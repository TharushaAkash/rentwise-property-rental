import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../shared/utils/api_constants.dart';

class PasswordResetService {
  PasswordResetService({http.Client? client})
    : _client = client ?? http.Client();

  final http.Client _client;

  Future<int> sendCode(String email) async {
    final data = await _post('/auth/forgot-password', {'email': email});
    return (data['expiresInSeconds'] as num).toInt();
  }

  Future<String> verifyCode(String email, String code) async {
    final data = await _post('/auth/verify-reset-code', {
      'email': email,
      'code': code,
    });
    return data['resetToken'] as String;
  }

  Future<void> resetPassword(
    String email,
    String token,
    String password,
    String confirmation,
  ) async {
    await _post('/auth/reset-password', {
      'email': email,
      'resetToken': token,
      'newPassword': password,
      'confirmPassword': confirmation,
    });
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, String> body,
  ) async {
    try {
      final response = await _client
          .post(
            Uri.parse('${ApiConstants.baseUrl}$path'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 30));

      // Rate-limit and proxy responses do not always contain JSON.
      Map<String, dynamic> data = {};
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) data = decoded;
      } on FormatException {
        // Use a readable fallback below instead of showing a raw server page.
      }
      if (response.statusCode == 200) return data;
      if (data['message'] is String) throw Exception(data['message']);
      if (data['errors'] is Map) {
        for (final messages in (data['errors'] as Map).values) {
          if (messages is List && messages.isNotEmpty) {
            throw Exception(messages.first.toString());
          }
        }
      }
      throw Exception(
        response.statusCode == 429
            ? 'Too many requests. Please wait a minute and try again.'
            : 'Password reset is unavailable. Please try again shortly.',
      );
    } on TimeoutException {
      throw Exception(
        'The request timed out. Please wait a minute and try again.',
      );
    } on http.ClientException {
      throw Exception('Unable to connect. Check your internet and try again.');
    }
  }

  void dispose() => _client.close();
}
