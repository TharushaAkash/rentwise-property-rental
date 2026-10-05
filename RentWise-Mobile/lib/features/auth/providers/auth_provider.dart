import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../../../shared/services/token_store.dart';
import '../../../shared/services/biometric_service.dart';
import '../../properties/property_service.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

final authStateProvider = AsyncNotifierProvider<AuthNotifier, UserModel?>(() {
  return AuthNotifier();
});

class AuthNotifier extends AsyncNotifier<UserModel?> {
  late final AuthService _authService;

  @override
  FutureOr<UserModel?> build() {
    _authService = ref.read(authServiceProvider);
    return null;
  }

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final user = await _authService.login(email, password);
      state = AsyncValue.data(user);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> register(
    String name,
    String email,
    String password,
    String role,
    String phone,
    String nic,
  ) async {
    state = const AsyncValue.loading();
    try {
      final user = await _authService.register(
        name,
        email,
        password,
        role,
        phone,
        nic,
      );
      state = AsyncValue.data(user);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> updateProfile(Map<String, dynamic> changes) async {
    final current = state.value;
    if (current == null) throw StateError('Please sign in.');
    final data = await ref
        .read(propertyServiceProvider)
        .request('PUT', '/auth/profile', changes);
    if (state.value?.id != current.id) return;
    final updated = UserModel.fromJson(Map<String, dynamic>.from(data));
    await TokenStore.instance.write(updated.token);
    state = AsyncData(updated);
  }

  Future<void> refreshProfile() async {
    final current = state.value;
    if (current == null) return;
    final data = await ref
        .read(propertyServiceProvider)
        .request('GET', '/auth/profile');
    if (state.value?.id != current.id) return;
    state = AsyncData(
      UserModel.fromJson({
        ...Map<String, dynamic>.from(data),
        'token': current.token,
      }),
    );
  }

  Future<void> biometricLogin() async {
    if (await BiometricService.instance.rememberedEmail() == null)
      throw StateError(
        'Sign in with your password and enable biometrics in your profile first.',
      );
    if (!await BiometricService.instance.authenticate()) return;
    final token = await TokenStore.instance.read();
    if (token == null) throw StateError('Please sign in with your password.');
    final api = PropertyService(token);
    try {
      final data = await api.request('GET', '/auth/profile');
      state = AsyncData(
        UserModel.fromJson({
          ...Map<String, dynamic>.from(data),
          'token': token,
        }),
      );
    } finally {
      api.close();
    }
  }

  Future<void> logout() async {
    state = const AsyncValue.loading();
    await _authService.logout();
    state = const AsyncValue.data(null);
  }
}
