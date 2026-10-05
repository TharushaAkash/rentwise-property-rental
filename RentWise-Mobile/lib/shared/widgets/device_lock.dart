import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/providers/auth_provider.dart';
import '../services/biometric_service.dart';

class DeviceLock extends ConsumerStatefulWidget {
  const DeviceLock({super.key, required this.child});
  final Widget child;
  @override
  ConsumerState<DeviceLock> createState() => _DeviceLockState();
}

class _DeviceLockState extends ConsumerState<DeviceLock>
    with WidgetsBindingObserver {
  bool locked = false, busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final user = ref.read(authStateProvider).value;
    if (user == null || busy) return;
    if (state == AppLifecycleState.paused) {
      // Cover private screens immediately while checking the device setting.
      setState(() => locked = true);
      BiometricService.instance.enabled(user.email).then((enabled) {
        if (mounted && !enabled) setState(() => locked = false);
      });
    } else if (state == AppLifecycleState.resumed && locked) {
      unlock();
    }
  }

  Future<void> unlock() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final user = ref.read(authStateProvider).value;
      final enabled =
          user != null && await BiometricService.instance.enabled(user.email);
      final success =
          !enabled || await BiometricService.instance.authenticate();
      if (mounted)
        setState(() {
          locked = !success;
        });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).value;
    return Stack(
      children: [
        widget.child,
        if (locked && user != null)
          Positioned.fill(
            child: Material(
              color: Theme.of(context).scaffoldBackgroundColor,
              child: PopScope(
                canPop: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.fingerprint, size: 64),
                        const SizedBox(height: 20),
                        const Text('RentWise is locked'),
                        if (error != null) Text(error!),
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: busy ? null : unlock,
                          child: Text(
                            busy
                                ? 'Authenticating...'
                                : 'Unlock with device biometrics',
                          ),
                        ),
                        TextButton(
                          onPressed: busy
                              ? null
                              : () async {
                                  await ref
                                      .read(authStateProvider.notifier)
                                      .logout();
                                  if (mounted) setState(() => locked = false);
                                },
                          child: const Text('Sign out'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
