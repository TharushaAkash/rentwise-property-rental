import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../../../shared/utils/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/property_model.dart';

final propertyCatalogClientProvider = Provider<http.Client>((ref) {
  final client = http.Client();
  ref.onDispose(client.close);
  return client;
});

final propertiesProvider = FutureProvider<List<PropertyModel>>((ref) async {
  final authState = ref.watch(authStateProvider);
  final token = authState.value?.token;

  if (token == null || token.isEmpty) return [];
  final response = await ref
      .watch(propertyCatalogClientProvider)
      .get(
        Uri.parse('${ApiConstants.baseUrl}/properties'),
        headers: {'Authorization': 'Bearer $token'},
      )
      .timeout(const Duration(seconds: 15));
  if (response.statusCode != 200) {
    throw Exception('Could not load properties. Please retry.');
  }
  final availability = await ref
      .watch(propertyCatalogClientProvider)
      .get(
        Uri.parse('${ApiConstants.baseUrl}/properties/unavailable'),
        headers: {'Authorization': 'Bearer $token'},
      )
      .timeout(const Duration(seconds: 15));
  if (availability.statusCode != 200)
    throw Exception('Could not confirm property availability. Please retry.');
  final unavailable = (jsonDecode(availability.body) as List)
      .map((id) => id.toString())
      .toSet();
  final data = jsonDecode(response.body) as List;
  return data
      .map((value) => PropertyModel.fromJson(value))
      .where((p) => !unavailable.contains(p.id))
      .toList();
}, retry: (retryCount, error) => null);

final bookedPropertiesProvider = FutureProvider<List<PropertyModel>>((
  ref,
) async {
  final authState = ref.watch(authStateProvider);
  final token = authState.value?.token;

  if (token == null || token.isEmpty) {
    return [];
  }

  try {
    final response = await http
        .get(
          Uri.parse('${ApiConstants.baseUrl}/agreements/mine'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
        )
        .timeout(const Duration(seconds: 10));

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      final List<PropertyModel> properties = [];

      for (var agreement in data) {
        if (agreement['property'] != null) {
          properties.add(PropertyModel.fromJson(agreement['property']));
        }
      }

      final uniqueProperties = <String, PropertyModel>{};
      for (var prop in properties) {
        uniqueProperties[prop.id] = prop;
      }
      return uniqueProperties.values.toList();
    }
  } catch (_) {}

  return [];
});
