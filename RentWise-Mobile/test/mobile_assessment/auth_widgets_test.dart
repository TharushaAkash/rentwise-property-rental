import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rentwise_mobile/features/auth/models/user_model.dart';
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';
import 'package:rentwise_mobile/features/auth/screens/login_screen.dart';
import 'package:rentwise_mobile/features/auth/screens/forgot_password_screen.dart';
import 'package:rentwise_mobile/features/home/screens/home_screen.dart';
import 'support/fixtures.dart';

void main() {
  testWidgets('MOB-01 login main widgets render correctly', (tester) async {
    await mountAssessment(tester, const LoginScreen());
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.widgetWithText(FilledButton, 'Sign In to Account'), findsOneWidget);
  });
  testWidgets('MOB-02 empty required fields block login submission', (tester) async {
    final auth = FakeAuthService();
    await mountAssessment(tester, const LoginScreen(), auth: auth);
    await submitLogin(tester, email: '', password: '');
    await tester.pumpAndSettle();
    expect(find.text('Enter your email address.'), findsOneWidget);
    expect(find.text('Enter your password.'), findsOneWidget);
    expect(auth.loginCalls, 0);
  });
  testWidgets('MOB-03 valid form passes trimmed email and original password to action', (tester) async {
    final auth = FakeAuthService()..pendingLogin = Completer<UserModel?>();
    await mountAssessment(tester, const LoginScreen(), auth: auth);
    await submitLogin(tester, email: ' tenant@example.com ', password: 'Password123!');
    expect(auth.loginCalls, 1);
    expect(auth.email, 'tenant@example.com');
    expect(auth.password, 'Password123!');
    auth.pendingLogin!.complete(null);
    await tester.pumpAndSettle();
  });
  testWidgets('MOB-04 forgot password navigation opens destination screen', (tester) async {
    await mountAssessment(tester, const LoginScreen());
    await tester.pumpAndSettle();
    final link = find.text('Forgot password?');
    await tester.ensureVisible(link);
    await tester.tap(link);
    await tester.pumpAndSettle();
    expect(find.byType(ForgotPasswordScreen), findsOneWidget);
  });
  testWidgets('MOB-07 malformed and overlong email rejected; one character sign-in password accepted', (tester) async {
    final auth = FakeAuthService()..pendingLogin = Completer<UserModel?>();
    await mountAssessment(tester, const LoginScreen(), auth: auth);
    await submitLogin(tester, email: 'bad-email', password: 'x');
    await tester.pumpAndSettle();
    expect(find.text('Enter a valid email address.'), findsOneWidget);
    expect(auth.loginCalls, 0);
    await submitLogin(tester, email: '${List.filled(201, 'a').join()}@example.com', password: 'x');
    await tester.pumpAndSettle();
    expect(auth.loginCalls, 0);
    await submitLogin(tester, password: 'x');
    expect(auth.loginCalls, 1);
    auth.pendingLogin!.complete(null);
    await tester.pumpAndSettle();
  });
  testWidgets('MOB-08 pending login displays progress and disables resubmission', (tester) async {
    final auth = FakeAuthService()..pendingLogin = Completer<UserModel?>();
    await mountAssessment(tester, const LoginScreen(), auth: auth);
    await submitLogin(tester);
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
    expect(auth.loginCalls, 1);
    auth.pendingLogin!.complete(null);
    await tester.pumpAndSettle();
  });
  testWidgets('MOB-11 invalid credentials display error and keep login screen', (tester) async {
    final auth = FakeAuthService()..loginError = Exception('Invalid email or password.');
    final container = await mountAssessment(tester, const LoginScreen(), auth: auth);
    await submitLogin(tester);
    await tester.pumpAndSettle();
    expect(find.text('Invalid email or password.'), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
    expect(container.read(authStateProvider), isA<AsyncError<UserModel?>>());
    expect(auth.savedToken, isNull);
  });
  testWidgets('MOB-12 valid login opens HomeScreen and authenticated state', (tester) async {
    final auth = FakeAuthService();
    final container = await mountAssessment(tester, const LoginScreen(), auth: auth);
    await submitLogin(tester);
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(LoginScreen), findsNothing);
    expect(container.read(authStateProvider).value?.id, 'tenant-1');
    expect(auth.savedToken, 'test-token');
    expect(tester.takeException(), isNull);
  });
}
