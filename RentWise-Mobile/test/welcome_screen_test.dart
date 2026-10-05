import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rentwise_mobile/main.dart';
import 'package:rentwise_mobile/features/auth/screens/login_screen.dart';
import 'package:rentwise_mobile/features/auth/screens/signup_screen.dart';
import 'package:rentwise_mobile/features/auth/screens/welcome_screen.dart';
import 'package:rentwise_mobile/features/shared/theme/app_theme.dart';

void main() {
  testWidgets('app opens with welcome and navigates to both auth screens', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: RentWiseApp()));
    await tester.pumpAndSettle();
    expect(find.byType(WelcomeScreen), findsOneWidget);
    expect(find.byType(LoginScreen), findsNothing);
    await tester.ensureVisible(find.text('Sign in'));
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Create account'));
    await tester.tap(find.text('Create account'));
    await tester.pumpAndSettle();
    expect(find.byType(SignupScreen), findsOneWidget);
  });

  testWidgets('welcome fits a small screen with larger text', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: const TextScaler.linear(1.5)),
          child: child!,
        ),
        home: const WelcomeScreen(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Create account'));
    expect(tester.takeException(), isNull);
  });
}
