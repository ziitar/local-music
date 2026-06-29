import 'package:json_annotation/json_annotation.dart';

part 'pagination.g.dart';

@JsonSerializable()
class Pagination {
  final int page;
  final int limit;
  final int total;
  @JsonKey(name: 'totalPages')
  final int totalPages;

  const Pagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  factory Pagination.fromJson(Map<String, dynamic> json) =>
      _$PaginationFromJson(json);
  Map<String, dynamic> toJson() => _$PaginationToJson(this);
}
