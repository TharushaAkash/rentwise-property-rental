class InputValidators {
  static String? text(
    String? value, {
    String label = 'Value',
    int min = 1,
    int? max,
  }) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return 'Enter $label.';
    if (text.length < min) return '$label must have at least $min characters.';
    if (max != null && text.length > max) {
      return '$label must have at most $max characters.';
    }
    return null;
  }

  static String? email(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Enter your email address.';
    if (email.length > 200 ||
        !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'Enter a valid email address.';
    }
    return null;
  }

  static String? password(String? value, {bool signingIn = false}) {
    if (value == null || value.isEmpty) return 'Enter your password.';
    if (!signingIn && value.length < 8) {
      return 'Password must have at least 8 characters.';
    }
    if (!signingIn && value.length > 64) {
      return 'Password must have at most 64 characters.';
    }
    return null;
  }

  static String? confirmation(String? value, String password) =>
      value == password && (value?.isNotEmpty ?? false)
      ? null
      : 'Passwords do not match.';
  static String? phone(String? value) =>
      RegExp(r'^0[1-9][0-9]{8}$')
          .hasMatch((value ?? '').replaceAll(RegExp(r'[ -]'), ''))
      ? null
      : 'Enter a valid 10-digit Sri Lankan phone number.';
  static String? nic(String? value) =>
      RegExp(r'^([0-9]{12}|[0-9]{9}[vVxX])$').hasMatch((value ?? '').trim())
      ? null
      : 'Enter 12 digits or 9 digits followed by V/X.';
  static String? number(String? value, {num min = 0, bool integer = false}) {
    final number = num.tryParse((value ?? '').trim());
    if (number == null ||
        !number.isFinite ||
        number < min ||
        (integer && int.tryParse((value ?? '').trim()) == null)) {
      return 'Enter ${integer ? 'a whole number' : 'a number'} of at least $min.';
    }
    return null;
  }

  static String? bankField(String key, String? value) {
    final labels = {
      'bankName': 'Bank name',
      'accountName': 'Account holder',
      'accountNumber': 'Account number',
      'branch': 'Branch',
    };
    final error = text(
      value,
      label: labels[key]!,
      max: key == 'accountName'
          ? 150
          : key == 'accountNumber'
          ? 40
          : 120,
    );
    if (error != null) return error;
    if (key == 'accountNumber' &&
        !RegExp(r'^[0-9A-Za-z -]{4,40}$').hasMatch(value!.trim())) {
      return 'Use 4?40 letters, numbers, spaces or hyphens.';
    }
    return null;
  }
}
