import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter_soloud/flutter_soloud.dart';
import 'package:just_audio/just_audio.dart';
import '../models/eq_preset.dart';
import 'package:logger/logger.dart';

/// Platform-abstracted equalizer service.
///
/// Android: uses just_audio's AndroidEqualizer (via AudioPipeline).
/// iOS/Desktop: uses flutter_soloud's ParametricEq filter.
///
/// On Android, this service owns the [AndroidEqualizer] and creates
/// an [AudioPipeline] that must be passed to [AudioPlayer].
class EqualizerService {
  static final EqualizerService _instance = EqualizerService._();
  factory EqualizerService() => _instance;
  EqualizerService._();

  final _logger = Logger();
  final SoLoud _soloud = SoLoud.instance;

  // ── State ──
  bool _enabled = false;
  String _currentPreset = 'flat';
  List<double> _gains = List.filled(10, 0.0); // normalized -1..+1
  List<double> _bandFrequencies = EqPresets.frequencies;

  // Platform-specific
  bool _soloudEqAvailable = false;
  AndroidEqualizer? _androidEqualizer;

  // ── Getters ──
  bool get enabled => _enabled;
  String get currentPreset => _currentPreset;
  List<double> get gains => List.unmodifiable(_gains);
  List<double> get bandFrequencies => List.unmodifiable(_bandFrequencies);
  bool get isAndroid => !kIsWeb && Platform.isAndroid;

  /// The AndroidEqualizer instance (null on non-Android platforms).
  AndroidEqualizer? get androidEqualizer => _androidEqualizer;

  /// Create an [AudioPipeline] with the AndroidEqualizer for just_audio.
  /// Returns null on non-Android platforms.
  AudioPipeline? getAudioPipeline() {
    if (!isAndroid) return null;
    _androidEqualizer = AndroidEqualizer();
    return AudioPipeline(androidAudioEffects: [_androidEqualizer!]);
  }

  /// Initialize the equalizer.
  Future<void> init() async {
    if (isAndroid) {
      _bandFrequencies = EqPresets.frequencies;
      _gains = List.filled(10, 0.0);
      _logger.i('Android equalizer mode (just_audio)');
    } else {
      await _initSoloudEq();
    }
  }

  /// Enable or disable the equalizer.
  Future<void> setEnabled(bool value) async {
    _enabled = value;
    if (isAndroid && _androidEqualizer != null) {
      await _androidEqualizer!.setEnabled(value);
      if (value) await _applyAndroidGains();
    } else if (_soloudEqAvailable && !isAndroid) {
      await _applySoloudGains();
    }
  }

  /// Apply a named preset.
  Future<void> applyPreset(String presetName) async {
    final preset = EqPresets.all.firstWhere(
      (p) => p.name == presetName,
      orElse: () => EqPresets.flat,
    );
    _currentPreset = presetName;
    _gains = List.from(preset.gains);
    await _applyGains();
  }

  /// Set gain for a specific band (normalized -1.0 to 1.0).
  Future<void> setBandGain(int bandIndex, double gain) async {
    if (bandIndex < 0 || bandIndex >= _gains.length) return;
    _gains[bandIndex] = gain.clamp(-1.0, 1.0);
    _currentPreset = 'custom';
    await _applyGains();
  }

  /// Get the current gains as an EqPreset.
  EqPreset getCurrentAsPreset() {
    return EqPreset(
      name: _currentPreset,
      label: _currentPreset == 'custom' ? '自定义' : _currentPreset,
      gains: List.from(_gains),
    );
  }

  // ── Internal ──

  /// Apply current gains to the active platform equalizer.
  Future<void> _applyGains() async {
    if (isAndroid) {
      await _applyAndroidGains();
    } else if (_soloudEqAvailable) {
      await _applySoloudGains();
    }
  }

  /// Apply gains to Android equalizer bands.
  Future<void> _applyAndroidGains() async {
    final eq = _androidEqualizer;
    if (eq == null) return;
    try {
      if (!eq.enabled) await eq.setEnabled(true);
      final params = await eq.parameters;
      final bands = params.bands;
      for (var i = 0; i < bands.length && i < _gains.length; i++) {
        // Map normalized gain (-1..+1) to millibels (-1500..+1500)
        final gainMb = (_gains[i] * 1500).round();
        await bands[i].setGain(gainMb.toDouble());
      }
    } catch (e) {
      _logger.e('Failed to apply Android EQ gains: $e');
    }
  }

  /// Initialize flutter_soloud parametric EQ for iOS/Desktop.
  Future<void> _initSoloudEq() async {
    try {
      _soloudEqAvailable = true;
      _bandFrequencies = EqPresets.frequencies;
      _gains = List.filled(10, 0.0);
      _logger.i('SoLoud parametric EQ initialized');
    } catch (e) {
      _logger.w('SoLoud EQ not available: $e');
      _soloudEqAvailable = false;
    }
  }

  /// Apply gains to SoLoud parametric EQ.
  Future<void> _applySoloudGains() async {
    try {
      final eq = _soloud.filters.parametricEqFilter;

      final nBandsParam = eq.numBands;
      nBandsParam.value = 10.0;

      for (var i = 0; i < 10 && i < _gains.length; i++) {
        final soloudGain = _gains[i] >= 0
            ? 1.0 + _gains[i] * 3.0
            : 1.0 + _gains[i] * 1.0;
        final bandParam = eq.bandGain(i);
        bandParam.value = soloudGain;
      }

      eq.wet.value = 1.0;
    } catch (e) {
      _logger.e('Failed to apply SoLoud EQ gains: $e');
    }
  }

  /// Get band info for UI display.
  List<EqBandInfo> getBands() {
    return List.generate(_gains.length, (i) {
      return EqBandInfo(
        index: i,
        frequency: _bandFrequencies.length > i ? _bandFrequencies[i] : 0,
        gain: _gains[i],
      );
    });
  }
}

/// Info for a single EQ band (for UI).
class EqBandInfo {
  final int index;
  final double frequency;
  final double gain;

  const EqBandInfo({
    required this.index,
    required this.frequency,
    required this.gain,
  });

  String get frequencyLabel {
    if (frequency >= 1000) {
      return '${(frequency / 1000).toStringAsFixed(1)}k';
    }
    return frequency.toStringAsFixed(0);
  }
}
