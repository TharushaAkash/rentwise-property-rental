import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../shared/services/token_store.dart';

import '../../shared/utils/api_constants.dart';

class WorkflowException implements Exception {
  final String message;
  const WorkflowException(this.message);
  @override
  String toString() => message;
}

/// Workflow state always lives in ASP.NET/PostgreSQL, never in local storage.
class WorkflowService {
  final http.Client _client;
  final Future<String?> Function()? tokenLoader;
  WorkflowService({http.Client? client, this.tokenLoader})
    : _client = client ?? http.Client();

  Future<dynamic> _request(
    String method,
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    final token = tokenLoader != null
        ? await tokenLoader!()
        : await TokenStore.instance.read();
    if (token == null || token.isEmpty) {
      throw const WorkflowException(
        'Please sign in again to view rental requests.',
      );
    }
    final request = http.Request(
      method,
      Uri.parse('${ApiConstants.baseUrl}/rental-workflows$path'),
    );
    request.headers.addAll({
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    });
    if (body != null) request.body = jsonEncode(body);
    final response = await (() async => http.Response.fromStream(
      await _client.send(request),
    ))().timeout(const Duration(seconds: 135));
    if (response.statusCode == 204) return null;
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } catch (_) {
      data = null;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 401) {
        throw const WorkflowException(
          'Your session expired. Please sign in again.',
        );
      }
      if (response.statusCode == 404) {
        throw const WorkflowException(
          'This request is no longer available. Refresh your list.',
        );
      }
      throw WorkflowException(
        data is Map && data['message'] is String
            ? data['message']
            : 'We could not complete this request. Please try again.',
      );
    }
    return data;
  }

  Future<List<Map<String, dynamic>>> list() async =>
      (await _request('GET', '') as List)
          .map((v) => Map<String, dynamic>.from(v as Map))
          .toList();
  Future<Map<String, dynamic>> get(String id) async =>
      Map<String, dynamic>.from(
        await _request('GET', '/${Uri.encodeComponent(id)}') as Map,
      );
  Future<String> create(Map<String, dynamic> request) async =>
      (await _request('POST', '', request))['id'] as String;
  Future<void> advance(String id) async =>
      _request('POST', '/${Uri.encodeComponent(id)}/advance');
  Future<void> revise(String id, Map<String, dynamic> request) async =>
      _request('POST', '/${Uri.encodeComponent(id)}/revise', request);
  Future<void> decide(
    String id,
    String decision,
    String note,
    int version,
  ) async => _request('POST', '/${Uri.encodeComponent(id)}/decision', {
    'decision': decision,
    'note': note,
    'version': version,
  });
  Future<void> delete(String id) async =>
      _request('DELETE', '/${Uri.encodeComponent(id)}');
  void dispose() => _client.close();
}
