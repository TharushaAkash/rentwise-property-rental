import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/rental_model.dart';
import '../providers/rental_provider.dart';

class PaymentScreen extends ConsumerStatefulWidget {
  final AgreementModel agreement;
  final bool isMonthlyRent;

  const PaymentScreen({
    super.key,
    required this.agreement,
    this.isMonthlyRent = false,
  });

  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen>
    with TickerProviderStateMixin {
  // Payment method: 'card' | 'bank'
  String _method = 'card';

  // Billing Month State
  late String _selectedMonth;
  late final List<String> _billingMonths;

  // Card fields
  final TextEditingController _holderCtrl = TextEditingController();
  final TextEditingController _numberCtrl = TextEditingController();
  final TextEditingController _expiryCtrl = TextEditingController();
  final TextEditingController _cvvCtrl = TextEditingController();

  bool _isProcessing = false;
  bool _paymentSuccess = false;
  String _error = '';

  late final AnimationController _successController;
  late final Animation<double> _successScale;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authStateProvider).value;
    _holderCtrl.text = user?.name ?? widget.agreement.tenantName;

    // Generate upcoming 6 calendar months
    _billingMonths = List.generate(6, (i) {
      final now = DateTime.now();
      final dt = DateTime(now.year, now.month + i, 1);
      final monthName = _monthName(dt.month);
      return 'Rent for $monthName ${dt.year}';
    });
    _selectedMonth = _billingMonths.first;

