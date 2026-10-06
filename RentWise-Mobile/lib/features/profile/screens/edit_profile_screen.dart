import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/validation/input_validators.dart';
import '../../auth/providers/auth_provider.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});
  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController(),
      phone = TextEditingController(),
      nic = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    final user = ref.read(authStateProvider).value;
    name.text = user?.name ?? '';
    phone.text = user?.phoneNumber ?? '';
    nic.text = user?.nicNumber ?? '';
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    nic.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref.read(authStateProvider.notifier).updateProfile({
        'name': name.text.trim(),
        'phoneNumber': phone.text.trim(),
        'nicNumber': nic.text.trim().toUpperCase(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Edit profile')),
    body: Form(
      key: form,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextFormField(
            controller: name,
            decoration: const InputDecoration(labelText: 'Full name'),
            validator: (v) =>
                v == null || v.trim().isEmpty ? 'Enter your full name.' : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: phone,
            keyboardType: TextInputType.phone,
            validator: InputValidators.phone,
            decoration: const InputDecoration(labelText: 'Phone number'),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: nic,
            validator: InputValidators.nic,
            decoration: const InputDecoration(labelText: 'NIC number'),
          ),
          const SizedBox(height: 16),
          const Text('Changing your NIC number requires verification again.'),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(error!),
            ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: busy ? null : save,
            child: Text(busy ? 'Saving...' : 'Save changes'),
          ),
        ],
      ),
    ),
  );
}
