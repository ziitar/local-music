import 'dart:typed_data';
import 'package:flutter_soloud/flutter_soloud.dart';
import 'package:logger/logger.dart';

/// FFT frequency band energy data.
class FftBandData {
  /// Low frequency energy (0.0 - 1.0), 20-250 Hz
  final double low;

  /// Mid frequency energy (0.0 - 1.0), 250-4000 Hz
  final double mid;

  /// High frequency energy (0.0 - 1.0), 4000-20000 Hz
  final double high;

  /// Raw FFT data (256 bins)
  final Float32List rawFft;

  /// Raw wave data (256 samples)
  final Float32List rawWave;

  FftBandData({
    required this.low,
    required this.mid,
    required this.high,
    required this.rawFft,
    required this.rawWave,
  });

  static final empty = FftBandData(
    low: 0,
    mid: 0,
    high: 0,
    rawFft: Float32List(0),
    rawWave: Float32List(0),
  );
}

/// Service for audio visualization using flutter_soloud.
///
/// This is a SEPARATE audio engine from just_audio, used only for FFT analysis.
/// It does NOT play audio — it reads the system's audio output for visualization.
class VisualizerService {
  static final VisualizerService _instance = VisualizerService._();
  factory VisualizerService() => _instance;
  VisualizerService._();

  final _logger = Logger();
  final SoLoud _soloud = SoLoud.instance;
  AudioData? _audioData;
  bool _initialized = false;
  bool _enabled = false;

  /// Initialize the visualizer engine.
  Future<bool> init() async {
    if (_initialized) return true;

    try {
      await _soloud.init(
        bufferSize: 1024,
        channels: Channels.mono,
      );

      _soloud.setVisualizationEnabled(true);
      _soloud.setFftSmoothing(0.85);

      _audioData = AudioData(GetSamplesKind.linear);
      _initialized = true;
      _enabled = true;
      _logger.i('Visualizer initialized');
      return true;
    } catch (e) {
      _logger.e('Failed to init visualizer: $e');
      return false;
    }
  }

  /// Update audio samples. Call this every frame.
  void updateSamples() {
    if (!_enabled || _audioData == null) return;
    try {
      _audioData!.updateSamples();
    } catch (_) {}
  }

  /// Get current FFT band data.
  FftBandData getBandData() {
    if (!_enabled || _audioData == null) {
      return FftBandData.empty;
    }

    try {
      final samples = _audioData!.getAudioData(alwaysReturnData: true);
      if (samples.isEmpty || samples.length < 512) {
        return FftBandData.empty;
      }

      final fft = samples.sublist(0, 256);
      final wave = samples.sublist(256, 512);

      // Calculate band energies
      // With 44100 Hz sample rate and 1024 buffer, each bin ≈ 43 Hz
      // Low: 20-250 Hz → bins 0-5
      // Mid: 250-4000 Hz → bins 6-93
      // High: 4000-20000 Hz → bins 94-255
      double low = _averageRange(fft, 0, 6);
      double mid = _averageRange(fft, 6, 94);
      double high = _averageRange(fft, 94, 256);

      low = low.clamp(0.0, 1.0);
      mid = mid.clamp(0.0, 1.0);
      high = high.clamp(0.0, 1.0);

      return FftBandData(
        low: low,
        mid: mid,
        high: high,
        rawFft: fft,
        rawWave: wave,
      );
    } catch (_) {
      return FftBandData.empty;
    }
  }

  double _averageRange(Float32List data, int start, int end) {
    if (start >= end || data.isEmpty) return 0;
    double sum = 0;
    final len = end.clamp(0, data.length);
    for (var i = start; i < len; i++) {
      sum += data[i].abs();
    }
    return sum / (len - start);
  }

  /// Enable or disable visualization.
  void setEnabled(bool enabled) {
    _enabled = enabled;
    if (_initialized) {
      _soloud.setVisualizationEnabled(enabled);
    }
  }

  /// Set FFT smoothing (0.0 - 1.0).
  void setSmoothing(double smooth) {
    if (_initialized) {
      _soloud.setFftSmoothing(smooth);
    }
  }

  /// Dispose resources.
  void dispose() {
    _audioData?.dispose();
    _audioData = null;
    if (_initialized) {
      _soloud.deinit();
      _initialized = false;
    }
  }
}
