// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'artist.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Artist _$ArtistFromJson(Map<String, dynamic> json) => Artist(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  alias: json['alias'] as String?,
  songCount: (json['song_count'] as num?)?.toInt(),
  albumCount: (json['album_count'] as num?)?.toInt(),
  albums: (json['albums'] as List<dynamic>?)
      ?.map((e) => Album.fromJson(e as Map<String, dynamic>))
      .toList(),
  songs: (json['songs'] as List<dynamic>?)
      ?.map((e) => Song.fromJson(e as Map<String, dynamic>))
      .toList(),
  createdAt: json['created_at'] as String?,
);

Map<String, dynamic> _$ArtistToJson(Artist instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'alias': instance.alias,
  'song_count': instance.songCount,
  'album_count': instance.albumCount,
  'albums': instance.albums,
  'songs': instance.songs,
  'created_at': instance.createdAt,
};
