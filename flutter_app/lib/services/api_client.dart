import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:logger/logger.dart';
import '../models/auth_response.dart';
import '../models/user.dart';
import '../models/song.dart';
import '../models/api_responses.dart';
import '../models/playlist.dart';
import '../models/play_history.dart';
import '../models/lyrics.dart';
import '../models/artist.dart';
import '../models/album.dart';
import '../models/config.dart' as cfg;
import 'storage_service.dart';

/// Dio-based HTTP client compatible with the existing backend API.
class ApiClient {
  late final Dio _dio;
  final StorageService _storage;
  final Logger _logger = Logger();
  bool _isRefreshing = false;

  ApiClient(this._storage) {
    _dio = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    // Accept self-signed / untrusted certificates for self-hosted HTTPS servers.
    _dio.httpClientAdapter = IOHttpClientAdapter(
      createHttpClient: () {
        final client = HttpClient();
        client.badCertificateCallback = (cert, host, port) => true;
        return client;
      },
    );

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: _onRequest,
      onError: _onError,
    ));
  }

  /// Current server base URL (e.g. "http://192.168.1.100:8000").
  String get baseUrl => _dio.options.baseUrl;

  /// Update base URL (called after user configures server address).
  void updateBaseUrl(String url) {
    _dio.options.baseUrl = url;
  }

  // ── Interceptors ──

  void _onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = _storage.accessToken;
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    options.headers['X-Platform'] = 'native';
    handler.next(options);
  }

  void _onError(DioException error, ErrorInterceptorHandler handler) async {
    if (error.response?.statusCode == 401 && !_isRefreshing) {
      final refreshed = await _tryRefreshToken();
      if (refreshed) {
        try {
          final response = await _dio.fetch(error.requestOptions);
          handler.resolve(response);
          return;
        } catch (e) {
          // Fall through to original error
        }
      }
    }
    handler.next(error);
  }

  Future<bool> _tryRefreshToken() async {
    if (_isRefreshing) return false;
    _isRefreshing = true;

    try {
      final refreshToken = _storage.refreshToken;
      if (refreshToken == null) return false;

      final response = await _dio.post('/api/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        _storage.accessToken = data['token'] as String?;
        _storage.refreshToken = data['refreshToken'] as String?;
        return true;
      }
      return false;
    } catch (e) {
      _logger.w('Token refresh failed: $e');
      return false;
    } finally {
      _isRefreshing = false;
    }
  }

  // ── Auth ──

  Future<AuthResponse> register(String username, String password) async {
    final response = await _dio.post('/api/auth/register',
      data: {'username': username, 'password': password},
    );
    final result = AuthResponse.fromJson(response.data as Map<String, dynamic>);
    if (result.token != null) _storage.accessToken = result.token;
    if (result.refreshToken != null) _storage.refreshToken = result.refreshToken;
    return result;
  }

  Future<AuthResponse> login(String username, String password) async {
    final response = await _dio.post('/api/auth/login',
      data: {'username': username, 'password': password},
    );
    final result = AuthResponse.fromJson(response.data as Map<String, dynamic>);
    if (result.token != null) _storage.accessToken = result.token;
    if (result.refreshToken != null) _storage.refreshToken = result.refreshToken;
    return result;
  }

  Future<User> me() async {
    final response = await _dio.get('/api/auth/me');
    return User.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      final refreshToken = _storage.refreshToken;
      if (refreshToken != null) {
        await _dio.post('/api/auth/logout',
          data: {'refreshToken': refreshToken},
        );
      }
    } catch (_) {
      // Ignore logout API errors
    }
    _storage.clearTokens();
  }

  // ── Songs ──

  Future<SongsResponse> listSongs({
    int? page,
    int? limit,
    String? search,
    String? quality,
    String? artist,
  }) async {
    final params = <String, dynamic>{};
    if (page != null) params['page'] = page;
    if (limit != null) params['limit'] = limit;
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (quality != null) params['quality'] = quality;
    if (artist != null) params['artist'] = artist;

    final response = await _dio.get('/api/songs', queryParameters: params);
    return SongsResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Song> getSong(int id) async {
    final response = await _dio.get('/api/songs/$id');
    return Song.fromJson(response.data as Map<String, dynamic>);
  }

  String getStreamUrl(int id, {bool isCueTrack = false, String? bitrate}) {
    final params = <String, dynamic>{};
    if (isCueTrack) params['cue'] = '1';
    if (bitrate != null) params['bitrate'] = bitrate;
    final query = params.isNotEmpty
        ? '?${params.entries.map((e) => '${e.key}=${e.value}').join('&')}'
        : '';
    return '${_dio.options.baseUrl}/api/songs/$id/stream$query';
  }

  Future<void> stopStream(int songId) async {
    try {
      await _dio.post('/api/songs/stop-stream', data: {'songId': songId});
    } catch (_) {
      // Best-effort cleanup
    }
  }

  Future<void> deleteSong(int id) async {
    await _dio.delete('/api/songs/$id');
  }

  // ── Artists ──

  Future<ArtistsResponse> listArtists({
    int? page,
    int? limit,
    String? search,
  }) async {
    final params = <String, dynamic>{};
    if (page != null) params['page'] = page;
    if (limit != null) params['limit'] = limit;
    if (search != null && search.isNotEmpty) params['search'] = search;

    final response = await _dio.get('/api/artists', queryParameters: params);
    return ArtistsResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Artist> getArtist(int id) async {
    final response = await _dio.get('/api/artists/$id');
    return Artist.fromJson(response.data as Map<String, dynamic>);
  }

  // ── Albums ──

  Future<AlbumsResponse> listAlbums({
    int? page,
    int? limit,
    String? search,
    String? artist,
  }) async {
    final params = <String, dynamic>{};
    if (page != null) params['page'] = page;
    if (limit != null) params['limit'] = limit;
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (artist != null) params['artist'] = artist;

    final response = await _dio.get('/api/albums', queryParameters: params);
    return AlbumsResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Album> getAlbum(int id) async {
    final response = await _dio.get('/api/albums/$id');
    return Album.fromJson(response.data as Map<String, dynamic>);
  }

  // ── Playlists ──

  Future<List<Playlist>> listPlaylists() async {
    final response = await _dio.get('/api/playlists');
    return (response.data as List)
        .map((e) => Playlist.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Playlist> getPlaylist(int id) async {
    final response = await _dio.get('/api/playlists/$id');
    return Playlist.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Playlist> createPlaylist(String name, {String? description}) async {
    final response = await _dio.post('/api/playlists',
      data: {'name': name, 'description': description},
    );
    return Playlist.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> updatePlaylist(int id, String name, {String? description}) async {
    await _dio.put('/api/playlists/$id',
      data: {'name': name, 'description': description},
    );
  }

  Future<void> deletePlaylist(int id) async {
    await _dio.delete('/api/playlists/$id');
  }

  Future<void> addSongToPlaylist(int playlistId, int songId) async {
    await _dio.post('/api/playlists/$playlistId/songs',
      data: {'songId': songId},
    );
  }

  Future<void> addSongsToPlaylist(int playlistId, List<int> songIds) async {
    await _dio.post('/api/playlists/$playlistId/songs/batch',
      data: {'songIds': songIds},
    );
  }

  Future<void> removeSongFromPlaylist(int playlistId, int songId) async {
    await _dio.delete('/api/playlists/$playlistId/songs/$songId');
  }

  // ── History ──

  Future<List<PlayHistory>> listHistory({int limit = 50}) async {
    final response = await _dio.get('/api/history',
      queryParameters: {'limit': limit},
    );
    return (response.data as List)
        .map((e) => PlayHistory.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> addHistory(int songId) async {
    await _dio.post('/api/history', data: {'songId': songId});
  }

  Future<void> clearHistory() async {
    await _dio.delete('/api/history');
  }

  // ── Lyrics ──

  Future<LyricsResponse> getLyrics(String title, String artist) async {
    final response = await _dio.get('/api/lyrics',
      queryParameters: {'title': title, 'artist': artist},
    );
    return LyricsResponse.fromJson(response.data as Map<String, dynamic>);
  }

  // ── Config ──

  Future<cfg.ServerConfig> getServerConfig() async {
    final response = await _dio.get('/api/config');
    return cfg.ServerConfig.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> updateServerConfig(cfg.ServerConfig config) async {
    await _dio.put('/api/config', data: config.toJson());
  }
}
