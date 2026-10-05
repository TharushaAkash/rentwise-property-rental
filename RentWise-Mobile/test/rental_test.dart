import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rentwise_mobile/features/rentals/models/rental_model.dart';
import 'package:rentwise_mobile/features/rentals/services/rental_service.dart';
import 'package:rentwise_mobile/features/rentals/providers/rental_provider.dart';
import 'package:rentwise_mobile/features/rentals/screens/agreement_detail_screen.dart';
import 'package:rentwise_mobile/features/rentals/screens/payment_screen.dart';
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';
import 'package:rentwise_mobile/features/auth/models/user_model.dart';

class RentalTestAuth extends AuthNotifier {
  @override
  UserModel build() => UserModel(
    id: 'tenant',
    name: 'Test Tenant',
    email: 'test@example.com',
    role: 'Tenant',
    token: 'test',
  );
}

class RentalTestService extends RentalService {
  @override
  Future<Map<String, dynamic>> bankDetails(String agreementId) async => {
    'configured': false,
  };
  @override
  Future<List<AgreementModel>> fetchAgreements() async => [];
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test('Agreement AI uses the authenticated ASP.NET proxy', () async {
    SharedPreferences.setMockInitialValues({'auth_token': 'fixture-token'});
    var called = false;
    final api = RentalService(
      accountEmail: 'test@example.com',
      client: MockClient((request) async {
        called = true;
        expect(request.url.path, '/api/agentic/workflow/draft-agreement');
        expect(request.headers['Authorization'], 'Bearer fixture-token');
        return http.Response('{"draft":{"plain_language_summary":{}}}', 200);
      }),
    );
    final result = await api.auditAgreementWithAi(
      propertyId: 'p1',
      agreementId: 'a1',
      rent: 50000,
      location: 'Malabe',
      propertyType: 'House',
      bedrooms: 2,
      document: 'Draft terms',
    );
    expect(called, isTrue);
    expect(result, isNotNull);
  });

  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('payment form fits a narrow mobile viewport', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final lease = AgreementModel.fromJson({
      'id': 'lease',
      'status': 'PendingOwnerApproval',
      'agreedMonthlyRent': 50000,
      'securityDeposit': 75000,
      'property': {'title': 'Garden House'},
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authStateProvider.overrideWith(RentalTestAuth.new),
          rentalServiceProvider.overrideWithValue(RentalTestService()),
        ],
        child: MaterialApp(home: PaymentScreen(agreement: lease)),
      ),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
    for (var i = 0; i < 4; i++) {
      await tester.drag(
        find.byType(SingleChildScrollView).first,
        const Offset(0, -350),
      );
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.takeException(), isNull);
    }
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('agreement sections fit a narrow mobile viewport', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final lease = AgreementModel.fromJson({
      'id': 'lease',
      'status': 'Drafted',
      'agreedMonthlyRent': 50000,
      'securityDeposit': 75000,
      'termsAndConditions': 'Residential tenancy terms.',
      'startDate': '2026-09-01',
      'endDate': '2027-03-01',
      'property': {'title': 'Garden House', 'address': 'Malabe'},
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authStateProvider.overrideWith(RentalTestAuth.new),
          rentalServiceProvider.overrideWithValue(RentalTestService()),
        ],
        child: MaterialApp(home: AgreementDetailScreen(agreement: lease)),
      ),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
    for (var i = 0; i < 5; i++) {
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -400));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.takeException(), isNull);
    }
    expect(find.text('Payment Receipts & History'), findsOneWidget);
    expect(find.text('Sign & Agree to Lease'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  test(
    'booking draft is replaced by the server lease before signing',
    () async {
      final service = RentalService(
        accountEmail: 'test@example.com',
        client: MockClient((request) async {
          expect(request.url.path, '/api/agreements');
          expect(jsonDecode(request.body)['id'], isNull);
          return http.Response(
            '{"id":"server-lease","propertyId":"property"}',
            201,
          );
        }),
      );
      final draft = AgreementModel.fromJson({
        'id': 'agr_booking',
        'propertyId': 'property',
        'property': {'title': 'Garden House'},
      });
      await service.saveLocalAgreement(draft);
      final saved = await service.persistDraft(draft);
      expect(saved.id, 'server-lease');
      expect(saved.propertyTitle, 'Garden House');
      final prefs = await SharedPreferences.getInstance();
      final cached = jsonDecode(
        prefs.getString('rentwise_client_agreements_test%40example.com')!,
      ) as List;
      expect(cached.map((item) => item['id']), ['server-lease']);
    },
  );

  test(
    'saved rentals are isolated by normalized email and ignore legacy cache',
    () async {
      SharedPreferences.setMockInitialValues({
        'rentwise_client_agreements': '[{"id":"legacy"}]',
      });
      final client = MockClient((_) async => http.Response('[]', 200));
      final first = RentalService(
        accountEmail: ' FIRST@example.com ',
        client: client,
      );
      final second = RentalService(
        accountEmail: 'second@example.com',
        client: client,
      );
      await first.saveLocalAgreement(
        AgreementModel.fromJson({'id': 'first-lease'}),
      );
      expect((await first.fetchAgreements()).map((a) => a.id), ['first-lease']);
      expect(await second.fetchAgreements(), isEmpty);
      final returning = RentalService(
        accountEmail: 'first@example.com',
        client: client,
      );
      expect((await returning.fetchAgreements()).map((a) => a.id), [
        'first-lease',
      ]);
    },
  );

  test('server receipt fields retain agreement and payment date', () {
    final payment = PaymentModel.fromJson({
      'id': 'receipt',
      'rentalAgreementId': 'lease',
      'paymentDate': '2026-09-26T10:00:00Z',
      'amount': 50000,
      'isSuccessful': true,
    });
    expect(payment.agreementId, 'lease');
    expect(payment.paidAt, '2026-09-26T10:00:00Z');
  });

  test('rejected payment never creates a successful local receipt', () async {
    final service = RentalService(
      accountEmail: 'test@example.com',
      client: MockClient((_) async => http.Response('', 500)),
    );
    expect(await service.payAgreement('lease', 50000, 'Card', 'ref'), false);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('rentwise_client_payments'), isNull);
  });

  test('monthly rent uses the monthly endpoint and preserves the server receipt ID', () async {
    SharedPreferences.setMockInitialValues({});
    final service = RentalService(
      accountEmail: 'test@example.com',
      client: MockClient((request) async {
        expect(request.url.path, '/api/agreements/lease/payments');
        return http.Response(
          '{"id":"server-payment","purpose":"MonthlyRent"}',
          201,
        );
      }),
    );
    expect(
      await service.payAgreement(
        'lease',
        50000,
        'Card',
        'RENT-test',
        isMonthlyRent: true,
      ),
      true,
    );
    final prefs = await SharedPreferences.getInstance();
    final saved =
        jsonDecode(prefs.getString('rentwise_client_payments')!) as List;
    expect(saved.single['id'], 'server-payment');
    expect(saved.single['purpose'], 'MonthlyRent');
  });
  test('payment purpose survives a cache round trip', () {
    final payment = PaymentModel.fromJson({
      'id': 'p',
      'purpose': 'SecurityDeposit',
      'paymentReference': 'RENT-old',
    });
    expect(
      PaymentModel.fromJson(payment.toJson()).purposeLabel,
      'Security deposit',
    );
  });

  test('successful payment is submitted exactly once', () async {
    final paths = <String>[];
    final service = RentalService(
      accountEmail: 'test@example.com',
      client: MockClient((request) async {
        paths.add(request.url.path);
        return http.Response(
          '{"success":true,"payment":{"id":"saved-deposit","purpose":"SecurityDeposit"}}',
          200,
        );
      }),
    );
    expect(await service.payAgreement('lease', 50000, 'Card', 'ref'), true);
    expect(paths, ['/api/agreements/lease/pay']);
  });

  test('failed signing does not cache an agreed lease', () async {
    final service = RentalService(
      accountEmail: 'test@example.com',
      client: MockClient((_) async => http.Response('', 403)),
    );
    final agreement = AgreementModel.fromJson({
      'id': 'lease',
      'status': 'Drafted',
    });
    expect(
      await service.agreeToAgreement(
        'lease',
        'Tenant',
        localAgreement: agreement,
      ),
      false,
    );
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('rentwise_client_agreements'), isNull);
  });

  test('offline estimate identifies its source and actual deposit', () {
    final result = RentalService().localAiAudit(
      rent: 50000,
      location: 'Malabe',
      propertyType: 'Apartment',
      bedrooms: 2,
      ownerName: 'Owner',
      tenantName: 'Tenant',
      propertyAddress: 'Malabe',
      startDate: '2026-09-01',
      endDate: '2027-03-01',
      securityDeposit: 75000,
    );
    expect(result['is_local_estimate'], true);
    expect(
      result['plain_language_summary']['financial_terms'],
      contains('75,000'),
    );
  });
}
