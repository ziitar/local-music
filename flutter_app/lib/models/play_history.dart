import 'package:json_annotation/json_annotation.dart';
import 'song.dart';

part 'play_history.g.dart';

@JsonSerializable()
class PlayHistory {
  final int id;
  @JsonKey(name: 'played_at')
  final String playedAt;
  @JsonKey(name: 'song_id')
  final int songId;
  final String title;
  final String artist;
  final String album;
  final int duration;
  final String quality;
  final String format;

  const PlayHistory({
    required this.id,
    required this.playedAt,
    required this.songId,
    required this.title,
    required this.artist,
    required this.album,
    required this.duration,
    required this.quality,
    required this.format,
  });

  factory PlayHistory.fromJson(Map<String, dynamic> json) =>
      _$PlayHistoryFromJson(json);
  Map<String, dynamic> toJson() => _$PlayHistoryToJson(this);

  /// Convert to [Song] for playback.
  Song toSong() => Song(
        id: songId,
        title: title,
        artist: artist,
        album: album,
        duration: duration,
        quality: quality,
        format: format,
      );
}
