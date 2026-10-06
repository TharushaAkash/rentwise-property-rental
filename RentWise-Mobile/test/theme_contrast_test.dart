import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rentwise_mobile/features/shared/theme/app_theme.dart';

// Keep small labels readable when the shared palette changes.
double contrast(Color text, Color background) {
  final first = text.computeLuminance();
  final second = background.computeLuminance();
  return first > second
      ? (first + 0.05) / (second + 0.05)
      : (second + 0.05) / (first + 0.05);
}

void main() {
  final pairs = <String, (Color, Color)>{
    'body text on white': (AppColors.ink, AppColors.surface),
    'secondary labels on canvas': (AppColors.muted, AppColors.canvas),
    'secondary labels on summary panels': (AppColors.muted, AppColors.softTeal),
    'green actions on light panels': (AppColors.teal, AppColors.softTeal),
    'filled button labels': (AppColors.onDark, AppColors.teal),
    'payment card labels': (AppColors.onDarkMuted, AppColors.darkGreen),
  };
  for (final entry in pairs.entries) {
    test(entry.key, () {
      expect(contrast(entry.value.$1, entry.value.$2), greaterThanOrEqualTo(4.5));
    });
  }
}
