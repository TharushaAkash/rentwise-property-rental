import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/modern_ui.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';
import '../../home/models/property_model.dart';
import '../property_service.dart';
import 'property_form_screen.dart';
import 'property_detail_screen.dart';

class PropertiesDashboardScreen extends ConsumerStatefulWidget {
  const PropertiesDashboardScreen({super.key});
  @override
  ConsumerState<PropertiesDashboardScreen> createState() =>
      _PropertiesDashboardScreenState();
}

class _PropertiesDashboardScreenState
    extends ConsumerState<PropertiesDashboardScreen> {
  String _filter = 'All', _search = '';
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('My Properties'),
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: () => ref.invalidate(managedPropertiesProvider),
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const PropertyFormScreen()),
      ),
      icon: const Icon(Icons.add),
      label: const Text('Add Property'),
    ),
    body: ref
        .watch(managedPropertiesProvider)
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$e'),
                TextButton(
                  onPressed: () => ref.invalidate(managedPropertiesProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (properties) {
            final filtered = properties
                .where(
                  (p) =>
                      ('${p.title} ${p.address}').toLowerCase().contains(
                        _search.toLowerCase(),
                      ) &&
                      (_filter == 'All' ||
                          (_filter == 'Active'
                              ? p.status == 'Active'
                              : p.status != 'Active')),
                )
                .toList();
            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(managedPropertiesProvider);
                await ref.read(managedPropertiesProvider.future);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                children: [
                  const PageIntro(
                    eyebrow: 'Owner workspace',
                    title: 'Great spaces.\nNew possibilities.',
                    description: 'Manage your listings and keep your next rental moving.',
                  ),
                  const SizedBox(height: 20),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${properties.length} Properties Listed',
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          Text(
                            '${properties.where((p) => p.status == 'Active').length} Active by Admin',
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const PropertyFormScreen(),
                              ),
                            ),
                            icon: const Icon(Icons.tune),
                            label: const Text('Manage Details'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'Search title or address',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (s) => setState(() => _search = s),
                  ),
                  Wrap(
                    spacing: 8,
                    children: ['All', 'Active', 'Not Active']
                        .map(
                          (s) => ChoiceChip(
                            label: Text(s),
                            selected: _filter == s,
                            onSelected: (_) => setState(() => _filter = s),
                          ),
                        )
                        .toList(),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const PropertyBookingsScreen(),
                      ),
                    ),
                    icon: const Icon(Icons.people_outline),
                    label: const Text('Tenant Inquiries & Bookings'),
                  ),
                  if (filtered.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(32),
                      child: Text(
                        'No properties match this view. Add a listing or change your filters.',
                      ),
                    ),
                  for (final p in filtered)
                    Card(
                      clipBehavior: Clip.antiAlias,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (p.photoUrl.isNotEmpty)
                            Image.network(
                              p.photoUrl,
                              height: 170,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => const SizedBox(
                                height: 100,
                                child: Center(
                                  child: Icon(Icons.apartment, size: 48),
                                ),
                              ),
                            ),
                          ListTile(
                            title: Text(p.title),
                            subtitle: Text(
                              '${p.address}\nLKR ${p.monthlyRent.toStringAsFixed(0)} / month\n${p.bedrooms} Beds • ${p.bathrooms} Baths • ${p.sqft} sqft\n${p.status}',
                            ),
                            isThreeLine: false,
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    PropertyDetailScreen(property: p),
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Wrap(
                              spacing: 8,
                              children: [
                                TextButton.icon(
                                  onPressed: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          PropertyDetailScreen(property: p),
                                    ),
                                  ),
                                  icon: const Icon(Icons.visibility),
                                  label: const Text('Inspect Listing'),
                                ),
                                TextButton.icon(
                                  onPressed: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          PropertyFormScreen(property: p),
                                    ),
                                  ),
                                  icon: const Icon(Icons.edit),
                                  label: const Text('Edit Details'),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            );
          },
        ),
  );
}

class PropertyBookingsScreen extends ConsumerStatefulWidget {
  const PropertyBookingsScreen({super.key});
  @override
  ConsumerState<PropertyBookingsScreen> createState() =>
      _PropertyBookingsScreenState();
}

