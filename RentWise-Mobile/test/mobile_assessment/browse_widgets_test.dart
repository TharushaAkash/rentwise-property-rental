import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:rentwise_mobile/features/home/screens/home_screen.dart';
import 'package:rentwise_mobile/features/properties/screens/property_detail_screen.dart';
import 'support/fixtures.dart';

void main() {
  testWidgets('MOB-05 successful mocked API listing displays returned fields', (tester) async {
    final paths = <String>[];
    await mountAssessment(tester, const HomeScreen(), signedIn: true, respond: (request) async {
      paths.add(request.url.path);
      expect(request.headers['Authorization'], 'Bearer test-token');
      if (request.url.path.endsWith('/browse')) return browseResponse([sampleJson]);
      return http.Response('[]', 200);
    });
    await tester.pumpAndSettle();
    final title = find.text('Garden House');
    await tester.ensureVisible(title);
    await tester.pumpAndSettle();
    expect(title, findsOneWidget);
    expect(find.text('LKR 50,000'), findsOneWidget);
    expect(paths, contains('/api/properties/browse'));
    expect(tester.takeException(), isNull);
  });
  testWidgets('MOB-06 backend failure displays friendly error and retry recovers', (tester) async {
    var fail = true;
    var calls = 0;
    await mountAssessment(tester, const HomeScreen(), signedIn: true, respond: (request) async {
      if (request.url.path.endsWith('/browse')) {
        calls++;
        return fail ? http.Response('{"message":"Service unavailable"}', 503) : browseResponse([]);
      }
      return http.Response('[]', 200);
    });
    await tester.pumpAndSettle();
    final error = find.text('Could not load properties.');
    await tester.ensureVisible(error);
    expect(error, findsOneWidget);
    fail = false;
    await tester.tap(find.widgetWithText(TextButton, 'Retry'));
    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(find.text('Could not load properties.'), findsNothing);
    expect(find.text('No properties found. Try another location or category.'), findsOneWidget);
  });
  testWidgets('MOB-08 pending property response renders loading indicator', (tester) async {
    final response = Completer<http.Response>();
    await mountAssessment(tester, const HomeScreen(), signedIn: true, respond: (request) async {
      if (request.url.path.endsWith('/browse')) return response.future;
      return http.Response('[]', 200);
    });
    // Do not pumpAndSettle while an indeterminate loading animation is active.
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(CircularProgressIndicator), findsWidgets);
    response.complete(browseResponse([]));
    await tester.pumpAndSettle();
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
  testWidgets('MOB-09 empty API response displays empty UI without crashing', (tester) async {
    await mountAssessment(tester, const HomeScreen(), signedIn: true);
    await tester.pumpAndSettle();
    final empty = find.text('No properties found. Try another location or category.');
    await tester.ensureVisible(empty);
    expect(empty, findsOneWidget);
    expect(find.text('Garden House'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  for (final timeout in [false, true]) {
    testWidgets('MOB-10 ${timeout ? 'timeout' : 'network failure'} displays retry and recovers', (tester) async {
      var fail = true;
      await mountAssessment(tester, const HomeScreen(), signedIn: true, respond: (request) async {
        if (request.url.path.endsWith('/browse')) {
          if (fail) {
            if (timeout) throw TimeoutException('Request timed out');
            throw http.ClientException('Network unavailable');
          }
          return browseResponse([]);
        }
        return http.Response('[]', 200);
      });
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Could not load properties.'));
      expect(find.text('Could not load properties.'), findsOneWidget);
      fail = false;
      await tester.tap(find.widgetWithText(TextButton, 'Retry'));
      await tester.pumpAndSettle();
      expect(find.text('Could not load properties.'), findsNothing);
      expect(find.text('No properties found. Try another location or category.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('MOB-04 listing tap navigates to selected property details', (tester) async {
    await mountAssessment(tester, const HomeScreen(), signedIn: true, respond: (request) async {
      if (request.url.path.endsWith('/browse')) return browseResponse([sampleJson]);
      return http.Response('[]', 200);
    });
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Garden House'));
    await tester.tap(find.text('Garden House'));
    await tester.pumpAndSettle();
    expect(find.byType(PropertyDetailScreen), findsOneWidget);
    expect(tester.widget<PropertyDetailScreen>(find.byType(PropertyDetailScreen)).property.id, 'mob-property-1');
    expect(tester.takeException(), isNull);
  });
}
