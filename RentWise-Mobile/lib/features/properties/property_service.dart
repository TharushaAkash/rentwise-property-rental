import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/providers/auth_provider.dart';
import '../home/models/property_model.dart';
import '../../shared/utils/api_constants.dart';

bool isAdmin(String? role) =>
    ['Admin', 'Administrator', 'SystemAdmin'].contains(role);
bool isOwner(String? role) => ['Owner', 'PropertyOwner'].contains(role);

final propertyServiceProvider = Provider((ref) {
  final service = PropertyService(
    ref.watch(authStateProvider).value?.token ?? '',
  );
  ref.onDispose(service.close);
  return service;
});
final managedPropertiesProvider = FutureProvider((ref) async {
  final user = ref.watch(authStateProvider).value;
  final data = await ref
      .watch(propertyServiceProvider)
      .request(
        'GET',
        isAdmin(user?.role) ? '/properties' : '/properties/owner/${user?.id}',
      );
  return (data as List)
      .map((p) => PropertyModel.fromJson(Map<String, dynamic>.from(p)))
      .toList();
});
final propertyDetailsProvider = FutureProvider.family<PropertyModel, String>((
  ref,
  id,
) async {
  final api = ref.watch(propertyServiceProvider);
  final data = Map<String, dynamic>.from(
    await api.request('GET', '/properties/$id'),
  );
  if (data['owner'] == null && data['ownerId'] != null) {
    try {
      data['owner'] = await api.request(
        'GET',
        '/auth/users/${data['ownerId']}',
      );
    } catch (_) {
      /* Owner contact details are optional. */
    }
  }
  return PropertyModel.fromJson(data);
});
final applicationsProvider = FutureProvider<List<Map<String, dynamic>>>(
  (ref) async =>
      (await ref
                  .watch(propertyServiceProvider)
                  .request('GET', '/property-applications')
              as List)
          .map((a) => Map<String, dynamic>.from(a))
          .toList(),
);
final verificationProvider =
    FutureProvider.family<Map<String, dynamic>, String>(
      (ref, id) async => Map<String, dynamic>.from(
        await ref
            .watch(propertyServiceProvider)
            .request('GET', '/properties/$id/verification-status'),
      ),
    );

class PropertyService {
  PropertyService(this.token, {http.Client? client})
    : _client = client ?? http.Client();
  final String token;
  final http.Client _client;
  void close() => _client.close();
  Future<dynamic> request(
    String method,
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    final request = http.Request(
      method,
      Uri.parse('${ApiConstants.baseUrl}$path'),
    );
    request.headers.addAll({
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    });
    if (body != null) request.body = jsonEncode(body);
    final response = await http.Response.fromStream(
      await _client.send(request).timeout(const Duration(seconds: 90)),
    ).timeout(const Duration(seconds: 90));
    return decode(response);
  }

  dynamic decode(http.Response response) {
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } catch (_) {
      data = response.body;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        data is Map
            ? data['message'] ??
                  data['title'] ??
                  'Request failed (${response.statusCode})'
            : 'Request failed (${response.statusCode}): $data',
      );
    }
    return data;
  }

  Future<dynamic> upload(
    String path,
    Uint8List bytes,
    String name,
    Map<String, String> fields,
  ) async {
    final extension = name.split('.').last.toLowerCase();
    final mime = switch (extension) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      'gif' => 'image/gif',
      'heic' => 'image/heic',
      'pdf' => 'application/pdf',
      _ => 'application/octet-stream',
    };
    final request =
        http.MultipartRequest('POST', Uri.parse('${ApiConstants.baseUrl}$path'))
          ..headers['Authorization'] = 'Bearer $token'
          ..fields.addAll(fields)
          ..files.add(
            http.MultipartFile.fromBytes(
              'file',
              bytes,
              filename: name,
              contentType: http.MediaType.parse(mime),
            ),
          );
    return decode(
      await http.Response.fromStream(
        await _client.send(request).timeout(const Duration(seconds: 90)),
      ).timeout(const Duration(seconds: 90)),
    );
  }

  Future<Uint8List> downloadPhoto(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null ||
        !['http', 'https'].contains(uri.scheme) ||
        uri.host.isEmpty) {
      throw Exception('Enter a valid image URL.');
    }
    final response = await _client
        .get(uri)
        .timeout(const Duration(seconds: 30));
    if (response.statusCode != 200 ||
        !(response.headers['content-type'] ?? '').startsWith('image/')) {
      throw Exception('The URL must point to an image.');
    }
    if (response.bodyBytes.length > 15 * 1024 * 1024) {
      throw Exception('Images must be smaller than 15 MB.');
    }
    return response.bodyBytes;
  }
}
