import '../../../shared/validation/payment_validators.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../property_service.dart';
import '../../auth/providers/auth_provider.dart';

class ListingStatusScreen extends ConsumerStatefulWidget {
  final String propertyId;
  const ListingStatusScreen({super.key, required this.propertyId});
  @override
  ConsumerState<ListingStatusScreen> createState() =>
      _ListingStatusScreenState();
}

class _ListingStatusScreenState extends ConsumerState<ListingStatusScreen> {
  Map<String, dynamic>? data;
  bool busy = true;
  String? error;
  final holder = TextEditingController();
  final number = TextEditingController();
  final expiry = TextEditingController();
  final cvv = TextEditingController();
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    holder.dispose();
    number.dispose();
    expiry.dispose();
    cvv.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final result = await ref
          .read(propertyServiceProvider)
          .request(
            'GET',
            '/properties/${widget.propertyId}/verification-status',
          );
      if (mounted) {
        setState(() {
          data = Map<String, dynamic>.from(result);
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> submit(bool approve) async {
    if (!approve) {
      final errors = PaymentValidators.validate(
        holder: holder.text,
        number: number.text,
        date: expiry.text,
        code: cvv.text,
      );
      if (errors.isNotEmpty) {
        setState(() => error = errors.values.first);
        return;
      }
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          approve ? 'Approve listing?' : 'Submit listing fee payment?',
        ),
        content: Text(
          approve
              ? 'Confirm you have reviewed the ownership documents and fee.'
              : 'Record the LKR 2,500 demo card payment? No real money will be charged.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref
          .read(propertyServiceProvider)
          .request(
            approve ? 'PUT' : 'POST',
            '/properties/${widget.propertyId}/${approve ? 'approve' : 'listing-fee'}',
            approve
                ? <String, dynamic>{}
                : {
                    'amount': 2500,
                    'paymentMethod': 'Demo Card',
                    'paymentReference':
                        'FEE-${DateTime.now().microsecondsSinceEpoch}',
                  },
          );
      ref.invalidate(managedPropertiesProvider);
      await load();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Listing verification & fee')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (busy) const LinearProgressIndicator(),
        if (error != null) Text(error!),
        if (data == null && !busy)
          TextButton(onPressed: load, child: const Text('Retry')),
        if (data != null) ...[
          ListTile(
            title: const Text('Ownership proof'),
            subtitle: Text(
              data!['isProofUploaded'] == true
                  ? 'Submitted'
                  : 'Add your proof in Edit Details',
            ),
          ),
          ListTile(
            title: const Text('Listing fee - LKR 2,500'),
            subtitle: Text(
              data!['isFeePaid'] == true
                  ? 'Payment recorded'
                  : 'Payment required before publication',
            ),
          ),
          ListTile(
            title: const Text('Listing status'),
            subtitle: Text(data!['status'].toString()),
          ),
          if (data!['isFeePaid'] != true) ...[
            const Text(
              'Card checkout',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            const Text(
              'Demo checkout, matching booking payments. No real money is charged. Use test card details.',
            ),
            const SizedBox(height: 16),
            TextField(
              controller: holder,
              enabled: !busy,
              decoration: const InputDecoration(labelText: 'Cardholder name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: number,
              enabled: !busy,
              keyboardType: TextInputType.number,
              maxLength: 19,
              decoration: const InputDecoration(
                labelText: 'Card number',
                hintText: '4242 4242 4242 4242',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: expiry,
                    enabled: !busy,
                    maxLength: 5,
                    keyboardType: TextInputType.datetime,
                    decoration: const InputDecoration(
                      labelText: 'Expiry',
                      hintText: 'MM/YY',
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: cvv,
                    enabled: !busy,
                    maxLength: 4,
                    obscureText: true,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'CVV'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: busy ? null : () => submit(false),
              child: const Text('Pay LKR 2,500 (Demo)'),
            ),
          ],
          if (isAdmin(ref.watch(authStateProvider).value?.role))
            FilledButton(
              onPressed:
                  busy ||
                      data!['isFeePaid'] != true ||
                      data!['isProofUploaded'] != true
                  ? null
                  : () => submit(true),
              child: const Text('Approve listing'),
            ),
        ],
      ],
    ),
  );
}
