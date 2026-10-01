import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';
import 'package:rentwise_mobile/features/auth/models/user_model.dart';
import 'package:rentwise_mobile/features/auth/screens/login_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rentwise_mobile/shared/validation/input_validators.dart';
import 'package:rentwise_mobile/shared/validation/payment_validators.dart';

class ValidationAuth extends AuthNotifier {
  int calls = 0;
  @override
  UserModel? build() => null;
  @override
  Future<void> login(String email, String password) async {
    calls++;
  }
}

void main() {
  testWidgets('invalid login stays on the form and displays field errors', (
    tester,
  ) async {
    final auth = ValidationAuth();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authStateProvider.overrideWith(() => auth)],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.enterText(find.byType(TextFormField).first, 'invalid@');
    await tester.ensureVisible(find.text('Sign In to Account'));
    await tester.tap(find.text('Sign In to Account'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a valid email address.'), findsOneWidget);
    expect(find.text('Enter your password.'), findsOneWidget);
    expect(auth.calls, 0);
  });

  test('email rules reject incomplete addresses and accept trimmed input', () {
    expect(InputValidators.email('a@'), isNotNull);
    expect(InputValidators.email('a b@example.com'), isNotNull);
    expect(InputValidators.email(' resident@example.com '), isNull);
  });
  test(
    'login does not impose new-password length rules on an existing password',
    () {
      expect(InputValidators.password('short', signingIn: true), isNull);
      expect(InputValidators.password('short'), isNotNull);
      expect(InputValidators.confirmation('different', 'password'), isNotNull);
    },
  );
  test('bank account format matches backend constraints without losing leading zeros', () {
    expect(InputValidators.bankField('accountNumber', '0012 3456'), isNull);
    expect(InputValidators.bankField('accountNumber', '12'), isNotNull);
    expect(InputValidators.bankField('accountNumber', '1234!'), isNotNull);
    expect(InputValidators.bankField('bankName', 'x' * 121), isNotNull);
  });
  test(
    'number validation rejects nonfinite, negative and fractional counts',
    () {
      for (final value in ['NaN', 'Infinity', '-1']) {
        expect(InputValidators.number(value), isNotNull);
      }
      expect(InputValidators.number('1.5', integer: true), isNotNull);
      expect(InputValidators.number('45000.50', min: 1), isNull);
    },
  );
  test('card validation checks digits and checksum', () {
    expect(PaymentValidators.cardNumber('4242 4242 4242 4242'), isNull);
    expect(PaymentValidators.cardNumber('4242 4242 4242 4241'), isNotNull);
    expect(PaymentValidators.cardNumber('0000000000000000'), isNotNull);
    expect(PaymentValidators.cardNumber('42424242424242ab'), isNotNull);
    expect(PaymentValidators.cardNumber('378282246310005'), isNull);
  });
  test(
    'expiry accepts current month until its last day and rejects invalid dates',
    () {
      final now = DateTime(2026, 9, 30, 23, 59);
      expect(PaymentValidators.expiry('09/26', now: now), isNull);
      expect(PaymentValidators.expiry('08/26', now: now), isNotNull);
      for (final value in ['00/29', '13/29', '1/29', '12/xx']) {
        expect(PaymentValidators.expiry(value, now: now), isNotNull);
      }
      expect(
        PaymentValidators.expiry('01/27', now: DateTime(2026, 12, 31)),
        isNull,
      );
    },
  );
  test('CVV requires numeric input of the appropriate length', () {
    expect(PaymentValidators.cvv('123', '4242424242424242'), isNull);
    expect(PaymentValidators.cvv('abcd', '378282246310005'), isNotNull);
    expect(PaymentValidators.cvv('123', '378282246310005'), isNotNull);
    expect(PaymentValidators.cvv('1234', '378282246310005'), isNull);
  });
}
