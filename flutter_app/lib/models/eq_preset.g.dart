// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'eq_preset.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EqPreset _$EqPresetFromJson(Map<String, dynamic> json) => EqPreset(
  name: json['name'] as String,
  label: json['label'] as String,
  gains: (json['gains'] as List<dynamic>)
      .map((e) => (e as num).toDouble())
      .toList(),
);

Map<String, dynamic> _$EqPresetToJson(EqPreset instance) => <String, dynamic>{
  'name': instance.name,
  'label': instance.label,
  'gains': instance.gains,
};
