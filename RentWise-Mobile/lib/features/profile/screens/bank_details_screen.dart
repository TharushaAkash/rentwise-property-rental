import '../../../shared/validation/input_validators.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../properties/property_service.dart';

class BankDetailsScreen extends ConsumerStatefulWidget {
  const BankDetailsScreen({super.key});
  @override
  ConsumerState<BankDetailsScreen> createState() => _BankDetailsScreenState();
}

class _BankDetailsScreenState extends ConsumerState<BankDetailsScreen> {
  final _form = GlobalKey<FormState>();
  final fields = {
    for (final key in ['bankName', 'accountName', 'accountNumber', 'branch'])
      key: TextEditingController(),
  };
  bool busy = true;
  bool loaded = false;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await ref
          .read(propertyServiceProvider)
          .request('GET', '/bank-details/mine');
      if (!mounted) return;
      for (final entry in fields.entries) {
        entry.value.text = data[entry.key]?.toString() ?? '';
      }
      setState(() {
        loaded = true;
        error = null;
      });
    } catch (_) {
      if (mounted) setState(() => error = 'Could not load bank details.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      await ref.read(propertyServiceProvider).request(
        'PUT',
        '/bank-details/mine',
        {for (final e in fields.entries) e.key: e.value.text.trim()},
      );
      if (mounted) {
        setState(() => error = null);
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Bank details saved.')));
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    for (final field in fields.values) {
      field.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Bank details')),
    body: Form(
      key: _form,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Tenants will see these details when paying by bank transfer.',
          ),
          if (busy) const LinearProgressIndicator(),
          if (error != null) Text(error!),
          if (!loaded && !busy)
            TextButton(onPressed: load, child: const Text('Retry')),
          for (final entry in {
            'bankName': 'Bank',
            'accountName': 'Account holder',
            'accountNumber': 'Account number',
            'branch': 'Branch',
          }.entries)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: TextFormField(
                validator: (value) =>
                    InputValidators.bankField(entry.key, value),
                controller: fields[entry.key],
                enabled: loaded && !busy,
                decoration: InputDecoration(labelText: entry.value),
              ),
            ),
          FilledButton(
            onPressed: busy || !loaded ? null : save,
            child: const Text('Save bank details'),
          ),
        ],
      ),
    ),
  );
}
