import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:logger/logger.dart';
import '../config.dart';
import '../models/song.dart';
import 'storage_service.dart';

/// Cache entry metadata.
class CacheEntry {
  final int songId;
  final String filePath;
  final int fileSize;
  final int downloadedAt; // millisecondsSinceEpoch
  int lastAccessedAt; // millisecondsSinceEpoch

  CacheEntry({
    required this.songId,
    required this.filePath,
    required this.fileSize,
    required this.downloadedAt,
    required this.lastAccessedAt,
  });

  Map<String, dynamic> toJson() => {
    'songId': songId,
    'filePath': filePath,
    'fileSize': fileSize,
    'downloadedAt': downloadedAt,
    'lastAccessedAt': lastAccessedAt,
  };

  factory CacheEntry.fromJson(Map<String, dynamic> json) => CacheEntry(
    songId: json['songId'] as int,
    filePath: json['filePath'] as String,
    fileSize: json['fileSize'] as int,
    downloadedAt: json['downloadedAt'] as int,
    lastAccessedAt: json['lastAccessedAt'] as int,
  );
}

/// Offline song cache with TTL and LRU eviction.
class CacheService {
  final StorageService _storage;
  final Dio _dio;
  final Logger _logger = Logger();

  final Map<int, CacheEntry> _entries = {};
  Directory? _cacheDir;

  CacheService(this._storage, this._dio);

  /// Initialize cache service: load registry, cleanup expired/oversized.
  Future<void> init() async {
    _cacheDir = await getApplicationCacheDirectory();
    final songsDir = Directory('${_cacheDir!.path}/songs');
    if (!await songsDir.exists()) {
      await songsDir.create(recursive: true);
    }

    _loadRegistry();
    await cleanup();
  }

  /// Download a song to local cache.
  Future<String?> downloadSong(Song song, String streamUrl) async {
    if (_cacheDir == null) return null;

    final filePath = '${_cacheDir!.path}/songs/${song.id}_${song.filePath.split('/').last}';

    try {
      await _dio.download(streamUrl, filePath);

      final file = File(filePath);
      final fileSize = await file.length();
      final now = DateTime.now().millisecondsSinceEpoch;

      _entries[song.id] = CacheEntry(
        songId: song.id,
        filePath: filePath,
        fileSize: fileSize,
        downloadedAt: now,
        lastAccessedAt: now,
      );

      _saveRegistry();
      _logger.i('Cached song ${song.id}: $filePath ($fileSize bytes)');

      // Enforce size limit after download
      await _enforceSizeLimit();

      return filePath;
    } catch (e) {
      _logger.e('Failed to download song ${song.id}: $e');
      // Clean up partial file
      try {
        final f = File(filePath);
        if (await f.exists()) await f.delete();
      } catch (_) {}
      return null;
    }
  }

  /// Get cached local path for a song, or null if not cached.
  String? getCachedPath(int songId) {
    final entry = _entries[songId];
    if (entry == null) return null;

    final file = File(entry.filePath);
    if (!file.existsSync()) {
      _entries.remove(songId);
      _saveRegistry();
      return null;
    }

    // Update last accessed time
    entry.lastAccessedAt = DateTime.now().millisecondsSinceEpoch;
    _saveRegistry();

    return entry.filePath;
  }

  /// Remove a specific song from cache.
  Future<void> removeCache(int songId) async {
    final entry = _entries.remove(songId);
    if (entry != null) {
      try {
        final file = File(entry.filePath);
        if (await file.exists()) await file.delete();
      } catch (_) {}
      _saveRegistry();
    }
  }

  /// Get total cache size in bytes.
  int getTotalSize() {
    return _entries.values.fold(0, (sum, e) => sum + e.fileSize);
  }

  /// Cleanup: remove expired entries and enforce LRU size limit.
  Future<void> cleanup() async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final ttlMs = AppConfig.cacheTtlDays * 24 * 60 * 60 * 1000;

    // Remove expired entries
    final expired = _entries.entries
        .where((e) => now - e.value.downloadedAt > ttlMs)
        .toList();

    for (final e in expired) {
      try {
        final file = File(e.value.filePath);
        if (await file.exists()) await file.delete();
      } catch (_) {}
      _entries.remove(e.key);
    }

    if (expired.isNotEmpty) {
      _logger.i('Removed ${expired.length} expired cache entries');
    }

    // Enforce size limit
    await _enforceSizeLimit();

    _saveRegistry();
  }

  /// LRU eviction: remove least-recently-accessed until under limit.
  Future<void> _enforceSizeLimit() async {
    while (getTotalSize() > AppConfig.cacheMaxSizeBytes && _entries.isNotEmpty) {
      // Find least recently accessed
      final sorted = _entries.values.toList()
        ..sort((a, b) => a.lastAccessedAt.compareTo(b.lastAccessedAt));

      final oldest = sorted.first;
      _logger.i('LRU evicting song ${oldest.songId} (${oldest.fileSize} bytes)');

      try {
        final file = File(oldest.filePath);
        if (await file.exists()) await file.delete();
      } catch (_) {}
      _entries.remove(oldest.songId);
    }

    _saveRegistry();
  }

  /// Clear all cached files.
  Future<void> clearAll() async {
    for (final entry in _entries.values) {
      try {
        final file = File(entry.filePath);
        if (await file.exists()) await file.delete();
      } catch (_) {}
    }
    _entries.clear();
    _saveRegistry();
  }

  /// Load cache registry from SharedPreferences.
  void _loadRegistry() {
    final json = _storage.prefs.getString(AppConfig.storageKeyCacheEntries);
    if (json == null || json.isEmpty) return;

    try {
      final list = jsonDecode(json) as List;
      for (final item in list) {
        final entry = CacheEntry.fromJson(item as Map<String, dynamic>);
        // Only load if file actually exists
        if (File(entry.filePath).existsSync()) {
          _entries[entry.songId] = entry;
        }
      }
    } catch (e) {
      _logger.e('Failed to load cache registry: $e');
    }
  }

  /// Save cache registry to SharedPreferences.
  void _saveRegistry() {
    final list = _entries.values.map((e) => e.toJson()).toList();
    _storage.prefs.setString(AppConfig.storageKeyCacheEntries, jsonEncode(list));
  }
}
