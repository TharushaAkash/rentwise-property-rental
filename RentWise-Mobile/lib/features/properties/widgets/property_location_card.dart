import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../home/models/property_model.dart';
import '../../shared/theme/app_theme.dart';

class PropertyLocationCard extends StatefulWidget {
  final PropertyModel property;
  const PropertyLocationCard({super.key, required this.property});
  @override
  State<PropertyLocationCard> createState() => _PropertyLocationCardState();
}

class _PropertyLocationCardState extends State<PropertyLocationCard> {
  LatLng? _point;
  bool _loading = false;
  bool _approximate = true;
  String? _error;
  static DateTime? _lastLookup;

  @override
  void initState() {
    super.initState();
    final raw = widget.property.raw;
    final lat = double.tryParse('${raw['latitude'] ?? raw['Latitude'] ?? ''}');
    final lon = double.tryParse(
      '${raw['longitude'] ?? raw['Longitude'] ?? ''}',
    );
    if (lat != null &&
        lon != null &&
        lat.isFinite &&
        lon.isFinite &&
        lat.abs() <= 90 &&
        lon.abs() <= 180) {
      _point = LatLng(lat, lon);
      _approximate = false;
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _locate();
      });
    }
  }

  Future<void> _locate() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final address = widget.property.address.trim();
      if (address.isEmpty) throw Exception('No property address is available.');
      final prefs = await SharedPreferences.getInstance();
      final key = 'rentwise_map_address:${Uri.encodeComponent(address)}';
      final cached = prefs.getString(key);
      List<dynamic> results;
      if (cached != null) {
        results = jsonDecode(cached) as List;
      } else {
        final previousLookup = _lastLookup;
        final now = DateTime.now();
        final nextLookup =
            previousLookup != null &&
                now.difference(previousLookup) < const Duration(seconds: 1)
            ? previousLookup.add(const Duration(seconds: 1))
            : now;
        _lastLookup = nextLookup;
        if (nextLookup.isAfter(now))
          await Future<void>.delayed(nextLookup.difference(now));
        if (!mounted) return;
        const host = String.fromEnvironment(
          'MAP_GEOCODER_HOST',
          defaultValue: 'nominatim.openstreetmap.org',
        );
        final response = await http
            .get(
              Uri.https(host, '/search', {
                'q': address,
                'format': 'jsonv2',
                'countrycodes': 'lk',
                'limit': '2',
              }),
              headers: {
                'User-Agent': 'RentWise-Mobile/1.0 (property location preview)',
                'Accept': 'application/json',
              },
            )
            .timeout(const Duration(seconds: 15));
        if (response.statusCode != 200)
          throw Exception('Map lookup is unavailable. Please try again later.');
        results = jsonDecode(response.body) as List;
        if (results.isNotEmpty) await prefs.setString(key, jsonEncode(results));
      }
      if (results.isEmpty) {
        throw Exception(
          'No map location was found for this address. Use Google Maps below or ask the landlord for the exact location.',
        );
      }
      // No reference coordinate exists for a nearest-distance calculation.
      // Use the geocoder's top ranked address match as an approximate location.
      final selected = results.first as Map;
      final point = LatLng(
        double.parse('${selected['lat']}'),
        double.parse('${selected['lon']}'),
      );
      if (!mounted) return;
      setState(() => _point = point);
    } catch (error) {
      if (mounted)
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _map(LatLng point) => FlutterMap(
    options: MapOptions(
      initialCenter: point,
      initialZoom: 15,
      interactionOptions: const InteractionOptions(
        flags:
            InteractiveFlag.drag |
            InteractiveFlag.pinchZoom |
            InteractiveFlag.doubleTapZoom,
      ),
    ),
    children: [
      TileLayer(
        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        userAgentPackageName: 'com.rentwise.mobile',
      ),
      MarkerLayer(
        markers: [
          Marker(
            point: point,
            width: 44,
            height: 44,
            child: const Icon(
              Icons.location_on,
              size: 40,
              color: AppColors.rose,
            ),
          ),
        ],
      ),
      Align(
        alignment: Alignment.bottomRight,
        child: Material(
          color: Colors.white,
          child: InkWell(
            onTap: () => launchUrl(
              Uri.parse('https://www.openstreetmap.org/copyright'),
              mode: LaunchMode.externalApplication,
            ),
            child: const Padding(
              padding: EdgeInsets.all(5),
              child: Text(
                '\u00a9 OpenStreetMap contributors',
                style: TextStyle(fontSize: 10, color: AppColors.ink),
              ),
            ),
          ),
        ),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.surface,
      border: Border.all(color: AppColors.line),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Location',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(
          widget.property.address,
          style: const TextStyle(fontSize: 12, color: AppColors.muted),
        ),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            height: 190,
            width: double.infinity,
            child: _point != null
                ? _map(_point!)
                : ColoredBox(
                    color: AppColors.softTeal,
                    child: Center(
                      child: _loading
                          ? const CircularProgressIndicator()
                          : Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.map_outlined, size: 36),
                                TextButton(
                                  onPressed: _locate,
                                  child: const Text('Show location on map'),
                                ),
                              ],
                            ),
                    ),
                  ),
          ),
        ),
        if (_point != null) ...[
          const SizedBox(height: 8),
          Text(
            _approximate
                ? 'Address-based map match. Confirm the exact property location with the landlord.'
                : 'Property location',
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
          TextButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => Scaffold(
                  appBar: AppBar(title: const Text('Property location')),
                  body: _map(_point!),
                ),
              ),
            ),
            icon: const Icon(Icons.fullscreen),
            label: const Text('Expand map'),
          ),
        ],
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _error!,
              style: const TextStyle(fontSize: 12, color: AppColors.rose),
            ),
          ),
      ],
    ),
  );
}
