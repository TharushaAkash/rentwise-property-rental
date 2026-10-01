import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rentwise_mobile/features/home/models/property_model.dart';
import 'package:rentwise_mobile/features/properties/property_service.dart';
import 'package:rentwise_mobile/features/properties/screens/property_booking_screen.dart';
import 'package:rentwise_mobile/features/properties/screens/property_form_screen.dart';
import 'package:rentwise_mobile/features/properties/screens/property_detail_screen.dart';
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';
import 'package:rentwise_mobile/features/auth/models/user_model.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rentwise_mobile/features/shared/theme/app_theme.dart';

class TestAuth extends AuthNotifier {
  TestAuth(this.role);
  final String role;
  @override
  UserModel build() => UserModel(
    id: 'owner',
    name: 'Test User',
    email: 'test@example.com',
    role: role,
    token: 'test-token',
  );
}

void main() {
  final listing = PropertyModel.fromJson({
    'id': 'p1',
    'ownerId': 'owner',
    'title': 'Garden House',
    'description': 'A spacious house with a garden.',
    'address': 'Colombo, Sri Lanka',
    'monthlyRent': 50000,
    'status': 1,
  });
  test(
    'multipart uploads preserve the API field names and image MIME type',
    () async {
      final api = PropertyService(
        'token',
        client: MockClient((request) async {
          expect(
            request.headers['content-type'],
            startsWith('multipart/form-data;'),
          );
          expect(request.body, contains('name="file"; filename="house.png"'));
          expect(request.body, contains('content-type: image/png'));
          expect(request.body, contains('name="isPrimary"'));
          return http.Response(
            '{"photoUrl":"https://example.com/house.png"}',
            201,
          );
        }),
      );
      final result = await api.upload(
        '/properties/p1/photos',
        Uint8List.fromList([1, 2, 3]),
        'house.png',
        {'isPrimary': 'true'},
      );
      expect(result['photoUrl'], 'https://example.com/house.png');
      api.close();
    },
  );
  for (final role in ['Tenant', 'Owner', 'Administrator']) {
    testWidgets(
      '$role property detail renders at mobile width with correct actions',
      (tester) async {
        SharedPreferences.setMockInitialValues({});
        tester.view.physicalSize = const Size(375, 812);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authStateProvider.overrideWith(() => TestAuth(role)),
              propertyDetailsProvider('p1').overrideWith((_) async => listing),
              applicationsProvider.overrideWith((_) async => []),
              verificationProvider('p1').overrideWith(
                (_) async => {
                  'isApproved': true,
                  'isFeePaid': true,
                  'documents': [],
                  'verifications': [],
                },
              ),
            ],
            child: MaterialApp(
              theme: buildAppTheme(),
              home: PropertyDetailScreen(property: listing),
            ),
          ),
        );
        await tester.pumpAndSettle();
        if (role == 'Tenant') {
          expect(find.text('Submit Rental Booking Request'), findsOneWidget);
          expect(find.text('Delete'), findsNothing);
        } else {
          expect(find.text('Delete'), findsOneWidget);
          expect(find.text('Submit Rental Booking Request'), findsNothing);
        }
        expect(
          find.text('Edit Listing Details'),
          role == 'Tenant' ? findsNothing : findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );
  }
  test(
    'normalizes API property status, photos, facilities and feature tags',
    () {
      final p = PropertyModel.fromJson({
        'Id': 'p1',
        'Status': 1,
        'MonthlyRent': 50000,
        'Facilities': 'Parking, AC, ',
        'Photos': [
          {'PhotoUrl': 'https://example.com/house.jpg'},
        ],
        'FeatureTags': ['Garden'],
        'OwnerId': 'owner',
      });
      expect(p.status, 'Active');
      expect(p.photoUrl, 'https://example.com/house.jpg');
      expect(p.photos, [p.photoUrl]);
      expect(p.facilities, ['Parking', 'AC']);
      expect(p.featureTags, ['Garden']);
      expect(p.ownerId, 'owner');
    },
  );
  test('month-end leases clamp to the last valid day', () {
    expect(leaseEndDate(DateTime(2026, 1, 31), 1), DateTime(2026, 2, 28));
    expect(leaseEndDate(DateTime(2028, 1, 31), 1), DateTime(2028, 2, 29));
    expect(leaseEndDate(DateTime(2026, 9, 26), 12), DateTime(2027, 9, 26));
  });
  test('booking sends authenticated JSON and uses server response', () async {
    final service = PropertyService(
      'test-token',
      client: MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/api/property-applications');
        expect(request.headers['Authorization'], 'Bearer test-token');
        expect(jsonDecode(request.body)['durationMonths'], 6);
        return http.Response(
          '{"id":"server-booking","status":"Submitted"}',
          200,
        );
      }),
    );
    final response = await service.request('POST', '/property-applications', {
      'durationMonths': 6,
    });
    expect(response['id'], 'server-booking');
    service.close();
  });
  test('server failures are not treated as successful writes', () async {
    final service = PropertyService(
      'token',
      client: MockClient(
        (_) async => http.Response('{"message":"Listing unavailable"}', 409),
      ),
    );
    await expectLater(
      service.request('POST', '/property-applications', {}),
      throwsA(predicate((e) => e.toString().contains('Listing unavailable'))),
    );
    service.close();
  });
  test('external photo requests never receive the bearer token', () async {
    final service = PropertyService(
      'secret',
      client: MockClient((request) async {
        expect(request.headers.containsKey('Authorization'), false);
        return http.Response(
          'not an image',
          200,
          headers: {'content-type': 'text/html'},
        );
      }),
    );
    await expectLater(
      service.downloadPhoto('https://example.com/photo'),
      throwsException,
    );
    service.close();
  });
  testWidgets('property form validates required fields on a narrow screen', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: PropertyFormScreen())),
    );
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.text('Save Property'),
      find.byType(Scrollable).first,
      const Offset(0, -500),
    );
    await tester.tap(find.text('Save Property'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(Scrollable).first, const Offset(0, 3000));
    await tester.pumpAndSettle();
    expect(find.text('Enter Property Title.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
