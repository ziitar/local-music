// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'api_responses.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SongsResponse _$SongsResponseFromJson(Map<String, dynamic> json) =>
    SongsResponse(
      songs: (json['songs'] as List<dynamic>)
          .map((e) => Song.fromJson(e as Map<String, dynamic>))
          .toList(),
      pagination: Pagination.fromJson(
        json['pagination'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$SongsResponseToJson(SongsResponse instance) =>
    <String, dynamic>{
      'songs': instance.songs,
      'pagination': instance.pagination,
    };

ArtistsResponse _$ArtistsResponseFromJson(Map<String, dynamic> json) =>
    ArtistsResponse(
      artists: (json['artists'] as List<dynamic>)
          .map((e) => Artist.fromJson(e as Map<String, dynamic>))
          .toList(),
      pagination: Pagination.fromJson(
        json['pagination'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$ArtistsResponseToJson(ArtistsResponse instance) =>
    <String, dynamic>{
      'artists': instance.artists,
      'pagination': instance.pagination,
    };

AlbumsResponse _$AlbumsResponseFromJson(Map<String, dynamic> json) =>
    AlbumsResponse(
      albums: (json['albums'] as List<dynamic>)
          .map((e) => Album.fromJson(e as Map<String, dynamic>))
          .toList(),
      pagination: Pagination.fromJson(
        json['pagination'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$AlbumsResponseToJson(AlbumsResponse instance) =>
    <String, dynamic>{
      'albums': instance.albums,
      'pagination': instance.pagination,
    };
