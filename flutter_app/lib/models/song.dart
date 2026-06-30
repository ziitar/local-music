import 'package:json_annotation/json_annotation.dart';

part 'song.g.dart';

@JsonSerializable()
class Song {
  final int id;
  final String title;
  final String artist;
  final String album;
  final int duration;
  @JsonKey(name: 'file_path')
  final String filePath;
  final String quality;
  @JsonKey(name: 'file_size')
  final int fileSize;
  final String format;
  @JsonKey(name: 'cover_image')
  final String? coverImage;
  @JsonKey(name: 'created_at')
  final String? createdAt;
  @JsonKey(name: 'album_id')
  final int? albumId;
  @JsonKey(name: 'track_no')
  final int? trackNo;
  @JsonKey(name: 'is_cue_track')
  final bool? isCueTrack;
  @JsonKey(name: 'cue_file_path')
  final String? cueFilePath;
  @JsonKey(name: 'track_start_time')
  final double? trackStartTime;
  @JsonKey(name: 'track_end_time')
  final double? trackEndTime;
  @JsonKey(name: 'integrated_loudness')
  final double? integratedLoudness;
  @JsonKey(name: 'true_peak')
  final double? truePeak;

  const Song({
    required this.id,
    required this.title,
    required this.artist,
    required this.album,
    required this.duration,
    required this.filePath,
    required this.quality,
    required this.fileSize,
    required this.format,
    this.coverImage,
    this.createdAt,
    this.albumId,
    this.trackNo,
    this.isCueTrack,
    this.cueFilePath,
    this.trackStartTime,
    this.trackEndTime,
    this.integratedLoudness,
    this.truePeak,
  });

  factory Song.fromJson(Map<String, dynamic> json) => _$SongFromJson(json);
  Map<String, dynamic> toJson() => _$SongToJson(this);
}
