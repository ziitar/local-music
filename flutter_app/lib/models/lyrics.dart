import 'package:json_annotation/json_annotation.dart';

part 'lyrics.g.dart';

@JsonSerializable()
class LyricsResponse {
  final String? lrc;
  @JsonKey(name: 'translated_lrc')
  final String? translatedLrc;

  const LyricsResponse({this.lrc, this.translatedLrc});

  factory LyricsResponse.fromJson(Map<String, dynamic> json) =>
      _$LyricsResponseFromJson(json);
  Map<String, dynamic> toJson() => _$LyricsResponseToJson(this);
}

/// A single parsed lyric line.
class LyricLine {
  final Duration timestamp;
  final String text;
  final String? translatedText;

  const LyricLine({
    required this.timestamp,
    required this.text,
    this.translatedText,
  });
}
