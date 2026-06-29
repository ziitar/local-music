import 'package:json_annotation/json_annotation.dart';
import 'song.dart';
import 'artist.dart';
import 'album.dart';
import 'pagination.dart';

part 'api_responses.g.dart';

@JsonSerializable()
class SongsResponse {
  final List<Song> songs;
  final Pagination pagination;

  const SongsResponse({required this.songs, required this.pagination});

  factory SongsResponse.fromJson(Map<String, dynamic> json) =>
      _$SongsResponseFromJson(json);
}

@JsonSerializable()
class ArtistsResponse {
  final List<Artist> artists;
  final Pagination pagination;

  const ArtistsResponse({required this.artists, required this.pagination});

  factory ArtistsResponse.fromJson(Map<String, dynamic> json) =>
      _$ArtistsResponseFromJson(json);
}

@JsonSerializable()
class AlbumsResponse {
  final List<Album> albums;
  final Pagination pagination;

  const AlbumsResponse({required this.albums, required this.pagination});

  factory AlbumsResponse.fromJson(Map<String, dynamic> json) =>
      _$AlbumsResponseFromJson(json);
}
