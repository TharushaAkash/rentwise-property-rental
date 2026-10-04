import '../../../shared/validation/input_validators.dart';
import '../../shared/widgets/modern_ui.dart';

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
          _isOwner ? 'Owner' : 'Tenant',
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
                backgroundColor: AppColors.teal,
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

    return Scaffold(
      appBar: AppBar(title: const Text('Create Account')),
      body: Form(
        key: _form,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const PageIntro(
                eyebrow: 'Welcome to RentWise',
                title: 'Your next chapter\nstarts here.',
                description:
                    'Find a place to call home, or share a space of your own.',
                icon: Icons.waving_hand_outlined,
              ),
              const SizedBox(height: 28),
              const FormHeading(
                'Create your account',
                'Choose how you will use RentWise.',
                icon: Icons.person_outline,
              ),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _isOwner = false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          vertical: 14,
                          horizontal: 12,
                        ),
                        decoration: BoxDecoration(
                          color: !_isOwner ? AppColors.softTeal : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: !_isOwner ? AppColors.teal : AppColors.line,
                            width: !_isOwner ? 2 : 1,
                          ),
                        ),
                        child: Column(
                          children: [
                            Icon(
                              Icons.person_pin_rounded,
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
                                    ? AppColors.teal
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
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          vertical: 14,
                          horizontal: 12,
                        ),
                        decoration: BoxDecoration(
                          color: _isOwner ? AppColors.softTeal : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: _isOwner ? AppColors.teal : AppColors.line,
                            width: _isOwner ? 2 : 1,
                          ),
                        ),
                        child: Column(
                          children: [
                            Icon(
                              Icons.real_estate_agent_rounded,
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
                                    ? AppColors.teal
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
              const SizedBox(height: 20),
              TextFormField(
                validator: (v) =>
                    InputValidators.text(v, label: 'Full name', min: 3),
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Full Name',
                  hintText: 'e.g. Kasun Kalhara',
                  prefixIcon: Icon(
                    Icons.person_outline_rounded,
                    color: AppColors.teal,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                validator: InputValidators.email,
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email Address',
                  hintText: 'e.g. kasun@gmail.com',
                  prefixIcon: Icon(
                    Icons.mail_outline_rounded,
                    color: AppColors.teal,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                validator: InputValidators.phone,
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Phone Number (10 Digits)',
                  hintText: '077 123 4567',
                  helperText: 'Validated to Sri Lankan 10-digit format',
                  prefixIcon: Icon(
                    Icons.phone_iphone_rounded,
                    color: AppColors.teal,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                validator: InputValidators.nic,
                controller: _nic,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: 'National Identity Card (NIC)',
                  hintText: '12-digit or 9-digit with V (e.g. 981234567V)',
                  helperText: 'Format: 12 numbers or 9 numbers + V',
                  prefixIcon: Icon(Icons.badge_outlined, color: AppColors.teal),
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                validator: InputValidators.password,
                controller: _password,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  labelText: 'Password (Min 8 Characters)',
                  prefixIcon: const Icon(
                    Icons.lock_outline_rounded,
                    color: AppColors.teal,
                  ),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                    onPressed: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                validator: (v) =>
                    InputValidators.confirmation(v, _password.text),
                controller: _confirmPassword,
                obscureText: _obscureConfirm,
                decoration: InputDecoration(
                  labelText: 'Confirm Password',
                  prefixIcon: const Icon(
                    Icons.lock_reset_rounded,
                    color: AppColors.teal,
                  ),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscureConfirm
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                    onPressed: () =>
                        setState(() => _obscureConfirm = !_obscureConfirm),
                  ),
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        color: Color(0xFFB91C1C),
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 24),
              SizedBox(
                height: 54,
                child: FilledButton(
                  onPressed: authState.isLoading ? null : _register,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.teal,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
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
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 14),
              Center(
                child: TextButton(
                  onPressed: () => Navigator.of(context).pushReplacement(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  ),
                  child: const Text(
                    'Already have an account? Sign in',
                    style: TextStyle(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
