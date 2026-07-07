import 'dart:async';
import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';
import '../models/song.dart';

/// Audio handler for system media controls (notification, lock screen).
///
/// Wraps [AudioPlayer] and syncs playback state to the system media session.
/// Provides notification controls: previous, play/pause, next.
class AudioPlayerHandler extends BaseAudioHandler with QueueHandler, SeekHandler {
  final AudioPlayer _player;

  // Streams for skip actions triggered from notification controls
  final _skipNextController = StreamController<void>.broadcast();
  final _skipPreviousController = StreamController<void>.broadcast();

  Stream<void> get skipToNextStream => _skipNextController.stream;
  Stream<void> get skipToPreviousStream => _skipPreviousController.stream;

  AudioPlayerHandler({AudioPipeline? pipeline})
      : _player = AudioPlayer(audioPipeline: pipeline) {
    _init();
  }

  /// Expose the underlying player for direct access (position, volume, etc.).
  AudioPlayer get player => _player;

  void _init() {
    // Sync player state → system playback state
    _player.playerStateStream.listen((state) {
      playbackState.add(playbackState.value.copyWith(
        playing: state.playing,
        processingState: _mapProcessingState(state.processingState),
        controls: _getControls(state.playing),
      ));
    });

    // Sync position
    _player.positionStream.listen((pos) {
      playbackState.add(playbackState.value.copyWith(
        updatePosition: pos,
      ));
    });

    // Sync duration
    _player.durationStream.listen((dur) {
      if (dur != null) {
        final current = mediaItem.value;
        if (current != null) {
          mediaItem.add(current.copyWith(duration: dur));
        }
      }
    });
  }

  /// Set and play a media item from a Song.
  Future<Duration?> playSongMedia({
    required Song song,
    required String url,
    String? artUri,
  }) async {
    final item = MediaItem(
      id: url,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: Duration(seconds: song.duration),
      artUri: artUri != null ? Uri.parse(artUri) : null,
      extras: {'songId': song.id},
    );

    mediaItem.add(item);

    // Update playback state to loading
    playbackState.add(playbackState.value.copyWith(
      processingState: AudioProcessingState.loading,
      controls: _getControls(false),
    ));

    final duration = await _player.setUrl(url);
    mediaItem.add(item.copyWith(duration: duration));
    return duration;
  }

  /// Set and play from a local file path.
  Future<Duration?> playSongFile({
    required Song song,
    required String filePath,
    String? artUri,
  }) async {
    final item = MediaItem(
      id: filePath,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: Duration(seconds: song.duration),
      artUri: artUri != null ? Uri.parse(artUri) : null,
      extras: {'songId': song.id},
    );

    mediaItem.add(item);

    playbackState.add(playbackState.value.copyWith(
      processingState: AudioProcessingState.loading,
      controls: _getControls(false),
    ));

    final duration = await _player.setFilePath(filePath);
    mediaItem.add(item.copyWith(duration: duration));
    return duration;
  }

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> stop() async {
    await _player.stop();
    playbackState.add(playbackState.value.copyWith(
      processingState: AudioProcessingState.idle,
      controls: _getControls(false),
    ));
  }

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> skipToNext() async {
    _skipNextController.add(null);
  }

  @override
  Future<void> skipToPrevious() async {
    _skipPreviousController.add(null);
  }

  List<MediaControl> _getControls(bool playing) {
    return [
      MediaControl.skipToPrevious,
      if (playing) MediaControl.pause else MediaControl.play,
      MediaControl.skipToNext,
    ];
  }

  AudioProcessingState _mapProcessingState(ProcessingState state) {
    switch (state) {
      case ProcessingState.idle:
        return AudioProcessingState.idle;
      case ProcessingState.loading:
        return AudioProcessingState.loading;
      case ProcessingState.buffering:
        return AudioProcessingState.buffering;
      case ProcessingState.ready:
        return AudioProcessingState.ready;
      case ProcessingState.completed:
        return AudioProcessingState.completed;
    }
  }

  @override
  Future<void> onTaskRemoved() async {
    await stop();
  }

  void dispose() {
    _skipNextController.close();
    _skipPreviousController.close();
    _player.dispose();
  }
}
