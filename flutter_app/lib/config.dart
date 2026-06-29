/// Centralized app configuration.
///
/// Server address is user-configurable on first launch.
class AppConfig {
  static const String defaultServerUrl = '';
  static const String storageKeyServerUrl = 'api_base_url';
  static const String storageKeyAccessToken = 'access_token';
  static const String storageKeyRefreshToken = 'refresh_token';
  static const String storageKeyCacheEntries = 'cache_song_entries';
  static const String appName = 'Local Music';
  static const int defaultPageSize = 50;

  // Cache settings
  static const int cacheMaxSizeBytes = 5 * 1024 * 1024 * 1024; // 5 GB
  static const int cacheTtlDays = 3;

  // Loudness normalization
  static const double targetLUFS = -14.0;
}
