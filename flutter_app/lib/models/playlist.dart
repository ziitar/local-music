import 'package:json_annotation/json_annotation.dart';
import 'song.dart';

part 'playlist.g.dart';

@JsonSerializable()
class Playlist {
  final int id;
  @JsonKey(name: 'user_id')
  final int userId;
  final String name;
  final String? description;
  @JsonKey(name: 'created_at')
  final String createdAt;
  @JsonKey(name: 'updated_at')
  final String? updatedAt;
  @JsonKey(name: 'song_count')
  final int? songCount;
  @JsonKey(name: 'cover_image')
  final String? coverImage;
  final List<Song>? songs;

  const Playlist({
    required this.id,
    required this.userId,
    required this.name,
    this.description,
    required this.createdAt,
    this.updatedAt,
    this.songCount,
    this.coverImage,
    this.songs,
  });

  factory Playlist.fromJson(Map<String, dynamic> json) =>
      _$PlaylistFromJson(json);
  Map<String, dynamic> toJson() => _$PlaylistToJson(this);
}
