import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rentwise_mobile/features/home/controllers/property_browse_controller.dart';
import 'package:rentwise_mobile/features/properties/property_service.dart';

void main() {
  test('browse excludes globally booked properties without reading another user bookings', () async {
    final paths = <String>[];
    final client = MockClient((request) async {
      paths.add(request.url.path);
      if (request.url.path.endsWith('/unavailable'))
        return http.Response('["reserved"]', 200);
      return http.Response(
        jsonEncode({
          'items': [
            {'id': 'reserved', 'title': 'Booked home'},
            {'id': 'available', 'title': 'Available home'},
          ],
          'hasMore': false,
        }),
        200,
      );
    });
    final api = PropertyService('tenant-two-token', client: client);
    final catalog = PropertyBrowseController(api);
    addTearDown(catalog.dispose);
    addTearDown(api.close);
    await catalog.load();
    expect(catalog.data.value?.map((p) => p.id), ['available']);
    expect(paths, ['/api/properties/browse', '/api/properties/unavailable']);
  });
  test(
    'availability failure does not expose a potentially booked catalogue',
    () async {
      final client = MockClient(
        (request) async => request.url.path.endsWith('/unavailable')
            ? http.Response('', 503)
            : http.Response(
                '{"items":[{"id":"reserved"}],"hasMore":false}',
                200,
              ),
      );
      final api = PropertyService('token', client: client);
      final catalog = PropertyBrowseController(api);
      addTearDown(catalog.dispose);
      addTearDown(api.close);
      await catalog.load();
      expect(catalog.data, isA<AsyncError>());
      expect(catalog.data.value, isNull);
    },
  );
}
