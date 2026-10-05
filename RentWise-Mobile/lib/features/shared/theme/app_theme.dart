import 'package:flutter/material.dart';

abstract final class AppColors {
  static const lime = Color(0xFFD8EF54);
  static const ink = Color(0xFF151813); // Charcoal
  static const muted = Color(0xFF666B61); // Secondary text
  static const surface = Color(0xFFFFFFFF);
  static const canvas = Color(0xFFFAFBF5); // Warm off-white
  static const line = Color(0xFFE2E5D9); // Neutral border
  static const navy = Color(0xFF303A22); // Muted forest
  static const teal = Color(0xFF303A22); // Primary Action
  static const darkGreen = Color(0xFF151813); // Darker Green
  static const softTeal = Color(0xFFF0F3E6); // Soft green surface
  static const amber = Color(0xFF916622); // Warning / In Progress
  static const rose = Color(0xFFAD443C); // Danger / Emergency
  static const onDark = Color(0xFFFFFFFF);
  static const onDarkMuted = Color(0xFFDDEBE6);
  static const blue = Color(0xFF526A78); // Info
}

ThemeData buildAppTheme({Brightness brightness = Brightness.light}) {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.lime,
    brightness: brightness,
    primary: brightness == Brightness.light
        ? AppColors.ink
        : const Color(0xFF90D5BA),
    onPrimary: brightness == Brightness.light
        ? Colors.white
        : AppColors.darkGreen,
    onSurface: brightness == Brightness.light ? AppColors.ink : Colors.white,
    onSurfaceVariant: brightness == Brightness.light
        ? AppColors.muted
        : AppColors.onDarkMuted,
    surface: brightness == Brightness.light
        ? AppColors.surface
        : const Color(0xFF1E293B),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: brightness == Brightness.light
        ? AppColors.canvas
        : const Color(0xFF151813),
    visualDensity: VisualDensity.standard,
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: scheme.primary,
      selectionColor: scheme.primary.withValues(alpha: 0.18),
      selectionHandleColor: scheme.primary,
    ),
    textTheme: const TextTheme(
      headlineMedium: TextStyle(
        fontSize: 28,
        height: 1.2,
        fontWeight: FontWeight.w600,
        color: AppColors.ink,
      ),
      titleLarge: TextStyle(
        fontSize: 21,
        height: 1.3,
        fontWeight: FontWeight.w600,
        color: AppColors.ink,
      ),
      titleMedium: TextStyle(
        fontSize: 17,
        height: 1.4,
        fontWeight: FontWeight.w600,
        color: AppColors.ink,
      ),
      bodyLarge: TextStyle(fontSize: 16, height: 1.5, color: AppColors.ink),
      bodyMedium: TextStyle(fontSize: 14, height: 1.5, color: AppColors.ink),
      bodySmall: TextStyle(fontSize: 12, height: 1.5, color: AppColors.muted),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.canvas,
      indicatorColor: AppColors.lime,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 11,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w400,
          color: states.contains(WidgetState.selected)
              ? AppColors.teal
              : AppColors.muted,
        ),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: AppColors.ink,
      foregroundColor: Colors.white,
      elevation: 1,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.teal,
      linearTrackColor: AppColors.line,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.ink,
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(48, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.ink
            : AppColors.muted,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.lime
            : AppColors.line,
      ),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.canvas,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.canvas,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.line,
      thickness: 1,
      space: 24,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.surface,
      selectedColor: AppColors.lime,
      side: const BorderSide(color: AppColors.line),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      labelStyle: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.teal,
        minimumSize: const Size(48, 50),
        side: const BorderSide(color: AppColors.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.ink,
      contentTextStyle: const TextStyle(color: AppColors.onDark, fontSize: 14),
      actionTextColor: AppColors.onDarkMuted,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    fontFamily: 'sans-serif',
    appBarTheme: AppBarTheme(
      backgroundColor: brightness == Brightness.light
          ? AppColors.canvas
          : const Color(0xFF151813),
      foregroundColor: brightness == Brightness.light
          ? AppColors.ink
          : Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: brightness == Brightness.light ? AppColors.ink : Colors.white,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: brightness == Brightness.light
          ? AppColors.surface
          : const Color(0xFF1E293B),
      floatingLabelStyle: const TextStyle(
        color: AppColors.teal,
        fontWeight: FontWeight.w700,
      ),
      prefixIconColor: AppColors.muted,
      hintStyle: const TextStyle(color: AppColors.muted, fontSize: 13),
      labelStyle: const TextStyle(
        color: AppColors.muted,
        fontSize: 13,
        fontWeight: FontWeight.w600,
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
        borderSide: const BorderSide(color: AppColors.teal, width: 1.8),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    ),
    cardTheme: CardThemeData(
      color: brightness == Brightness.light
          ? AppColors.surface
          : const Color(0xFF1E293B),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: const BorderSide(color: AppColors.line),
      ),
      margin: EdgeInsets.zero,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 52),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        backgroundColor: AppColors.ink,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        elevation: 0,
      ),
    ),
  );
}
