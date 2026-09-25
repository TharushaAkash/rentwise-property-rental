import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../../shared/utils/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/maintenance_model.dart';

final maintenanceProvider = FutureProvider<List<MaintenanceModel>>((ref) async {
  final authState = ref.watch(authStateProvider);
  final token = authState.value?.token;

  if (token == null || token.isEmpty) {
    throw Exception('Authentication required');
  }

  // Use the correct backend endpoint
  final response = await http.get(
    Uri.parse('${ApiConstants.baseUrl}/maintenance-requests'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
  ).timeout(const Duration(seconds: 15));

  if (response.statusCode == 200) {
    final List<dynamic> data = jsonDecode(response.body);
    return data.map((e) => MaintenanceModel.fromJson(e)).toList();
  } else {
    throw Exception('Failed to load maintenance requests: ${response.statusCode}');
  }
});
