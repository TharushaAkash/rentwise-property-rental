import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../../shared/utils/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/property_model.dart';

final propertiesProvider = FutureProvider<List<PropertyModel>>((ref) async {
  final authState = ref.watch(authStateProvider);
  final token = authState.value?.token;

  if (token == null || token.isEmpty) {
    throw Exception('Authentication required');
  }

  final response = await http.get(
    Uri.parse('${ApiConstants.baseUrl}/properties'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
  ).timeout(const Duration(seconds: 15));

  if (response.statusCode == 200) {
    final List<dynamic> data = jsonDecode(response.body);
    return data.map((e) => PropertyModel.fromJson(e)).toList();
  } else {
    throw Exception('Failed to load properties: ${response.statusCode}');
  }
});
