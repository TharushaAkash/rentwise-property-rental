import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';
import 'login_screen.dart';
import 'signup_screen.dart';

/// The app's public entry screen. No network request is needed to display it.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F5EF),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(
                        Icons.cottage_outlined,
                        color: AppColors.teal,
                        size: 32,
                      ),
                      SizedBox(width: 10),
                      Flexible(
                        child: Text(
                          'RentWise',
                          style: TextStyle(
                            fontSize: 25,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: AppColors.softTeal,
                      borderRadius: BorderRadius.circular(28),
                    ),
                    child: Column(
                      children: [
                        const ExcludeSemantics(
                          child: Icon(
                            Icons.holiday_village_outlined,
                            size: 112,
                            color: AppColors.darkGreen,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Text(
                            'Your next chapter starts here.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.darkGreen,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  const Text(
                    'A place to call\nhome.',
                    style: TextStyle(
                      fontSize: 38,
                      height: 1.12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -1.2,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Find a rental that fits your life. Keep your listings, agreements and requests together.',
                    style: TextStyle(
                      fontSize: 16,
                      height: 1.5,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 22),
                  const Wrap(
                    spacing: 16,
                    runSpacing: 12,
                    children: [
                      _Feature(
                        icon: Icons.search_rounded,
                        label: 'Find a home',
                      ),
                      _Feature(
                        icon: Icons.key_outlined,
                        label: 'Manage rentals',
                      ),
                      _Feature(
                        icon: Icons.auto_awesome_outlined,
                        label: 'AI assistance',
                      ),
                    ],
                  ),
                  const SizedBox(height: 30),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      ),
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('Sign in'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SignupScreen()),
                      ),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('Create account'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Center(
                    child: Text(
                      'For tenants and property owners.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 18, color: AppColors.teal),
      const SizedBox(width: 6),
      Flexible(
        child: Text(
          label,
          style: const TextStyle(fontSize: 13, color: AppColors.ink),
        ),
      ),
    ],
  );
}
