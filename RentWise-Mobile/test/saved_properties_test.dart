import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rentwise_mobile/features/auth/models/user_model.dart';
import 'package:rentwise_mobile/features/auth/providers/auth_provider.dart';
import 'package:rentwise_mobile/features/home/models/property_model.dart';
import 'package:rentwise_mobile/features/properties/property_service.dart';
import 'package:rentwise_mobile/features/properties/saved_properties.dart';

class TestAuth extends AuthNotifier {
  @override
  Future<UserModel?> build() async => UserModel(
    id: 'tenant-1',
    name: 'Tenant',
    email: 'test@example.com',
    role: 'Tenant',
    token: 'test',
  );
}

void main() {
  testWidgets(
    'saved screen loads existing IDs and removes a property at 320px',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        'saved_properties_tenant-1': ['one'],
        'saved_properties_another-user': ['other'],
      });
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authStateProvider.overrideWith(TestAuth.new),
            propertyDetailsProvider('one').overrideWith(
              (ref) async => PropertyModel.fromJson({
                'id': 'one',
                'title': 'A long saved property title in Colombo for a family',
                'address': 'Colombo',
                'monthlyRent': 50000,
              }),
            ),
          ],
          child: const MaterialApp(home: SavedPropertiesScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('A long saved property title in Colombo for a family'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await tester.tap(find.byTooltip('Remove from saved properties'));
      await tester.pumpAndSettle();
      expect(find.text('Your favourites belong here'), findsOneWidget);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getStringList('saved_properties_tenant-1'), isEmpty);
      expect(prefs.getStringList('saved_properties_another-user'), ['other']);
    },
  );

  testWidgets('heart button saves a property and keeps its selected state', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authStateProvider.overrideWith(TestAuth.new)],
        child: const MaterialApp(
          home: Scaffold(body: SavePropertyButton(propertyId: 'one')),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Save property'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Remove from saved properties'), findsOneWidget);
    expect(
      (await SharedPreferences.getInstance()).getStringList(
        'saved_properties_tenant-1',
      ),
      ['one'],
    );
  });
}
