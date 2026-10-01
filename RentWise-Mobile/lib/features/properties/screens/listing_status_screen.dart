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
  final reference = TextEditingController();
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    reference.dispose();
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
    if (!approve && reference.text.trim().isEmpty) {
      setState(() => error = 'Enter the listing fee payment reference.');
      return;
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
              : 'Confirm the LKR 2,500 listing fee payment reference is correct.',
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
                    'paymentMethod': 'Bank Transfer',
                    'paymentReference': reference.text.trim(),
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
            title: const Text('Listing fee ? LKR 2,500'),
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
            TextField(
              controller: reference,
              enabled: !busy,
              decoration: const InputDecoration(labelText: 'Payment reference'),
            ),
            FilledButton(
              onPressed: busy ? null : () => submit(false),
              child: const Text('Submit fee payment'),
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
