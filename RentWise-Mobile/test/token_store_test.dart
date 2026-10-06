import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rentwise_mobile/shared/services/token_store.dart';

class FailingStorage extends FlutterSecureStorage {
  @override
  Future<void> write({
    required String key,
    required String? value,
    dynamic aOptions,
    dynamic iOptions,
    dynamic lOptions,
    dynamic wOptions,
    dynamic webOptions,
    dynamic mOptions,
  }) async {
    throw StateError('Secure write unavailable');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });
  test('Migrates legacy token once and removes plaintext', () async {
    SharedPreferences.setMockInitialValues({'auth_token': 'old-token'});
    final store = TokenStore();
    expect(await store.read(), 'old-token');
    expect(
      (await SharedPreferences.getInstance()).containsKey('auth_token'),
      false,
    );
    expect(
      await const FlutterSecureStorage().read(key: 'auth_token'),
      'old-token',
    );
  });
  test('Secure token wins over an obsolete plaintext token', () async {
    FlutterSecureStorage.setMockInitialValues({'auth_token': 'new-token'});
    SharedPreferences.setMockInitialValues({'auth_token': 'old-token'});
    expect(await TokenStore().read(), 'new-token');
    expect(
      (await SharedPreferences.getInstance()).containsKey('auth_token'),
      false,
    );
  });
  test('Logout waits for pending migration and clears both stores', () async {
    SharedPreferences.setMockInitialValues({'auth_token': 'old-token'});
    final store = TokenStore();
    await Future.wait([store.read(), store.clear()]);
    expect(await store.read(), isNull);
    expect(
      (await SharedPreferences.getInstance()).containsKey('auth_token'),
      false,
    );
  });
  test('Login writes only secure storage', () async {
    final store = TokenStore();
    await store.write('new-token');
    expect(await store.read(), 'new-token');
    expect(
      (await SharedPreferences.getInstance()).containsKey('auth_token'),
      false,
    );
  });
  test('Migration failure does not discard the old token', () async {
    SharedPreferences.setMockInitialValues({'auth_token': 'old-token'});
    await expectLater(
      TokenStore(storage: FailingStorage()).read(),
      throwsStateError,
    );
    expect(
      (await SharedPreferences.getInstance()).getString('auth_token'),
      'old-token',
    );
  });
}
