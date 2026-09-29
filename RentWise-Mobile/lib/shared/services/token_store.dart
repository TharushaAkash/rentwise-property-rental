import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Serialize migration, login and logout so a late read cannot restore a logged-out token.
class TokenStore {
  static final instance = TokenStore();
  final FlutterSecureStorage storage;
  Future<void> _pending = Future.value();
  TokenStore({this.storage = const FlutterSecureStorage()});

  Future<T> _serial<T>(Future<T> Function() action) {
    final result = _pending.then((_) => action());
    _pending = result.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return result;
  }

  Future<String?> read() => _serial(() async {
    final prefs = await SharedPreferences.getInstance();
    final secured = await storage.read(key: 'auth_token');
    if (secured != null) {
      await prefs.remove('auth_token');
      return secured;
    }
    final legacy = prefs.getString('auth_token');
    if (legacy != null && legacy.isNotEmpty) {
      // Remove plaintext only after the secure write succeeds.
      await storage.write(key: 'auth_token', value: legacy);
    }
    await prefs.remove('auth_token');
    return legacy?.isNotEmpty == true ? legacy : null;
  });

  Future<void> write(String token) => _serial(() async {
    await storage.write(key: 'auth_token', value: token);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  });

  Future<void> clear() => _serial(() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await storage.delete(key: 'auth_token');
  });
}
