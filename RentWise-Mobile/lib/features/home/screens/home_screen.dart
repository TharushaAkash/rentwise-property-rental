import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../profile/screens/profile_screen.dart';

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
            const Center(child: Text('Properties (Owner)')),
            const Center(child: Text('Tenants')),
            const ProfileScreen(),
          ]
        : [
            const Center(child: Text('Discover Properties')),
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
                    _NavItem(icon: Icons.home_rounded, label: 'Home', index: 0, selectedIndex: _tab, onTap: (idx) => setState(() => _tab = idx)),
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
