import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/rental_model.dart';
import '../providers/rental_provider.dart';
import 'payment_screen.dart';

class AgreementDetailScreen extends ConsumerStatefulWidget {
  final AgreementModel agreement;

  const AgreementDetailScreen({super.key, required this.agreement});

  @override
  ConsumerState<AgreementDetailScreen> createState() =>
      _AgreementDetailScreenState();
}

class _AgreementDetailScreenState extends ConsumerState<AgreementDetailScreen>
    with SingleTickerProviderStateMixin {
  late AgreementModel _agreement;

  // Agree flow
  bool _isAgreeing = false;
  bool _hasAgreedCheck = false;
  final TextEditingController _signatureController = TextEditingController();

  // AI Audit
  bool _isAiLoading = false;
  Map<String, dynamic>? _aiResult;

  late final AnimationController _sparkleController;

  @override
  void initState() {
    super.initState();
    _agreement = widget.agreement;
    final user = ref.read(authStateProvider).value;
    _signatureController.text = user?.name ?? '';
    _sparkleController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _signatureController.dispose();
    _sparkleController.dispose();
    super.dispose();
  }

  // ─── Agree to Agreement ──────────────────────────────────────────────────
  Future<void> _agreeToAgreement() async {
    if (!_hasAgreedCheck) {
      _showSnack('Please tick the agreement checkbox to confirm.', error: true);
      return;
    }
    if (_signatureController.text.trim().isEmpty) {
      _showSnack(
        'Please enter your full legal name as signature.',
        error: true,
      );
      return;
    }

    setState(() => _isAgreeing = true);
    final svc = ref.read(rentalServiceProvider);
    bool success;
    try {
      final saved = await svc.persistDraft(_agreement);
      if (!mounted) return;
      setState(() => _agreement = saved);
      success = await svc.agreeToAgreement(
        _agreement.id,
        _signatureController.text.trim(),
        localAgreement: _agreement,
      );
    } catch (_) {
      success = false;
    }
    if (!mounted) return;
    if (!success) {
      setState(() => _isAgreeing = false);
      _showSnack(
        'Agreement could not be saved. Please retry when connected.',
        error: true,
      );
      return;
    }

    // Optimistic local update
    final updatedTerms =
        '${_agreement.termsAndConditions}\n[TENANT_AGREED: ${DateTime.now().toIso8601String()} | Signer: ${_signatureController.text.trim()}]';
    final updated = AgreementModel.fromJson({
      ..._agreement.toMap(),
      'status': 'PendingOwnerApproval',
      'termsAndConditions': updatedTerms,
    });

    ref.read(agreementsProvider.notifier).updateOne(updated);
    setState(() {
      _agreement = updated;
      _isAgreeing = false;
    });

    if (mounted) {
      _showSnack('You have agreed! Please proceed to make payment.');
      // Open payment screen immediately
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => PaymentScreen(agreement: _agreement)),
      ).then((_) {
        if (mounted) ref.read(agreementsProvider.notifier).refresh();
      });
    }
  }

  // ─── AI Audit ────────────────────────────────────────────────────────────
  Future<void> _runAiAudit() async {
    if (_isAiLoading) return;
    setState(() {
      _isAiLoading = true;
      _aiResult = null;
    });
    try {
      final svc = ref.read(rentalServiceProvider);
      final prop = _agreement.property;
      final loc = (prop['city'] ?? prop['address'] ?? '').toString();
      final beds = int.tryParse(prop['bedrooms']?.toString() ?? '') ?? 0;
      final type = (prop['propertyType'] ?? 'Property').toString();
      final live = await svc.auditAgreementWithAi(
        propertyId: (prop['id'] ?? _agreement.propertyId).toString(),
        agreementId: _agreement.id,
        rent: _agreement.agreedMonthlyRent,
        location: loc,
        propertyType: type,
        bedrooms: beds,
        document:
            'Start: ${_agreement.startDate}; End: ${_agreement.endDate}; Deposit: ${_agreement.securityDeposit}. ${_agreement.termsAndConditions}',
      );
      if (!mounted) return;
      final result =
          live ??
          svc.localAiAudit(
            rent: _agreement.agreedMonthlyRent,
            location: loc,
            propertyType: type,
            bedrooms: beds,
            ownerName: _agreement.ownerName,
            tenantName: _agreement.tenantName,
            propertyAddress: _agreement.propertyAddress,
            startDate: _fmtDate(_agreement.startDate),
            endDate: _fmtDate(_agreement.endDate),
            securityDeposit: _agreement.securityDeposit,
          );
      setState(() => _aiResult = result);
    } catch (_) {
      if (mounted) {
        _showSnack(
          'Could not complete the audit. Please try again.',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isAiLoading = false);
    }
  }

  void _showSnack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? Colors.red.shade700 : AppColors.teal,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(agreementsProvider, (previous, next) {
      next.whenData((items) {
        for (final item in items) {
          if (item.id == _agreement.id && mounted) {
            setState(() => _agreement = item);
            break;
          }
        }
      });
    });
    final isTenant = ref.watch(authStateProvider).value?.role == 'Tenant';
    final step = _agreement.lifecycleStep;
    final rent = _agreement.agreedMonthlyRent;
    final deposit = _agreement.securityDeposit > 0
        ? _agreement.securityDeposit
        : rent * 2;

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: CustomScrollView(
        slivers: [
          // ── Hero App Bar ────────────────────────────────────────────────
          SliverAppBar(
            expandedHeight: 220,
            pinned: true,
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            leading: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                margin: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withAlpha(100),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.arrow_back_ios_rounded,
                  color: Colors.white,
                  size: 18,
                ),
              ),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                children: [
                  _agreement.propertyPhoto.isNotEmpty
                      ? Image.network(
                          _agreement.propertyPhoto,
                          width: double.infinity,
                          height: 260,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => _GradientBanner(),
                        )
                      : _GradientBanner(),
                  // Gradient overlay
                  Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Colors.transparent, Color(0xE0000000)],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                  // Title at bottom
                  Positioned(
                    bottom: 16,
                    left: 20,
                    right: 20,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _StatusBadge(step: step),
                        const SizedBox(height: 8),
                        Text(
                          _agreement.propertyTitle,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 2,
                        ),
                        if (_agreement.propertyAddress.isNotEmpty)
                          Row(
                            children: [
                              const Icon(
                                Icons.location_on_rounded,
                                color: Colors.white60,
                                size: 13,
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  _agreement.propertyAddress,
                                  style: const TextStyle(
                                    color: Colors.white60,
                                    fontSize: 12,
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
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Lifecycle Progress ──────────────────────────────────
                  _ProgressCard(step: step),
                  const SizedBox(height: 16),

                  // ── Financial Summary ───────────────────────────────────
                  _FinancialCard(
                    rent: rent,
                    deposit: deposit,
                    agreement: _agreement,
                  ),
                  const SizedBox(height: 16),

                  // ── Parties ─────────────────────────────────────────────
                  _PartiesCard(agreement: _agreement),
                  const SizedBox(height: 16),

                  // ── Terms & Conditions ──────────────────────────────────
                  if (_agreement.termsAndConditions.isNotEmpty)
                    _TermsCard(
                      terms: _cleanTerms(_agreement.termsAndConditions),
                    ),
                  const SizedBox(height: 16),

                  // ── AI Audit Section ────────────────────────────────────
                  _AiAuditSection(
                    isLoading: _isAiLoading,
                    result: _aiResult,
                    onAudit: _runAiAudit,
                    sparkleController: _sparkleController,
                  ),
                  const SizedBox(height: 24),

                  // ── Action Buttons ──────────────────────────────────────
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Payment Receipts & History',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Official digital payment records for this lease agreement',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.muted,
                          ),
                        ),
                        const SizedBox(height: 14),
                        if (_agreement.payments.isEmpty)
                          const Text('No payments recorded yet.'),
                        ..._agreement.payments.map(
                          (payment) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(
                              payment.isSuccessful
                                  ? Icons.check_circle
                                  : Icons.schedule,
                              color: payment.isSuccessful
                                  ? Colors.green
                                  : Colors.amber,
                            ),
                            title: Text(
                              'LKR ${payment.amount.toStringAsFixed(2)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: Text(
                              'Ref: ${payment.paymentReference}\n${_fmtDate(payment.paidAt)} ${payment.paymentMethod}',
                            ),
                            isThreeLine: true,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (step == 1 && isTenant)
                    _AgreeSection(
                      hasAgreedCheck: _hasAgreedCheck,
                      signatureController: _signatureController,
                      isAgreeing: _isAgreeing,
                      onToggleCheck: (v) =>
                          setState(() => _hasAgreedCheck = v ?? false),
                      onAgree: _agreeToAgreement,
                    ),

                  if (step == 2 && isTenant)
                    FilledButton.icon(
                      onPressed: () =>
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  PaymentScreen(agreement: _agreement),
                            ),
                          ).then((_) {
                            if (mounted) {
                              ref.read(agreementsProvider.notifier).refresh();
                            }
                          }),
                      icon: const Icon(Icons.payment_rounded),
                      label: const Text('Make Payment'),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(52),
                        backgroundColor: const Color(0xFF916622),
                        textStyle: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),

                  if (step == 3)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.softTeal,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFD8E3D7)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.verified_rounded,
                            color: AppColors.teal,
                            size: 24,
                          ),
                          SizedBox(width: 10),
                          Text(
                            'Paid & Active Lease ✓',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.darkGreen,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    ),

                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _cleanTerms(String raw) {
    // Remove internal tracking tags from display
    return raw
        .replaceAll(RegExp(r'\[TENANT_AGREED:.*?\]', dotAll: true), '')
        .replaceAll(RegExp(r'\[PAYMENT_SUCCESS:.*?\]', dotAll: true), '')
        .trim();
  }

  String _fmtDate(String raw) {
    try {
      final dt = DateTime.parse(raw).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return raw;
    }
  }
}

// Extension to serialize agreement back to Map for optimistic update
extension AgreementToMap on AgreementModel {
  Map<String, dynamic> toMap() => {
    'id': id,
    'propertyId': propertyId,
    'ownerId': ownerId,
    'tenantId': tenantId,
    'agreedMonthlyRent': agreedMonthlyRent,
    'securityDeposit': securityDeposit,
    'startDate': startDate,
    'endDate': endDate,
    'status': status,
    'termsAndConditions': termsAndConditions,
    'property': property,
    'owner': owner,
    'tenant': tenant,
    'payments': payments
        .map(
          (p) => {
            'id': p.id,
            'agreementId': p.agreementId,
            'amount': p.amount,
            'paymentMethod': p.paymentMethod,
            'paymentReference': p.paymentReference,
            'isSuccessful': p.isSuccessful,
            'paidAt': p.paidAt,
          },
        )
        .toList(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-widgets
// ─────────────────────────────────────────────────────────────────────────────

class _GradientBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: AppColors.darkGreen),
      child: Center(
        child: Icon(
          Icons.home_work_rounded,
          size: 80,
          color: Colors.white.withAlpha(40),
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final int step;

  const _StatusBadge({required this.step});

  @override
  Widget build(BuildContext context) {
    final (color, label, icon) = switch (step) {
      3 => (AppColors.teal, 'Active Lease ✓', Icons.verified_rounded),
      2 => (const Color(0xFF916622), 'Payment Required', Icons.payment_rounded),
      _ => (
        const Color(0xFF526A78),
        'Pending Review',
        Icons.pending_actions_rounded,
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 13),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  final int step;

  const _ProgressCard({required this.step});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Lease Lifecycle Status',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.ink,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _StepDot(label: '1', active: step >= 1, text: 'Sent'),
              _StepLine(active: step >= 2),
              _StepDot(label: '2', active: step >= 2, text: 'Agreed'),
              _StepLine(active: step >= 3),
              _StepDot(label: '3', active: step >= 3, text: 'Paid ✓'),
            ],
          ),
        ],
      ),
    );
  }
}

