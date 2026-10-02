import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';
import '../../home/providers/property_provider.dart';
import '../../properties/property_service.dart';
import '../../shared/theme/app_theme.dart';
import '../models/rental_model.dart';
import '../providers/rental_provider.dart';
import 'agreement_detail_screen.dart';
import 'payment_screen.dart';

class MyRentalsScreen extends ConsumerStatefulWidget {
  const MyRentalsScreen({super.key});

  @override
  ConsumerState<MyRentalsScreen> createState() => _MyRentalsScreenState();
}

class _MyRentalsScreenState extends ConsumerState<MyRentalsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  bool _isOwnerOrAdmin(String? role) =>
      role == 'PropertyOwner' ||
      role == 'Owner' ||
      role == 'Administrator' ||
      role == 'Admin';

  @override
  Widget build(BuildContext context) {
    final userState = ref.watch(authStateProvider);
    final user = userState.value;
    final isManager = _isOwnerOrAdmin(user?.role);
    final agreementsAsync = ref.watch(agreementsProvider);

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) => [
          SliverAppBar(
            expandedHeight: 140,
            floating: false,
            pinned: true,
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.only(left: 20, bottom: 60),
              title: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Rentals & Agreements',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                  Text(
                    isManager
                        ? 'Tenant & Owner Leases & Listing Approvals'
                        : 'Your active lease agreements',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppColors.muted,
                    ),
                  ),
                ],
              ),
              background: Stack(
                children: [
                  Container(
                    decoration: const BoxDecoration(color: AppColors.darkGreen),
                  ),
                  Positioned(
                    right: -30,
                    top: -20,
                    child: Container(
                      width: 180,
                      height: 180,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withAlpha(15),
                      ),
                    ),
                  ),
                  Positioned(
                    right: 30,
                    top: 30,
                    child: Icon(
                      Icons.description_rounded,
                      size: 64,
                      color: Colors.white.withAlpha(25),
                    ),
                  ),
                ],
              ),
            ),
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(48),
              child: Container(
                color: Colors.white,
                child: TabBar(
                  controller: _tabController,
                  labelColor: AppColors.teal,
                  unselectedLabelColor: AppColors.muted,
                  indicatorColor: AppColors.teal,
                  indicatorWeight: 3,
                  labelStyle: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                  tabs: isManager
                      ? const [
                          Tab(text: 'Tenant & Owner Leases'),
                          Tab(text: 'Listing Approvals'),
                        ]
                      : const [Tab(text: 'Agreements'), Tab(text: 'Payments')],
                ),
              ),
            ),
          ),
        ],
        body: agreementsAsync.when(
          data: (agreements) => TabBarView(
            controller: _tabController,
            children: isManager
                ? [
                    _OwnerLeasesTab(agreements: agreements),
                    const _ListingApprovalsTab(),
                  ]
                : [
                    _AgreementsTab(agreements: agreements, isOwner: false),
                    _PaymentsTab(agreements: agreements),
                  ],
          ),
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.teal),
          ),
          error: (err, _) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.cloud_off_rounded,
                  size: 56,
                  color: AppColors.muted,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Could not load agreements',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  err.toString(),
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () =>
                      ref.read(agreementsProvider.notifier).refresh(),
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner/Admin TAB 1: Tenant & Owner Leases (No "Pay Monthly Rent" button for Owner)
// ─────────────────────────────────────────────────────────────────────────────
class _OwnerLeasesTab extends ConsumerWidget {
  final List<AgreementModel> agreements;

