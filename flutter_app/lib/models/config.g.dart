// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ServerConfig _$ServerConfigFromJson(Map<String, dynamic> json) => ServerConfig(
  musicSources: (json['music_sources'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  excludePaths: (json['exclude_paths'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
);

Map<String, dynamic> _$ServerConfigToJson(ServerConfig instance) =>
    <String, dynamic>{
      'music_sources': instance.musicSources,
      'exclude_paths': instance.excludePaths,
    };
