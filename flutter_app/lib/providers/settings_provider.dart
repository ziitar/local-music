import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config.dart';
import '../services/storage_service.dart';
import 'providers.dart';

/// Playback settings state with SharedPreferences persistence.
class PlaybackSettings {
  final bool eqEnabled;
  final String eqPresetName;
  final bool loudnessNormalizationEnabled;

  const PlaybackSettings({
    this.eqEnabled = false,
    this.eqPresetName = 'flat',
    this.loudnessNormalizationEnabled = true,
  });

  PlaybackSettings copyWith({
    bool? eqEnabled,
    String? eqPresetName,
    bool? loudnessNormalizationEnabled,
  }) {
    return PlaybackSettings(
      eqEnabled: eqEnabled ?? this.eqEnabled,
      eqPresetName: eqPresetName ?? this.eqPresetName,
      loudnessNormalizationEnabled:
          loudnessNormalizationEnabled ?? this.loudnessNormalizationEnabled,
    );
  }
}

/// Notifier that persists playback settings to SharedPreferences.
class PlaybackSettingsNotifier extends StateNotifier<PlaybackSettings> {
  final StorageService _storage;

  PlaybackSettingsNotifier(this._storage) : super(const PlaybackSettings()) {
    _load();
  }

  void _load() {
    state = PlaybackSettings(
      eqEnabled: _storage.prefs.getBool(AppConfig.storageKeyEqEnabled) ?? false,
      eqPresetName:
          _storage.prefs.getString(AppConfig.storageKeyEqPreset) ?? 'flat',
      loudnessNormalizationEnabled:
          _storage.prefs.getBool(AppConfig.storageKeyLoudnessNormEnabled) ??
              true,
    );
  }

  void setEqEnabled(bool value) {
    state = state.copyWith(eqEnabled: value);
    _storage.prefs.setBool(AppConfig.storageKeyEqEnabled, value);
  }

  void setEqPreset(String presetName) {
    state = state.copyWith(eqPresetName: presetName);
    _storage.prefs.setString(AppConfig.storageKeyEqPreset, presetName);
  }

  void setLoudnessNormalization(bool value) {
    state = state.copyWith(loudnessNormalizationEnabled: value);
    _storage.prefs.setBool(AppConfig.storageKeyLoudnessNormEnabled, value);
  }
}

/// Playback settings provider.
final playbackSettingsProvider =
    StateNotifierProvider<PlaybackSettingsNotifier, PlaybackSettings>((ref) {
  final storage = ref.watch(storageServiceProvider);
  return PlaybackSettingsNotifier(storage);
});
