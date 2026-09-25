import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../auth/screens/login_screen.dart';
import '../../maintenance/screens/maintenance_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userState = ref.watch(authStateProvider);
    final user = userState.value;

    if (user == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Scaffold(
      appBar: AppBar(title: const Text('My Profile & Settings')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // User Identity Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: AppColors.line),
              boxShadow: const [
                BoxShadow(color: Color(0x0A000000), blurRadius: 10, offset: Offset(0, 4))
              ],
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppColors.teal,
                  child: Text(
                    user.name.isNotEmpty ? user.name.substring(0, 1).toUpperCase() : 'U',
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.name, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: AppColors.ink)),
                      const SizedBox(height: 2),
                      Text(user.email, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.softTeal,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          user.role == 'PropertyOwner' || user.role == 'Owner' ? 'Property Owner' : 'Verified Tenant',
                          style: const TextStyle(color: AppColors.teal, fontSize: 11, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          if (user.phoneNumber != null || user.nicNumber != null) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: [
                  if (user.phoneNumber != null && user.phoneNumber!.isNotEmpty)
                    _infoRow(Icons.phone_outlined, 'Phone', user.phoneNumber!),
                  if (user.nicNumber != null && user.nicNumber!.isNotEmpty) ...[
                    const Divider(height: 16),
                    _infoRow(Icons.badge_outlined, 'NIC Number', user.nicNumber!),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Settings Links
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.key_outlined, color: AppColors.teal),
                  title: const Text('My Rentals', style: TextStyle(fontWeight: FontWeight.w700)),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () {},
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.payments_outlined, color: AppColors.teal),
                  title: const Text('Payments', style: TextStyle(fontWeight: FontWeight.w700)),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () {},
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.build_outlined, color: AppColors.teal),
                  title: const Text('Maintenance Requests', style: TextStyle(fontWeight: FontWeight.w700)),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const MaintenanceScreen()),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Logout Button
          SizedBox(
            width: double.infinity,
            height: 50,
            child: TextButton.icon(
              onPressed: () {
                ref.read(authStateProvider.notifier).logout();
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (route) => false,
                );
              },
              icon: const Icon(Icons.logout_rounded, color: Color(0xFFB91C1C)),
              label: const Text('Sign Out', style: TextStyle(color: Color(0xFFB91C1C), fontWeight: FontWeight.bold)),
              style: TextButton.styleFrom(
                backgroundColor: const Color(0xFFFEE2E2),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.muted),
        const SizedBox(width: 12),
        Text(label, style: const TextStyle(color: AppColors.muted, fontWeight: FontWeight.w600)),
        const Spacer(),
        Text(value, style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w800)),
      ],
    );
  }
}
