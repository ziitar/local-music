import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/storage_service.dart';
import '../services/api_client.dart';
import '../services/audio_handler.dart';
import '../services/cache_service.dart';
import '../services/loudness_service.dart';

/// Storage service provider (initialized in main.dart).
final storageServiceProvider = Provider<StorageService>((ref) {
  throw UnimplementedError('StorageService must be initialized before use');
});

/// API client provider.
final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(storageServiceProvider);
  final client = ApiClient(storage);
  final serverUrl = storage.serverUrl;
  if (serverUrl != null && serverUrl.isNotEmpty) {
    client.updateBaseUrl(serverUrl);
  }
  return client;
});

/// Audio handler provider (initialized in main.dart).
final audioHandlerProvider = Provider<AudioPlayerHandler>((ref) {
  throw UnimplementedError('AudioPlayerHandler must be initialized before use');
});

/// Cache service provider (initialized in main.dart).
final cacheServiceProvider = Provider<CacheService>((ref) {
  throw UnimplementedError('CacheService must be initialized before use');
});

/// Loudness service provider.
final loudnessServiceProvider = Provider<LoudnessService>((ref) {
  return LoudnessService();
});
