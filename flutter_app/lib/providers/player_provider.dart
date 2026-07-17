import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import '../models/song.dart';
import '../services/api_client.dart';
import '../services/audio_handler.dart';
import '../services/cache_service.dart';
import '../services/loudness_service.dart';
import '../services/equalizer_service.dart';
import 'providers.dart';
import 'settings_provider.dart';

/// Playback mode.
enum PlayMode { sequential, loopAll, loopOne, shuffle }

/// Player state.
class PlayerState {
  final Song? currentSong;
  final List<Song> queue;
  final int currentIndex;
  final bool isPlaying;
  final Duration position;
  final Duration duration;
  final double volume;
  final double loudnessMultiplier;
  final bool loudnessNormalizationEnabled;
  final PlayMode playMode;
  final String? quality;
  final String? error;

  const PlayerState({
    this.currentSong,
    this.queue = const [],
    this.currentIndex = -1,
    this.isPlaying = false,
    this.position = Duration.zero,
    this.duration = Duration.zero,
    this.volume = 1.0,
    this.loudnessMultiplier = 1.0,
    this.loudnessNormalizationEnabled = true,
    this.playMode = PlayMode.sequential,
    this.quality,
    this.error,
  });

  /// Effective volume = user volume * loudness multiplier (if enabled), clamped to [0, 1].
  double get effectiveVolume {
    final mult = loudnessNormalizationEnabled ? loudnessMultiplier : 1.0;
    return (volume * mult).clamp(0.0, 1.0);
  }

  PlayerState copyWith({
    Song? currentSong,
    List<Song>? queue,
    int? currentIndex,
    bool? isPlaying,
    Duration? position,
    Duration? duration,
    double? volume,
    double? loudnessMultiplier,
    bool? loudnessNormalizationEnabled,
    PlayMode? playMode,
    String? quality,
    String? error,
  }) {
    return PlayerState(
      currentSong: currentSong ?? this.currentSong,
      queue: queue ?? this.queue,
      currentIndex: currentIndex ?? this.currentIndex,
      isPlaying: isPlaying ?? this.isPlaying,
      position: position ?? this.position,
      duration: duration ?? this.duration,
      volume: volume ?? this.volume,
      loudnessMultiplier: loudnessMultiplier ?? this.loudnessMultiplier,
      loudnessNormalizationEnabled: loudnessNormalizationEnabled ?? this.loudnessNormalizationEnabled,
      playMode: playMode ?? this.playMode,
      quality: quality ?? this.quality,
      error: error,
    );
  }
}

/// Player notifier managing audio playback with cache, loudness, and media controls.
class PlayerNotifier extends StateNotifier<PlayerState> {
  final AudioPlayerHandler _handler;
  final ApiClient _api;
  final CacheService _cache;
  final LoudnessService _loudness;
  final void Function(PlayMode mode)? _onPlayModeChanged;

  AudioPlayer get _player => _handler.player;

  PlayerNotifier(
    this._handler,
    this._api,
    this._cache,
    this._loudness, {
    void Function(PlayMode mode)? onPlayModeChanged,
  })  : _onPlayModeChanged = onPlayModeChanged,
        super(const PlayerState()) {
    _init();
  }

  void _init() {
    _player.positionStream.listen((pos) {
      state = state.copyWith(position: pos);
    });

    _player.durationStream.listen((dur) {
      // For streaming URLs, just_audio may return null or invalid duration.
      // Prefer database duration (set in playSong) over stream duration.
      if (dur != null && dur > Duration.zero) {
        // Only update if we don't have a valid database duration already
        final songDuration = state.currentSong?.duration ?? 0;
        if (songDuration <= 0) {
          state = state.copyWith(duration: dur);
        }
      }
    });

    _player.playerStateStream.listen((playerState) {
      state = state.copyWith(isPlaying: playerState.playing);

      if (playerState.processingState == ProcessingState.completed) {
        _onSongComplete();
      }
    });

    _player.volumeStream.listen((vol) {
      state = state.copyWith(volume: vol);
    });

    // Listen for skip actions from notification controls
    _handler.skipToNextStream.listen((_) => next());
    _handler.skipToPreviousStream.listen((_) => previous());
  }

  void _onSongComplete() {
    switch (state.playMode) {
      case PlayMode.loopOne:
        seek(Duration.zero);
        play();
        break;
      case PlayMode.loopAll:
        next();
        break;
      case PlayMode.shuffle:
        _playRandom();
        break;
      case PlayMode.sequential:
        if (state.currentIndex < state.queue.length - 1) {
          next();
        } else {
          pause();
        }
        break;
    }
  }

