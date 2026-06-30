import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:audio_service/audio_service.dart';
import 'package:dio/dio.dart';
import 'app.dart';
import 'services/storage_service.dart';
import 'services/api_client.dart';
import 'services/audio_handler.dart';
import 'services/cache_service.dart';
import 'providers/providers.dart';

late AudioPlayerHandler audioHandler;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize storage
  final storage = StorageService();
  await storage.init();

  // Initialize audio handler (system media controls)
  audioHandler = await AudioService.init<AudioPlayerHandler>(
    builder: () => AudioPlayerHandler(),
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'com.localmusic.audio',
      androidNotificationChannelName: 'Local Music',
      androidNotificationOngoing: true,
      androidStopForegroundOnPause: true,
    ),
  );

  // Initialize cache service
  final api = ApiClient(storage);
  final serverUrl = storage.serverUrl;
  if (serverUrl != null && serverUrl.isNotEmpty) {
    api.updateBaseUrl(serverUrl);
  }
  final cache = CacheService(storage, Dio());
  await cache.init();

  runApp(
    ProviderScope(
      overrides: [
        storageServiceProvider.overrideWithValue(storage),
        audioHandlerProvider.overrideWithValue(audioHandler),
        cacheServiceProvider.overrideWithValue(cache),
      ],
      child: const LocalMusicApp(),
    ),
  );
}