  const _OwnerLeasesTab({required this.agreements});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
      color: AppColors.teal,
      onRefresh: () async => ref.read(agreementsProvider.notifier).refresh(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.darkGreen,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'OWNER LEASE MANAGEMENT',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${agreements.length} Total Tenant Leases',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
                const Icon(
                  Icons.verified_user_rounded,
                  color: Colors.white,
                  size: 28,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (agreements.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(
                child: Text(
                  'No tenant leases issued yet. Accept a booking request to generate a lease.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted),
                ),
              ),
            ),

          ...agreements.map((a) => _AgreementCard(agreement: a)),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner/Admin TAB 2: Listing Approvals & Verification
// ─────────────────────────────────────────────────────────────────────────────
class _ListingApprovalsTab extends ConsumerWidget {
  const _ListingApprovalsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final propertiesAsync = ref.watch(propertiesProvider);
    final user = ref.watch(authStateProvider).value;
    final admin = user?.role == 'Administrator' || user?.role == 'Admin';

    return propertiesAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(color: AppColors.teal)),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (properties) {
        if (properties.isEmpty) {
          return const Center(child: Text('No property listings found.'));
        }

        return RefreshIndicator(
          color: AppColors.teal,
          onRefresh: () async => ref.refresh(propertiesProvider.future),
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
            itemCount: properties.length,
            itemBuilder: (context, i) {
              final p = properties[i];
              final active = p.status == 'Active';

              return Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
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
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            p.title,
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
                            color: active
                                ? AppColors.softTeal
                                : const Color(0xFFFEF9C3),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            active
                                ? 'Approved • Active'
                                : 'Pending Verification',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: active
                                  ? const Color(0xFF385345)
                                  : const Color(0xFF854D0E),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${p.address} • LKR ${p.monthlyRent.toStringAsFixed(0)}/mo',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Checklist Status Grid
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.canvas,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Ownership Proof',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: AppColors.muted,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Icon(
                                      active
                                          ? Icons.check_circle_rounded
                                          : Icons.schedule_rounded,
                                      size: 14,
                                      color: active
                                          ? AppColors.teal
                                          : Colors.amber.shade800,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      active ? 'Verified' : 'Pending Review',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: active
                                            ? AppColors.teal
                                            : Colors.amber.shade800,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: 1,
                            height: 28,
                            color: AppColors.line,
                          ),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(left: 12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Listing Fee (LKR 2,500)',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: AppColors.muted,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Row(
                                    children: [
                                      Icon(
                                        active
                                            ? Icons.check_circle_rounded
                                            : Icons.schedule_rounded,
                                        size: 14,
                                        color: active
                                            ? AppColors.teal
                                            : Colors.amber.shade800,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        active ? 'Paid ✓' : 'Recorded',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: active
                                              ? AppColors.teal
                                              : Colors.amber.shade800,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Admin Actions
                    if (admin && !active)
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: () async {
                            final api = ref.read(propertyServiceProvider);
                            await api.request(
                              'PUT',
                              '/properties/${p.id}/approve',
                              {},
                            );
                            ref.invalidate(propertiesProvider);
                          },
                          icon: const Icon(Icons.verified_rounded, size: 16),
                          label: const Text('Approve & Publish Listing'),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.teal,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 (Tenant): Agreements
// ─────────────────────────────────────────────────────────────────────────────
class _AgreementsTab extends ConsumerWidget {
  final List<AgreementModel> agreements;
  final bool isOwner;

  const _AgreementsTab({required this.agreements, required this.isOwner});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (agreements.isEmpty) {
      return _EmptyState(
        icon: Icons.description_outlined,
        title: 'No Agreements Yet',
        subtitle: isOwner
            ? 'Send a lease to a tenant from your property dashboard.'
            : 'Once an owner accepts your booking request, your agreement will appear here.',
      );
    }

    return RefreshIndicator(
      color: AppColors.teal,
      onRefresh: () => ref.read(agreementsProvider.notifier).refresh(),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        itemCount: agreements.length,
        itemBuilder: (context, i) => _AgreementCard(agreement: agreements[i]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 (Tenant): Payments summary & Recurring Monthly Rent
// ─────────────────────────────────────────────────────────────────────────────
class _PaymentsTab extends ConsumerWidget {
  final List<AgreementModel> agreements;

  const _PaymentsTab({required this.agreements});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeAgreements = agreements
        .where((a) => a.hasPaid || a.status == 'Active')
        .toList();
    final allPayments = agreements.expand((a) => a.payments).toList();
    final paidAgreements = agreements
        .where((a) => a.hasPaid && a.payments.isEmpty)
        .toList();

    final hasSomething =
        activeAgreements.isNotEmpty ||
        allPayments.isNotEmpty ||
        paidAgreements.isNotEmpty;

    if (!hasSomething) {
      return const _EmptyState(
        icon: Icons.receipt_long_outlined,
        title: 'No Payment Records',
        subtitle: 'Payment history and monthly rent actions will appear here once a lease is active.',
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        _PaymentSummaryCard(agreements: agreements),
        const SizedBox(height: 20),

        if (activeAgreements.isNotEmpty) ...[
          const _SectionHeader('Active Leases - Pay Monthly Rent'),
          const SizedBox(height: 12),
          ...activeAgreements.map(
            (a) => _ActiveLeaseMonthlyRentCard(agreement: a, ref: ref),
          ),
          const SizedBox(height: 20),
        ],

        if (allPayments.isNotEmpty) ...[
          const _SectionHeader('Transaction History'),
          const SizedBox(height: 12),
          ...allPayments.map((p) => _PaymentTile(payment: p)),
        ],

        if (paidAgreements.isNotEmpty) ...[
          const SizedBox(height: 16),
          const _SectionHeader('Activated Leases (Payment Confirmed)'),
          const SizedBox(height: 12),
          ...paidAgreements.map((a) => _ActivatedLeaseTile(agreement: a)),
        ],
      ],
    );
  }
}

class _ActiveLeaseMonthlyRentCard extends StatelessWidget {
  final AgreementModel agreement;
  final WidgetRef ref;

  const _ActiveLeaseMonthlyRentCard({
    required this.agreement,
    required this.ref,
  });

  @override
  Widget build(BuildContext context) {
    final rent = agreement.agreedMonthlyRent > 0
        ? agreement.agreedMonthlyRent
        : 65000.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFD8E3D7)),
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
              Container(
                width: 42,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.softTeal,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.home_work_rounded,
                  color: AppColors.teal,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      agreement.propertyTitle,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: AppColors.ink,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      'Monthly Rent: LKR ${_fmtMoney(rent)}/month',
                      style: const TextStyle(
                        color: AppColors.teal,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => PaymentScreen(
                      agreement: agreement,
                      isMonthlyRent: true,
                    ),
                  ),
                ).then((_) => ref.read(agreementsProvider.notifier).refresh());
              },
              icon: const Icon(Icons.payment_rounded, size: 16),
              label: const Text('Pay Monthly Rent'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.teal,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(vertical: 10),
                textStyle: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agreement Card
// ─────────────────────────────────────────────────────────────────────────────
class _AgreementCard extends ConsumerWidget {
  final AgreementModel agreement;

  const _AgreementCard({required this.agreement});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).value;
    final isTenant = user?.role == 'Tenant' || user == null;

    final step = agreement.lifecycleStep;
    final rent = agreement.agreedMonthlyRent;
    final deposit = agreement.securityDeposit > 0
        ? agreement.securityDeposit
        : rent * 2;

    Color stepColor;
    String stepLabel;
    IconData stepIcon;

    switch (step) {
      case 3:
        stepColor = AppColors.teal;
        stepLabel = 'Active Lease ✓';
        stepIcon = Icons.verified_rounded;
      case 2:
        stepColor = const Color(0xFF916622);
        stepLabel = 'Payment Required';
        stepIcon = Icons.payment_rounded;
      default:
        stepColor = const Color(0xFF526A78);
        stepLabel = 'Pending Review';
        stepIcon = Icons.pending_actions_rounded;
    }

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => AgreementDetailScreen(agreement: agreement),
        ),
      ).then((_) => ref.read(agreementsProvider.notifier).refresh()),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.line),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A000000),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Photo banner ──────────────────────────────────
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(20),
                  ),
                  child: agreement.propertyPhoto.isNotEmpty
                      ? Image.network(
                          agreement.propertyPhoto,
                          height: 160,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => _PlaceholderBanner(
                            title: agreement.propertyTitle,
                          ),
                        )
                      : _PlaceholderBanner(title: agreement.propertyTitle),
                ),
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(20),
                    ),
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
                      color: stepColor,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(stepIcon, color: Colors.white, size: 13),
                        const SizedBox(width: 5),
                        Text(
                          stepLabel,
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
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withAlpha(140),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.calendar_month_rounded,
                          color: Colors.white70,
                          size: 12,
                        ),
                        SizedBox(width: 4),
                        Text(
                          '6-Month Lease',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  bottom: 12,
                  left: 12,
                  right: 12,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        agreement.propertyTitle,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          shadows: [
                            Shadow(blurRadius: 4, color: Colors.black54),
                          ],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (agreement.propertyAddress.isNotEmpty)
                        Row(
                          children: [
                            const Icon(
                              Icons.location_on_rounded,
                              color: Colors.white70,
                              size: 12,
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                agreement.propertyAddress,
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 11,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
              ],
            ),

            // ── Body ──────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.canvas,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: _FinancialStat(
                            label: 'Monthly Rent',
                            value: 'LKR ${_fmtMoney(rent)}',
                            color: AppColors.teal,
                          ),
                        ),
                        Container(width: 1, height: 32, color: AppColors.line),
                        Expanded(
                          child: _FinancialStat(
                            label: 'Security Deposit',
                            value: 'LKR ${_fmtMoney(deposit)}',
                            color: AppColors.ink,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _StepLabel('1. Sent', step >= 1),
                          _StepLabel('2. Agreed', step >= 2),
                          _StepLabel('3. Paid ✓', step >= 3),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: LinearProgressIndicator(
                          value: step / 3,
                          minHeight: 6,
                          backgroundColor: AppColors.line,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            step == 3
                                ? AppColors.teal
                                : step == 2
                                ? const Color(0xFF916622)
                                : const Color(0xFF526A78),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () =>
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => AgreementDetailScreen(
                                    agreement: agreement,
                                  ),
                                ),
                              ).then(
                                (_) => ref
                                    .read(agreementsProvider.notifier)
                                    .refresh(),
                              ),
                          icon: const Icon(Icons.visibility_outlined, size: 16),
                          label: const Text('Details'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.ink,
                            side: const BorderSide(color: AppColors.line),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            textStyle: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),

                      if (step < 3 && isTenant) ...[
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: () {
                              if (step == 1) {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => AgreementDetailScreen(
                                      agreement: agreement,
                                    ),
                                  ),
                                ).then(
                                  (_) => ref
                                      .read(agreementsProvider.notifier)
                                      .refresh(),
                                );
                              } else {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        PaymentScreen(agreement: agreement),
                                  ),
                                ).then(
                                  (_) => ref
                                      .read(agreementsProvider.notifier)
                                      .refresh(),
                                );
                              }
                            },
                            icon: Icon(
                              step == 1
                                  ? Icons.draw_outlined
                                  : Icons.payment_rounded,
                              size: 16,
                            ),
                            label: Text(
                              step == 1 ? 'Review & Sign' : 'Pay Now',
                            ),
                            style: FilledButton.styleFrom(
                              backgroundColor: step == 1
                                  ? const Color(0xFF526A78)
                                  : AppColors.teal,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              textStyle: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      ],

