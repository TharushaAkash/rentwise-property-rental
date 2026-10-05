import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/services/biometric_service.dart';
import '../../auth/providers/auth_provider.dart';

class BiometricSettingsTile extends ConsumerStatefulWidget {
  const BiometricSettingsTile({super.key});
  @override
  ConsumerState<BiometricSettingsTile> createState() =>
      _BiometricSettingsTileState();
}

class _BiometricSettingsTileState extends ConsumerState<BiometricSettingsTile> {
  bool enabled = false, busy = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final email = ref.read(authStateProvider).value?.email;
    final value =
        email != null && await BiometricService.instance.enabled(email);
    if (mounted)
      setState(() {
        enabled = value;
        busy = false;
      });
  }

  Future<void> change(bool value) async {
    final email = ref.read(authStateProvider).value?.email;
    if (email == null) return;
    setState(() => busy = true);
    try {
      await BiometricService.instance.setEnabled(email, value);
      if (mounted) setState(() => enabled = value);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => SwitchListTile(
    secondary: const Icon(Icons.fingerprint),
    title: const Text('Fingerprint / device biometrics'),
    subtitle: const Text(
      'Unlock this account with your enrolled device biometrics',
    ),
    value: enabled,
    onChanged: busy ? null : change,
  );
}
