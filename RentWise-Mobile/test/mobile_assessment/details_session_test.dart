import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';
import 'package:rentwise_mobile/features/auth/services/auth_service.dart';
import 'package:rentwise_mobile/features/auth/screens/login_screen.dart';
import 'package:rentwise_mobile/features/home/models/property_model.dart';
import 'package:rentwise_mobile/features/home/screens/home_screen.dart';
import 'package:rentwise_mobile/features/profile/screens/profile_screen.dart';
import 'package:rentwise_mobile/features/properties/screens/property_detail_screen.dart';
import 'package:rentwise_mobile/shared/services/token_store.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'support/fixtures.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('MOB-13 selected property detail displays title address rent and description', (tester) async {
    await mountAssessment(tester, PropertyDetailScreen(property: sampleProperty), signedIn: true);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Garden House'), 150, scrollable: find.byType(Scrollable).first);
    expect(find.text('Garden House'), findsWidgets);
    expect(find.text('12 Main Road, Colombo'), findsWidgets);
    expect(find.text('50,000'), findsWidgets);
    await tester.scrollUntilVisible(find.text(sampleProperty.description), 150, scrollable: find.byType(Scrollable).first);
    expect(find.text(sampleProperty.description), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('MOB-14 long property content at narrow width has no overflow', (tester) async {
    final longTitle = List.filled(12, 'Spacious family house').join(' ');
    final description = List.filled(80, 'A comfortable home with garden and parking.').join(' ');
    final property = PropertyModel.fromJson({...sampleJson, 'title': longTitle, 'description': description});
    await mountAssessment(tester, PropertyDetailScreen(property: property), signedIn: true, details: property);
    tester.view.physicalSize = const Size(320, 812);
    await tester.pumpAndSettle();
    // Exercise the whole lazy scroll view, checking each rendered section.
    final scroll = find.byType(Scrollable).first;
    expect(tester.takeException(), isNull);
    for (var i = 0; i < 16; i++) {
      await tester.drag(scroll, const Offset(0, -250));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'Overflow/exception after scroll $i');
    }
  });
  testWidgets('MOB-15 sign out clears auth state and blocks home after logout', (tester) async {
    final auth = FakeAuthService();
    final container = await mountAssessment(tester, const ProfileScreen(), auth: auth, signedIn: true);
    await tester.pumpAndSettle();
    expect(container.read(authStateProvider).value?.id, 'tenant-1');
    final button = find.widgetWithText(OutlinedButton, 'Sign out');
    await tester.scrollUntilVisible(button, 200, scrollable: find.byType(Scrollable).first);
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(auth.logoutCalls, 1);
    expect(auth.savedToken, isNull);
    expect(container.read(authStateProvider).value, isNull);
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(ProfileScreen), findsNothing);
    // Attempt opening the protected home again with the same logged-out container.
    final context = tester.element(find.byType(LoginScreen));
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const HomeScreen()));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('Welcome back'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  test('MOB-15 real logout clears token stores with mocked platform storage', () async {
    FlutterSecureStorage.setMockInitialValues({'auth_token': 'stored-session'});
    SharedPreferences.setMockInitialValues({'auth_token': 'legacy-session'});
    await AuthService().logout();
    expect(await TokenStore.instance.read(), isNull);
    expect((await SharedPreferences.getInstance()).containsKey('auth_token'), isFalse);
  });
}
