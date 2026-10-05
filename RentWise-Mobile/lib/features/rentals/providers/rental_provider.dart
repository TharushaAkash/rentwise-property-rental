import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';
import '../models/rental_model.dart';
import '../services/rental_service.dart';

// ── Service singleton ──────────────────────────────────────
final rentalServiceProvider = Provider<RentalService>((ref) {
  final user = ref.watch(authStateProvider).value;
  return RentalService(accountEmail: user?.email, token: user?.token);
});

// ── Agreements list ────────────────────────────────────────
final agreementsProvider =
    AsyncNotifierProvider<AgreementsNotifier, List<AgreementModel>>(
      AgreementsNotifier.new,
    );

class AgreementsNotifier extends AsyncNotifier<List<AgreementModel>> {
  @override
  Future<List<AgreementModel>> build() {
    final user = ref.watch(authStateProvider).value;
    final service = ref.watch(rentalServiceProvider);
    if (user == null) return Future.value([]);
    return service.fetchAgreements();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(rentalServiceProvider).fetchAgreements(),
    );
  }

  /// Optimistically update one agreement in the list (for agree/pay actions)
  void updateOne(AgreementModel updated) {
    state.whenData((list) {
      state = AsyncData([
        updated,
        ...list.where(
          (a) =>
              a.id != updated.id &&
              !(a.id.startsWith('agr_') && a.propertyId == updated.propertyId),
        ),
      ]);
    });
  }
}
