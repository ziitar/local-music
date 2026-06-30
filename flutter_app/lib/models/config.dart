import 'package:json_annotation/json_annotation.dart';

part 'config.g.dart';

@JsonSerializable()
class ServerConfig {
  @JsonKey(name: 'music_sources')
  final List<String> musicSources;
  @JsonKey(name: 'exclude_paths')
  final List<String> excludePaths;

  const ServerConfig({
    required this.musicSources,
    required this.excludePaths,
  });

  factory ServerConfig.fromJson(Map<String, dynamic> json) =>
      _$ServerConfigFromJson(json);
  Map<String, dynamic> toJson() => _$ServerConfigToJson(this);
}
