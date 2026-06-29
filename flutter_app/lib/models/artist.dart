import 'package:json_annotation/json_annotation.dart';
import 'album.dart';

part 'artist.g.dart';

@JsonSerializable()
class Artist {
  final int id;
  final String name;
  final String? alias;
  @JsonKey(name: 'song_count')
  final int? songCount;
  @JsonKey(name: 'album_count')
  final int? albumCount;
  final List<Album>? albums;
  @JsonKey(name: 'created_at')
  final String? createdAt;

  const Artist({
    required this.id,
    required this.name,
    this.alias,
    this.songCount,
    this.albumCount,
    this.albums,
    this.createdAt,
  });

  factory Artist.fromJson(Map<String, dynamic> json) => _$ArtistFromJson(json);
  Map<String, dynamic> toJson() => _$ArtistToJson(this);
}
