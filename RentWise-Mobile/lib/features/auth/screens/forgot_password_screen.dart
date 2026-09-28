import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../shared/theme/app_theme.dart';
import '../services/password_reset_service.dart';

enum ResetStep { email, code, password, success }

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, this.initialEmail = '', this.service});

  final String initialEmail;
  final PasswordResetService? service;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with WidgetsBindingObserver {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirmation = TextEditingController();
  final _digits = List.generate(6, (_) => TextEditingController());
  final _digitFocus = List.generate(6, (_) => FocusNode());
  late final PasswordResetService _service;
  ResetStep _step = ResetStep.email;
  Timer? _timer;
  DateTime? _deadline;
  int _seconds = 0;
  String _token = '';
  String? _error;
  bool _busy = false;
  bool _hidePassword = true;

  @override
  void initState() {
    super.initState();
    _email.text = widget.initialEmail;
    _service = widget.service ?? PasswordResetService();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _email.dispose();
    _password.dispose();
    _confirmation.dispose();
    for (final controller in _digits) {
      controller.dispose();
    }
    for (final focus in _digitFocus) {
      focus.dispose();
    }
    if (widget.service == null) _service.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _step == ResetStep.code) {
      _updateCountdown();
    }
  }

  void _updateCountdown() {
    if (!mounted || _deadline == null) return;
    // Use a deadline so opening the email app does not pause the countdown.
    final remaining =
        (_deadline!.difference(DateTime.now()).inMilliseconds / 1000)
            .ceil()
            .clamp(0, 60);
    if (remaining != _seconds) setState(() => _seconds = remaining);
    if (remaining == 0) _timer?.cancel();
  }

  Future<void> _runRequest(Future<void> Function() action) async {
    if (_busy) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendCode() async {
    if (_step == ResetStep.email && !_formKey.currentState!.validate()) return;
    await _runRequest(() async {
      final email = _email.text.trim().toLowerCase();
      final seconds = await _service.sendCode(email);
      if (!mounted) return;
      _timer?.cancel();
      for (final digit in _digits) {
        digit.clear();
      }
      setState(() {
        _email.text = email;
        _token = '';
        _step = ResetStep.code;
        _seconds = seconds;
        _deadline = DateTime.now().add(Duration(seconds: seconds));
      });
      _timer = Timer.periodic(
        const Duration(milliseconds: 250),
        (_) => _updateCountdown(),
      );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _step == ResetStep.code) {
          _digitFocus.first.requestFocus();
        }
      });
    });
  }

  Future<void> _verifyCode() async {
    _updateCountdown();
    final code = _digits.map((digit) => digit.text).join();
    if (_seconds == 0 || code.length != 6) return;
    await _runRequest(() async {
      final token = await _service.verifyCode(_email.text, code);
      if (!mounted) return;
      _timer?.cancel();
      setState(() {
        _token = token;
        _step = ResetStep.password;
      });
    });
  }

  Future<void> _resetPassword() async {
    if (!_formKey.currentState!.validate()) return;
    await _runRequest(() async {
      await _service.resetPassword(
        _email.text,
        _token,
        _password.text,
        _confirmation.text,
      );
      if (!mounted) return;
      _password.clear();
      _confirmation.clear();
      setState(() {
        _token = '';
        _step = ResetStep.success;
      });
    });
  }

  void _startAgain() {
    _timer?.cancel();
    _formKey.currentState?.reset();
    _password.clear();
    _confirmation.clear();
    setState(() {
      _step = ResetStep.email;
      _token = '';
      _error = null;
    });
  }

  void _changeDigit(String value, int index) {
    // Also handle pasting the complete code or keyboard OTP autofill.
    if (value.length > 1) {
      final start = value.length == 6 ? 0 : index;
      final count = value.length.clamp(0, 6 - start);
      for (var offset = 0; offset < count; offset++) {
        _digits[start + offset].text = value[offset];
      }
      _digitFocus[(start + count).clamp(0, 5)].requestFocus();
    } else if (value.isNotEmpty && index < 5) {
      _digitFocus[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      _digitFocus[index - 1].requestFocus();
    }
    setState(() {});
  }

  Widget _button(String label, VoidCallback? onPressed) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: FilledButton(
        onPressed: _busy ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.teal,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        child: _busy
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _emailForm() {
    return Column(
      children: [
        TextFormField(
          controller: _email,
          enabled: !_busy,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _sendCode(),
          decoration: const InputDecoration(
            labelText: 'Email address',
            hintText: 'you@example.com',
            prefixIcon: Icon(Icons.mail_outline),
          ),
          validator: (value) {
            final email = value?.trim() ?? '';
            if (email.isEmpty) return 'Enter your account email.';
            if (email.length > 200 ||
                !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
              return 'Enter a valid email address.';
            }
            return null;
          },
        ),
        const SizedBox(height: 24),
        _button('Send verification code', _sendCode),
      ],
    );
  }

  Widget _codeForm() {
    final time =
        '${_seconds ~/ 60}:${(_seconds % 60).toString().padLeft(2, '0')}';
    return Column(
      children: [
        Text(
          _email.text,
          textAlign: TextAlign.center,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 16),
        const Text(
          'If this email belongs to an active account, a code has been sent.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted, fontSize: 13),
        ),
        const SizedBox(height: 24),
        Row(
          children: List.generate(
            6,
            (index) => Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: index == 5 ? 0 : 6),
                child: TextField(
                  controller: _digits[index],
                  focusNode: _digitFocus[index],
                  enabled: !_busy && _seconds > 0,
                  keyboardType: TextInputType.number,
                  autofillHints: index == 0
                      ? const [AutofillHints.oneTimeCode]
                      : null,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(6),
                  ],
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                  decoration: InputDecoration(
                    counterText: '',
                    contentPadding: const EdgeInsets.symmetric(vertical: 16),
                    semanticCounterText: 'Digit ${index + 1} of 6',
                  ),
                  onTap: () => _digits[index].selection = TextSelection(
                    baseOffset: 0,
                    extentOffset: _digits[index].text.length,
                  ),
                  onChanged: (value) => _changeDigit(value, index),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.timer_outlined,
              size: 18,
              color: _seconds == 0 ? AppColors.rose : AppColors.teal,
            ),
            const SizedBox(width: 8),
            Text(
              _seconds == 0
                  ? 'Your code has expired.'
                  : 'Code expires in $time',
              style: TextStyle(
                color: _seconds == 0 ? AppColors.rose : AppColors.teal,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        _button(
          'Verify code',
          _seconds > 0 && _digits.every((digit) => digit.text.length == 1)
              ? _verifyCode
              : null,
        ),
        const SizedBox(height: 12),
        if (_seconds == 0)
          TextButton(
            onPressed: _busy ? null : _sendCode,
            child: const Text('Resend code'),
          )
        else
          const Text(
            'You can resend a code when the timer ends.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
        const SizedBox(height: 8),
        const Text(
          'Check your spam folder too.',
          style: TextStyle(color: AppColors.muted, fontSize: 12),
        ),
        TextButton(
          onPressed: _busy ? null : _startAgain,
          child: const Text('Use a different email'),
        ),
      ],
    );
  }

  Widget _passwordField(bool confirm) {
    return TextFormField(
      controller: confirm ? _confirmation : _password,
      enabled: !_busy,
      obscureText: _hidePassword,
      enableSuggestions: false,
      autocorrect: false,
      autofillHints: const [AutofillHints.newPassword],
      decoration: InputDecoration(
        labelText: confirm ? 'Confirm password' : 'New password',
        prefixIcon: const Icon(Icons.lock_outline),
        suffixIcon: IconButton(
          tooltip: _hidePassword ? 'Show passwords' : 'Hide passwords',
          onPressed: () => setState(() => _hidePassword = !_hidePassword),
          icon: Icon(
            _hidePassword
                ? Icons.visibility_outlined
                : Icons.visibility_off_outlined,
          ),
        ),
      ),
      validator: (value) {
        if (value == null || value.length < 8 || value.length > 64) {
          return 'Use 8–64 characters.';
        }
        if (confirm && value != _password.text) {
          return 'Passwords do not match.';
        }
        return null;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    const titles = [
      'Forgot your password?',
      'Check your inbox',
      'Create a new password',
      'You’re all set!',
    ];
    const descriptions = [
      'Enter your account email. We’ll help you get back in.',
      'Enter your 6-digit verification code below.',
      'Choose a strong password to keep your account secure.',
      'Your password has been updated. Sign in with your new password.',
    ];
    const icons = [
      Icons.mail_outline,
      Icons.verified_user_outlined,
      Icons.lock_reset,
      Icons.check_circle_outline,
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Account recovery')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(
                    color: AppColors.teal.withValues(alpha: 0.15),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.teal.withValues(alpha: 0.06),
                      blurRadius: 28,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.cottage_outlined, color: AppColors.teal),
                          SizedBox(width: 8),
                          Text(
                            'RentWise',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: AppColors.teal,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      if (_step != ResetStep.success) ...[
                        Row(
                          children: List.generate(
                            3,
                            (index) => Expanded(
                              child: Column(
                                children: [
                                  CircleAvatar(
                                    radius: 14,
                                    backgroundColor: index <= _step.index
                                        ? AppColors.teal
                                        : AppColors.softTeal,
                                    child: Text(
                                      '${index + 1}',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: index <= _step.index
                                            ? Colors.white
                                            : AppColors.teal,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    ['Email', 'Verify', 'Reset'][index],
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.muted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 28),
                      ],
                      Center(
                        child: Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: AppColors.softTeal,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Icon(
                            icons[_step.index],
                            color: AppColors.teal,
                            size: 32,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Semantics(
                        header: true,
                        child: Text(
                          titles[_step.index],
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        descriptions[_step.index],
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.muted,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 24),
                      if (_error != null) ...[
                        Semantics(
                          liveRegion: true,
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFE4E6),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              _error!,
                              style: const TextStyle(color: Color(0xFF9F1239)),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      if (_step == ResetStep.email) _emailForm(),
                      if (_step == ResetStep.code) _codeForm(),
                      if (_step == ResetStep.password) ...[
                        _passwordField(false),
                        const SizedBox(height: 16),
                        _passwordField(true),
                        const SizedBox(height: 12),
                        const Text(
                          'Use 8–64 characters with a mix of letters, numbers and symbols.',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 24),
                        _button('Reset password', _resetPassword),
                        TextButton(
                          onPressed: _busy ? null : _startAgain,
                          child: const Text('Need a new code? Start again'),
                        ),
                      ],
                      if (_step == ResetStep.success)
                        _button(
                          'Back to sign in',
                          () => Navigator.of(context).pop(),
                        ),
                      const SizedBox(height: 24),
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.shield_outlined,
                            size: 14,
                            color: AppColors.muted,
                          ),
                          SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              'Secure account recovery',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.muted,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
