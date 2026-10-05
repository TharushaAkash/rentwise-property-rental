import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';
import 'login_screen.dart';
import 'signup_screen.dart';

/// The app's public entry screen with an immersive property hero design.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  static const Color _bgDark = Color(0xFF0C1916);
  static const Color _accentGreen = Color(0xFF34D399);

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final screenHeight = mediaQuery.size.height;
    final imageHeight = (screenHeight * 0.48).clamp(260.0, 480.0);

    return Scaffold(
      backgroundColor: _bgDark,
      body: Stack(
        children: [
          // 1. Full-width Hero Property Image with smooth alpha fade
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: (screenHeight * 0.65).clamp(320.0, 560.0),
            child: ShaderMask(
              shaderCallback: (rect) {
                return const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: [0.0, 0.35, 0.70, 1.0],
                  colors: [
                    Colors.black,
                    Colors.black,
                    Color(0x77000000),
                    Colors.transparent,
                  ],
                ).createShader(rect);
              },
              blendMode: BlendMode.dstIn,
              child: Image.asset(
                'assets/property_placeholder.jpg',
                fit: BoxFit.cover,
                alignment: Alignment.topCenter,
              ),
            ),
          ),

          // 2. Cinematic Ambient Gradient for seamless tone transition
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: const [0.0, 0.20, 0.50, 0.75, 1.0],
                  colors: [
                    Colors.black.withAlpha(60),
                    Colors.transparent,
                    _bgDark.withAlpha(120),
                    _bgDark.withAlpha(230),
                    _bgDark,
                  ],
                ),
              ),
            ),
          ),

          // 3. Scrollable Foreground Content
          SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 16,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Spacer to reveal the property image nicely
                      SizedBox(height: imageHeight * 0.65),

                      // Brand Icon + Name Badge
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: AppColors.teal,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: _accentGreen.withAlpha(90),
                                width: 1.2,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.teal.withAlpha(80),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.cottage_rounded,
                              color: Colors.white,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Flexible(
                            child: Text(
                              'RentWise',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),

                      // Main Hero Title
                      RichText(
                        text: const TextSpan(
                          style: TextStyle(
                            fontSize: 34,
                            height: 1.15,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1.0,
                            fontFamily: 'sans-serif',
                          ),
                          children: [
                            TextSpan(
                              text: 'A place to call ',
                              style: TextStyle(color: Colors.white),
                            ),
                            TextSpan(
                              text: 'home.',
                              style: TextStyle(color: _accentGreen),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Subtitle
                      Text(
                        'Find a rental that fits your life. Keep your listings, agreements and requests together.',
                        style: TextStyle(
                          fontSize: 14.5,
                          height: 1.45,
                          color: Colors.white.withAlpha(200),
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Feature Highlight Chips
                      const Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _FeaturePill(
                            icon: Icons.search_rounded,
                            label: 'Find a home',
                          ),
                          _FeaturePill(
                            icon: Icons.key_rounded,
                            label: 'Manage rentals',
                          ),
                          _FeaturePill(
                            icon: Icons.auto_awesome_rounded,
                            label: 'AI assistance',
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),

                      // Primary Button: Sign in
                      SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: ElevatedButton.icon(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const LoginScreen(),
                            ),
                          ),
                          icon: const Icon(
                            Icons.mail_outline_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                          label: const Text(
                            'Sign in',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: 0.2,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.teal,
                            foregroundColor: Colors.white,
                            elevation: 4,
                            shadowColor: AppColors.teal.withAlpha(100),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(28),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Secondary Button: Create account (No Apple button!)
                      SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: ElevatedButton(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const SignupScreen(),
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: _bgDark,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(28),
                            ),
                          ),
                          child: const Text(
                            'Create account',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: _bgDark,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Bottom Note
                      Center(
                        child: Text(
                          'For tenants and property owners.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white.withAlpha(150),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeaturePill extends StatelessWidget {
  const _FeaturePill({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(18),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withAlpha(35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: const Color(0xFF34D399)),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