class _PropertyBookingsScreenState
    extends ConsumerState<PropertyBookingsScreen> {
  String _filter = 'All';
  String? _busy, _error;
  Future<void> _sample(List<PropertyModel> properties) async {
    final selected = await showDialog<PropertyModel>(
      context: context,
      builder: (c) => SimpleDialog(
        title: const Text('Create Sample Booking'),
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Choose a property for a clearly marked demo inquiry. This creates a booking request on the server.',
            ),
          ),
          for (final p in properties)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(c, p),
              child: Text(p.title),
            ),
          SimpleDialogOption(
            onPressed: () => Navigator.pop(c),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
    if (selected == null || !mounted) return;
    setState(() => _busy = 'sample');
    try {
      final start = DateTime.now()
          .add(const Duration(days: 7))
          .toIso8601String()
          .split('T')
          .first;
      await ref.read(propertyServiceProvider).request(
        'POST',
        '/property-applications',
        {
          'propertyId': selected.id,
          'propertyTitle': selected.title,
          'propertyAddress': selected.address,
          'monthlyRent': selected.monthlyRent,
          'durationMonths': 6,
          'startDate': start,
          'tenantId': 'demo-${DateTime.now().millisecondsSinceEpoch}',
          'tenantName': 'Demo Tenant',
          'tenantEmail': 'demo@example.com',
          'status': 'Submitted',
          'message': 'DEMO BOOKING: Sample inquiry for testing. Decline this request after reviewing.',
        },
      );
      ref.invalidate(applicationsProvider);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _act(Map<String, dynamic> app, String action) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(
          action == 'confirm' ? 'Confirm Booking?' : 'Decline Booking?',
        ),
        content: Text('${app['propertyTitle']} — ${app['tenantName']}'),
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
    if (confirmed != true || !mounted) return;
    setState(() {
      _busy = app['id'];
      _error = null;
    });
    try {
      await ref
          .read(propertyServiceProvider)
          .request('POST', '/property-applications/${app['id']}/$action');
      ref.invalidate(applicationsProvider);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).value;
    final manager = isOwner(user?.role) || isAdmin(user?.role);
    final owned = manager ? ref.watch(managedPropertiesProvider) : null;
    return Scaffold(
      appBar: AppBar(
        title: Text(manager ? 'Tenant Inquiries & Bookings' : 'My Bookings'),
        actions: [
          IconButton(
            tooltip: 'Refresh bookings',
            onPressed: () => ref.invalidate(applicationsProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: ref
          .watch(applicationsProvider)
          .when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: TextButton(
                onPressed: () => ref.invalidate(applicationsProvider),
                child: Text('$e\nRetry'),
              ),
            ),
            data: (apps) {
              if (owned?.isLoading == true) {
                return const Center(child: CircularProgressIndicator());
              }
              if (owned?.hasError == true) {
                return Center(
                  child: TextButton(
                    onPressed: () => ref.invalidate(managedPropertiesProvider),
                    child: const Text('Could not load your properties. Retry'),
                  ),
                );
              }
              final ids = owned?.value?.map((p) => p.id).toSet() ?? <String>{};
              final visible = apps
                  .where(
                    (a) =>
                        (manager
                            ? isAdmin(user?.role) ||
                                  ids.contains(a['propertyId'])
                            : a['tenantId'] == user?.id) &&
                        (_filter == 'All' || a['status'] == _filter),
                  )
                  .toList();
              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(applicationsProvider);
                  await ref.read(applicationsProvider.future);
                },
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    PageIntro(
                      eyebrow: manager
                          ? 'Rental requests'
                          : 'Your rental journey',
                      title: manager
                          ? 'Meet your next tenant.'
                          : 'Your next move,\nin one place.',
                      description: manager
                          ? 'Review requests and keep applicants up to date.'
                          : 'Follow your requests from first interest to a new home.',
                      icon: Icons.calendar_month_outlined,
                    ),
                    const SizedBox(height: 24),
                    const FormHeading(
                      'Booking activity',
                      'Filter your requests by their current status.',
                      icon: Icons.timelapse_rounded,
                    ),
                    if (manager)
                      OutlinedButton.icon(
                        onPressed:
                            _busy != null || (owned?.value?.isEmpty ?? true)
                            ? null
                            : () => _sample(owned!.value!),
                        icon: const Icon(Icons.science_outlined),
                        label: const Text('Create Sample Booking'),
                      ),
                    Wrap(
                      spacing: 6,
                      children: ['All', 'Submitted', 'Accepted', 'Rejected']
                          .map(
                            (s) => ChoiceChip(
                              label: Text(s),
                              selected: _filter == s,
                              onSelected: (_) => setState(() => _filter = s),
                            ),
                          )
                          .toList(),
                    ),
                    if (_error != null)
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                    if (visible.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(32),
                        child: Text('No booking requests in this view.'),
                      ),
                    for (final a in visible)
                      Card(
                        margin: const EdgeInsets.only(top: 14),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${a['propertyTitle'] ?? 'Property'}',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '${a['propertyAddress'] ?? ''}',
                                style: const TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 12,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Chip(
                                avatar: Icon(
                                  a['status'] == 'Accepted'
                                      ? Icons.check_circle_outline
                                      : Icons.schedule,
                                  size: 16,
                                ),
                                backgroundColor: a['status'] == 'Accepted'
                                    ? AppColors.softTeal
                                    : const Color(0xFFFFF5E4),
                                label: Text('${a['status']}'),
                              ),
                              const Divider(),
                              Text(
                                '${a['tenantName'] ?? ''}\n${a['tenantEmail'] ?? ''}',
                              ),
                              Text(
                                '${a['durationMonths'] ?? '—'} months • LKR ${a['monthlyRent'] ?? '—'} / month',
                              ),
                              Text(
                                'Move in: ${a['startDate'] ?? '—'}\nEnd: ${a['endDate'] ?? '—'}',
                              ),
                              const SizedBox(height: 12),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.canvas,
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Text(
                                  '${a['message'] ?? ''}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 12,
                                    height: 1.5,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              if (manager &&
                                  [
                                    'Submitted',
                                    'Pending',
                                  ].contains(a['status']))
                                Wrap(
                                  spacing: 8,
                                  children: [
                                    FilledButton(
                                      onPressed: _busy != null
                                          ? null
                                          : () => _act(a, 'confirm'),
                                      child: Text(
                                        _busy == a['id']
                                            ? 'Saving...'
                                            : 'Confirm Booking',
                                      ),
                                    ),
                                    OutlinedButton(
                                      onPressed: _busy != null
                                          ? null
                                          : () => _act(a, 'reject'),
                                      child: const Text('Decline'),
                                    ),
                                  ],
                                ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
    );
  }
}
