import 'package:json_annotation/json_annotation.dart';

part 'user.g.dart';

@JsonSerializable()
class User {
  final int id;
  final String username;
  final String role;
  @JsonKey(name: 'created_at')
  final String? createdAt;

  const User({
    required this.id,
    required this.username,
    required this.role,
    this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
  Map<String, dynamic> toJson() => _$UserToJson(this);
}
