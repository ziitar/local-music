// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lyrics.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LyricsResponse _$LyricsResponseFromJson(Map<String, dynamic> json) =>
    LyricsResponse(
      lrc: json['lrc'] as String?,
      translatedLrc: json['translated_lrc'] as String?,
    );

Map<String, dynamic> _$LyricsResponseToJson(LyricsResponse instance) =>
    <String, dynamic>{
      'lrc': instance.lrc,
      'translated_lrc': instance.translatedLrc,
    };
