import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rentwise_mobile/features/shared/theme/app_theme.dart';
import 'package:rentwise_mobile/features/workflows/workflow_service.dart';
import 'package:rentwise_mobile/features/workflows/workflow_screens.dart';

Map<String, dynamic> detail({
  String status = 'AwaitingApproval',
  bool reviewer = false,
}) => {
  'id': 'request-1',
  'status': status,
  'version': 7,
  'createdAt': '2026-09-28T00:00:00Z',
  'updatedAt': '2026-09-28T00:00:00Z',
  'canAdvance': !reviewer,
  'canReview': reviewer,
  'steps': [],
  'state': {
    'request': {
      'objective': 'A quiet home in Malabe',
      'maxMonthlyRent': 100000,
      'startDate': '2027-04-01',
      'endDate': '2027-10-01',
    },
    'plan': [
      'MatchingLocation',
      'PropertyVerification',
      'AgreementPricing',
      'MaintenanceTriage',
    ],
    'outputs': status == 'Ready'
        ? <String, dynamic>{}
        : {
            'MatchingLocation': {'summary': 'Your matching home'},
            'PropertyVerification': {'summary': 'Available'},
            'AgreementPricing': {
              'summary': 'Draft summary',
              'terms': 'Reviewed lease terms',
              'monthlyRent': 60000,
            },
            'MaintenanceTriage': {
              'summary': 'Move-in summary',
              'checklist': ['Check water supply'],
            },
          },
    'decisions': [],
    'attempts': 0,
  },
};

WorkflowService service(Future<http.Response> Function(http.Request) handler) =>
    WorkflowService(
      client: MockClient(handler),
      tokenLoader: () async => 'fixture-jwt',
    );
Widget app(Widget child) => ProviderScope(
  child: MaterialApp(theme: buildAppTheme(), home: child),
);

