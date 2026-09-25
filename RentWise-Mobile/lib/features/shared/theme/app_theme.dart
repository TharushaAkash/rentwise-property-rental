import 'package:flutter/material.dart';

abstract final class AppColors {
  static const ink = Color(0xFF0F172A); // Deep Slate
  static const muted = Color(0xFF64748B); // Slate 500
  static const surface = Color(0xFFFFFFFF);
  static const canvas = Color(0xFFF8FAFC); // Slate 50
  static const line = Color(0xFFE2E8F0); // Slate 200
  static const navy = Color(0xFF008037); // RentWise Emerald Green #008037
  static const teal = Color(0xFF008037); // Primary Action
  static const darkGreen = Color(0xFF005C27); // Darker Green
  static const softTeal = Color(0xFFE6F5EC); // Soft Emerald Tint
  static const amber = Color(0xFFD97706); // Warning / In Progress
  static const rose = Color(0xFFE11D48); // Danger / Emergency
  static const blue = Color(0xFF2563EB); // Info
}

ThemeData buildAppTheme({Brightness brightness = Brightness.light}) {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.teal,
    brightness: brightness,
    surface: brightness == Brightness.light ? AppColors.surface : const Color(0xFF1E293B),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: brightness == Brightness.light ? AppColors.canvas : const Color(0xFF0F172A),
    fontFamily: 'sans-serif',
    appBarTheme: AppBarTheme(
      backgroundColor: brightness == Brightness.light ? AppColors.canvas : const Color(0xFF0F172A),
      foregroundColor: brightness == Brightness.light ? AppColors.ink : Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        color: brightness == Brightness.light ? AppColors.ink : Colors.white,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: brightness == Brightness.light ? AppColors.surface : const Color(0xFF1E293B),
      hintStyle: const TextStyle(color: AppColors.muted, fontSize: 13),
      labelStyle: const TextStyle(color: AppColors.muted, fontSize: 13, fontWeight: FontWeight.w600),
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
        borderSide: const BorderSide(color: AppColors.teal, width: 1.8),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    ),
    cardTheme: CardThemeData(
      color: brightness == Brightness.light ? AppColors.surface : const Color(0xFF1E293B),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: const BorderSide(color: AppColors.line),
      ),
      margin: EdgeInsets.zero,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.teal,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
        elevation: 0,
      ),
    ),
  );
}
