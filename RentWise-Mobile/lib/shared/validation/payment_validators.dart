import 'input_validators.dart';

class PaymentValidators {
  static String? cardNumber(String value) {
    final digits = value.replaceAll(' ', '');
    if (!RegExp(r'^[0-9]{15,16}$').hasMatch(digits)) {
      return 'Enter a valid 15 or 16-digit card number.';
    }
    var total = 0;
    var doubleDigit = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var digit = int.parse(digits[i]);
      if (doubleDigit) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      total += digit;
      doubleDigit = !doubleDigit;
    }
    return total % 10 == 0 && !RegExp(r'^0+$').hasMatch(digits)
        ? null
        : 'Check your card number.';
  }

  static String? expiry(String value, {DateTime? now}) {
    final match = RegExp(r'^(0[1-9]|1[0-2])/([0-9]{2})$')
        .firstMatch(value.trim());
    if (match == null) return 'Enter a valid expiry date (MM/YY).';
    final date = now ?? DateTime.now();
    final month = int.parse(match[1]!);
    final year = 2000 + int.parse(match[2]!);
    return year < date.year || (year == date.year && month < date.month)
        ? 'This card has expired.'
        : null;
  }

  static String? cvv(String value, String number) {
    final amex = RegExp(r'^3[47]').hasMatch(number.replaceAll(' ', ''));
    return RegExp(amex ? r'^[0-9]{4}$' : r'^[0-9]{3}$').hasMatch(value)
        ? null
        : 'Enter a ${amex ? 4 : 3}-digit security code.';
  }

  static Map<String, String> validate({
    required String holder,
    required String number,
    required String date,
    required String code,
    DateTime? now,
  }) {
    final errors = {
      'holder': InputValidators.text(
        holder,
        label: 'Cardholder name',
        min: 2,
        max: 150,
      ),
      'number': cardNumber(number),
      'expiry': expiry(date, now: now),
      'cvv': cvv(code, number),
    };
    return {
      for (final entry in errors.entries)
        if (entry.value != null) entry.key: entry.value!,
    };
  }
}
