import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../profile/screens/profile_screen.dart';
import '../providers/property_provider.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final userState = ref.watch(authStateProvider);
    final isOwner = userState.value?.role == 'Owner' || userState.value?.role == 'PropertyOwner';

    final pages = isOwner
        ? [
            const _DiscoverPropertiesTab(),
            const Center(child: Text('Tenants')),
            const ProfileScreen(),
          ]
        : [
            const _DiscoverPropertiesTab(),
            const Center(child: Text('Saved Rentals')),
            const ProfileScreen(),
          ];

    return Scaffold(
      body: pages[_tab],
      bottomNavigationBar: SafeArea(
        top: false,
        minimum: const EdgeInsets.fromLTRB(10, 0, 10, 8),
        child: Container(
          height: 70,
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.line),
            boxShadow: const [
              BoxShadow(
                color: Color(0x1A008037),
                blurRadius: 16,
                offset: Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: isOwner
                ? [
                    _NavItem(icon: Icons.home_rounded, label: 'Properties', index: 0, selectedIndex: _tab, onTap: (idx) => setState(() => _tab = idx)),
                    _NavItem(icon: Icons.people_alt_rounded, label: 'Tenants', index: 1, selectedIndex: _tab, onTap: (idx) => setState(() => _tab = idx)),
                    _NavItem(icon: Icons.person_rounded, label: 'Profile', index: 2, selectedIndex: _tab, onTap: (idx) => setState(() => _tab = idx)),
                  ]
                : [
                    _NavItem(icon: Icons.search_rounded, label: 'Discover', index: 0, selectedIndex: _tab, onTap: (idx) => setState(() => _tab = idx)),
                    _NavItem(icon: Icons.favorite_rounded, label: 'Saved', index: 1, selectedIndex: _tab, onTap: (idx) => setState(() => _tab = idx)),
                    _NavItem(icon: Icons.person_rounded, label: 'My Profile', index: 2, selectedIndex: _tab, onTap: (idx) => setState(() => _tab = idx)),
                  ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.index,
    required this.selectedIndex,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final int index;
  final int selectedIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final selected = index == selectedIndex;
    return Expanded(
      child: InkWell(
        onTap: () => onTap(index),
        borderRadius: BorderRadius.circular(18),
        child: Container(
          decoration: BoxDecoration(
            color: selected ? AppColors.softTeal : Colors.transparent,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 24, color: selected ? AppColors.teal : AppColors.muted),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  color: selected ? AppColors.teal : AppColors.muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DiscoverPropertiesTab extends ConsumerWidget {
  const _DiscoverPropertiesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final propertiesAsync = ref.watch(propertiesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover Properties', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: Colors.white,
        scrolledUnderElevation: 0,
      ),
      body: propertiesAsync.when(
        data: (properties) {
          if (properties.isEmpty) {
            return const Center(child: Text('No properties found.'));
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(propertiesProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              itemCount: properties.length,
              itemBuilder: (context, index) {
                return _MobilePropertyCard(property: properties[index]);
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Failed to load properties', style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: () => ref.refresh(propertiesProvider.future),
                child: const Text('Retry'),
              )
            ],
          ),
        ),
      ),
    );
  }
}

class _MobilePropertyCard extends StatelessWidget {
  final dynamic property;

  const _MobilePropertyCard({required this.property});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.line),
        boxShadow: const [
          BoxShadow(color: Color(0x0D000000), blurRadius: 10, offset: Offset(0, 4)),
        ],
      ),
      child: InkWell(
        onTap: () {
          // TODO: Navigate to Details
        },
        borderRadius: BorderRadius.circular(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Photo Banner
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
                  child: property.photoUrl.isNotEmpty
                      ? Image.network(
                          property.photoUrl,
                          height: 180,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
                        )
                      : _buildPlaceholder(),
                ),
                Positioned(
                  top: 14,
                  left: 14,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                    child: Row(
                      children: [
                        Icon(Icons.star_rounded, color: Colors.orange[400], size: 16),
                        const SizedBox(width: 4),
                        const Text('New', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  top: 14,
                  right: 14,
                  child: CircleAvatar(
                    backgroundColor: Colors.white,
                    radius: 18,
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      icon: const Icon(Icons.favorite_border_rounded, size: 20, color: AppColors.muted),
                      onPressed: () {},
                    ),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                  ),
                  Text(
                    property.title,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.ink),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.location_on_rounded, size: 14, color: AppColors.muted),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          property.address,
                          style: const TextStyle(color: AppColors.muted, fontSize: 13),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _buildFeature(Icons.bed_rounded, '${property.bedrooms} Beds'),
                      const SizedBox(width: 12),
                      _buildFeature(Icons.bathtub_rounded, '${property.bathrooms} Baths'),
                      const SizedBox(width: 12),
                      _buildFeature(Icons.square_foot_rounded, '${property.sqft} sqft'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Divider(height: 1, color: AppColors.line),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Monthly Rent', style: TextStyle(color: AppColors.muted, fontSize: 11)),
                          const SizedBox(height: 2),
                          Text(
                            'LKR ${property.monthlyRent.toStringAsFixed(0)}',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.teal),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(color: AppColors.teal, borderRadius: BorderRadius.circular(12)),
                        child: const Text('View Details', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      height: 180,
      color: const Color(0xFFE2E8F0),
      child: const Icon(Icons.apartment_rounded, size: 50, color: AppColors.muted),
    );
  }

  Widget _buildFeature(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.muted),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.ink)),
      ],
    );
  }
}
