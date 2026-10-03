import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rentwise_mobile/features/home/models/property_model.dart';
import 'package:rentwise_mobile/features/home/providers/property_provider.dart';
import 'package:rentwise_mobile/features/maintenance/screens/create_maintenance_screen.dart';
import 'package:rentwise_mobile/features/shared/theme/app_theme.dart';

void main() {
  for (final scale in [1.0, 1.5]) {
    testWidgets(
      'maintenance form fits 320px with long property title at scale $scale',
      (tester) async {
        tester.view.physicalSize = const Size(320, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        const title =
            'Spacious fully furnished family apartment near university in Colombo';
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              bookedPropertiesProvider.overrideWith(
                (ref) async => [
                  PropertyModel.fromJson({'id': 'property-1', 'title': title}),
                ],
              ),
            ],
            child: MaterialApp(
              theme: buildAppTheme(),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context)
                    .copyWith(textScaler: TextScaler.linear(scale)),
                child: child!,
              ),
              home: const CreateMaintenanceScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        final propertyField = find
            .byType(DropdownButtonFormField<String>)
            .first;
        await tester.ensureVisible(propertyField);
        await tester.tap(propertyField);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.tap(find.text(title).last);
        await tester.pumpAndSettle();
        expect(find.text('Booked Home'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('AI Triage'));
        await tester.tap(find.text('AI Triage'));
        await tester.pumpAndSettle();
        expect(find.text('Please enter a description first'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
