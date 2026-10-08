import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';
import 'package:rentwise_mobile/features/properties/property_service.dart';
import 'package:rentwise_mobile/features/home/models/property_model.dart';
import 'package:rentwise_mobile/features/properties/screens/property_detail_screen.dart';
import 'package:rentwise_mobile/shared/services/token_store.dart';
import 'package:rentwise_mobile/shared/utils/api_constants.dart';

const apiBase = String.fromEnvironment('API_BASE_URL');
const ownerEmail = String.fromEnvironment('OWNER_EMAIL');
const ownerPassword = String.fromEnvironment('OWNER_PASSWORD');
const expectedId = String.fromEnvironment('EXPECTED_PROPERTY_ID');
const expectedTitle = String.fromEnvironment('EXPECTED_TITLE');
const expectedAddress = String.fromEnvironment('EXPECTED_ADDRESS');
const expectedRent = String.fromEnvironment('EXPECTED_RENT');

Future<void> waitUntil(WidgetTester tester, bool Function() ready, String reason) async {
  final deadline = DateTime.now().add(const Duration(seconds: 120));
  while (!ready()) {
    if (DateTime.now().isAfter(deadline)) fail('Timed out: $reason');
    await tester.pump(const Duration(milliseconds: 200));
  }
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('INT-03 Flutter displays the same real property created on web', (tester) async {
    for (final value in [apiBase, ownerEmail, ownerPassword, expectedId, expectedTitle, expectedAddress, expectedRent]) {
      expect(value, isNotEmpty, reason: 'Run web INT-03 then prepare-mobile.ps1 first.');
    }
    expect(ApiConstants.baseUrl, apiBase);
    await TokenStore.instance.clear();
    final container = ProviderContainer();
    addTearDown(() async {
      await tester.pumpWidget(const SizedBox.shrink());
      container.dispose();
      await TokenStore.instance.clear();
    });
    await container.read(authStateProvider.future);
    await container.read(authStateProvider.notifier).login(ownerEmail, ownerPassword);
    final auth = container.read(authStateProvider);
    expect(auth.error, isNull, reason: 'Real owner authentication must succeed');
    expect(auth.value, isNotNull);
    expect(['Owner', 'PropertyOwner', 'Admin', 'Administrator', 'SystemAdmin'], contains(auth.value!.role));
    final service = PropertyService(auth.value!.token);
    addTearDown(service.close);
    final json = Map<String, dynamic>.from(await service.request('GET', '/properties/$expectedId'));
    final property = PropertyModel.fromJson(json);
    expect(property.id, expectedId);
    expect(property.title, expectedTitle);
    expect(property.address, expectedAddress);
    expect(property.monthlyRent, double.parse(expectedRent));
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp(home: PropertyDetailScreen(property: property)),
    ));
    // Real screen provider fetches again from the shared backend; no overrides/mocks.
    await waitUntil(tester, () => container.read(propertyDetailsProvider(expectedId)).hasValue,
      'real Flutter detail provider');
    final loaded = container.read(propertyDetailsProvider(expectedId)).value!;
    expect(loaded.id, expectedId);
    expect(loaded.title, expectedTitle);
    expect(loaded.address, expectedAddress);
    expect(loaded.monthlyRent, double.parse(expectedRent));
    await tester.scrollUntilVisible(find.text(expectedTitle), 150, maxScrolls: 30,
      scrollable: find.byType(Scrollable).first);
    expect(find.text(expectedTitle), findsWidgets);
    await tester.scrollUntilVisible(find.text(expectedAddress), 150, maxScrolls: 30,
      scrollable: find.byType(Scrollable).first);
    expect(find.text(expectedAddress), findsWidgets);
    print('INT-03 verified same backend property ID: $expectedId');
  }, timeout: const Timeout(Duration(minutes: 8)));
}