void main() {
  testWidgets('Reviewer reads terms and confirms a versioned approval', (
    tester,
  ) async {
    Map<String, dynamic>? sent;
    var current = detail(reviewer: true);
    final api = service((request) async {
      if (request.url.path.endsWith('/decision')) {
        sent = jsonDecode(request.body) as Map<String, dynamic>;
        current = detail(status: 'Completed', reviewer: true);
        return http.Response('{}', 200);
      }
      return http.Response(jsonEncode(current), 200);
    });
    addTearDown(api.dispose);
    await tester.pumpWidget(
      app(RentalRequestDetail(service: api, id: 'request-1')),
    );
    await tester.pumpAndSettle();
    expect(find.byTooltip('Delete request'), findsNothing);
    await tester.ensureVisible(find.text('Review agreement'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Review agreement'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Approve and save draft'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Approve and save draft'));
    await tester.pumpAndSettle();
    expect(sent, isNull);
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(sent, {'decision': 'approve', 'note': '', 'version': 7});
    expect(find.text('Draft approved'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  test(
    'Workflow actions use authenticated ASP.NET routes and review versions',
    () async {
      final requests = <http.Request>[];
      final api = service((request) async {
        requests.add(request);
        return http.Response(
          request.method == 'DELETE' ? '' : '{"id":"request-1"}',
          request.method == 'DELETE' ? 204 : 200,
        );
      });
      addTearDown(api.dispose);
      await api.create({'objective': 'A home in Malabe'});
      await api.advance('request-1');
      await api.decide('request-1', 'approve', 'Reviewed', 7);
      await api.revise('request-1', {'objective': 'Updated preferences'});
      await api.delete('request-1');
      expect(
        requests.every((r) => r.url.path.startsWith('/api/rental-workflows')),
        isTrue,
      );
      expect(
        requests.every(
          (r) => r.headers['Authorization'] == 'Bearer fixture-jwt',
        ),
        isTrue,
      );
      expect(jsonDecode(requests[2].body), {
        'decision': 'approve',
        'note': 'Reviewed',
        'version': 7,
      });
      expect(requests.last.method, 'DELETE');
    },
  );

  test(
    'Backend validation errors and expired sessions remain actionable',
    () async {
      final api = service(
        (_) async =>
            http.Response('{"message":"Property is unavailable"}', 409),
      );
      addTearDown(api.dispose);
      await expectLater(
        api.advance('request-1'),
        throwsA(
          isA<WorkflowException>().having(
            (e) => e.message,
            'message',
            'Property is unavailable',
          ),
        ),
      );
      final expired = service((_) async => http.Response('', 401));
      addTearDown(expired.dispose);
      await expectLater(
        expired.list(),
        throwsA(
          isA<WorkflowException>().having(
            (e) => e.message,
            'message',
            contains('session expired'),
          ),
        ),
      );
    },
  );

  testWidgets('Tenant list has a clear create action; reviewer list does not', (
    tester,
  ) async {
    final api = service((_) async => http.Response('[]', 200));
    addTearDown(api.dispose);
    await tester.pumpWidget(
      app(RentalRequestsScreen(canCreate: true, service: api)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Find a home'), findsOneWidget);
    expect(find.text('Nothing here yet'), findsOneWidget);
    await tester.pumpWidget(
      app(
        RentalRequestsScreen(
          key: const ValueKey('reviewer'),
          canCreate: false,
          service: api,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Find a home'), findsNothing);
  });

  testWidgets(
    'Request form validates preferences before showing budget and dates',
    (tester) async {
      final api = service((_) async => http.Response('{}', 200));
      addTearDown(api.dispose);
      await tester.pumpWidget(app(RentalRequestForm(service: api)));
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(
        find.text('Add a little more detail (at least 10 characters).'),
        findsOneWidget,
      );
      await tester.enterText(
        find.byKey(const ValueKey('objective')),
        'A home in Malabe with parking',
      );
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('budget')), findsOneWidget);
      expect(find.byKey(const ValueKey('objective')), findsNothing);
    },
  );

  testWidgets(
    'Proposal uses separate tabs and supports small screens and larger text',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = service(
        (_) async => http.Response(jsonEncode(detail()), 200),
      );
      addTearDown(api.dispose);
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: buildAppTheme(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(textScaler: const TextScaler.linear(1.3)),
              child: child!,
            ),
            home: RentalRequestDetail(service: api, id: 'request-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Your matching home'), findsOneWidget);
      expect(find.text('Reviewed lease terms'), findsNothing);
      await tester.ensureVisible(find.text('Agreement'));
      await tester.tap(find.text('Agreement'));
      await tester.pumpAndSettle();
      expect(find.text('Reviewed lease terms'), findsOneWidget);
      expect(find.text('Your matching home'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('New request automatically prepares all steps', (tester) async {
    var current = detail(status: 'Ready');
    var advances = 0;
    final api = service((request) async {
      if (request.url.path.endsWith('/advance')) {
        advances++;
        if (advances == 4) current = detail();
        return http.Response('{}', 200);
      }
      return http.Response(jsonEncode(current), 200);
    });
    addTearDown(api.dispose);
    await tester.pumpWidget(
      app(RentalRequestDetail(service: api, id: 'request-1', autoStart: true)),
    );
    await tester.pumpAndSettle();
    expect(advances, 4);
    expect(find.text('Awaiting owner review'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('Delete requires confirmation and uses the request endpoint', (
    tester,
  ) async {
    var deletes = 0;
    final api = service((request) async {
      if (request.method == 'DELETE') {
        deletes++;
        return http.Response('', 204);
      }
      return http.Response(jsonEncode(detail()), 200);
    });
    addTearDown(api.dispose);
    await tester.pumpWidget(
      app(RentalRequestDetail(service: api, id: 'request-1')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Delete request'));
    await tester.pumpAndSettle();
    expect(deletes, 0);
    await tester.tap(find.text('Keep request'));
    await tester.pumpAndSettle();
    expect(deletes, 0);
    await tester.tap(find.byTooltip('Delete request'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Delete request'));
    await tester.pumpAndSettle();
    expect(deletes, 1);
    await tester.pumpWidget(const SizedBox());
  });
}
