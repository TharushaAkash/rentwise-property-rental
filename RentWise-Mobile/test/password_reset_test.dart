import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rentwise_mobile/features/auth/screens/forgot_password_screen.dart';
import 'package:rentwise_mobile/features/auth/services/password_reset_service.dart';
import 'package:rentwise_mobile/features/shared/theme/app_theme.dart';

void main() {
  test(
    'Recovery requests send the expected email, code and reset token',
    () async {
      final requests = <http.Request>[];
      final service = PasswordResetService(
        client: MockClient((request) async {
          requests.add(request);
          if (request.url.path.endsWith('forgot-password')) {
            return http.Response('{"expiresInSeconds":60}', 200);
          }
          if (request.url.path.endsWith('verify-reset-code')) {
            return http.Response('{"resetToken":"verified-token"}', 200);
          }
          return http.Response('{"message":"Password reset"}', 200);
        }),
      );
      addTearDown(service.dispose);
      expect(await service.sendCode('test@example.com'), 60);
      final token = await service.verifyCode('test@example.com', '012345');
      await service.resetPassword(
        'test@example.com',
        token,
        'NewPassword123!',
        'NewPassword123!',
      );
      expect(jsonDecode(requests[1].body)['code'], '012345');
      expect(jsonDecode(requests[2].body), {
        'email': 'test@example.com',
        'resetToken': 'verified-token',
        'newPassword': 'NewPassword123!',
        'confirmPassword': 'NewPassword123!',
      });
    },
  );

  test(
    'Empty rate-limit responses and validation errors are readable',
    () async {
      final limited = PasswordResetService(
        client: MockClient((_) async => http.Response('', 429)),
      );
      final invalid = PasswordResetService(
        client: MockClient(
          (_) async => http.Response(
            '{"errors":{"ConfirmPassword":["Passwords do not match."]}}',
            400,
          ),
        ),
      );
      addTearDown(limited.dispose);
      addTearDown(invalid.dispose);
      await expectLater(
        limited.sendCode('test@example.com'),
        throwsA(predicate((e) => e.toString().contains('Too many requests'))),
      );
      await expectLater(
        invalid.resetPassword(
          'test@example.com',
          'token',
          'password',
          'different',
        ),
        throwsA(
          predicate((e) => e.toString().contains('Passwords do not match')),
        ),
      );
    },
  );

  testWidgets('Email, pasted OTP, password confirmation and success flow', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(430, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final service = FakeResetService();
    addTearDown(service.dispose);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: ForgotPasswordScreen(service: service),
      ),
    );
    await tester.enterText(find.byType(TextFormField), ' TEST@example.com ');
    await tester.tap(find.text('Send verification code'));
    await tester.pumpAndSettle();
    expect(service.email, 'test@example.com');
    expect(find.text('Code expires in 1:00'), findsOneWidget);
    expect(find.text('Resend code'), findsNothing);
    expect(find.byType(TextField), findsNWidgets(6));
    await tester.enterText(find.byType(TextField).first, '012345');
    await tester.pump();
    await tester.ensureVisible(find.text('Verify code'));
    await tester.tap(find.text('Verify code'));
    await tester.pumpAndSettle();
    expect(service.code, '012345');
    expect(find.text('Create a new password'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).first, 'NewPassword123!');
    await tester.enterText(
      find.byType(TextFormField).last,
      'WrongPassword123!',
    );
    await tester.ensureVisible(find.text('Reset password'));
    await tester.tap(find.text('Reset password'));
    await tester.pumpAndSettle();
    expect(find.text('Passwords do not match.'), findsOneWidget);
    expect(service.resetCount, 0);
    await tester.enterText(find.byType(TextFormField).last, 'NewPassword123!');
    await tester.ensureVisible(find.text('Reset password'));
    await tester.tap(find.text('Reset password'));
    await tester.pumpAndSettle();
    expect(service.resetCount, 1);
    expect(find.text('You’re all set!'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Expired code disables verification and allows resend', (
    tester,
  ) async {
    final service = FakeResetService()..seconds = 0;
    addTearDown(service.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: ForgotPasswordScreen(
          initialEmail: 'test@example.com',
          service: service,
        ),
      ),
    );
    await tester.ensureVisible(find.text('Send verification code'));
    await tester.tap(find.text('Send verification code'));
    await tester.pumpAndSettle();
    expect(find.text('Your code has expired.'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Verify code'),
          )
          .onPressed,
      isNull,
    );
    service.seconds = 60;
    await tester.ensureVisible(find.text('Resend code'));
    await tester.tap(find.text('Resend code'));
    await tester.pumpAndSettle();
    expect(find.text('Code expires in 1:00'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}

class FakeResetService extends PasswordResetService {
  String email = '';
  String code = '';
  int seconds = 60;
  int resetCount = 0;

  @override
  Future<int> sendCode(String email) async {
    this.email = email;
    return seconds;
  }

  @override
  Future<String> verifyCode(String email, String code) async {
    this.code = code;
    return 'verified-token';
  }

  @override
  Future<void> resetPassword(
    String email,
    String token,
    String password,
    String confirmation,
  ) async {
    expect(token, 'verified-token');
    resetCount++;
  }
}
