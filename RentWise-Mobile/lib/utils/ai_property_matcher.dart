import 'dart:convert';
import 'dart:async';

import '../shared/services/token_store.dart';

import 'package:http/http.dart' as http;

import '../shared/utils/api_constants.dart';
import '../features/home/models/property_model.dart';

class AiPropertyMatchResult {
  final PropertyModel property;
  final int matchScore;
  final double? distanceKm;
  final int? travelTimeMins;
  final List<String> matchReasons;
  final String destinationLandmark;

  AiPropertyMatchResult({
    required this.property,
    required this.matchScore,
    required this.distanceKm,
    required this.travelTimeMins,
    required this.matchReasons,
    required this.destinationLandmark,
  });
}

class AiSearchResult {
  final List<AiPropertyMatchResult> results;
  final String destinationLandmark;

  AiSearchResult(this.results, this.destinationLandmark);
}

Future<AiSearchResult> matchPropertiesWithAi(
  String query,
  List<dynamic> properties, {
  http.Client? client,
  Future<String?> Function()? tokenLoader,
}) async {
  if (query.trim().isEmpty) return AiSearchResult([], '');
  final api = client ?? http.Client();
  try {
    final token = await (tokenLoader ?? TokenStore.instance.read)();
    final response = await api
        .post(
          Uri.parse('${ApiConstants.baseUrl}/agentic/workflow/match-location'),
          headers: {
            'Content-Type': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'objective': query,
            'tenant_profile': {'role': 'Tenant'},
          }),
        )
        .timeout(const Duration(seconds: 120));
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } catch (_) {
      data = null;
    }
    if (response.statusCode != 200 ||
        data is! Map ||
        data['status'] == 'failed') {
      throw Exception(
        data is Map
            ? (data['message'] ??
                  data['error'] ??
                  'AI search is unavailable. Please retry.')
            : 'AI search is unavailable. Please retry.',
      );
    }
    final ranked = data['ranked_properties'] ?? data['matching_results'];
    if (ranked is! List) {
      throw Exception('AI returned an invalid response. Please retry.');
    }
    final destination = data['destination_landmark']?.toString() ?? '';
    final matches = <AiPropertyMatchResult>[];
    for (final p in ranked) {
      final id = (p['property_id'] ?? p['id']).toString();
      final property = properties
          .whereType<PropertyModel>()
          .where((v) => v.id == id)
          .firstOrNull;
      if (property == null) continue;
      final distance = p['distance_km'];
      final minutes = p['travel_time_mins'];
      for (final value in [distance, minutes]) {
        if (value != null && (value is! num || !value.isFinite || value < 0)) {
          throw Exception(
            'AI returned an invalid commute estimate. Please retry.',
          );
        }
      }
      matches.add(
        AiPropertyMatchResult(
          property: property,
          matchScore: (p['match_score'] as num?)?.toInt() ?? 0,
          distanceKm: (distance as num?)?.toDouble(),
          travelTimeMins: (minutes as num?)?.round(),
          matchReasons: (p['match_reasons'] as List? ?? [])
              .map((v) => v.toString())
              .toList(),
          destinationLandmark: destination,
        ),
      );
    }
    return AiSearchResult(matches, destination);
  } on TimeoutException {
    throw Exception('AI search timed out. Please try again.');
  } on http.ClientException {
    throw Exception(
      'Could not reach AI search. Check your connection and retry.',
    );
  } finally {
    if (client == null) api.close();
  }
}
