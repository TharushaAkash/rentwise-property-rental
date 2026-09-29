import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../shared/services/token_store.dart';
import '../../../shared/utils/api_constants.dart';
import '../models/user_model.dart';

class AuthService {
  Future<UserModel?> login(String email, String password) async {
    try {
      final response = await http
          .post(
            Uri.parse('${ApiConstants.baseUrl}${ApiConstants.loginEndpoint}'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'password': password}),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final user = UserModel.fromJson(data);
        await saveToken(user.token);
        return user;
      } else {
        throw Exception('Login failed: ${response.body}');
      }
    } catch (e) {
      throw Exception('Error during login: $e');
    }
  }

  Future<UserModel?> register(
    String name,
    String email,
    String password,
    String role,
    String phone,
    String nic,
  ) async {
    try {
      final response = await http
          .post(
            Uri.parse(
              '${ApiConstants.baseUrl}${ApiConstants.registerEndpoint}',
            ),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'name': name,
              'email': email,
              'password': password,
              'role': role,
              'phoneNumber': phone,
              'nicNumber': nic,
            }),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        final user = UserModel.fromJson(data);
        await saveToken(user.token);
        return user;
      } else {
        throw Exception('Registration failed: ${response.body}');
      }
    } catch (e) {
      throw Exception('Error during registration: $e');
    }
  }

  Future<void> saveToken(String token) => TokenStore.instance.write(token);
  Future<String?> getToken() => TokenStore.instance.read();
  Future<void> logout() => TokenStore.instance.clear();
}
