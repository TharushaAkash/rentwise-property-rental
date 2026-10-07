import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:rentwise_mobile/main.dart' as app;
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';
import 'package:rentwise_mobile/features/auth/screens/login_screen.dart';
import 'package:rentwise_mobile/features/home/screens/home_screen.dart';
import 'package:rentwise_mobile/features/home/models/property_model.dart';
import 'package:rentwise_mobile/features/properties/property_service.dart';
import 'package:rentwise_mobile/features/properties/screens/property_detail_screen.dart';
import 'package:rentwise_mobile/shared/services/token_store.dart';

const apiUrl = String.fromEnvironment('API_BASE_URL');
const email = String.fromEnvironment('E2E_EMAIL');
const password = String.fromEnvironment('E2E_PASSWORD');
const propertyId = String.fromEnvironment('E2E_PROPERTY_ID');

Future<void> waitFor(WidgetTester tester, bool Function() ready, String description) async {
  final deadline = DateTime.now().add(const Duration(seconds: 120));
  while (!ready()) {
    if (DateTime.now().isAfter(deadline)) fail('Timed out waiting for $description');
    await tester.pump(const Duration(milliseconds: 200));
  }
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('MOB-LIVE-01 real login, API browse, property details and logout', (tester) async {
    expect(apiUrl, isNotEmpty, reason: 'Set API_BASE_URL explicitly; no default server is used for this test.');
    expect(email, isNotEmpty, reason: 'Set E2E_EMAIL for a dedicated tenant test account.');
    expect(password, isNotEmpty, reason: 'Set E2E_PASSWORD.');
    expect(propertyId, isNotEmpty, reason: 'Set E2E_PROPERTY_ID for a visible active listing on the first browse page.');
    final uri = Uri.tryParse(apiUrl);
    expect(uri != null && uri.hasAuthority && ['http', 'https'].contains(uri.scheme), isTrue);
    expect(apiUrl.endsWith('/api'), isTrue, reason: 'API_BASE_URL must end in /api without a trailing slash.');

    // Real platform token storage and real providers: no fake services or overrides.
    await TokenStore.instance.clear();
    addTearDown(() async {
      await tester.pumpWidget(const SizedBox.shrink());
      await TokenStore.instance.clear();
    });
    app.main();
    await waitFor(tester, () => find.text('Sign in').evaluate().isNotEmpty, 'welcome screen');
    await tester.tap(find.text('Sign in'));
    await waitFor(tester, () => find.byType(LoginScreen).evaluate().isNotEmpty, 'login screen');
    await tester.enterText(find.byType(TextFormField).at(0), email);
    await tester.enterText(find.byType(TextFormField).at(1), password);
    final signIn = find.widgetWithText(FilledButton, 'Sign In to Account');
    await tester.ensureVisible(signIn);
    await tester.tap(signIn);
    await tester.pump();
    final container = ProviderScope.containerOf(tester.element(find.byType(LoginScreen)), listen: false);
    await waitFor(tester, () => !container.read(authStateProvider).isLoading, 'real authentication response');
    final auth = container.read(authStateProvider);
    expect(auth.error, isNull, reason: 'Real backend login failed. Check test account and API connectivity.');
    final user = auth.value;
    expect(user, isNotNull);
    expect(user!.role, 'Tenant', reason: 'Use a tenant account for the discover workflow.');
    expect(user.token, isNotEmpty);
    expect(await TokenStore.instance.read(), user.token);
    await waitFor(tester, () => find.byType(HomeScreen).evaluate().isNotEmpty, 'authenticated home');

    final api = PropertyService(user.token);
    addTearDown(api.close);
    // Read the same real browse endpoint as the UI, then verify the selected backend fields.
    final page = await api.request('GET', '/properties/browse?pageSize=12&location=');
    final items = (page['items'] as List).map((item) => PropertyModel.fromJson(Map<String, dynamic>.from(item))).toList();
    final matches = items.where((item) => item.id == propertyId).toList();
    expect(matches, hasLength(1), reason: 'The configured listing must be present on the first live browse page.');
    final unavailable = await api.request('GET', '/properties/unavailable') as List;
    expect(unavailable.map((id) => id.toString()), isNot(contains(propertyId)), reason: 'Choose an unbooked listing.');
    final expected = PropertyModel.fromJson(Map<String, dynamic>.from(await api.request('GET', '/properties/$propertyId')));
    expect(expected.title, isNotEmpty);
    expect(expected.address, isNotEmpty);

    await waitFor(tester, () => find.byType(CircularProgressIndicator).evaluate().isEmpty, 'live catalogue UI');
    expect(find.text('Could not load properties.'), findsNothing);
    await tester.scrollUntilVisible(find.text(matches.single.title), 200, maxScrolls: 40,
      scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text(matches.single.title));
    await waitFor(tester, () => find.byType(PropertyDetailScreen).evaluate().isNotEmpty, 'listing navigation');
    expect(tester.widget<PropertyDetailScreen>(find.byType(PropertyDetailScreen)).property.id, propertyId);
    await waitFor(tester, () => container.read(propertyDetailsProvider(propertyId)).hasValue, 'live property details');
    expect(container.read(propertyDetailsProvider(propertyId)).value?.title, expected.title);
    await tester.scrollUntilVisible(find.text(expected.title), 150, maxScrolls: 30,
      scrollable: find.byType(Scrollable).first);
    expect(find.text(expected.title), findsWidgets);
    expect(find.text(expected.address), findsWidgets);

    // Real logout service clears secure storage; protected home must then show login.
    await container.read(authStateProvider.notifier).logout();
    expect(container.read(authStateProvider).value, isNull);
    expect(await TokenStore.instance.read(), isNull);
    final context = tester.element(find.byType(PropertyDetailScreen));
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) => const HomeScreen()), (_) => false);
    await waitFor(tester, () => find.byType(LoginScreen).evaluate().isNotEmpty, 'logged-out protected home');
    expect(find.byType(NavigationBar), findsNothing);
  }, timeout: const Timeout(Duration(minutes: 8)));
}
