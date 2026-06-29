// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'playlist.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Playlist _$PlaylistFromJson(Map<String, dynamic> json) => Playlist(
  id: (json['id'] as num).toInt(),
  userId: (json['user_id'] as num).toInt(),
  name: json['name'] as String,
  description: json['description'] as String?,
  createdAt: json['created_at'] as String,
  updatedAt: json['updated_at'] as String?,
  songCount: (json['song_count'] as num?)?.toInt(),
  coverImage: json['cover_image'] as String?,
  songs: (json['songs'] as List<dynamic>?)
      ?.map((e) => Song.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$PlaylistToJson(Playlist instance) => <String, dynamic>{
  'id': instance.id,
  'user_id': instance.userId,
  'name': instance.name,
  'description': instance.description,
  'created_at': instance.createdAt,
  'updated_at': instance.updatedAt,
  'song_count': instance.songCount,
  'cover_image': instance.coverImage,
  'songs': instance.songs,
};
