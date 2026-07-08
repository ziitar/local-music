import 'package:flutter/material.dart';

/// App color palette as a ThemeExtension for light/dark theme support.
///
/// Access via `AppColors.of(context)` in widgets.
/// Use `AppColors.dark()` or `AppColors.light()` when building ThemeData.
class AppColors extends ThemeExtension<AppColors> {
  // Background
  final Color background;
  final Color surface;
  final Color surfaceVariant;
  final Color card;

  // Primary — warm orange
  final Color primary;
  final Color primaryLight;
  final Color primaryDark;

  // Accent
  final Color accent;

  // Text
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;

  // Semantic
  final Color error;
  final Color success;

  // Divider
  final Color divider;

  const AppColors({
    required this.background,
    required this.surface,
    required this.surfaceVariant,
    required this.card,
    required this.primary,
    required this.primaryLight,
    required this.primaryDark,
    required this.accent,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.error,
    required this.success,
    required this.divider,
  });

  /// Access AppColors from context via ThemeExtension.
  static AppColors of(BuildContext context) {
    return Theme.of(context).extension<AppColors>()!;
  }

  /// Current warm dark palette — preserved exactly from the original.
  factory AppColors.dark() => const AppColors(
        background: Color(0xFF121212),
        surface: Color(0xFF1E1E1E),
        surfaceVariant: Color(0xFF2A2A2A),
        card: Color(0xFF252525),
        primary: Color(0xFFFF8C42),
        primaryLight: Color(0xFFFFAB76),
        primaryDark: Color(0xFFE07030),
        accent: Color(0xFFFFD166),
        textPrimary: Color(0xFFF5F5F5),
        textSecondary: Color(0xFFB0B0B0),
        textTertiary: Color(0xFF757575),
        error: Color(0xFFE63946),
        success: Color(0xFF4CAF50),
        divider: Color(0xFF333333),
      );

  /// Material 3 light palette seeded from the warm orange primary.
  factory AppColors.light() => const AppColors(
        background: Color(0xFFFFFBFE),
        surface: Color(0xFFFFFBFE),
        surfaceVariant: Color(0xFFE7E0EC),
        card: Color(0xFFFFFFFF),
        primary: Color(0xFFE07030),
        primaryLight: Color(0xFFFFAB76),
        primaryDark: Color(0xFFBF5A1A),
        accent: Color(0xFFB8860B),
        textPrimary: Color(0xFF1C1B1F),
        textSecondary: Color(0xFF49454F),
        textTertiary: Color(0xFF79747E),
        error: Color(0xFFBA1A1A),
        success: Color(0xFF388E3C),
        divider: Color(0xFFCAC4D0),
      );

  @override
  AppColors copyWith({
    Color? background,
    Color? surface,
    Color? surfaceVariant,
    Color? card,
    Color? primary,
    Color? primaryLight,
    Color? primaryDark,
    Color? accent,
    Color? textPrimary,
    Color? textSecondary,
    Color? textTertiary,
    Color? error,
    Color? success,
    Color? divider,
  }) {
    return AppColors(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceVariant: surfaceVariant ?? this.surfaceVariant,
      card: card ?? this.card,
      primary: primary ?? this.primary,
      primaryLight: primaryLight ?? this.primaryLight,
      primaryDark: primaryDark ?? this.primaryDark,
      accent: accent ?? this.accent,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textTertiary: textTertiary ?? this.textTertiary,
      error: error ?? this.error,
      success: success ?? this.success,
      divider: divider ?? this.divider,
    );
  }

  @override
  AppColors lerp(AppColors? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceVariant: Color.lerp(surfaceVariant, other.surfaceVariant, t)!,
      card: Color.lerp(card, other.card, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      primaryLight: Color.lerp(primaryLight, other.primaryLight, t)!,
      primaryDark: Color.lerp(primaryDark, other.primaryDark, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textTertiary: Color.lerp(textTertiary, other.textTertiary, t)!,
      error: Color.lerp(error, other.error, t)!,
      success: Color.lerp(success, other.success, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
    );
  }
}
