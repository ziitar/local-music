import 'package:json_annotation/json_annotation.dart';
import 'user.dart';

part 'auth_response.g.dart';

@JsonSerializable()
class AuthResponse {
  final bool success;
  final String message;
  final String? token;
  @JsonKey(name: 'refreshToken')
  final String? refreshToken;
  final User? user;

  const AuthResponse({
    required this.success,
    required this.message,
    this.token,
    this.refreshToken,
    this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseFromJson(json);
  Map<String, dynamic> toJson() => _$AuthResponseToJson(this);
}
