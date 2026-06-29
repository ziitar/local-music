import 'dart:typed_data';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../theme/colors.dart';
import '../../services/visualizer_service.dart';

/// Three-wave warm-color band visualizer.
///
/// Renders three horizontal wave curves:
/// - Low frequency (20-250 Hz): warm orange, bottom 1/3, large amplitude, slow
/// - Mid frequency (250-4000 Hz): warm yellow, middle, medium amplitude
/// - High frequency (4000-20000 Hz): warm red, top 1/3, small amplitude, fast
///
/// Each curve has a gradient fill from curve (opacity ~0.8) to baseline (opacity 0).
class WaveVisualizerPainter extends CustomPainter {
  final FftBandData bandData;
  final double animationValue; // 0.0 - 1.0 cycling animation

  WaveVisualizerPainter({
    required this.bandData,
    required this.animationValue,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;

    final height = size.height;

    // Draw three waves from back to front: high, mid, low
    _drawWave(
      canvas: canvas,
      size: size,
      energy: bandData.high,
      baseY: height * 0.30,       // top 1/3
      color: AppColors.waveHigh,  // warm red
      frequency: 3.5,             // faster oscillation
      amplitudeScale: 0.6,        // smaller amplitude
      phase: animationValue * 2.0 * math.pi * 1.5,
      rawFft: bandData.rawFft,
      fftStartBin: 94,
      fftEndBin: 256,
    );

    _drawWave(
      canvas: canvas,
      size: size,
      energy: bandData.mid,
      baseY: height * 0.50,       // middle
      color: AppColors.waveMid,   // warm yellow
      frequency: 2.0,             // medium oscillation
      amplitudeScale: 0.8,
      phase: animationValue * 2.0 * math.pi * 1.0,
      rawFft: bandData.rawFft,
      fftStartBin: 6,
      fftEndBin: 94,
    );

    _drawWave(
      canvas: canvas,
      size: size,
      energy: bandData.low,
      baseY: height * 0.70,       // bottom 1/3
      color: AppColors.waveLow,   // warm orange
      frequency: 1.0,             // slow oscillation
      amplitudeScale: 1.0,        // largest amplitude
      phase: animationValue * 2.0 * math.pi * 0.6,
      rawFft: bandData.rawFft,
      fftStartBin: 0,
      fftEndBin: 6,
    );
  }

  void _drawWave({
    required Canvas canvas,
    required Size size,
    required double energy,
    required double baseY,
    required Color color,
    required double frequency,
    required double amplitudeScale,
    required double phase,
    required Float32List rawFft,
    required int fftStartBin,
    required int fftEndBin,
  }) {
    final w = size.width;
    final maxAmplitude = size.height * 0.15 * amplitudeScale;

    // Combine FFT energy with sine wave for natural movement
    // Energy controls amplitude, sine provides the wave shape
    final effectiveAmplitude = maxAmplitude * (0.3 + energy * 0.7);

    final path = Path();
    final segments = 120; // number of line segments
    final dx = w / segments;

    // Build wave path
    path.moveTo(0, baseY);

    for (var i = 0; i <= segments; i++) {
      final x = i * dx;
      final t = i / segments;

      // Multi-frequency sine wave for natural ocean-like movement
      final wave1 = math.sin(t * frequency * 2 * math.pi + phase);
      final wave2 = math.sin(t * frequency * 3.7 * math.pi + phase * 1.3) * 0.4;
      final wave3 = math.sin(t * frequency * 1.3 * math.pi + phase * 0.7) * 0.25;

      // Add FFT-driven variation at different points along the wave
      final fftIndex = ((fftStartBin + (fftEndBin - fftStartBin) * t).round())
          .clamp(0, rawFft.length - 1);
      final fftModulation = rawFft.isEmpty ? 0.0 : rawFft[fftIndex].abs() * 0.3;

      final y = baseY + (wave1 + wave2 + wave3 + fftModulation) * effectiveAmplitude;

      if (i == 0) {
        path.lineTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    // Close path to bottom for fill
    path.lineTo(w, baseY);
    path.lineTo(0, baseY);
    path.close();

    // Gradient fill: curve (opacity 0.8) → baseline (opacity 0.0)
    final gradientRect = Rect.fromLTWH(0, baseY - maxAmplitude * 1.5, w, maxAmplitude * 3);
    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          color.withValues(alpha: 0.8),
          color.withValues(alpha: 0.0),
        ],
        stops: const [0.0, 1.0],
      ).createShader(gradientRect)
      ..style = PaintingStyle.fill;

    canvas.drawPath(path, fillPaint);

    // Draw the curve line itself
    final linePath = Path();
    for (var i = 0; i <= segments; i++) {
      final x = i * dx;
      final t = i / segments;

      final wave1 = math.sin(t * frequency * 2 * math.pi + phase);
      final wave2 = math.sin(t * frequency * 3.7 * math.pi + phase * 1.3) * 0.4;
      final wave3 = math.sin(t * frequency * 1.3 * math.pi + phase * 0.7) * 0.25;

      final fftIndex = ((fftStartBin + (fftEndBin - fftStartBin) * t).round())
          .clamp(0, rawFft.length - 1);
      final fftModulation = rawFft.isEmpty ? 0.0 : rawFft[fftIndex].abs() * 0.3;

      final y = baseY + (wave1 + wave2 + wave3 + fftModulation) * effectiveAmplitude;

      if (i == 0) {
        linePath.moveTo(x, y);
      } else {
        linePath.lineTo(x, y);
      }
    }

    final linePaint = Paint()
      ..color = color.withValues(alpha: 0.9)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawPath(linePath, linePaint);
  }

  @override
  bool shouldRepaint(covariant WaveVisualizerPainter oldDelegate) {
    return oldDelegate.animationValue != animationValue ||
        oldDelegate.bandData.low != bandData.low ||
        oldDelegate.bandData.mid != bandData.mid ||
        oldDelegate.bandData.high != bandData.high;
  }
}
