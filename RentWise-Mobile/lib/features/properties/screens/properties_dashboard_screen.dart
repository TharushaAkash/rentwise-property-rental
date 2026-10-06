import '../../auth/providers/auth_provider.dart';
import 'listing_status_screen.dart';

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../shared/theme/app_theme.dart';
import '../../home/models/property_model.dart';
import '../../rentals/providers/rental_provider.dart';
import '../property_service.dart';
import 'property_form_screen.dart';

class PropertiesDashboardScreen extends ConsumerStatefulWidget {
  const PropertiesDashboardScreen({super.key});

  @override
  ConsumerState<PropertiesDashboardScreen> createState() =>
      _PropertiesDashboardScreenState();
}

class _PropertiesDashboardScreenState
    extends ConsumerState<PropertiesDashboardScreen> {
  String _filter = 'All';
  String _search = '';

  void _inspectProperty(PropertyModel p) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (c) => _PropertyInspectSheet(property: p),
    );
  }

  @override
  Widget build(BuildContext context) {
    final propertiesAsync = ref.watch(managedPropertiesProvider);

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        title: const Text(
          'My Properties',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Refresh Properties',
            onPressed: () => ref.invalidate(managedPropertiesProvider),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const PropertyFormScreen()),
        ),
        backgroundColor: AppColors.ink,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text(
          'Add Property',
          style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
        ),
      ),
      body: propertiesAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.teal),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.cloud_off_rounded,
                size: 48,
                color: AppColors.muted,
              ),
              const SizedBox(height: 12),
              Text('Failed to load properties: $e'),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => ref.invalidate(managedPropertiesProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (properties) {
          final filtered = properties.where((p) {
            final matchesSearch = ('${p.title} ${p.address}')
                .toLowerCase()
                .contains(_search.toLowerCase());
            final matchesFilter =
                _filter == 'All' ||
                (_filter == 'Active'
                    ? p.status == 'Active'
                    : p.status != 'Active');
            return matchesSearch && matchesFilter;
          }).toList();

          final activeCount = properties
              .where((p) => p.status == 'Active')
              .length;

          return RefreshIndicator(
            color: AppColors.teal,
            onRefresh: () async {
              ref.invalidate(managedPropertiesProvider);
              await ref.read(managedPropertiesProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
              children: [
                // Owner Workspace Hero Banner
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.softTeal,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.line.withAlpha(80),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'OWNER WORKSPACE',
                        style: TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${properties.length} Properties Listed',
                        style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '$activeCount Active on Marketplace',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Search Bar
                TextField(
                  onChanged: (s) => setState(() => _search = s),
                  decoration: InputDecoration(
                    hintText: 'Search title or address...',
                    prefixIcon: const Icon(
                      Icons.search_rounded,
                      color: AppColors.muted,
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Filter Chips
                Row(
                  children: ['All', 'Active', 'Pending'].map((s) {
                    final selected = _filter == s;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(s),
                        selected: selected,
                        selectedColor: AppColors.softTeal,
                        labelStyle: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: selected ? AppColors.teal : AppColors.muted,
                        ),
                        onSelected: (_) => setState(() => _filter = s),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),

                if (filtered.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(
                      child: Text(
                        'No properties found. Tap "Add Property" to create a new listing.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted),
                      ),
                    ),
                  ),

                // Property Cards
                ...filtered.map(
                  (p) => _OwnerPropertyCard(
                    property: p,
                    onInspect: () => _inspectProperty(p),
                    onListingStatus: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ListingStatusScreen(propertyId: p.id),
                      ),
                    ),
                    onEdit: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => PropertyFormScreen(property: p),
                      ),
                    ).then((_) => ref.invalidate(managedPropertiesProvider)),
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

// ─────────────────────────────────────────────────────────────────────────────
// Owner Property Card
// ─────────────────────────────────────────────────────────────────────────────
class _OwnerPropertyCard extends StatelessWidget {
  final PropertyModel property;
  final VoidCallback onInspect;
  final VoidCallback onEdit;
  final VoidCallback onListingStatus;

  const _OwnerPropertyCard({
    required this.property,
    required this.onInspect,
    required this.onEdit,
    required this.onListingStatus,
  });

  @override
  Widget build(BuildContext context) {
    final active = property.status == 'Active';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner photo
          Stack(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(20),
                ),
                child: property.photoUrl.isNotEmpty
                    ? Image.network(
                        property.photoUrl,
                        height: 160,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Container(
                          height: 160,
                          color: Colors.grey.shade200,
                          child: const Icon(
                            Icons.apartment_rounded,
                            size: 48,
                            color: AppColors.muted,
                          ),
                        ),
                      )
                    : Container(
                        height: 160,
                        color: Colors.grey.shade200,
                        child: const Icon(
                          Icons.apartment_rounded,
                          size: 48,
                          color: AppColors.muted,
                        ),
                      ),
              ),
              Positioned(
                top: 12,
                left: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: active ? AppColors.teal : Colors.amber.shade700,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        active
                            ? Icons.check_circle_rounded
                            : Icons.schedule_rounded,
                        color: Colors.white,
                        size: 13,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        active ? 'Active Listing' : 'Pending Verification',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  property.title,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(
                      Icons.location_on_rounded,
                      size: 14,
                      color: AppColors.muted,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        property.address,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Price & Specs Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'LKR ${property.monthlyRent.toStringAsFixed(0).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}/mo',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: AppColors.teal,
                      ),
                    ),
                    Text(
                      '${property.bedrooms} Beds • ${property.bathrooms} Baths • ${property.sqft} sqft',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const Divider(height: 1, color: AppColors.line),
                const SizedBox(height: 12),

                TextButton.icon(
                  onPressed: onListingStatus,
                  icon: const Icon(Icons.verified_outlined),
                  label: const Text('Verification & listing fee'),
                ),
                // Distinct Action Buttons: Inspect Listing vs Edit Details
                Row(
                  children: [
                    // Inspect Listing
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onInspect,
                        icon: const Icon(Icons.visibility_outlined, size: 16),
                        label: const Text('Inspect Listing'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.ink,
                          side: const BorderSide(color: AppColors.line),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),

                    // Edit Details
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: onEdit,
                        icon: const Icon(Icons.edit_rounded, size: 16),
                        label: const Text('Edit Details'),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.ink,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Inspection Preview Sheet
// ─────────────────────────────────────────────────────────────────────────────
class _PropertyInspectSheet extends StatelessWidget {
  final PropertyModel property;

  const _PropertyInspectSheet({required this.property});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Listing Inspection Preview',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: property.photoUrl.isNotEmpty
                      ? Image.network(
                          property.photoUrl,
                          height: 200,
                          width: double.infinity,
                          fit: BoxFit.cover,
                        )
                      : Container(
                          height: 200,
                          color: AppColors.canvas,
                          child: const Icon(Icons.apartment_rounded, size: 60),
                        ),
                ),
                const SizedBox(height: 16),
                Text(
                  property.title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  property.address,
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.softTeal,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Monthly Rent Value',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: AppColors.teal,
                        ),
                      ),
                      Text(
                        'LKR ${property.monthlyRent.toStringAsFixed(0).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 18,
                          color: AppColors.teal,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _InspectSpec('Bedrooms', '${property.bedrooms} Beds'),
                    _InspectSpec('Bathrooms', '${property.bathrooms} Baths'),
                    _InspectSpec('Area', '${property.sqft} sqft'),
                  ],
                ),
                const Divider(height: 30),
                const Text(
                  'Description',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
                const SizedBox(height: 6),
                Text(
                  property.description.isNotEmpty
                      ? property.description
                      : 'No description provided.',
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Facilities',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  children: property.facilities
                      .map(
                        (f) => Chip(
                          avatar: const Icon(Icons.check, size: 14),
                          label: Text(f, style: const TextStyle(fontSize: 11)),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              PropertyFormScreen(property: property),
                        ),
                      );
                    },
                    icon: const Icon(Icons.edit_rounded),
                    label: const Text('Edit Property Details'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.ink,
                      minimumSize: const Size.fromHeight(50),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InspectSpec extends StatelessWidget {
  final String label;
  final String value;

  const _InspectSpec(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(color: AppColors.muted, fontSize: 11),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 14,
            color: AppColors.ink,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner Tenants Tab: Inquiries, Applications & Active Leases
// ─────────────────────────────────────────────────────────────────────────────
class PropertyBookingsScreen extends ConsumerStatefulWidget {
  const PropertyBookingsScreen({super.key});

  @override
  ConsumerState<PropertyBookingsScreen> createState() =>
      _PropertyBookingsScreenState();
}

class _PropertyBookingsScreenState extends ConsumerState<PropertyBookingsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    final role = ref.read(authStateProvider).value?.role;
    _tabController = TabController(
      length: isOwner(role) || isAdmin(role) ? 2 : 1,
      vsync: this,
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _deleteRequest(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Delete agreement request?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    try {
      await ref
          .read(propertyServiceProvider)
          .request('DELETE', '/property-applications/$id');
      ref.invalidate(applicationsProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _handleAction(
    String appId,
    String action,
    String propTitle,
    String tenantName,
    double rent,
  ) async {
    final api = ref.read(propertyServiceProvider);
    try {
      await api.request('POST', '/property-applications/$appId/$action');

      if (action == 'confirm') {
        // Auto-generate a 6-month lease agreement for the tenant on SharedPreferences
        final prefs = await SharedPreferences.getInstance();
        final rawAgreements = prefs.getString('rentwise_client_agreements');
        List<dynamic> list = [];
        if (rawAgreements != null && rawAgreements.isNotEmpty) {
          try {
            list = jsonDecode(rawAgreements);
          } catch (_) {}
        }

        final now = DateTime.now();
        final end = DateTime(now.year, now.month + 6, now.day);
        final newAgreement = {
          'id': 'agr_$appId',
          'propertyId': 'prop_$appId',
          'ownerId': 'owner_demo',
          'propertyTitle': propTitle,
          'propertyAddress': 'Sri Lanka',
          'tenantName': tenantName,
          'monthlyRent': rent,
          'agreedMonthlyRent': rent,
          'securityDeposit': rent * 2,
          'startDate': now.toIso8601String().split('T')[0],
          'endDate': end.toIso8601String().split('T')[0],
          'status': 'Drafted',
          'termsAndConditions':
              '[6-Month Lease Issued on ${now.toString().split(' ')[0]}]\nPlease review house photos and terms, then click Review & Sign to proceed.',
        };

        list.insert(0, newAgreement);
        await prefs.setString('rentwise_client_agreements', jsonEncode(list));
      }

      ref.invalidate(applicationsProvider);
      ref.invalidate(agreementsProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              action == 'confirm'
                  ? 'Booking accepted! 6-month lease issued to $tenantName.'
                  : 'Booking request declined.',
            ),
            backgroundColor: action == 'confirm'
                ? AppColors.teal
                : Colors.red.shade700,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Action failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authStateProvider).value?.role;
    final canManage = isOwner(role) || isAdmin(role);
    final appsAsync = ref.watch(applicationsProvider);
    final agreementsAsync = canManage ? ref.watch(agreementsProvider) : null;

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        title: Text(
          canManage ? 'Tenant bookings' : 'My bookings',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: AppColors.canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.teal,
          unselectedLabelColor: AppColors.muted,
          indicatorColor: AppColors.lime,
          indicatorWeight: 3,
          labelStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
          tabs: [
            const Tab(text: 'Bookings'),
            if (canManage) const Tab(text: 'Active Leases'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // TAB 1: Inquiries & Applications
          appsAsync.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: AppColors.teal),
            ),
            error: (e, _) => Center(child: Text('Error: $e')),
            data: (apps) {
              if (apps.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text(
                      'No pending tenant inquiries or booking applications.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted),
                    ),
                  ),
                );
              }

              return RefreshIndicator(
                color: AppColors.teal,
                onRefresh: () async => ref.invalidate(applicationsProvider),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                  itemCount: apps.length,
                  itemBuilder: (context, i) {
                    final app = apps[i];
                    final appId = app['id']?.toString() ?? '';
                    final propTitle =
                        app['propertyTitle']?.toString() ?? 'Rental Property';
                    final tenantName =
                        app['tenantName']?.toString() ?? 'Prospective Tenant';
                    final tenantEmail = app['tenantEmail']?.toString() ?? '';
                    final status = app['status']?.toString() ?? 'Submitted';
                    final message = app['message']?.toString() ?? '';
                    num toNum(dynamic v) =>
                        num.tryParse(v?.toString() ?? '') ?? 0;
                    final rent = toNum(app['monthlyRent']).toDouble();

                    final isAccepted =
                        status == 'Accepted' || status == 'Approved';

                    final providedPhoto =
                        (app['propertyPhotoUrl'] ??
                                app['PropertyPhotoUrl'] ??
                                '')
                            .toString()
                            .trim();
                    final propertyId =
                        (app['propertyId'] ?? app['PropertyId'] ?? '')
                            .toString();
                    final resolvedPhoto =
                        providedPhoto.isEmpty && propertyId.isNotEmpty
                        ? ref.watch(bookingPhotoProvider(propertyId))
                        : null;
                    final photoUrl = providedPhoto.isNotEmpty
                        ? providedPhoto
                        : resolvedPhoto?.value ?? '';
                    final address = app['propertyAddress']?.toString() ?? '';
                    String dateLabel(dynamic value) {
                      final date = DateTime.tryParse(value?.toString() ?? '');
                      return date == null
                          ? 'Not specified'
                          : '${date.day}/${date.month}/${date.year}';
                    }

                    return Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
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
                          ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: AspectRatio(
                              aspectRatio: 1.9,
                              child: photoUrl.isEmpty
                                  ? Container(
                                      color: AppColors.softTeal,
                                      child: Center(
                                        child: resolvedPhoto?.isLoading == true
                                            ? const CircularProgressIndicator()
                                            : const Column(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(
                                                    Icons.image_outlined,
                                                    size: 30,
                                                    color: AppColors.muted,
                                                  ),
                                                  SizedBox(height: 6),
                                                  Text(
                                                    'Photo unavailable',
                                                    style: TextStyle(
                                                      color: AppColors.muted,
                                                      fontSize: 12,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                      ),
                                    )
                                  : Image.network(
                                      photoUrl,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, error, stack) =>
                                          const ColoredBox(
                                            color: AppColors.softTeal,
                                            child: Center(
                                              child: Icon(
                                                Icons.broken_image_outlined,
                                                color: AppColors.muted,
                                              ),
                                            ),
                                          ),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  propTitle,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                    color: AppColors.ink,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: isAccepted
                                      ? AppColors.softTeal
                                      : const Color(0xFFFEF9C3),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  status,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: isAccepted
                                        ? const Color(0xFF385345)
                                        : const Color(0xFF854D0E),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (address.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.location_on_outlined,
                                    size: 14,
                                    color: AppColors.muted,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      address,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.muted,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.softTeal,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'LKR ${rent.toStringAsFixed(0)} / month',
                                  style: const TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.ink,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '${dateLabel(app['startDate'])} - ${dateLabel(app['endDate'])}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.muted,
                                  ),
                                ),
                                Text(
                                  '${app['durationMonths'] ?? '-'} month lease',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: [
                              const Icon(
                                Icons.person_rounded,
                                size: 16,
                                color: AppColors.teal,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                tenantName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              if (tenantEmail.isNotEmpty) ...[
                                const SizedBox(width: 8),
                                Text(
                                  '($tenantEmail)',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          if (message.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              message,
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                                height: 1.4,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                          const SizedBox(height: 12),

                          if (!isAccepted &&
                              isAdmin(ref.watch(authStateProvider).value?.role))
                            TextButton.icon(
                              onPressed: () => _deleteRequest(appId),
                              icon: const Icon(Icons.delete_outline),
                              label: const Text('Delete request'),
                            ),
                          if (canManage && status == 'Submitted')
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () => _handleAction(
                                      appId,
                                      'reject',
                                      propTitle,
                                      tenantName,
                                      rent,
                                    ),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: Colors.red,
                                      side: const BorderSide(color: Colors.red),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                    child: const Text('Decline'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: FilledButton(
                                    onPressed: () => _handleAction(
                                      appId,
                                      'confirm',
                                      propTitle,
                                      tenantName,
                                      rent,
                                    ),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: AppColors.ink,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                    child: const Text('Accept Booking'),
                                  ),
                                ),
                              ],
                            )
                          else if (isAccepted)
                            const Row(
                              children: [
                                Icon(
                                  Icons.check_circle_rounded,
                                  color: AppColors.teal,
                                  size: 16,
                                ),
                                SizedBox(width: 6),
                                Text(
                                  'Accepted ✓ 6-Month Lease Issued',
                                  style: TextStyle(
                                    color: AppColors.teal,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    );
                  },
                ),
              );
            },
          ),

          // TAB 2: Active Leases & Tenant Directory
          if (canManage)
            agreementsAsync!.when(
              loading: () => const Center(
                child: CircularProgressIndicator(color: AppColors.teal),
              ),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (agreements) {
                if (agreements.isEmpty) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Text(
                        'No active tenant leases found.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted),
                      ),
                    ),
                  );
                }

                return RefreshIndicator(
                  color: AppColors.teal,
                  onRefresh: () async =>
                      ref.read(agreementsProvider.notifier).refresh(),
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    itemCount: agreements.length,
                    itemBuilder: (context, i) {
                      final ag = agreements[i];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: AppColors.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    ag.propertyTitle,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 15,
                                      color: AppColors.ink,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: ag.hasPaid
                                        ? AppColors.softTeal
                                        : const Color(0xFFFEF9C3),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    ag.hasPaid
                                        ? 'Active Lease'
                                        : 'Awaiting Payment',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: ag.hasPaid
                                          ? const Color(0xFF385345)
                                          : const Color(0xFF854D0E),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Tenant: ${ag.tenantName}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                color: AppColors.ink,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Monthly Rent: LKR ${ag.agreedMonthlyRent.toStringAsFixed(0)} | Deposit: LKR ${ag.securityDeposit.toStringAsFixed(0)}',
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
