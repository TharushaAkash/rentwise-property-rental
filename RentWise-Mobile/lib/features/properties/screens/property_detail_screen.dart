import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../home/models/property_model.dart';
import '../../home/providers/property_provider.dart';
import '../../auth/providers/auth_provider.dart';
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
  int _photo = 0;
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
        throw Exception('Unable to open this link.');
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

  Future<void> _fee() async {
    final reference = TextEditingController();
    String method = 'Card';
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, update) => AlertDialog(
          title: const Text('Listing Verification Fee'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'LKR 2,500\nSubmit your listing fee payment record for admin review.',
                ),
                DropdownButtonFormField<String>(
                  initialValue: method,
                  items: ['Card', 'Bank Transfer']
                      .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                      .toList(),
                  onChanged: (m) => update(() => method = m!),
                ),
                TextField(
                  controller: reference,
                  decoration: const InputDecoration(
                    labelText: 'Payment reference (optional)',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, {
                'amount': 2500,
                'paymentMethod': method,
                'paymentReference': reference.text.trim(),
              }),
              child: const Text('Submit Fee'),
            ),
          ],
        ),
      ),
    );
    reference.dispose();
    if (result == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(propertyServiceProvider)
          .request(
            'POST',
            '/properties/${widget.property.id}/listing-fee',
            result,
          );
      _refresh();
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
              tooltip: 'Close gallery',
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
          bottomNavigationBar: SafeArea(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                TextButton(
                  onPressed: () => controller.previousPage(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeInOut,
                  ),
                  child: const Text('Previous'),
                ),
                TextButton(
                  onPressed: () => controller.nextPage(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeInOut,
                  ),
                  child: const Text('Next'),
                ),
              ],
            ),
          ),
        ),
      ),
    ).then((_) => controller.dispose());
  }

  Widget _section(String title, List<Widget> children) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
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
    final verification = manage ? ref.watch(verificationProvider(p.id)) : null;
    final owner = p.owner;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Property Details'),
        actions: [
          IconButton(
            tooltip: _saved ? 'Unsave Property' : 'Save Property',
            onPressed: _saveFavorite,
            icon: Icon(_saved ? Icons.favorite : Icons.favorite_border),
          ),
          IconButton(
            tooltip: 'Share: copy property link',
            onPressed: () async {
              await Clipboard.setData(
                ClipboardData(
                  text:
                      '${p.title}\n${p.address}\nLKR ${p.monthlyRent.toStringAsFixed(0)} / month\nProperty ID: ${p.id}',
                ),
              );
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Property details copied for sharing'),
                  ),
                );
              }
            },
            icon: const Icon(Icons.share),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          _refresh();
          await ref.read(propertyDetailsProvider(p.id).future);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (details.isLoading) const LinearProgressIndicator(),
            if (details.hasError)
              TextButton(
                onPressed: _refresh,
                child: const Text('Could not refresh listing. Retry'),
              ),
            if (_error != null)
              MaterialBanner(
                content: Text(_error!),
                actions: [
                  TextButton(
                    onPressed: () => setState(() => _error = null),
                    child: const Text('Dismiss'),
                  ),
                ],
              ),
            if (_busy) const LinearProgressIndicator(),
            if (manage)
              _section(
                admin
                    ? 'Administrator Platform Oversight'
                    : 'Owner Management Access',
                [
                  Wrap(
                    spacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: _busy
                            ? null
                            : () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) =>
                                      PropertyFormScreen(property: p),
                                ),
                              ),
                        icon: const Icon(Icons.edit),
                        label: const Text('Edit Details / Attach Bill'),
                      ),
                      TextButton.icon(
                        onPressed: _busy
                            ? null
                            : () => _action('Delete Property', 'DELETE', ''),
                        icon: const Icon(Icons.delete_outline),
                        label: const Text('Delete Property'),
                      ),
                      if (admin) ...[
                        FilledButton(
                          onPressed: _busy
                              ? null
                              : () => _action(
                                  'Approve & Activate',
                                  'PUT',
                                  '/approve',
                                  {},
                                ),
                          child: const Text('Approve & Activate'),
                        ),
                        OutlinedButton(
                          onPressed: _busy
                              ? null
                              : () => _action(
                                  'Suspend Listing',
                                  'PUT',
                                  '/reject',
                                  {},
                                ),
                          child: const Text('Suspend'),
                        ),
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => _action(
                                  'Mark Pending',
                                  'PUT',
                                  '/status',
                                  {'status': 0},
                                ),
                          child: const Text('Mark Pending'),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            if (photos.isEmpty)
              const SizedBox(
                height: 180,
                child: Center(child: Icon(Icons.apartment, size: 80)),
              )
            else ...[
              InkWell(
                onTap: () =>
                    _gallery(photos, _photo.clamp(0, photos.length - 1)),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Image.network(
                    photos[_photo.clamp(0, photos.length - 1)],
                    height: 240,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox(
                      height: 240,
                      child: Icon(Icons.broken_image, size: 60),
                    ),
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: () =>
                    _gallery(photos, _photo.clamp(0, photos.length - 1)),
                icon: const Icon(Icons.fullscreen),
                label: Text('View All ${photos.length} Photos'),
              ),
              SizedBox(
                height: 65,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: photos.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => InkWell(
                    onTap: () => setState(() => _photo = i),
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: i == _photo ? Colors.green : Colors.grey,
                          width: 2,
                        ),
                      ),
                      child: Image.network(
                        photos[i],
                        width: 80,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) =>
                            const Icon(Icons.broken_image),
                      ),
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Text(p.title, style: Theme.of(context).textTheme.headlineSmall),
            Text(p.address),
            Wrap(
              spacing: 8,
              children: [
                Chip(label: Text(p.status)),
                Chip(label: Text(p.propertyType)),
                if (booked) const Chip(label: Text('Booking Pending / Leased')),
              ],
            ),
            Text(
              'LKR ${p.monthlyRent.toStringAsFixed(0)} / month',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            _section('Property Overview', [
              Wrap(
                spacing: 20,
                runSpacing: 12,
                children: [
                  Text('${p.bedrooms} Bedrooms'),
                  Text('${p.bathrooms} Bathrooms'),
                  Text('${p.sqft} sqft'),
                ],
              ),
              const SizedBox(height: 12),
              SelectableText('Listing ID: ${p.id}'),
              if (p.raw['createdAt'] != null)
                Text(
                  'Listed: ${p.raw['createdAt'].toString().split('T').first}',
                ),
              if (p.raw['updatedAt'] != null)
                Text(
                  'Updated: ${p.raw['updatedAt'].toString().split('T').first}',
                ),
            ]),
            _section('About This Property', [
              Text(
                p.description,
                maxLines: _expanded ? null : 4,
                overflow: _expanded ? null : TextOverflow.ellipsis,
              ),
              TextButton(
                onPressed: () => setState(() => _expanded = !_expanded),
                child: Text(_expanded ? 'Show Less' : 'Read More'),
              ),
            ]),
            _section('Facilities & Amenities', [
              if (p.facilities.isEmpty) const Text('No facilities specified.'),
              Wrap(
                spacing: 6,
                children: p.facilities
                    .map(
                      (f) => Chip(
                        avatar: const Icon(Icons.check, size: 16),
                        label: Text(f),
                      ),
                    )
                    .toList(),
              ),
            ]),
            if (p.featureTags.isNotEmpty)
              _section('Feature Tags & Highlights', [
                Wrap(
                  spacing: 6,
                  children: p.featureTags
                      .map((t) => Chip(label: Text(t)))
                      .toList(),
                ),
              ]),
            if (widget.aiResult != null)
              _section('Agentic AI Matching Insights', [
                Text(
                  '${widget.aiResult.distanceKm} km • ~${widget.aiResult.travelTimeMins} mins to ${widget.aiResult.destinationLandmark}',
                ),
                ...widget.aiResult.matchReasons.map<Widget>(
                  (r) => Text('• $r'),
                ),
              ]),
            _section('Property Owner', [
              Text('${owner['name'] ?? owner['Name'] ?? 'Property Owner'}'),
              if (owner['phoneNumber'] != null)
                TextButton.icon(
                  onPressed: () =>
                      _open(Uri(scheme: 'tel', path: owner['phoneNumber'])),
                  icon: const Icon(Icons.phone),
                  label: Text('${owner['phoneNumber']}'),
                ),
              if (owner['email'] != null)
                TextButton.icon(
                  onPressed: () =>
                      _open(Uri(scheme: 'mailto', path: owner['email'])),
                  icon: const Icon(Icons.mail_outline),
                  label: Text('${owner['email']}'),
                ),
            ]),
            OutlinedButton.icon(
              onPressed: () => _open(
                Uri.https('www.google.com', '/maps/search/', {
                  'api': '1',
                  'query': p.address,
                }),
              ),
              icon: const Icon(Icons.map_outlined),
              label: const Text('View Location on Map'),
            ),
            if (verification != null)
              verification.when(
                loading: () => const LinearProgressIndicator(),
                error: (e, _) => TextButton(
                  onPressed: () => ref.invalidate(verificationProvider(p.id)),
                  child: Text('Verification unavailable: $e. Retry'),
                ),
                data: (v) => _section('Listing Inspection & Verification', [
                  Text(
                    v['isApproved'] == true
                        ? 'Approved • Live on Marketplace'
                        : 'Awaiting verification / admin review',
                  ),
                  Text(
                    v['isFeePaid'] == true
                        ? 'Listing fee recorded'
                        : 'Listing fee not recorded',
                  ),
                  for (final doc in v['documents'] as List? ?? [])
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.description_outlined),
                      title: Text('${doc['documentType']}'),
                      trailing: const Icon(Icons.open_in_new),
                      onTap: () => _open(Uri.parse(doc['documentUrl'])),
                    ),
                  if ((v['documents'] as List? ?? []).isEmpty)
                    const Text(
                      'No ownership documents attached. Use Edit Details to attach a bill.',
                    ),
                  for (final record in v['verifications'] as List? ?? [])
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text('${record['comments'] ?? ''}'),
                      subtitle: Text('${record['agentReport'] ?? ''}'),
                    ),
                  if (v['isFeePaid'] != true)
                    FilledButton(
                      onPressed: _busy ? null : _fee,
                      child: const Text('Submit Listing Fee • LKR 2,500'),
                    ),
                ]),
              ),
            if (!manage)
              _section('Utility Bill / Ownership Verification', [
                Text(
                  p.status == 'Active'
                      ? 'Listing approved'
                      : 'Awaiting verification',
                ),
                for (final doc in p.raw['documents'] as List? ?? [])
                  ListTile(
                    leading: const Icon(Icons.description_outlined),
                    title: Text('${doc['documentType'] ?? 'Document'}'),
                    trailing: const Icon(Icons.open_in_new),
                    onTap: () => _open(Uri.parse(doc['documentUrl'])),
                  ),
                if ((p.raw['documents'] as List? ?? []).isEmpty)
                  const Text('No utility document attached.'),
              ]),
            if (manage)
              _section('Connected Booking Requests', [
                if (apps.isLoading) const LinearProgressIndicator(),
                if (apps.hasError)
                  TextButton(
                    onPressed: () => ref.invalidate(applicationsProvider),
                    child: const Text('Could not load bookings. Retry'),
                  ),
                for (final a in apps.value ?? <Map<String, dynamic>>[])
                  if (a['propertyId'] == p.id)
                    ListTile(
                      title: Text(
                        '${a['tenantName'] ?? 'Tenant'} • ${a['status']}',
                      ),
                      subtitle: Text(
                        '${a['tenantEmail'] ?? ''}\n${a['message'] ?? ''}',
                      ),
                    ),
              ]),
          ],
        ),
      ),
      bottomNavigationBar: user?.role == 'Tenant'
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: FilledButton(
                  onPressed:
                      p.status != 'Active' ||
                          booked ||
                          apps.isLoading ||
                          apps.hasError
                      ? null
                      : () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PropertyBookingScreen(property: p),
                          ),
                        ),
                  child: Text(
                    apps.hasError
                        ? 'Refresh to check availability'
                        : booked
                        ? 'Booking Pending / Leased'
                        : p.status != 'Active'
                        ? 'Listing Not Available'
                        : 'Book Property Now',
                  ),
                ),
              ),
            )
          : null,
    );
  }
}
