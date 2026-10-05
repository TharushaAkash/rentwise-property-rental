import 'dart:convert';

import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'token_store.dart';

class BiometricService {
  static final instance = BiometricService();
  final LocalAuthentication _auth = LocalAuthentication();
  String _key(String email) =>
      'biometric_enabled_${email.trim().toLowerCase()}';
  Future<bool> enabled(String email) async =>
      (await SharedPreferences.getInstance()).getBool(_key(email)) ?? false;
  Future<bool> available() async =>
      await _auth.canCheckBiometrics &&
      (await _auth.getAvailableBiometrics()).isNotEmpty;
  Future<bool> authenticate() async {
    if (!await available())
      throw Exception(
        'Set up fingerprint or face recognition in your device settings first.',
      );
    return _auth.authenticate(
      localizedReason: 'Unlock your RentWise account',
      biometricOnly: true,
    );
  }

  Future<void> setEnabled(String email, bool value) async {
    if (!await authenticate())
      throw Exception('Biometric confirmation was cancelled.');
    await (await SharedPreferences.getInstance()).setBool(_key(email), value);
  }

  Future<String?> rememberedEmail() async {
    final token = await TokenStore.instance.read();
    try {
      final claims = jsonDecode(
        utf8.decode(
          base64Url.decode(base64Url.normalize(token!.split('.')[1])),
        ),
      );
      final expiry = claims['exp'];
      if (expiry is num &&
          expiry * 1000 <= DateTime.now().millisecondsSinceEpoch)
        return null;
      final email = claims['email']?.toString();
      return email != null && await enabled(email) ? email : null;
    } catch (_) {
      return null;
    }
  }
}
