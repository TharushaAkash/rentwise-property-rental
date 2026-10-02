import 'bank_details_screen.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/modern_ui.dart';
import '../../auth/providers/auth_provider.dart';
import '../../auth/screens/login_screen.dart';
import '../../maintenance/screens/maintenance_screen.dart';
import '../../rentals/screens/my_rentals_screen.dart';
import '../../properties/screens/properties_dashboard_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userState = ref.watch(authStateProvider);
    final user = userState.value;
    if (user == null) {
      return const Scaffold(
        body: Center(child: Text('Sign in to view your profile.')),
      );
    }
    final owner = user.role == 'Owner' || user.role == 'PropertyOwner';
    void open(Widget page) =>
        Navigator.push(context, MaterialPageRoute(builder: (_) => page));
    return Scaffold(
      appBar: AppBar(title: const Text('Your profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.softTeal,
              borderRadius: BorderRadius.circular(28),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 70,
                      height: 70,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE4EBDF),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Text(
                        user.name.isEmpty
                            ? 'U'
                            : user.name.characters.first.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w700,
                          color: AppColors.teal,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Text(
                        owner ? 'PROPERTY OWNER' : user.role.toUpperCase(),
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                          letterSpacing: 1.4,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Text(
                  user.name,
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                    letterSpacing: -.6,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  user.email,
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          const FormHeading(
            'Personal details',
            'Your account information, all together.',
            icon: Icons.person_outline,
          ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  DetailLine('Email address', user.email),
                  if (user.phoneNumber?.isNotEmpty == true) ...[
                    const Divider(),
                    DetailLine('Phone number', user.phoneNumber!),
                  ],
                  if (user.nicNumber?.isNotEmpty == true) ...[
                    const Divider(),
                    DetailLine('NIC number', user.nicNumber!),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 28),
          const FormHeading(
            'Your workspace',
            'Everything you need for your rental journey.',
            icon: Icons.grid_view_outlined,
          ),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Column(
                children: [
                  if (owner)
                    _ProfileLink(
                      icon: Icons.account_balance_outlined,
                      title: 'Bank details',
                      subtitle: 'Your account for tenant transfers',
                      onTap: () => open(const BankDetailsScreen()),
                    ),
                  _ProfileLink(
                    icon: Icons.key_outlined,
                    title: 'Rentals & payments',
                    subtitle: 'Agreements, receipts and your lease',
                    onTap: () => open(const MyRentalsScreen()),
                  ),
                  const Divider(height: 1, indent: 70, endIndent: 20),
                  _ProfileLink(
                    icon: Icons.calendar_month_outlined,
                    title: 'Bookings',
                    subtitle: owner
                        ? 'Manage tenant requests'
                        : 'Track your rental requests',
                    onTap: () => open(const PropertyBookingsScreen()),
                  ),
                  const Divider(height: 1, indent: 70, endIndent: 20),
                  _ProfileLink(
                    icon: Icons.handyman_outlined,
                    title: 'Maintenance',
                    subtitle: 'Get help with your home',
                    onTap: () => open(const MaintenanceScreen()),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 28),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFB42335),
              side: const BorderSide(color: Color(0xFFF0D8DC)),
            ),
            onPressed: () async {
              await ref.read(authStateProvider.notifier).logout();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
            icon: const Icon(Icons.logout_rounded, size: 19),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

class _ProfileLink extends StatelessWidget {
  const _ProfileLink({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
    leading: Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: AppColors.softTeal,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(icon, color: AppColors.teal, size: 21),
    ),
    title: Text(
      title,
      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
    ),
    subtitle: Text(
      subtitle,
      style: const TextStyle(fontSize: 12, color: AppColors.muted),
    ),
    trailing: const Icon(
      Icons.arrow_forward_ios_rounded,
      size: 14,
      color: AppColors.muted,
    ),
    onTap: onTap,
  );
}
