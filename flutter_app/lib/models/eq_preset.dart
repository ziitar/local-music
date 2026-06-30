import 'package:json_annotation/json_annotation.dart';

part 'eq_preset.g.dart';

/// Equalizer preset definition.
@JsonSerializable()
class EqPreset {
  final String name;
  final String label;
  final List<double> gains; // gain values per band (normalized -1.0 to 1.0)

  const EqPreset({
    required this.name,
    required this.label,
    required this.gains,
  });

  factory EqPreset.fromJson(Map<String, dynamic> json) =>
      _$EqPresetFromJson(json);
  Map<String, dynamic> toJson() => _$EqPresetToJson(this);
}

/// Built-in equalizer presets.
///
/// Gains are normalized to -1.0 (cut) .. 0.0 (flat) .. +1.0 (boost).
/// Actual dB mapping depends on the platform's min/max range.
class EqPresets {
  EqPresets._();

  /// 10-band frequency centers (Hz) — standard ISO frequencies.
  static const List<double> frequencies = [
    31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
  ];

  static const flat = EqPreset(
    name: 'flat',
    label: '平坦',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  );

  static const pop = EqPreset(
    name: 'pop',
    label: '流行',
    gains: [-0.2, 0.3, 0.6, 0.8, 0.6, 0.0, -0.2, -0.2, 0.3, 0.4],
  );

  static const rock = EqPreset(
    name: 'rock',
    label: '摇滚',
    gains: [0.6, 0.4, -0.2, -0.5, -0.2, 0.2, 0.5, 0.7, 0.8, 0.8],
  );

  static const classical = EqPreset(
    name: 'classical',
    label: '古典',
    gains: [0.5, 0.4, 0.3, 0.2, -0.1, -0.1, 0.0, 0.3, 0.5, 0.6],
  );

  static const jazz = EqPreset(
    name: 'jazz',
    label: '爵士',
    gains: [0.4, 0.3, 0.1, 0.3, -0.2, -0.2, 0.0, 0.2, 0.5, 0.6],
  );

  static const electronic = EqPreset(
    name: 'electronic',
    label: '电子',
    gains: [0.8, 0.7, 0.3, 0.0, -0.3, 0.0, 0.3, 0.5, 0.8, 0.9],
  );

  static const bass = EqPreset(
    name: 'bass',
    label: '低音增强',
    gains: [0.9, 0.8, 0.6, 0.3, 0.0, -0.2, -0.3, -0.3, -0.2, -0.1],
  );

  static const vocal = EqPreset(
    name: 'vocal',
    label: '人声',
    gains: [-0.3, -0.2, 0.0, 0.4, 0.7, 0.8, 0.6, 0.3, 0.0, -0.2],
  );

  /// All available presets.
  static const List<EqPreset> all = [
    flat, pop, rock, classical, jazz, electronic, bass, vocal,
  ];
}
