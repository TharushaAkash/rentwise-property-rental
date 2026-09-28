import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'features/auth/screens/login_screen.dart';
import 'features/shared/theme/app_theme.dart';

void main() {
  runApp(const ProviderScope(child: RentWiseApp()));
}

class RentWiseApp extends StatelessWidget {
  const RentWiseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RentWise',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(brightness: Brightness.light),
      home: const LoginScreen(),
    );
  }
}