                      if (step == 3 && isTenant) ...[
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => PaymentScreen(
                                    agreement: agreement,
                                    isMonthlyRent: true,
                                  ),
                                ),
                              ).then(
                                (_) => ref
                                    .read(agreementsProvider.notifier)
                                    .refresh(),
                              );
                            },
                            icon: const Icon(Icons.payment_rounded, size: 16),
                            label: const Text('Pay Monthly Rent'),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.teal,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              textStyle: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payments Tab – Summary Card
// ─────────────────────────────────────────────────────────────────────────────
class _PaymentSummaryCard extends StatelessWidget {
  final List<AgreementModel> agreements;

  const _PaymentSummaryCard({required this.agreements});

  @override
  Widget build(BuildContext context) {
    final receipts = {
      for (final p
          in agreements.expand((a) => a.payments).where((p) => p.isSuccessful))
        p.id: p,
    }.values;
    final totalPaid = receipts.fold<double>(0, (sum, p) => sum + p.amount);
    final deposits = receipts
        .where((p) => p.purpose == 'SecurityDeposit')
        .fold<double>(0, (sum, p) => sum + p.amount);
    final rentPaid = receipts
        .where((p) => p.purpose == 'MonthlyRent')
        .fold<double>(0, (sum, p) => sum + p.amount);

    final activeLeases = agreements.where((a) => a.lifecycleStep == 3).length;
    final pendingPayment = agreements.where((a) => a.lifecycleStep == 2).length;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.softTeal,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.line.withAlpha(100),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Payment Overview',
            style: TextStyle(
              color: AppColors.muted,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'LKR ${_fmtMoney(totalPaid)}',
            style: const TextStyle(
              color: AppColors.ink,
              fontSize: 32,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
            ),
          ),
          Text(
            'Security deposits: LKR ${_fmtMoney(deposits)}',
            style: const TextStyle(color: AppColors.muted),
          ),
          Text(
            'Monthly rent: LKR ${_fmtMoney(rentPaid)}',
            style: const TextStyle(color: AppColors.muted),
          ),
          const Text(
            'Total amount paid',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _StatChip(
                label: 'Active Leases',
                value: '$activeLeases',
                icon: Icons.verified_rounded,
              ),
              const SizedBox(width: 12),
              _StatChip(
                label: 'Awaiting Payment',
                value: '$pendingPayment',
                icon: Icons.hourglass_top_rounded,
                warning: pendingPayment > 0,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final bool warning;

  const _StatChip({
    required this.label,
    required this.value,
    required this.icon,
    this.warning = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.line),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: warning ? AppColors.amber : AppColors.teal,
              size: 18,
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    color: AppColors.ink,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  label,
                  style: const TextStyle(color: AppColors.muted, fontSize: 10),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  final PaymentModel payment;

  const _PaymentTile({required this.payment});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.softTeal,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.receipt_long_rounded,
              color: AppColors.teal,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  payment.purposeLabel,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: AppColors.ink,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (payment.paidAt.isNotEmpty)
                  Text(
                    _formatDate(payment.paidAt),
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'LKR ${_fmtMoney(payment.amount)}',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: AppColors.teal,
                ),
              ),
              Container(
                margin: const EdgeInsets.only(top: 4),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: payment.isSuccessful
                      ? AppColors.softTeal
                      : const Color(0xFFFEF9C3),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  payment.isSuccessful ? 'Paid' : 'Pending',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: payment.isSuccessful
                        ? const Color(0xFF385345)
                        : const Color(0xFF854D0E),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActivatedLeaseTile extends StatelessWidget {
  final AgreementModel agreement;

  const _ActivatedLeaseTile({required this.agreement});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFD8E3D7)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.softTeal,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.verified_rounded,
              color: AppColors.teal,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  agreement.propertyTitle,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: AppColors.ink,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const Text(
                  'Lease Activated',
                  style: TextStyle(color: AppColors.teal, fontSize: 11),
                ),
              ],
            ),
          ),
          Text(
            'LKR ${_fmtMoney(agreement.securityDeposit > 0 ? agreement.securityDeposit : agreement.agreedMonthlyRent * 2)}',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: AppColors.teal,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers / Small Widgets
// ─────────────────────────────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.softTeal,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 36, color: AppColors.teal),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String text;

  const _SectionHeader(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
      ),
    );
  }
}

class _FinancialStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _FinancialStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: AppColors.muted, fontSize: 10),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _StepLabel extends StatelessWidget {
  final String text;
  final bool active;

  const _StepLabel(this.text, this.active);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        color: active ? AppColors.teal : AppColors.muted,
      ),
    );
  }
}

class _PlaceholderBanner extends StatelessWidget {
  final String title;

  const _PlaceholderBanner({required this.title});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 160,
      width: double.infinity,
      decoration: const BoxDecoration(color: AppColors.darkGreen),
      child: Center(
        child: Icon(
          Icons.home_work_rounded,
          size: 56,
          color: Colors.white.withAlpha(60),
        ),
      ),
    );
  }
}

String _fmtMoney(double v) => v
    .toStringAsFixed(0)
    .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');

String _formatDate(String raw) {
  try {
    final dt = DateTime.parse(raw).toLocal();
    return '${dt.day}/${dt.month}/${dt.year}';
  } catch (_) {
    return raw;
  }
}
