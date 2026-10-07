import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rentwise_mobile/features/auth/models/user_model.dart';
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';
import 'package:rentwise_mobile/features/auth/services/auth_service.dart';
import 'package:rentwise_mobile/features/home/models/property_model.dart';
import 'package:rentwise_mobile/features/properties/property_service.dart';
import 'package:rentwise_mobile/features/shared/theme/app_theme.dart';

final sampleJson = <String, dynamic>{
  'id': 'mob-property-1', 'ownerId': 'owner-1',
  'title': 'Garden House', 'description': 'A spacious family house with a garden.',
  'address': '12 Main Road, Colombo', 'monthlyRent': 50000,
  'bedrooms': 3, 'bathrooms': 2, 'sqft': 1200, 'propertyType': 'House',
  'status': 'Active', 'photos': <dynamic>[], 'facilities': 'Parking, Garden',
};
PropertyModel get sampleProperty => PropertyModel.fromJson(sampleJson);
UserModel get sampleUser => UserModel(id: 'tenant-1', name: 'Test Tenant',
  email: 'tenant@example.com', role: 'Tenant', token: 'test-token');

// Fake service boundary; the real AuthNotifier and LoginScreen remain under test.
class FakeAuthService extends AuthService {
  int loginCalls = 0;
  int logoutCalls = 0;
  String? email;
  String? password;
  String? savedToken;
  Object? loginError;
  Completer<UserModel?>? pendingLogin;
  @override
  Future<UserModel?> login(String email, String password) async {
    loginCalls++;
    this.email = email;
    this.password = password;
    if (loginError != null) throw loginError!;
    final user = pendingLogin == null ? sampleUser : await pendingLogin!.future;
    savedToken = user?.token;
    return user;
  }
  @override
  Future<void> logout() async { logoutCalls++; savedToken = null; }
}

http.Response browseResponse(List<Map<String, dynamic>> items) =>
  http.Response(jsonEncode({'items': items, 'hasMore': false, 'nextCursor': null}), 200);

Future<ProviderContainer> mountAssessment(WidgetTester tester, Widget screen, {
  FakeAuthService? auth,
  bool signedIn = false,
  PropertyModel? details,
  Future<http.Response> Function(http.Request)? respond,
}) async {
  final selectedProperty = details ?? sampleProperty;
  SharedPreferences.setMockInitialValues({
    'rentwise_map_address:${Uri.encodeComponent(selectedProperty.address)}': '[]',
  });
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final service = auth ?? FakeAuthService();
  final client = MockClient(respond ?? (request) async {
    if (request.url.path.endsWith('/browse')) return browseResponse([]);
    return http.Response('[]', 200);
  });
  final api = PropertyService('test-token', client: client);
  final container = ProviderContainer(overrides: [
    authServiceProvider.overrideWithValue(service),
    propertyServiceProvider.overrideWithValue(api),
    propertyDetailsProvider('mob-property-1').overrideWith((ref) async => selectedProperty),
    applicationsProvider.overrideWith((ref) async => []),
    verificationProvider('mob-property-1').overrideWith((ref) async => {
      'isApproved': true, 'isFeePaid': true, 'documents': [], 'verifications': [],
    }),
  ]);
  await container.read(authStateProvider.future);
  if (signedIn) await container.read(authStateProvider.notifier).login('tenant@example.com', 'Password123!');
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox.shrink());
    container.dispose();
    api.close();
  });
  await tester.pumpWidget(UncontrolledProviderScope(container: container,
    child: MaterialApp(theme: buildAppTheme(), home: screen)));
  await tester.pump();
  return container;
}

Future<void> submitLogin(WidgetTester tester, {String email = 'tenant@example.com', String password = 'Password123!'}) async {
  await tester.enterText(find.byType(TextFormField).at(0), email);
  await tester.enterText(find.byType(TextFormField).at(1), password);
  final button = find.widgetWithText(FilledButton, 'Sign In to Account');
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pump();
}
