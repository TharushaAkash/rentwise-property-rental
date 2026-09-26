import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../home/models/property_model.dart';
import '../../home/providers/property_provider.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/theme/app_theme.dart';
import '../property_service.dart';
import 'property_form_screen.dart';
import 'property_booking_screen.dart';

class PropertyDetailScreen extends ConsumerStatefulWidget {
  const PropertyDetailScreen({
    super.key,
    required this.property,
    this.aiResult,
  });
  final PropertyModel property;
  final dynamic aiResult;

  @override
  ConsumerState<PropertyDetailScreen> createState() =>
      _PropertyDetailScreenState();
}

class _PropertyDetailScreenState extends ConsumerState<PropertyDetailScreen> {
  bool _busy = false, _saved = false, _expanded = false;
  String? _error;
  int _photoIndex = 0;

  String get _savedKey =>
      'saved_properties_${ref.read(authStateProvider).value?.id}';

  @override
  void initState() {
    super.initState();
    _loadSaved();
  }

  Future<void> _loadSaved() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(
        () => _saved = (prefs.getStringList(_savedKey) ?? []).contains(
          widget.property.id,
        ),
      );
    }
  }

  Future<void> _saveFavorite() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ids = prefs.getStringList(_savedKey) ?? [];
      _saved ? ids.remove(widget.property.id) : ids.add(widget.property.id);
      await prefs.setStringList(_savedKey, ids);
      if (mounted) setState(() => _saved = !_saved);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  Future<void> _open(Uri uri) async {
    try {
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw Exception('Unable to open link.');
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  void _refresh() {
    ref.invalidate(propertyDetailsProvider(widget.property.id));
    ref.invalidate(verificationProvider(widget.property.id));
    ref.invalidate(managedPropertiesProvider);
    ref.invalidate(propertiesProvider);
  }

  Future<void> _action(
    String label,
    String method,
    String suffix, [
    Map<String, dynamic>? body,
  ]) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(label),
        content: Text(
          suffix.isEmpty
              ? 'Permanently delete this property? This cannot be undone.'
              : 'Apply this action to ${widget.property.title}?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(propertyServiceProvider)
          .request(method, '/properties/${widget.property.id}$suffix', body);
      _refresh();
      if (mounted && method == 'DELETE') Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _gallery(List<String> photos, int index) {
    final controller = PageController(initialPage: index);
    showDialog<void>(
      context: context,
      builder: (c) => Dialog.fullscreen(
        child: Scaffold(
          appBar: AppBar(
            title: const Text('Property Photos'),
            leading: IconButton(
              onPressed: () => Navigator.pop(c),
              icon: const Icon(Icons.close),
            ),
          ),
          body: PageView(
            controller: controller,
            children: photos
                .map(
                  (url) => InteractiveViewer(
                    child: Center(
                      child: Image.network(
                        url,
                        errorBuilder: (_, _, _) =>
                            const Icon(Icons.broken_image, size: 60),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
      ),
    ).then((_) => controller.dispose());
  }

  Widget _sectionCard(String title, IconData icon, List<Widget> children) =>
      Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.line),
          boxShadow: const [
            BoxShadow(
              color: Color(0x06000000),
              blurRadius: 8,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: AppColors.teal, size: 20),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: AppColors.ink,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final details = ref.watch(propertyDetailsProvider(widget.property.id));
    final p = details.value ?? widget.property;
    final user = ref.watch(authStateProvider).value;
    final admin = isAdmin(user?.role);
    final manage =
        admin ||
        (isOwner(user?.role) &&
            p.ownerId.toLowerCase() == user?.id.toLowerCase());
    final photos = p.photos.isNotEmpty
        ? p.photos
        : p.photoUrl.isNotEmpty
            ? [p.photoUrl]
            : <String>[];
    final apps = ref.watch(applicationsProvider);
    final booked =
        apps.value?.any(
          (a) =>
              a['propertyId'] == p.id &&
              ['Submitted', 'Pending', 'Accepted'].contains(a['status']),
        ) ??
        false;
    final owner = p.owner;

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: CustomScrollView(
        slivers: [
          // ── Hero Photo Carousel AppBar ────────────────────────────────
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            backgroundColor: Colors.white,
            leading: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                margin: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withAlpha(120),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_back_ios_rounded,
                    color: Colors.white, size: 18),
              ),
            ),
            actions: [
              GestureDetector(
                onTap: _saveFavorite,
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black.withAlpha(120),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                    color: _saved ? Colors.redAccent : Colors.white,
                    size: 20,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () async {
                  await Clipboard.setData(
                    ClipboardData(
                      text:
                          '${p.title}\n${p.address}\nLKR ${p.monthlyRent.toStringAsFixed(0)}/mo',
                    ),
                  );
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Copied property details!')),
                    );
                  }
                },
                child: Container(
                  margin: const EdgeInsets.only(right: 12),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black.withAlpha(120),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.share_rounded,
                      color: Colors.white, size: 20),
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                children: [
                  photos.isNotEmpty
                      ? InkWell(
                          onTap: () => _gallery(photos, _photoIndex),
                          child: Image.network(
                            photos[_photoIndex.clamp(0, photos.length - 1)],
                            width: double.infinity,
                            height: 320,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => Container(
                              color: AppColors.teal,
                              child: const Icon(Icons.apartment_rounded,
                                  size: 80, color: Colors.white38),
                            ),
                          ),
                        )
                      : Container(
                          color: AppColors.teal,
                          child: const Icon(Icons.apartment_rounded,
                              size: 80, color: Colors.white38),
                        ),
                  Positioned.fill(
                    child: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Colors.transparent, Color(0xCC000000)],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                      ),
                    ),
                  ),
                  if (photos.length > 1)
                    Positioned(
                      bottom: 12,
                      right: 16,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withAlpha(160),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${_photoIndex + 1} / ${photos.length}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // ── Main Content ──────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Photo thumbnails
                  if (photos.length > 1)
                    SizedBox(
                      height: 56,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: photos.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (_, i) => GestureDetector(
                          onTap: () => setState(() => _photoIndex = i),
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: i == _photoIndex
                                    ? AppColors.teal
                                    : Colors.transparent,
                                width: 2.5,
                              ),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                photos[i],
                                width: 70,
                                height: 50,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),

                  // Title & Address
                  Text(
                    p.title,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: AppColors.ink,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.location_on_rounded,
                          size: 16, color: AppColors.muted),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          p.address,
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Price Banner
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF005C27), Color(0xFF008037)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Monthly Rent',
                                style: TextStyle(
                                    color: Colors.white70, fontSize: 11)),
                            Text(
                              'LKR ${p.monthlyRent.toStringAsFixed(0).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withAlpha(30),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            p.propertyType,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Owner Management Controls (if owner/admin)
                  if (manage)
                    _sectionCard('Owner Management Access', Icons.admin_panel_settings_rounded, [
                      Wrap(
                        spacing: 8,
                        children: [
                          FilledButton.icon(
                            onPressed: _busy
                                ? null
                                : () => Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) =>
                                            PropertyFormScreen(property: p),
                                      ),
                                    ),
                            icon: const Icon(Icons.edit_rounded, size: 16),
                            label: const Text('Edit Listing Details'),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.teal,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                          OutlinedButton.icon(
                            onPressed: _busy
                                ? null
                                : () => _action('Delete Property', 'DELETE', ''),
                            icon: const Icon(Icons.delete_outline_rounded, size: 16),
                            label: const Text('Delete'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.red,
                              side: const BorderSide(color: Colors.red),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ]),

                  // Specs Grid
                  _sectionCard('Property Specs', Icons.space_dashboard_rounded, [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _SpecItem(Icons.bed_rounded, '${p.bedrooms} Beds'),
                        _SpecItem(Icons.bathtub_rounded, '${p.bathrooms} Baths'),
                        _SpecItem(Icons.square_foot_rounded, '${p.sqft} sqft'),
                      ],
                    ),
                  ]),

                  // Agentic AI Matching Insights (if came from search)
                  if (widget.aiResult != null)
                    _sectionCard('Agentic AI Matching Insights', Icons.auto_awesome_rounded, [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0F9FF),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFBAE6FD)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${widget.aiResult.distanceKm} km • ~${widget.aiResult.travelTimeMins} mins commute to ${widget.aiResult.destinationLandmark}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0369A1),
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 6),
                            ...widget.aiResult.matchReasons.map<Widget>(
                              (r) => Padding(
                                padding: const EdgeInsets.only(bottom: 2),
                                child: Text('• $r',
                                    style: const TextStyle(
                                        fontSize: 12, color: AppColors.ink)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ]),

                  // Description
                  _sectionCard('About Property', Icons.description_rounded, [
                    Text(
                      p.description,
                      maxLines: _expanded ? null : 4,
                      overflow: _expanded ? null : TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.ink, fontSize: 13, height: 1.5),
                    ),
                    if (p.description.length > 120)
                      TextButton(
                        onPressed: () => setState(() => _expanded = !_expanded),
                        child: Text(_expanded ? 'Show Less' : 'Read More'),
                      ),
                  ]),

                  // Facilities
                  _sectionCard('Facilities & Amenities', Icons.star_rounded, [
                    if (p.facilities.isEmpty)
                      const Text('Standard residential amenities.'),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: p.facilities
                          .map(
                            (f) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.softTeal,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.check_circle_rounded,
                                      color: AppColors.teal, size: 14),
                                  const SizedBox(width: 5),
                                  Text(
                                    f,
                                    style: const TextStyle(
                                      color: AppColors.teal,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ]),

                  // Owner Contact Card
                  _sectionCard('Landlord Details', Icons.person_rounded, [
                    Text(
                      '${owner['name'] ?? owner['Name'] ?? 'Verified Landlord'}',
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 14),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        if (owner['phoneNumber'] != null)
                          OutlinedButton.icon(
                            onPressed: () => _open(
                                Uri(scheme: 'tel', path: owner['phoneNumber'])),
                            icon: const Icon(Icons.phone_rounded, size: 16),
                            label: const Text('Call'),
                            style: OutlinedButton.styleFrom(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          ),
                        const SizedBox(width: 8),
                        if (owner['email'] != null)
                          OutlinedButton.icon(
                            onPressed: () => _open(
                                Uri(scheme: 'mailto', path: owner['email'])),
                            icon: const Icon(Icons.mail_outline_rounded, size: 16),
                            label: const Text('Email'),
                            style: OutlinedButton.styleFrom(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ]),

                  // View Location on Map
                  OutlinedButton.icon(
                    onPressed: () => _open(
                      Uri.https('www.google.com', '/maps/search/', {
                        'api': '1',
                        'query': p.address,
                      }),
                    ),
                    icon: const Icon(Icons.map_outlined),
                    label: const Text('View Location on Google Maps'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),

                  const SizedBox(height: 80),
                ],
              ),
            ),
          ),
        ],
      ),

      // Bottom Sticky Booking Button (Tenants)
      bottomNavigationBar: user?.role == 'Tenant' || user == null
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: FilledButton.icon(
                  onPressed: p.status != 'Active' || booked
                      ? null
                      : () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => PropertyBookingScreen(property: p),
                            ),
                          ),
                  icon: const Icon(Icons.calendar_today_rounded),
                  label: Text(
                    booked
                        ? 'Booking Pending / Leased'
                        : p.status != 'Active'
                            ? 'Listing Not Available'
                            : 'Submit Rental Booking Request',
                  ),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                    backgroundColor: const Color(0xFF16a34a),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    textStyle: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                ),
              ),
            )
          : null,
    );
  }
}

class _SpecItem extends StatelessWidget {
  final IconData icon;
  final String text;

  const _SpecItem(this.icon, this.text);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: AppColors.teal, size: 24),
        const SizedBox(height: 4),
        Text(
          text,
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 13,
            color: AppColors.ink,
          ),
        ),
      ],
    );
  }
}
