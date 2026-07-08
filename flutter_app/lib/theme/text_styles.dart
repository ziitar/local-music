import 'package:flutter/material.dart';
import 'colors.dart';

/// Reusable text styles that read colors from the current theme.
class AppTextStyles {
  static TextStyle headlineLarge(BuildContext context) {
    final colors = AppColors.of(context);
    return TextStyle(
      fontSize: 28,
      fontWeight: FontWeight.bold,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    );
  }

  static TextStyle headlineMedium(BuildContext context) {
    final colors = AppColors.of(context);
    return TextStyle(
      fontSize: 22,
      fontWeight: FontWeight.bold,
      color: colors.textPrimary,
    );
  }

  static TextStyle titleLarge(BuildContext context) {
    final colors = AppColors.of(context);
    return TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w600,
      color: colors.textPrimary,
    );
  }

  static TextStyle titleMedium(BuildContext context) {
    final colors = AppColors.of(context);
    return TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: colors.textPrimary,
    );
  }

  static TextStyle bodyLarge(BuildContext context) {
    final colors = AppColors.of(context);
    return TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.normal,
      color: colors.textPrimary,
    );
  }

  static TextStyle bodyMedium(BuildContext context) {
    final colors = AppColors.of(context);
    return TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.normal,
      color: colors.textSecondary,
    );
  }

  static TextStyle bodySmall(BuildContext context) {
    final colors = AppColors.of(context);
    return TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.normal,
      color: colors.textTertiary,
    );
  }

  static TextStyle labelLarge(BuildContext context) {
    final colors = AppColors.of(context);
    return TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: colors.textPrimary,
      letterSpacing: 0.5,
    );
  }

  /// Versions that take AppColors directly (for ThemeData construction).
  static TextStyle headlineLargeFromColors(AppColors colors) => TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.bold,
        color: colors.textPrimary,
        letterSpacing: -0.5,
      );

  static TextStyle headlineMediumFromColors(AppColors colors) => TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.bold,
        color: colors.textPrimary,
      );

  static TextStyle titleLargeFromColors(AppColors colors) => TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: colors.textPrimary,
      );

  static TextStyle titleMediumFromColors(AppColors colors) => TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: colors.textPrimary,
      );

  static TextStyle bodyLargeFromColors(AppColors colors) => TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.normal,
        color: colors.textPrimary,
      );

  static TextStyle bodyMediumFromColors(AppColors colors) => TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.normal,
        color: colors.textSecondary,
      );

  static TextStyle bodySmallFromColors(AppColors colors) => TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.normal,
        color: colors.textTertiary,
      );

  static TextStyle labelLargeFromColors(AppColors colors) => TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: colors.textPrimary,
        letterSpacing: 0.5,
      );
}
