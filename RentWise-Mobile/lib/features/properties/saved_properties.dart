import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../auth/providers/auth_provider.dart';
import 'property_service.dart';
import 'screens/property_detail_screen.dart';

final savedPropertyIdsProvider =
    AsyncNotifierProvider<SavedPropertyIds, List<String>>(SavedPropertyIds.new);

class SavedPropertyIds extends AsyncNotifier<List<String>> {
  String? _key;

  @override
  Future<List<String>> build() async {
    final user = ref.watch(authStateProvider).value;
    _key = user == null ? null : 'saved_properties_${user.id}';
    final key = _key;
    if (key == null) return [];
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(key) ?? []).toSet().toList();
  }

  Future<void> toggle(String id) async {
    final key = _key;
    if (key == null) throw StateError('Sign in to save properties.');
    final prefs = await SharedPreferences.getInstance();
    final ids = (prefs.getStringList(key) ?? []).toSet();
    if (!ids.remove(id)) ids.add(id);
    if (!await prefs.setStringList(key, ids.toList())) {
      throw StateError('Could not save your changes. Please try again.');
    }
    if (_key == key) state = AsyncData(ids.toList());
  }
}

class SavePropertyButton extends ConsumerStatefulWidget {
  const SavePropertyButton({super.key, required this.propertyId});
  final String propertyId;
  @override
  ConsumerState<SavePropertyButton> createState() => _SavePropertyButtonState();
}

class _SavePropertyButtonState extends ConsumerState<SavePropertyButton> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final saved = ref.watch(savedPropertyIdsProvider);
    final selected = saved.value?.contains(widget.propertyId) ?? false;
    return IconButton(
      tooltip: selected ? 'Remove from saved properties' : 'Save property',
      style: IconButton.styleFrom(backgroundColor: Colors.white),
      icon: Icon(
        selected ? Icons.favorite : Icons.favorite_border,
        color: selected ? Colors.red.shade700 : Colors.blueGrey.shade700,
      ),
      onPressed: _busy || saved.isLoading
          ? null
          : () async {
              setState(() => _busy = true);
              try {
                await ref
                    .read(savedPropertyIdsProvider.notifier)
                    .toggle(widget.propertyId);
              } catch (error) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text('$error')));
                }
              } finally {
                if (mounted) setState(() => _busy = false);
              }
            },
    );
  }
}

class SavedPropertiesScreen extends ConsumerWidget {
  const SavedPropertiesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(savedPropertyIdsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Saved properties')),
      body: saved.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: TextButton(
            onPressed: () => ref.invalidate(savedPropertyIdsProvider),
            child: const Text('Could not load saved properties. Retry'),
          ),
        ),
        data: (ids) => ids.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.favorite_border,
                        size: 48,
                        color: Colors.blueGrey,
                      ),
                      SizedBox(height: 16),
                      Text(
                        'Your favourites belong here',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Tap the heart on a property to save it for later.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              )
            : RefreshIndicator(
                onRefresh: () async {
                  for (final id in ids) {
                    ref.invalidate(propertyDetailsProvider(id));
                  }
                  ref.invalidate(savedPropertyIdsProvider);
                  await ref.read(savedPropertyIdsProvider.future);
                },
                child: ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: ids.length,
                  separatorBuilder: (_, index) => const SizedBox(height: 12),
                  itemBuilder: (_, index) => _SavedPropertyCard(id: ids[index]),
                ),
              ),
      ),
    );
  }
}

class _SavedPropertyCard extends ConsumerWidget {
  const _SavedPropertyCard({required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: ref
          .watch(propertyDetailsProvider(id))
          .when(
            loading: () => const SizedBox(
              height: 140,
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, stack) => Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'This saved listing could not be loaded. It may no longer be available.',
                  ),
                  Row(
                    children: [
                      TextButton(
                        onPressed: () =>
                            ref.invalidate(propertyDetailsProvider(id)),
                        child: const Text('Retry'),
                      ),
                      const Spacer(),
                      SavePropertyButton(propertyId: id),
                    ],
                  ),
                ],
              ),
            ),
            data: (property) => InkWell(
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => PropertyDetailScreen(property: property),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Stack(
                    children: [
                      Image.network(
                        property.photoUrl,
                        height: 180,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorBuilder: (_, error, stack) => const SizedBox(
                          height: 180,
                          width: double.infinity,
                          child: Icon(Icons.home_outlined, size: 48),
                        ),
                      ),
                      Positioned(
                        top: 8,
                        right: 8,
                        child: SavePropertyButton(propertyId: id),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          property.title,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(property.address),
                        const SizedBox(height: 8),
                        Text(
                          'LKR ${property.monthlyRent.toStringAsFixed(0)} / month',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${property.bedrooms} beds · ${property.bathrooms} baths',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
    );
  }
}
