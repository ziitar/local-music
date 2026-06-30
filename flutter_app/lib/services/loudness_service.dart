import 'dart:math';
import '../config.dart';
import '../models/song.dart';

/// Loudness normalization service.
///
/// Computes a volume multiplier based on the song's integrated loudness
/// relative to a target LUFS level (default -14 LUFS).
///
/// The formula: adjustment = targetLUFS - integratedLoudness
/// multiplier = pow(10, adjustment / 20).clamp(0.1, 2.0)
///
/// This ensures quiet songs get boosted and loud songs get attenuated
/// to a consistent perceived loudness level.
class LoudnessService {
  /// Compute volume multiplier for a song.
  /// Returns 1.0 if no loudness data is available.
  double computeVolumeMultiplier(Song song) {
    final loudness = song.integratedLoudness;
    if (loudness == null) return 1.0;

    final adjustment = AppConfig.targetLUFS - loudness;
    final multiplier = pow(10.0, adjustment / 20.0).toDouble();

    // Clamp to reasonable range: 0.1x (-20dB) to 2.0x (+6dB)
    return multiplier.clamp(0.1, 2.0);
  }

  /// Compute volume adjustment in dB for display purposes.
  double computeAdjustmentDb(Song song) {
    final loudness = song.integratedLoudness;
    if (loudness == null) return 0.0;

    return AppConfig.targetLUFS - loudness;
  }
}
