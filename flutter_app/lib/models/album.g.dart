// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'album.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Album _$AlbumFromJson(Map<String, dynamic> json) => Album(
  id: (json['id'] as num).toInt(),
  title: json['title'] as String,
  coverImage: json['cover_image'] as String?,
  thumbnail: json['thumbnail'] as String?,
  trackTotal: (json['track_total'] as num?)?.toInt(),
  diskTotal: (json['disk_total'] as num?)?.toInt(),
  releaseYear: (json['release_year'] as num?)?.toInt(),
  artist: json['artist'] as String?,
  songCount: (json['song_count'] as num?)?.toInt(),
  songs: (json['songs'] as List<dynamic>?)
      ?.map((e) => Song.fromJson(e as Map<String, dynamic>))
      .toList(),
  createdAt: json['created_at'] as String?,
);

Map<String, dynamic> _$AlbumToJson(Album instance) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'cover_image': instance.coverImage,
  'thumbnail': instance.thumbnail,
  'track_total': instance.trackTotal,
  'disk_total': instance.diskTotal,
  'release_year': instance.releaseYear,
  'artist': instance.artist,
  'song_count': instance.songCount,
  'songs': instance.songs,
  'created_at': instance.createdAt,
};
