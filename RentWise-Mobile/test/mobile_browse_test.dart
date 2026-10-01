import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rentwise_mobile/features/home/screens/home_screen.dart';
import 'package:rentwise_mobile/features/properties/property_service.dart';
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';

import 'property_catalog_test.dart' show CatalogAuth;

void main() {
  testWidgets(
    'normal browsing loads a bounded page and sends search filters to ASP.NET',
    (tester) async {
      final requests = <Uri>[];
      final client = MockClient((request) async {
        requests.add(request.url);
        return http.Response(
          jsonEncode({'items': [], 'nextCursor': null, 'hasMore': false}),
          200,
        );
      });
      addTearDown(client.close);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authStateProvider.overrideWith(CatalogAuth.new),
            propertyServiceProvider.overrideWithValue(
              PropertyService('fixture', client: client),
            ),
          ],
          child: const MaterialApp(home: HomeScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(requests.single.path, '/api/properties/browse');
      expect(requests.single.queryParameters['pageSize'], '12');
      await tester.enterText(find.byType(TextField).first, 'Colombo');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      expect(requests.last.queryParameters['location'], 'Colombo');
      expect(requests.every((url) => url.path.endsWith('/browse')), true);
    },
  );
}