    _successController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _successScale = CurvedAnimation(
      parent: _successController,
      curve: Curves.elasticOut,
    );
  }

  String _monthName(int m) {
    const names = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return names[(m - 1) % 12];
  }

  @override
  void dispose() {
    _holderCtrl.dispose();
    _numberCtrl.dispose();
    _expiryCtrl.dispose();
    _cvvCtrl.dispose();
    _successController.dispose();
    super.dispose();
  }

  // ── Card helpers ──────────────────────────────────────────────────────────
  ({String name, List<Color> colors, Color accent}) _cardBrand(String num) {
    final d = num.replaceAll(' ', '');
    if (d.startsWith('4')) {
      return (
        name: 'VISA',
        colors: [const Color(0xFF1E3A8A), const Color(0xFF1E40AF)],
        accent: Colors.blue.shade300,
      );
    }
    if (RegExp(r'^(5[1-5]|2[2-7])').hasMatch(d)) {
      return (
        name: 'MASTERCARD',
        colors: [const Color(0xFF92400E), const Color(0xFFB45309)],
        accent: Colors.orange.shade300,
      );
    }
    if (d.startsWith('3')) {
      return (
        name: 'AMEX',
        colors: [const Color(0xFF065F46), const Color(0xFF047857)],
        accent: const Color(0xFF34D399),
      );
    }
    return (
      name: 'CARD',
      colors: [const Color(0xFF1E293B), const Color(0xFF334155)],
      accent: Colors.grey.shade400,
    );
  }

  void _formatCardNumber(String raw) {
    final digits = raw
        .replaceAll(RegExp(r'\D'), '')
        .substring(0, raw.replaceAll(RegExp(r'\D'), '').length.clamp(0, 16));
    final formatted = digits.replaceAllMapped(
      RegExp(r'(\d{4})(?=\d)'),
      (m) => '${m[0]} ',
    );
    _numberCtrl.value = TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }

  void _formatExpiry(String raw) {
    final digits = raw
        .replaceAll(RegExp(r'\D'), '')
        .substring(0, raw.replaceAll(RegExp(r'\D'), '').length.clamp(0, 4));
    final formatted = digits.length >= 3
        ? '${digits.substring(0, 2)}/${digits.substring(2)}'
        : digits;
    _expiryCtrl.value = TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }

  void _fillDemo() {
    _numberCtrl.text = '4242 4242 4242 4242';
    _expiryCtrl.text = '12/28';
    _cvvCtrl.text = '888';
    setState(() {});
  }

  double get _totalPayable {
    if (widget.isMonthlyRent) {
      return widget.agreement.agreedMonthlyRent > 0
          ? widget.agreement.agreedMonthlyRent
          : 65000;
    }
    final deposit = widget.agreement.securityDeposit;
    final rent = widget.agreement.agreedMonthlyRent;
    return deposit > 0 ? deposit : rent * 2;
  }

  // ── Pay ───────────────────────────────────────────────────────────────────
  Future<void> _pay() async {
    if (_isProcessing) return;
    setState(() {
      _error = '';
      _isProcessing = true;
    });

    if (_method == 'card') {
      final num = _numberCtrl.text.replaceAll(' ', '');
      if (num.length < 15) {
        setState(() {
          _error = 'Please enter a valid 15 or 16-digit card number.';
          _isProcessing = false;
        });
        return;
      }
      if (_expiryCtrl.text.length < 5) {
        setState(() {
          _error = 'Please enter a valid expiry date (MM/YY).';
          _isProcessing = false;
        });
        return;
      }
      if (_cvvCtrl.text.length < 3) {
        setState(() {
          _error = 'Please enter a valid 3 or 4-digit CVV.';
          _isProcessing = false;
        });
        return;
      }
    }

    final brand = _cardBrand(_numberCtrl.text);
    final cardLast4 = _numberCtrl.text.replaceAll(' ', '').isNotEmpty
        ? _numberCtrl.text
              .replaceAll(' ', '')
              .substring(
                (_numberCtrl.text.replaceAll(' ', '').length - 4).clamp(0, 16),
              )
        : '4242';

    final methodName = _method == 'card'
        ? '${brand.name} Card (•••• $cardLast4) · $_selectedMonth'
        : 'Direct Bank Transfer · $_selectedMonth';

    final prefix = widget.isMonthlyRent ? 'RENT' : 'PAY';
    final ref_ =
        '$prefix-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';

    // Call backend & update SharedPreferences
    if (!widget.agreement.hasAgreed || _totalPayable <= 0) {
      setState(() {
        _isProcessing = false;
        _error = 'Please confirm the agreement and payment amount first.';
      });
      return;
    }
    final svc = ref.read(rentalServiceProvider);
    bool success;
    try {
      success = await svc.payAgreement(
        widget.agreement.id,
        _totalPayable,
        methodName,
        ref_,
        localAgreement: widget.agreement,
      );
    } catch (_) {
      success = false;
    }
    if (!mounted) return;
    if (!success) {
      setState(() {
        _isProcessing = false;
        _error = 'Payment was not confirmed. Refresh payment history before retrying.';
      });
      return;
    }

    if (mounted) {
      setState(() {
        _isProcessing = false;
        _paymentSuccess = true;
      });
      _successController.forward();

      ref.read(agreementsProvider.notifier).refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        title: Text(
          _paymentSuccess
              ? 'Payment Successful'
              : (widget.isMonthlyRent
                    ? 'Pay Monthly Rent'
                    : 'Complete Activation Payment'),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: _paymentSuccess ? _buildSuccess() : _buildPaymentForm(),
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  Widget _buildSuccess() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ScaleTransition(
              scale: _successScale,
              child: Container(
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  color: const Color(0xFF293F35),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.teal.withAlpha(80),
                      blurRadius: 30,
                      spreadRadius: 6,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: Colors.white,
                  size: 60,
                ),
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'Payment Successful!',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Your payment of LKR ${_fmtMoney(_totalPayable)} for $_selectedMonth has been processed.\n${widget.isMonthlyRent ? "Monthly rent receipt recorded!" : "Your lease is now active!"}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFECF1EC),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.verified_rounded,
                    color: Color(0xFF426253),
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    widget.isMonthlyRent
                        ? 'Paid for $_selectedMonth ✓'
                        : 'Active Lease ✓',
                    style: const TextStyle(
                      color: Color(0xFF293F35),
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 36),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  if (!widget.isMonthlyRent) {
                    Navigator.pop(context);
                  }
                },
                icon: const Icon(Icons.home_rounded),
                label: const Text('Back to My Rentals'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Payment Form ──────────────────────────────────────────────────────────
  Widget _buildPaymentForm() {
    final brand = _cardBrand(_numberCtrl.text);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Summary Banner
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF293F35),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppColors.teal.withAlpha(60),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.isMonthlyRent
                      ? 'Monthly Rent Payment'
                      : 'Lease Activation Payment',
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'LKR ${_fmtMoney(_totalPayable)}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 34,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -1,
                  ),
                ),
                Text(
                  '${widget.agreement.propertyTitle} · ${widget.agreement.propertyAddress}',
                  style: const TextStyle(color: Colors.white60, fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Billing Month Selector
          Container(
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
                    Icon(
                      Icons.calendar_month_rounded,
                      color: Color(0xFF526A78),
                      size: 18,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'PAYING RENT FOR MONTH',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                        fontSize: 12,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _selectedMonth,
                  isExpanded: true,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF526A78)),
                    ),
                    fillColor: Colors.white,
                    filled: true,
                  ),
                  style: const TextStyle(
                    color: AppColors.ink,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                  items: _billingMonths.map((m) {
                    return DropdownMenuItem<String>(
                      value: m,
                      child: Text(m, overflow: TextOverflow.ellipsis),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _selectedMonth = val);
                  },
                ),
                const SizedBox(height: 6),
                const Text(
                  'Select which calendar month this payment applies to.',
                  style: TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Error
          if (_error.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    color: Colors.red,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error,
                      style: const TextStyle(
                        color: Colors.red,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Method Selector
          const _Label('Payment Method'),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _MethodChip(
                  icon: Icons.credit_card_rounded,
                  label: 'Card',
                  selected: _method == 'card',
                  onTap: () => setState(() => _method = 'card'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MethodChip(
                  icon: Icons.account_balance_rounded,
                  label: 'Bank Transfer',
                  selected: _method == 'bank',
                  onTap: () => setState(() => _method = 'bank'),
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          if (_method == 'card') ...[
            // Visual Card Mockup
            _CardMockup(
              brand: brand,
              number: _numberCtrl.text,
              holder: _holderCtrl.text,
              expiry: _expiryCtrl.text,
            ),
            const SizedBox(height: 12),

            // Demo autofill
            Align(
              alignment: Alignment.centerRight,
              child: GestureDetector(
                onTap: _fillDemo,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECF1EC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF86EFAC)),
                  ),
                  child: const Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Icon(Icons.auto_awesome, size: 14, color: AppColors.teal),
                      SizedBox(width: 6),
                      Text(
                        'Autofill Test Card (4242)',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.teal,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Cardholder Name
            const _Label('Cardholder Name'),
            const SizedBox(height: 6),
            TextField(
              controller: _holderCtrl,
              textCapitalization: TextCapitalization.words,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: 'Full name as on card',
                prefixIcon: Icon(Icons.person_outline_rounded, size: 18),
              ),
            ),
            const SizedBox(height: 12),

            // Card Number
            const _Label('Card Number'),
            const SizedBox(height: 6),
            TextField(
              controller: _numberCtrl,
              keyboardType: TextInputType.number,
              maxLength: 19,
              onChanged: (v) {
                _formatCardNumber(v);
                setState(() {});
              },
              decoration: const InputDecoration(
                hintText: '4242 4242 4242 4242',
                prefixIcon: Icon(Icons.credit_card_rounded, size: 18),
                counterText: '',
              ),
              style: const TextStyle(fontFamily: 'monospace', letterSpacing: 2),
            ),
            const SizedBox(height: 12),

            // Expiry + CVV
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _Label('Expiry Date'),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _expiryCtrl,
                        keyboardType: TextInputType.number,
                        maxLength: 5,
                        onChanged: (v) {
                          _formatExpiry(v);
                          setState(() {});
                        },
                        decoration: const InputDecoration(
                          hintText: 'MM/YY',
                          prefixIcon: Icon(
                            Icons.calendar_today_rounded,
                            size: 16,
                          ),
                          counterText: '',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _Label('CVV / CVC'),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _cvvCtrl,
                        keyboardType: TextInputType.number,
                        maxLength: 4,
                        obscureText: true,
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                          hintText: '•••',
                          prefixIcon: Icon(
                            Icons.lock_outline_rounded,
                            size: 16,
                          ),
                          counterText: '',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],

          if (_method == 'bank') ...[
            Container(
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
                    'Bank Transfer Details',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _BankRow('Bank', 'Commercial Bank of Ceylon'),
                  _BankRow('Account Name', 'RentWise Escrow Account'),
                  _BankRow('Account No.', '8002 4567 8901 2345'),
                  _BankRow('Branch', 'Malabe Branch (Code: 104)'),
                  const Divider(height: 20),
                  Text(
                    'Please include your Agreement ID and billing month ($_selectedMonth) in the transfer reference.',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Reference: ${widget.agreement.id}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.teal,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 24),

          // Security note
          Wrap(
            children: [
              const Icon(Icons.lock_rounded, size: 14, color: AppColors.muted),
              const SizedBox(width: 6),
              Text(
                'Secured by 256-bit SSL encryption',
                style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Pay Button
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _isProcessing ? null : _pay,
              icon: _isProcessing
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : const Icon(Icons.payment_rounded),
              label: Text(
                _isProcessing
                    ? 'Processing Payment…'
                    : 'Confirm & Pay LKR ${_fmtMoney(_totalPayable)}',
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                backgroundColor: const Color(0xFF426253),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
                textStyle: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
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
// Visual Credit Card Mockup
// ─────────────────────────────────────────────────────────────────────────────
class _CardMockup extends StatelessWidget {
  final ({String name, List<Color> colors, Color accent}) brand;
  final String number;
  final String holder;
  final String expiry;

  const _CardMockup({
    required this.brand,
    required this.number,
    required this.holder,
    required this.expiry,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 190,
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF293F35),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: brand.colors.last.withAlpha(100),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Chip
              Container(
                width: 40,
                height: 28,
                decoration: BoxDecoration(
                  color: const Color(0xFFD4C3A0),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              // Brand name
              Text(
                brand.name,
                style: TextStyle(
                  color: brand.accent,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  letterSpacing: 2,
                ),
              ),
            ],
          ),
          const Spacer(),
          // Card number
          Text(
            number.isNotEmpty ? number : '•••• •••• •••• ••••',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
              letterSpacing: 3,
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'CARDHOLDER',
                    style: TextStyle(
                      color: Colors.white38,
                      fontSize: 9,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    (holder.isNotEmpty ? holder : 'FULL NAME').toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'EXPIRES',
                    style: TextStyle(
                      color: Colors.white38,
                      fontSize: 9,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    expiry.isNotEmpty ? expiry : 'MM/YY',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
class _Label extends StatelessWidget {
  final String text;

  const _Label(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
        fontSize: 13,
      ),
    );
  }
}

class _MethodChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _MethodChip({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected ? AppColors.softTeal : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.teal : AppColors.line,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: selected ? AppColors.teal : AppColors.muted,
              size: 24,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12,
                color: selected ? AppColors.teal : AppColors.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BankRow extends StatelessWidget {
  final String label;
  final String value;

  const _BankRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.ink,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

String _fmtMoney(double v) => v
    .toStringAsFixed(0)
    .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
