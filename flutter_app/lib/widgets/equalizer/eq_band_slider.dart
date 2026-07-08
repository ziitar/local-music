import 'package:flutter/material.dart';
import '../../theme/colors.dart';

/// Vertical slider for a single EQ band.
class EqBandSlider extends StatelessWidget {
  final String label;
  final double value; // -1.0 to 1.0
  final ValueChanged<double> onChanged;

  const EqBandSlider({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SizedBox(
      width: 48,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Gain value display
          Text(
            value >= 0 ? '+${(value * 12).toStringAsFixed(0)}' : (value * 12).toStringAsFixed(0),
            style: TextStyle(
              color: value.abs() > 0.01
                  ? colors.primary
                  : colors.textTertiary,
              fontSize: 10,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          // Slider
          Expanded(
            child: RotatedBox(
              quarterTurns: -1,
              child: SliderTheme(
                data: SliderThemeData(
                  activeTrackColor: colors.primary,
                  inactiveTrackColor: colors.divider,
                  thumbColor: colors.primary,
                  thumbShape: const RoundSliderThumbShape(
                    enabledThumbRadius: 8,
                    elevation: 2,
                  ),
                  overlayShape: const RoundSliderOverlayShape(
                    overlayRadius: 16,
                  ),
                  trackHeight: 4,
                  trackShape: const RoundedRectSliderTrackShape(),
                ),
                child: Slider(
                  value: value,
                  min: -1.0,
                  max: 1.0,
                  onChanged: onChanged,
                ),
              ),
            ),
          ),
          const SizedBox(height: 4),
          // Frequency label
          Text(
            label,
            style: TextStyle(
              color: colors.textTertiary,
              fontSize: 9,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
