import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rentwise_mobile/utils/ai_property_matcher.dart';
import 'package:rentwise_mobile/features/home/models/property_model.dart';

void main() {
  final property = PropertyModel.fromJson({
    'id': 'p1',
    'title': 'Real listing',
    'address': 'Malabe',
    'monthlyRent': 50000,
  });
  test('Quota failure is visible and never replaced by local scores', () async {
    var calls = 0;
    final client = MockClient((request) async {
      calls++;
      expect(request.url.path, '/api/agentic/workflow/match-location');
      return http.Response('{"message":"AI usage limit reached"}', 429);
    });
    await expectLater(
      matchPropertiesWithAi(
        'near SLIIT',
        [property],
        client: client,
        tokenLoader: () async => null,
      ),
      throwsA(
        predicate((e) => e.toString().contains('AI usage limit reached')),
      ),
    );
    expect(calls, 1);
    client.close();
  });
  test('No matches stays empty, without sample listings', () async {
    final client = MockClient(
      (_) async => http.Response('{"matching_results":[]}', 200),
    );
    expect(
      (await matchPropertiesWithAi(
        'near SLIIT',
        [property],
        client: client,
        tokenLoader: () async => null,
      )).results,
      isEmpty,
    );
    client.close();
  });
  test(
    'Unknown commute remains null, and only known listing IDs are shown',
    () async {
      final client = MockClient(
        (_) async => http.Response(
          jsonEncode({
            'matching_results': [
              {
                'property_id': 'p1',
                'match_score': 80,
                'distance_km': null,
                'travel_time_mins': null,
              },
              {'property_id': 'invented', 'match_score': 100},
            ],
          }),
          200,
        ),
      );
      final result = await matchPropertiesWithAi(
        'near SLIIT',
        [property],
        client: client,
        tokenLoader: () async => null,
      );
      expect(result.results.length, 1);
      expect(result.results.single.distanceKm, isNull);
      expect(result.results.single.travelTimeMins, isNull);
      client.close();
    },
  );
}
