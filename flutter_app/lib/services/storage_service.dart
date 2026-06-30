import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

/// Persistent storage for tokens and settings.
class StorageService {
  late final SharedPreferences prefs;

  Future<void> init() async {
    prefs = await SharedPreferences.getInstance();
  }

  // ── Server URL ──

  String? get serverUrl => prefs.getString(AppConfig.storageKeyServerUrl);

  set serverUrl(String? value) {
    if (value == null) {
      prefs.remove(AppConfig.storageKeyServerUrl);
    } else {
      prefs.setString(AppConfig.storageKeyServerUrl, value);
    }
  }

  // ── Tokens ──

  String? get accessToken => prefs.getString(AppConfig.storageKeyAccessToken);

  set accessToken(String? value) {
    if (value == null) {
      prefs.remove(AppConfig.storageKeyAccessToken);
    } else {
      prefs.setString(AppConfig.storageKeyAccessToken, value);
    }
  }

  String? get refreshToken => prefs.getString(AppConfig.storageKeyRefreshToken);

  set refreshToken(String? value) {
    if (value == null) {
      prefs.remove(AppConfig.storageKeyRefreshToken);
    } else {
      prefs.setString(AppConfig.storageKeyRefreshToken, value);
    }
  }

  void clearTokens() {
    prefs.remove(AppConfig.storageKeyAccessToken);
    prefs.remove(AppConfig.storageKeyRefreshToken);
  }

  bool get hasToken => accessToken != null && accessToken!.isNotEmpty;
}
