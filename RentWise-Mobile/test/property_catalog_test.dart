import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rentwise_mobile/features/home/providers/property_provider.dart';
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';
import 'package:rentwise_mobile/features/auth/models/user_model.dart';

class CatalogAuth extends AuthNotifier {
  @override
  UserModel build() => UserModel(
    id: 'tenant',
    name: 'Tenant',
    email: 'test@example.com',
    role: 'Tenant',
    token: 'fixture',
  );
}

void main() {
  test('An empty live catalogue stays empty, without demo listings', () async {
    final client = MockClient((_) async => http.Response('[]', 200));
    final container = ProviderContainer(
      overrides: [
        authStateProvider.overrideWith(CatalogAuth.new),
        propertyCatalogClientProvider.overrideWithValue(client),
      ],
    );
    addTearDown(container.dispose);
    addTearDown(client.close);
    expect(await container.read(propertiesProvider.future), isEmpty);
  });
  test(
    'Catalogue failures remain errors instead of showing demo homes',
    () async {
      final client = MockClient((_) async => http.Response('', 503));
      final container = ProviderContainer(
        overrides: [
          authStateProvider.overrideWith(CatalogAuth.new),
          propertyCatalogClientProvider.overrideWithValue(client),
        ],
      );
      addTearDown(container.dispose);
      addTearDown(client.close);
      await expectLater(
        container.read(propertiesProvider.future),
        throwsException,
      );
    },
  );
}