  /// Play a song, optionally setting a new queue.
  Future<void> playSong(Song song, {List<Song>? queue, int? index}) async {
    final newQueue = queue ?? state.queue;
    final newIndex = index ?? newQueue.indexOf(song);

    // Compute loudness multiplier
    final loudnessMult = _loudness.computeVolumeMultiplier(song);

    // Set duration from database immediately (streaming URLs don't provide proper duration)
    final songDuration = song.duration > 0
        ? Duration(seconds: song.duration)
        : Duration.zero;

    state = state.copyWith(
      currentSong: song,
      queue: newQueue,
      currentIndex: newIndex >= 0 ? newIndex : 0,
      loudnessMultiplier: loudnessMult,
      duration: songDuration,
      position: Duration.zero,
    );

    try {
      final artUri = song.coverImage != null
          ? '${_api.baseUrl}${song.coverImage}'
          : null;

      // Check local cache first
      final cachedPath = _cache.getCachedPath(song.id);
      if (cachedPath != null) {
        await _handler.playSongFile(
          song: song,
          filePath: cachedPath,
          artUri: artUri,
        );
      } else {
        final url = _api.getStreamUrl(
          song.id,
          isCueTrack: song.isCueTrack ?? false,
          bitrate: state.quality,
        );
        await _handler.playSongMedia(
          song: song,
          url: url,
          artUri: artUri,
        );
      }

      // Apply effective volume (user volume * loudness)
      await _player.setVolume(state.effectiveVolume);
      await _player.play();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> play() async => _player.play();
  Future<void> pause() async => _player.pause();

  Future<void> togglePlay() async {
    if (state.isPlaying) {
      await pause();
    } else {
      await play();
    }
  }

  Future<void> seek(Duration position) async => _player.seek(position);

  Future<void> next() async {
    if (state.queue.isEmpty) return;
    final nextIndex = (state.currentIndex + 1) % state.queue.length;
    await playSong(state.queue[nextIndex], index: nextIndex);
  }

  Future<void> previous() async {
    if (state.queue.isEmpty) return;
    final prevIndex = state.currentIndex > 0
        ? state.currentIndex - 1
        : state.queue.length - 1;
    await playSong(state.queue[prevIndex], index: prevIndex);
  }

  void _playRandom() {
    if (state.queue.isEmpty) return;
    var nextIndex = state.currentIndex;
    while (nextIndex == state.currentIndex && state.queue.length > 1) {
      nextIndex = DateTime.now().millisecondsSinceEpoch % state.queue.length;
    }
    playSong(state.queue[nextIndex], index: nextIndex);
  }

  void setPlayMode(PlayMode mode, {bool persist = true}) {
    state = state.copyWith(playMode: mode);
    if (persist) {
      _onPlayModeChanged?.call(mode);
    }
  }

  void cyclePlayMode() {
    const modes = PlayMode.values;
    final nextIndex = (modes.indexOf(state.playMode) + 1) % modes.length;
    setPlayMode(modes[nextIndex]);
  }

  Future<void> setVolume(double volume) async {
    final clamped = volume.clamp(0.0, 1.0);
    state = state.copyWith(volume: clamped);
    await _player.setVolume(state.effectiveVolume);
  }

  void setQuality(String? quality) {
    final oldQuality = state.quality;
    state = state.copyWith(quality: quality);
    // Reload current song if quality changed and something is playing
    if (oldQuality != quality && state.currentSong != null && state.isPlaying) {
      playSong(
        state.currentSong!,
        queue: state.queue,
        index: state.currentIndex,
      );
    }
  }

  /// Update loudness normalization toggle and re-apply volume.
  Future<void> setLoudnessNormalization(bool enabled) async {
    state = state.copyWith(loudnessNormalizationEnabled: enabled);
    await _player.setVolume(state.effectiveVolume);
  }

  Future<void> addToQueue(Song song) async {
    state = state.copyWith(queue: [...state.queue, song]);
  }

  Future<void> removeFromQueue(int index) async {
    final newQueue = List<Song>.from(state.queue)..removeAt(index);
    var newIndex = state.currentIndex;
    if (index < newIndex) {
      newIndex--;
    } else if (index == newIndex) {
      newIndex = newIndex.clamp(0, newQueue.length - 1);
    }
    state = state.copyWith(queue: newQueue, currentIndex: newIndex);
  }

  Future<void> playQueue(List<Song> songs, {int startIndex = 0}) async {
    if (songs.isEmpty) return;
    await playSong(songs[startIndex], queue: songs, index: startIndex);
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }
}

/// Player provider.
final playerProvider = StateNotifierProvider<PlayerNotifier, PlayerState>((ref) {
  final handler = ref.watch(audioHandlerProvider);
  final api = ref.watch(apiClientProvider);
  final cache = ref.watch(cacheServiceProvider);
  final loudness = ref.watch(loudnessServiceProvider);
  final settingsNotifier = ref.read(playbackSettingsProvider.notifier);
  final notifier = PlayerNotifier(
    handler,
    api,
    cache,
    loudness,
    onPlayModeChanged: (mode) => settingsNotifier.setPlayMode(mode.name),
  );

  // Load persisted settings on startup
  final initialSettings = ref.read(playbackSettingsProvider);
  notifier.setPlayMode(
    PlayMode.values.firstWhere(
      (e) => e.name == initialSettings.playMode,
      orElse: () => PlayMode.sequential,
    ),
    persist: false,
  );
  notifier.setQuality(initialSettings.quality);

  // Sync loudness normalization toggle from playback settings
  ref.listen<PlaybackSettings>(playbackSettingsProvider, (prev, next) {
    if (prev?.loudnessNormalizationEnabled != next.loudnessNormalizationEnabled) {
      notifier.setLoudnessNormalization(next.loudnessNormalizationEnabled);
    }
  });

  // Sync equalizer settings from playback settings
  final eqService = EqualizerService();
  ref.listen<PlaybackSettings>(playbackSettingsProvider, (prev, next) {
    if (prev?.eqEnabled != next.eqEnabled) {
      eqService.setEnabled(next.eqEnabled);
    }
    if (prev?.eqPresetName != next.eqPresetName) {
      eqService.applyPreset(next.eqPresetName);
    }
  });

  // Apply persisted EQ settings on startup
  eqService.applyPreset(initialSettings.eqPresetName);
  if (initialSettings.eqEnabled) {
    eqService.setEnabled(true);
  }

  // Reload current song when quality changes via settings
  ref.listen<PlaybackSettings>(playbackSettingsProvider, (prev, next) {
    if (prev?.quality != next.quality) {
      notifier.setQuality(next.quality);
    }
  });

  return notifier;
});
