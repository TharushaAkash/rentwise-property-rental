import '../../../shared/validation/input_validators.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/theme/app_theme.dart';
import '../providers/auth_provider.dart';
import '../../home/screens/home_screen.dart';
import 'login_screen.dart';

class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _name = TextEditingController();
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _nic = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();

  bool _isOwner = false;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _nic.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  void _register() {
    final name = _name.text.trim();
    final email = _email.text.trim();
    final phone = _phone.text.trim();
    final nic = _nic.text.trim();
    final password = _password.text;
    if (!_form.currentState!.validate()) return;

    setState(() => _error = null);

    ref
        .read(authStateProvider.notifier)
        .register(
          name,
          email,
          password,
          _isOwner ? 'PropertyOwner' : 'Tenant',
          phone,
          nic,
        );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);

    ref.listen(authStateProvider, (previous, next) {
      next.whenOrNull(
        error: (error, stackTrace) {
          setState(
            () => _error = error.toString().replaceAll('Exception:', '').trim(),
          );
        },
        data: (user) {
          if (user != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Account created successfully!'),
                backgroundColor: AppColors.ink,
              ),
            );
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const HomeScreen()),
              (route) => false,
            );
          }
        },
      );
    });

    final canPop = Navigator.of(context).canPop();

    return Scaffold(
      backgroundColor: const Color(0xFFF8F7F4),
      appBar: canPop
          ? AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              leading: const BackButton(color: AppColors.ink),
            )
          : null,
      body: Form(
        key: _form,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: ListView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 16,
                ),
                children: [
                  // Brand Icon & Badge
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.teal,
                          borderRadius: BorderRadius.circular(13),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.teal.withAlpha(50),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
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
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.softTeal,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          'GET STARTED',
                          style: TextStyle(
                            fontSize: 10.5,
                            letterSpacing: 1.2,
                            color: AppColors.darkGreen,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Headings
                  const Text(
                    'Create an account',
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.8,
                      color: AppColors.ink,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Join RentWise to discover verified homes or manage your rental properties.',
                    style: TextStyle(
                      fontSize: 14.5,
                      color: AppColors.muted,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Role Selector
                  const Text(
                    'Select your account type',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                      letterSpacing: 0.2,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _isOwner = false),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(
                              vertical: 14,
                              horizontal: 12,
                            ),
                            decoration: BoxDecoration(
                              color: !_isOwner
                                  ? AppColors.softTeal
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: !_isOwner
                                    ? AppColors.teal
                                    : AppColors.line,
                                width: !_isOwner ? 2 : 1,
                              ),
                              boxShadow: !_isOwner
                                  ? [
                                      BoxShadow(
                                        color: AppColors.teal.withAlpha(30),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ]
                                  : null,
                            ),
                            child: Column(
                              children: [
                                Icon(
                                  Icons.person_pin_rounded,
                                  size: 26,
                                  color: !_isOwner
                                      ? AppColors.teal
                                      : AppColors.muted,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'I am a Tenant',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                    color: !_isOwner
                                        ? AppColors.darkGreen
                                        : AppColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _isOwner = true),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(
                              vertical: 14,
                              horizontal: 12,
                            ),
                            decoration: BoxDecoration(
                              color: _isOwner
                                  ? AppColors.softTeal
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: _isOwner
                                    ? AppColors.teal
                                    : AppColors.line,
                                width: _isOwner ? 2 : 1,
                              ),
                              boxShadow: _isOwner
                                  ? [
                                      BoxShadow(
                                        color: AppColors.teal.withAlpha(30),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ]
                                  : null,
                            ),
                            child: Column(
                              children: [
                                Icon(
                                  Icons.real_estate_agent_rounded,
                                  size: 26,
                                  color: _isOwner
                                      ? AppColors.teal
                                      : AppColors.muted,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Property Owner',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                    color: _isOwner
                                        ? AppColors.darkGreen
                                        : AppColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),

                  // Full Name Field
                  TextFormField(
                    validator: (v) =>
                        InputValidators.text(v, label: 'Full name', min: 3),
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      labelText: 'Full Name',
                      hintText: 'e.g. Kasun Kalhara',
                      filled: true,
                      fillColor: Colors.white,
                      prefixIcon: const Icon(
                        Icons.person_outline_rounded,
                        color: AppColors.teal,
                        size: 20,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(
                          color: AppColors.teal,
                          width: 1.8,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Email Field
                  TextFormField(
                    validator: InputValidators.email,
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: 'Email Address',
                      hintText: 'e.g. kasun@gmail.com',
                      filled: true,
                      fillColor: Colors.white,
                      prefixIcon: const Icon(
                        Icons.mail_outline_rounded,
                        color: AppColors.teal,
                        size: 20,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(
                          color: AppColors.teal,
                          width: 1.8,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Phone Field
                  TextFormField(
                    validator: InputValidators.phone,
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: 'Phone Number (10 Digits)',
                      hintText: '077 123 4567',
                      helperText: 'Validated to Sri Lankan 10-digit format',
                      filled: true,
                      fillColor: Colors.white,
                      prefixIcon: const Icon(
                        Icons.phone_iphone_rounded,
                        color: AppColors.teal,
                        size: 20,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(
                          color: AppColors.teal,
                          width: 1.8,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // NIC Field
                  TextFormField(
                    validator: InputValidators.nic,
                    controller: _nic,
                    textCapitalization: TextCapitalization.characters,
                    decoration: InputDecoration(
                      labelText: 'National Identity Card (NIC)',
                      hintText: '12-digit or 9-digit with V (e.g. 981234567V)',
                      helperText: 'Format: 12 numbers or 9 numbers + V',
                      filled: true,
                      fillColor: Colors.white,
                      prefixIcon: const Icon(
                        Icons.badge_outlined,
                        color: AppColors.teal,
                        size: 20,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(
                          color: AppColors.teal,
                          width: 1.8,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Password Field
                  TextFormField(
                    validator: InputValidators.password,
                    controller: _password,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      labelText: 'Password (Min 8 Characters)',
                      filled: true,
                      fillColor: Colors.white,
                      prefixIcon: const Icon(
                        Icons.lock_outline_rounded,
                        color: AppColors.teal,
                        size: 20,
                      ),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          color: AppColors.muted,
                          size: 20,
                        ),
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(
                          color: AppColors.teal,
                          width: 1.8,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Confirm Password Field
                  TextFormField(
                    validator: (v) =>
                        InputValidators.confirmation(v, _password.text),
                    controller: _confirmPassword,
                    obscureText: _obscureConfirm,
                    decoration: InputDecoration(
                      labelText: 'Confirm Password',
                      filled: true,
                      fillColor: Colors.white,
                      prefixIcon: const Icon(
                        Icons.lock_reset_rounded,
                        color: AppColors.teal,
                        size: 20,
                      ),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureConfirm
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          color: AppColors.muted,
                          size: 20,
                        ),
                        onPressed: () => setState(
                          () => _obscureConfirm = !_obscureConfirm,
                        ),
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(
                          color: AppColors.teal,
                          width: 1.8,
                        ),
                      ),
                    ),
                  ),

                  // Error Box
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.error_outline_rounded,
                              color: Color(0xFFB91C1C),
                              size: 18,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _error!,
                                style: const TextStyle(
                                  color: Color(0xFFB91C1C),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 24),

                  // Create Account Button
                  SizedBox(
                    height: 54,
                    child: FilledButton(
                      onPressed: authState.isLoading ? null : _register,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.ink,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        shadowColor: AppColors.teal.withAlpha(80),
                        elevation: 3,
                      ),
                      child: authState.isLoading
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Create Account',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                                letterSpacing: 0.2,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 18),

                  // Switch to Login
                  Center(
                    child: TextButton(
                      onPressed: () => Navigator.of(context).pushReplacement(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      ),
                      child: RichText(
                        text: const TextSpan(
                          style: TextStyle(fontFamily: 'sans-serif'),
                          children: [
                            TextSpan(
                              text: 'Already have an account? ',
                              style: TextStyle(
                                color: AppColors.muted,
                                fontSize: 14,
                              ),
                            ),
                            TextSpan(
                              text: 'Sign in',
                              style: TextStyle(
                                color: AppColors.teal,
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