class _StepDot extends StatelessWidget {
  final String label;
  final bool active;
  final String text;

  const _StepDot({
    required this.label,
    required this.active,
    required this.text,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: active ? AppColors.teal : AppColors.line,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: active ? Colors.white : AppColors.muted,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          text,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: active ? AppColors.teal : AppColors.muted,
          ),
        ),
      ],
    );
  }
}

class _StepLine extends StatelessWidget {
  final bool active;

  const _StepLine({required this.active});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        height: 3,
        margin: const EdgeInsets.only(bottom: 16),
        color: active ? AppColors.teal : AppColors.line,
      ),
    );
  }
}

class _FinancialCard extends StatelessWidget {
  final double rent;
  final double deposit;
  final AgreementModel agreement;

  const _FinancialCard({
    required this.rent,
    required this.deposit,
    required this.agreement,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Financials & Terms',
            style: TextStyle(
              color: AppColors.ink,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _FinStat(label: 'Monthly Rent', value: 'LKR ${_fmt(rent)}'),
              const SizedBox(width: 24),
              _FinStat(
                label: 'Security Deposit',
                value: 'LKR ${_fmt(deposit)}',
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(color: AppColors.line),
          const SizedBox(height: 12),
          Row(
            children: [
              _FinStat(
                label: 'Start Date',
                value: agreement.startDate.isNotEmpty
                    ? _fmtDate(agreement.startDate)
                    : 'Immediate',
              ),
              const SizedBox(width: 24),
              _FinStat(
                label: 'End Date',
                value: agreement.endDate.isNotEmpty
                    ? _fmtDate(agreement.endDate)
                    : '6 Months',
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _fmt(double v) => v
      .toStringAsFixed(0)
      .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');

  String _fmtDate(String raw) {
    try {
      final dt = DateTime.parse(raw).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return raw;
    }
  }
}

class _FinStat extends StatelessWidget {
  final String label;
  final String value;

  const _FinStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: AppColors.muted, fontSize: 11),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.teal,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }
}

class _PartiesCard extends StatelessWidget {
  final AgreementModel agreement;

  const _PartiesCard({required this.agreement});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Parties',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.ink,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 12),
          _PartyRow(
            label: 'Owner',
            name: agreement.ownerName,
            icon: Icons.person_rounded,
          ),
          const SizedBox(height: 8),
          _PartyRow(
            label: 'Tenant',
            name: agreement.tenantName,
            icon: Icons.person_outline_rounded,
          ),
        ],
      ),
    );
  }
}

class _PartyRow extends StatelessWidget {
  final String label;
  final String name;
  final IconData icon;

