// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pagination.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Pagination _$PaginationFromJson(Map<String, dynamic> json) => Pagination(
  page: (json['page'] as num).toInt(),
  limit: (json['limit'] as num).toInt(),
  total: (json['total'] as num).toInt(),
  totalPages: (json['totalPages'] as num).toInt(),
);

Map<String, dynamic> _$PaginationToJson(Pagination instance) =>
    <String, dynamic>{
      'page': instance.page,
      'limit': instance.limit,
      'total': instance.total,
      'totalPages': instance.totalPages,
    };
