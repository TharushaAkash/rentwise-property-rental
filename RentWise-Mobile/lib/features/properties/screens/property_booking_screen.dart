import '../../shared/widgets/modern_ui.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../auth/providers/auth_provider.dart';
import '../../home/models/property_model.dart';
import '../../home/providers/property_provider.dart';
import '../property_service.dart';

DateTime leaseEndDate(DateTime start, int months) {
  final lastDay = DateTime(start.year, start.month + months + 1, 0).day;
  return DateTime(
    start.year,
    start.month + months,
    start.day > lastDay ? lastDay : start.day,
  );
}

class PropertyBookingScreen extends ConsumerStatefulWidget {
  const PropertyBookingScreen({super.key, required this.property});
  final PropertyModel property;
  @override
  ConsumerState<PropertyBookingScreen> createState() =>
      _PropertyBookingScreenState();
}

class _PropertyBookingScreenState extends ConsumerState<PropertyBookingScreen> {
  final _form = GlobalKey<FormState>();
  final _custom = TextEditingController(), _message = TextEditingController();
  int _months = 12;
  bool _useCustom = false, _busy = false;
  DateTime _start = DateUtils.dateOnly(DateTime.now())
      .add(const Duration(days: 1));
  String? _error;
  int get months => _useCustom ? int.tryParse(_custom.text) ?? 0 : _months;
  @override
  void dispose() {
    _custom.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final user = ref.read(authStateProvider).value;
      if (user?.role != 'Tenant') {
        throw Exception('Only tenants can book rental properties.');
      }
      final api = ref.read(propertyServiceProvider);
      final latest = await api.request(
        'GET',
        '/properties/${widget.property.id}',
      );
      if (PropertyModel.fromJson(Map<String, dynamic>.from(latest)).status !=
          'Active') {
        throw Exception('This property is no longer available.');
      }
      final applications =
          await api.request('GET', '/property-applications') as List;
      if (applications.any(
        (a) =>
            a['propertyId'] == widget.property.id &&
            ['Submitted', 'Pending', 'Accepted'].contains(a['status']),
      )) {
        throw Exception(
          'This property already has an active booking under landlord review.',
        );
      }
      final p = widget.property;
      final date = DateFormat('yyyy-MM-dd').format(_start);
      final end = DateFormat('yyyy-MM-dd').format(leaseEndDate(_start, months));
      await api.request('POST', '/property-applications', {
        'propertyId': p.id,
        'propertyTitle': p.title,
        'propertyAddress': p.address,
        'monthlyRent': p.monthlyRent,
        'durationMonths': months,
        'startDate': date,
        'endDate': end,
        'tenantId': user!.id,
        'tenantName': user.name,
        'tenantEmail': user.email,
        'status': 'Submitted',
        'message':
            'Duration: $months months | Start: $date | End: $end | Rent: ${p.monthlyRent} | Note: ${_message.text.trim().isEmpty ? 'Standard lease request under published terms.' : _message.text.trim()}',
      });
      ref.invalidate(applicationsProvider);
      ref.invalidate(propertiesProvider);
      ref.invalidate(bookedPropertiesProvider);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Booking request submitted. Awaiting landlord review.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(symbol: 'LKR ', decimalDigits: 0);
    final rent = widget.property.monthlyRent;
    return PopScope(
      canPop: !_busy,
      child: Scaffold(
        appBar: AppBar(title: const Text('Rental Booking Request')),
        body: AbsorbPointer(
          absorbing: _busy,
          child: Form(
            key: _form,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const FormHeading(
                    'Make your move',
                    'Choose your dates. Your owner will review the request.',
                    icon: Icons.calendar_month_outlined,
                  ),
                  PageIntro(
                    eyebrow: 'Your next home',
                    title: widget.property.title,
                    description:
                        '${widget.property.address}\n${money.format(rent)} / month',
                    icon: Icons.home_outlined,
                  ),
                  const SizedBox(height: 28),
                  if (_error != null)
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                  const FormHeading(
                    'Your stay',
                    'Select the lease length that works for you.',
                    icon: Icons.date_range_outlined,
                  ),
                  Wrap(
                    spacing: 8,
                    children: [3, 6, 12, 24]
                        .map(
                          (m) => ChoiceChip(
                            label: Text('$m Months'),
                            selected: !_useCustom && _months == m,
                            onSelected: (_) => setState(() {
                              _months = m;
                              _useCustom = false;
                            }),
                          ),
                        )
                        .toList(),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Custom number of months'),
                    value: _useCustom,
                    onChanged: (v) => setState(() => _useCustom = v),
                  ),
                  if (_useCustom)
                    TextFormField(
                      controller: _custom,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Months (1–60)',
                      ),
                      onChanged: (_) => setState(() {}),
                      validator: (v) {
                        final n = int.tryParse(v ?? '');
                        return n == null || n < 1 || n > 60
                            ? 'Enter 1 to 60 months'
                            : null;
                      },
                    ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final tomorrow = DateUtils.dateOnly(DateTime.now())
                          .add(const Duration(days: 1));
                      final date = await showDatePicker(
                        context: context,
                        initialDate: _start.isBefore(tomorrow)
                            ? tomorrow
                            : _start,
                        firstDate: tomorrow,
                        lastDate: DateTime.now().add(
                          const Duration(days: 1825),
                        ),
                      );
                      if (date != null && mounted) {
                        setState(() => _start = date);
                      }
                    },
                    icon: const Icon(Icons.calendar_month),
                    label: Text(
                      'Move in: ${DateFormat.yMMMd().format(_start)}',
                    ),
                  ),
                  Text(
                    'Lease ends: ${DateFormat.yMMMd().format(leaseEndDate(_start, months.clamp(1, 60)))}',
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _message,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Message to Landlord',
                      hintText: 'Special requests or details (optional)',
                    ),
                  ),
                  const SizedBox(height: 20),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Payment Summary',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 12),
                          DetailLine('Monthly rent', money.format(rent)),
                          DetailLine(
                            'Rent for $months months',
                            money.format(rent * months),
                          ),
                          DetailLine(
                            'Deposit ? 2 months',
                            money.format(rent * 2),
                          ),
                          const Divider(),
                          DetailLine(
                            'Total with deposit',
                            money.format(rent * (months + 2)),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'No payment is collected now. Your booking is subject to landlord approval.',
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(
                      _busy
                          ? 'Submitting Request...'
                          : 'Submit Booking Request',
                    ),
                  ),
                  TextButton(
                    onPressed: _busy ? null : () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
