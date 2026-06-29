// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'song.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Song _$SongFromJson(Map<String, dynamic> json) => Song(
  id: (json['id'] as num).toInt(),
  title: json['title'] as String,
  artist: json['artist'] as String,
  album: json['album'] as String,
  duration: (json['duration'] as num).toInt(),
  filePath: json['file_path'] as String,
  quality: json['quality'] as String,
  fileSize: (json['file_size'] as num).toInt(),
  format: json['format'] as String,
  coverImage: json['cover_image'] as String?,
  createdAt: json['created_at'] as String?,
  albumId: (json['album_id'] as num?)?.toInt(),
  trackNo: (json['track_no'] as num?)?.toInt(),
  isCueTrack: json['is_cue_track'] as bool?,
  cueFilePath: json['cue_file_path'] as String?,
  trackStartTime: (json['track_start_time'] as num?)?.toDouble(),
  trackEndTime: (json['track_end_time'] as num?)?.toDouble(),
  integratedLoudness: (json['integrated_loudness'] as num?)?.toDouble(),
  truePeak: (json['true_peak'] as num?)?.toDouble(),
);

Map<String, dynamic> _$SongToJson(Song instance) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'artist': instance.artist,
  'album': instance.album,
  'duration': instance.duration,
  'file_path': instance.filePath,
  'quality': instance.quality,
  'file_size': instance.fileSize,
  'format': instance.format,
  'cover_image': instance.coverImage,
  'created_at': instance.createdAt,
  'album_id': instance.albumId,
  'track_no': instance.trackNo,
  'is_cue_track': instance.isCueTrack,
  'cue_file_path': instance.cueFilePath,
  'track_start_time': instance.trackStartTime,
  'track_end_time': instance.trackEndTime,
  'integrated_loudness': instance.integratedLoudness,
  'true_peak': instance.truePeak,
};