  const _PartyRow({
    required this.label,
    required this.name,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppColors.softTeal,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: AppColors.teal, size: 18),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              name,
              style: const TextStyle(
                color: AppColors.ink,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _TermsCard extends StatefulWidget {
  final String terms;

  const _TermsCard({required this.terms});

  @override
  State<_TermsCard> createState() => _TermsCardState();
}

class _TermsCardState extends State<_TermsCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              const Row(
                children: [
                  Icon(Icons.article_outlined, color: AppColors.teal, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Terms & Conditions',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: () => setState(() => _expanded = !_expanded),
                child: Text(_expanded ? 'Collapse' : 'Read All'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 300),
            crossFadeState: _expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: Text(
              widget.terms,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 13,
                height: 1.5,
              ),
            ),
            secondChild: Text(
              widget.terms,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Audit Section
// ─────────────────────────────────────────────────────────────────────────────
class _AiAuditSection extends StatelessWidget {
  final bool isLoading;
  final Map<String, dynamic>? result;
  final VoidCallback onAudit;
  final AnimationController sparkleController;

  const _AiAuditSection({
    required this.isLoading,
    required this.result,
    required this.onAudit,
    required this.sparkleController,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surface),
        color: AppColors.softTeal,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Row(
              children: [
                RotationTransition(
                  turns: sparkleController,
                  child: const Icon(
                    Icons.auto_awesome,
                    color: AppColors.amber,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Agreement & Pricing Agent',
                        style: TextStyle(
                          color: AppColors.ink,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                      Text(
                        'Agentic AI · Market Rent + Lease Summary',
                        style: TextStyle(color: AppColors.blue, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.teal.withAlpha(80)),
                  ),
                  child: const Text(
                    'AI Agent',
                    style: TextStyle(
                      color: AppColors.blue,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          if (!isLoading && result == null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Analyse this agreement\'s market pricing and get an AI-generated plain-language summary of all lease terms.',
                    style: TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 14),
                  GestureDetector(
                    onTap: onAudit,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.teal,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.auto_awesome,
                            color: AppColors.onDark,
                            size: 18,
                          ),
                          SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              'Audit Lease & Evaluate Market Pricing',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: AppColors.onDark,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

          if (isLoading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Column(
                  children: [
                    CircularProgressIndicator(color: AppColors.amber),
                    SizedBox(height: 14),
                    Text(
                      'Agentic AI is evaluating lease terms\nand market pricing benchmarks…',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          if (!isLoading && result != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (result!['is_local_estimate'] == true)
                    const Text(
                      'Local estimate - Live AI unavailable',
                      style: TextStyle(
                        color: AppColors.amber,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  _AiResultBody(result: result!),
                  TextButton.icon(
                    onPressed: onAudit,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry AI audit'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _AiResultBody extends StatelessWidget {
  final Map<String, dynamic> result;

  const _AiResultBody({required this.result});

  @override
  Widget build(BuildContext context) {
    final rawAssessment = result['market_pricing_assessment'];
    final assessment = rawAssessment is Map ? rawAssessment : null;
    final summary = result['plain_language_summary'];
    final disclaimer = result['non_binding_disclaimer']?.toString();

    Color assessmentColor = AppColors.teal;
    if (assessment != null) {
      final status = (assessment['market_status']?.toString() ?? '')
          .toLowerCase();
      if (status.contains('above')) assessmentColor = AppColors.amber;
      if (status.contains('below')) assessmentColor = AppColors.blue;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Market Assessment Box
        if (assessment != null)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: assessmentColor.withAlpha(30),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: assessmentColor.withAlpha(80)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    Text(
                      assessment['market_status']?.toString() ?? '',
                      style: TextStyle(
                        color: assessmentColor,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: assessmentColor.withAlpha(40),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Variance: ${assessment['variance_percentage'] ?? '0%'}',
                        style: TextStyle(
                          color: assessmentColor,
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                _AiRow(
                  'Listed Rent',
                  'LKR ${_fmt(double.tryParse(assessment['listed_rent']?.toString() ?? '0') ?? 0)}',
                ),
                _AiRow(
                  'Market Range',
                  assessment['typical_market_range']?.toString() ?? '',
                ),
                _AiRow(
                  'Median Benchmark',
                  'LKR ${_fmt(double.tryParse(assessment['median_benchmark']?.toString() ?? '0') ?? 0)}',
                ),
                const SizedBox(height: 8),
                Text(
                  assessment['pricing_reasoning']?.toString() ?? '',
                  style: TextStyle(
                    color: AppColors.ink,
                    fontSize: 12,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),

        if (summary != null) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(
                      Icons.article_rounded,
                      color: AppColors.muted,
                      size: 16,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Plain-Language Lease Summary',
                      style: TextStyle(
                        color: AppColors.ink,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (summary is Map)
                  ...summary.entries.map(
                    (e) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            e.key
                                .toString()
                                .replaceAll('_', ' ')
                                .split(' ')
                                .map(
                                  (w) => w.isEmpty
                                      ? w
                                      : '${w[0].toUpperCase()}${w.substring(1)}',
                                )
                                .join(' '),
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            e.value?.toString() ?? '',
                            style: const TextStyle(
                              color: AppColors.ink,
                              fontSize: 12,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  Text(
                    summary.toString(),
                    style: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
              ],
            ),
          ),
        ],

        if (disclaimer != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              disclaimer,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 10,
                fontStyle: FontStyle.italic,
                height: 1.5,
              ),
            ),
          ),
        ],
      ],
    );
  }

  String _fmt(double v) => v
      .toStringAsFixed(0)
      .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
}

class _AiRow extends StatelessWidget {
  final String label;
  final String value;

  const _AiRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: AppColors.muted, fontSize: 11),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(
                color: AppColors.ink,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agree Section
// ─────────────────────────────────────────────────────────────────────────────
class _AgreeSection extends StatelessWidget {
  final bool hasAgreedCheck;
  final TextEditingController signatureController;
  final bool isAgreeing;
  final ValueChanged<bool?> onToggleCheck;
  final VoidCallback onAgree;

  const _AgreeSection({
    required this.hasAgreedCheck,
    required this.signatureController,
    required this.isAgreeing,
    required this.onToggleCheck,
    required this.onAgree,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFDFE7EA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.draw_rounded, color: Color(0xFF526A78), size: 20),
              SizedBox(width: 8),
              Flexible(
                child: Text(
                  'Sign & Agree to Lease',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Checkbox
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.canvas,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.line),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: hasAgreedCheck,
                  onChanged: onToggleCheck,
                  activeColor: AppColors.teal,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(5),
                  ),
                ),
                const Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(top: 12),
                    child: Text(
                      'I have reviewed the property details and hereby agree to the terms of this 6-month residential rental agreement.',
                      style: TextStyle(
                        color: AppColors.ink,
                        fontSize: 12,
                        height: 1.5,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          // Signature field
          TextField(
            controller: signatureController,
            decoration: const InputDecoration(
              labelText: 'Electronic Signature (Full Legal Name)',
              prefixIcon: Icon(Icons.edit_rounded, size: 18),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: isAgreeing ? null : onAgree,
              icon: isAgreeing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.check_circle_rounded),
              label: Text(
                isAgreeing
                    ? 'Signing Agreement…'
                    : 'I Agree · Proceed to Payment',
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                backgroundColor: const Color(0xFF526A78),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                textStyle: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
