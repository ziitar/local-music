import 'package:json_annotation/json_annotation.dart';
import 'song.dart';

part 'album.g.dart';

@JsonSerializable()
class Album {
  final int id;
  final String title;
  @JsonKey(name: 'cover_image')
  final String? coverImage;
  final String? thumbnail;
  @JsonKey(name: 'track_total')
  final int? trackTotal;
  @JsonKey(name: 'disk_total')
  final int? diskTotal;
  @JsonKey(name: 'release_year')
  final int? releaseYear;
  final String? artist;
  @JsonKey(name: 'song_count')
  final int? songCount;
  final List<Song>? songs;
  @JsonKey(name: 'created_at')
  final String? createdAt;

  const Album({
    required this.id,
    required this.title,
    this.coverImage,
    this.thumbnail,
    this.trackTotal,
    this.diskTotal,
    this.releaseYear,
    this.artist,
    this.songCount,
    this.songs,
    this.createdAt,
  });

  factory Album.fromJson(Map<String, dynamic> json) => _$AlbumFromJson(json);
  Map<String, dynamic> toJson() => _$AlbumToJson(this);
}
