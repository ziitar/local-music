import 'package:flutter/material.dart';
import 'colors.dart';
import 'text_styles.dart';

/// App theme definitions for light and dark modes.
class AppTheme {
  static ThemeData get darkTheme {
    final colors = AppColors.dark();
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      extensions: [colors],
      scaffoldBackgroundColor: colors.background,
      colorScheme: ColorScheme.dark(
        primary: colors.primary,
        onPrimary: Colors.white,
        secondary: colors.accent,
        surface: colors.surface,
        error: colors.error,
      ),
      cardColor: colors.card,
      dividerColor: colors.divider,
      appBarTheme: AppBarTheme(
        backgroundColor: colors.surface,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        centerTitle: false,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: colors.surface,
        selectedItemColor: colors.primary,
        unselectedItemColor: colors.textTertiary,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: colors.primary,
        inactiveTrackColor: colors.divider,
        thumbColor: colors.primary,
        overlayColor: colors.primary.withValues(alpha: 0.16),
      ),
      iconTheme: IconThemeData(
        color: colors.textSecondary,
      ),
      textTheme: TextTheme(
        headlineLarge: AppTextStyles.headlineLargeFromColors(colors),
        headlineMedium: AppTextStyles.headlineMediumFromColors(colors),
        titleLarge: AppTextStyles.titleLargeFromColors(colors),
        titleMedium: AppTextStyles.titleMediumFromColors(colors),
        bodyLarge: AppTextStyles.bodyLargeFromColors(colors),
        bodyMedium: AppTextStyles.bodyMediumFromColors(colors),
        bodySmall: AppTextStyles.bodySmallFromColors(colors),
        labelLarge: AppTextStyles.labelLargeFromColors(colors),
      ),
    );
  }

  static ThemeData get lightTheme {
    final colors = AppColors.light();
    final colorScheme = ColorScheme.fromSeed(
      brightness: Brightness.light,
      seedColor: const Color(0xFFFF8C42),
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      extensions: [colors],
      scaffoldBackgroundColor: colors.background,
      colorScheme: colorScheme.copyWith(
        primary: colors.primary,
        secondary: colors.accent,
        surface: colors.surface,
        error: colors.error,
      ),
      cardColor: colors.card,
      dividerColor: colors.divider,
      appBarTheme: AppBarTheme(
        backgroundColor: colors.surface,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        centerTitle: false,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: colors.surface,
        selectedItemColor: colors.primary,
        unselectedItemColor: colors.textTertiary,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: colors.primary,
        inactiveTrackColor: colors.divider,
        thumbColor: colors.primary,
        overlayColor: colors.primary.withValues(alpha: 0.16),
      ),
      iconTheme: IconThemeData(
        color: colors.textSecondary,
      ),
      textTheme: TextTheme(
        headlineLarge: AppTextStyles.headlineLargeFromColors(colors),
        headlineMedium: AppTextStyles.headlineMediumFromColors(colors),
        titleLarge: AppTextStyles.titleLargeFromColors(colors),
        titleMedium: AppTextStyles.titleMediumFromColors(colors),
        bodyLarge: AppTextStyles.bodyLargeFromColors(colors),
        bodyMedium: AppTextStyles.bodyMediumFromColors(colors),
        bodySmall: AppTextStyles.bodySmallFromColors(colors),
        labelLarge: AppTextStyles.labelLargeFromColors(colors),
      ),
    );
  }
}
