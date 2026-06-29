// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'play_history.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlayHistory _$PlayHistoryFromJson(Map<String, dynamic> json) => PlayHistory(
  id: (json['id'] as num).toInt(),
  playedAt: json['played_at'] as String,
  songId: (json['song_id'] as num).toInt(),
  title: json['title'] as String,
  artist: json['artist'] as String,
  album: json['album'] as String,
  duration: (json['duration'] as num).toInt(),
  quality: json['quality'] as String,
  format: json['format'] as String,
);

Map<String, dynamic> _$PlayHistoryToJson(PlayHistory instance) =>
    <String, dynamic>{
      'id': instance.id,
      'played_at': instance.playedAt,
      'song_id': instance.songId,
      'title': instance.title,
      'artist': instance.artist,
      'album': instance.album,
      'duration': instance.duration,
      'quality': instance.quality,
      'format': instance.format,
    };
