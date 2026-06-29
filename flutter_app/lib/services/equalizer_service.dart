import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter_soloud/flutter_soloud.dart';
import '../models/eq_preset.dart';
import 'package:logger/logger.dart';

/// Platform-abstracted equalizer service.
///
/// Android: uses just_audio's AndroidEqualizer (via AudioPipeline).
/// iOS/Desktop: uses flutter_soloud's ParametricEq filter.
///
/// Note: On Android, the caller must pass an AudioPipeline with
/// AndroidEqualizer to just_audio's AudioPlayer. This service
/// provides the EQ data model and UI state; the actual audio
/// routing is handled by the player.
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

  // ── Getters ──
  bool get enabled => _enabled;
  String get currentPreset => _currentPreset;
  List<double> get gains => List.unmodifiable(_gains);
  List<double> get bandFrequencies => List.unmodifiable(_bandFrequencies);
  bool get isAndroid => !kIsWeb && Platform.isAndroid;

  /// Initialize the equalizer.
  Future<void> init() async {
    if (isAndroid) {
      // Android uses just_audio's AndroidEqualizer.
      // The caller is responsible for setting up the AudioPipeline.
      // We just track state here.
      _bandFrequencies = EqPresets.frequencies;
      _gains = List.filled(10, 0.0);
      _logger.i('Android equalizer mode (just_audio)');
    } else {
      await _initSoloudEq();
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

  /// Enable or disable the equalizer.
  Future<void> setEnabled(bool value) async {
    _enabled = value;
    if (_soloudEqAvailable && !isAndroid) {
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
    if (!isAndroid && _soloudEqAvailable) {
      await _applySoloudGains();
    }
    // On Android, gains are applied via the AndroidEqualizerBand
    // objects returned by AudioPlayer.androidEqualizer.
    // The caller must handle this.
  }

  /// Apply gains to SoLoud parametric EQ.
  Future<void> _applySoloudGains() async {
    try {
      final eq = _soloud.filters.parametricEqFilter;

      // Set number of bands
      final nBandsParam = eq.numBands;
      nBandsParam.value = 10.0;

      // Apply gains to each band
      for (var i = 0; i < 10 && i < _gains.length; i++) {
        // Map normalized gain (-1..+1) to SoLoud range (0..4, where 1 = flat)
        final soloudGain = _gains[i] >= 0
            ? 1.0 + _gains[i] * 3.0  // 1.0 to 4.0
            : 1.0 + _gains[i] * 1.0; // 0.0 to 1.0
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
