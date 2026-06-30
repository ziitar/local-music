import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/song.dart';
import '../models/lyrics.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../utils/format_duration.dart';
import '../widgets/lyrics/lrc_parser.dart';
import '../widgets/visualizer/wave_visualizer.dart';

/// View mode for the song detail page.
enum _ViewMode { cover, visualizer, lyrics }

class SongDetailPage extends ConsumerStatefulWidget {
  final int id;
  const SongDetailPage({super.key, required this.id});

  @override
  ConsumerState<SongDetailPage> createState() => _SongDetailPageState();
}

class _SongDetailPageState extends ConsumerState<SongDetailPage> {
  Song? _song;
  List<LyricLine> _lyrics = [];
  bool _loading = true;
  _ViewMode _viewMode = _ViewMode.cover;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final song = await api.getSong(widget.id);
      setState(() => _song = song);

      // Load lyrics
      final lyricsResp = await api.getLyrics(song.title, song.artist);
      if (lyricsResp.lrc != null) {
        setState(() => _lyrics = LrcParser.parse(
          lyricsResp.lrc!,
          translatedLrc: lyricsResp.translatedLrc,
        ));
      }
      setState(() => _loading = false);
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _onSwipe(DragEndDetails details) {
    if (details.primaryVelocity == null) return;

    if (details.primaryVelocity! < 0) {
      // Swipe left: cover → visualizer → lyrics
      setState(() {
        switch (_viewMode) {
          case _ViewMode.cover:
            _viewMode = _ViewMode.visualizer;
            break;
          case _ViewMode.visualizer:
            _viewMode = _ViewMode.lyrics;
            break;
          case _ViewMode.lyrics:
            break;
        }
      });
    } else {
      // Swipe right: lyrics → visualizer → cover
      setState(() {
        switch (_viewMode) {
          case _ViewMode.lyrics:
            _viewMode = _ViewMode.visualizer;
            break;
          case _ViewMode.visualizer:
            _viewMode = _ViewMode.cover;
            break;
          case _ViewMode.cover:
            break;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = ref.watch(playerProvider);
    final song = _song ?? player.currentSong;

    return Scaffold(
      appBar: AppBar(
        title: Text(song?.title ?? '歌曲'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      extendBodyBehindAppBar: true,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : song == null
              ? const Center(child: Text('加载失败'))
              : Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        AppColors.primaryDark.withValues(alpha: 0.3),
                        AppColors.background,
                      ],
                    ),
                  ),
                  child: SafeArea(
                    child: Column(
                      children: [
                        // View indicator dots
                        _buildViewIndicator(),
                        // Main content area
                        Expanded(
                          child: GestureDetector(
                            onHorizontalDragEnd: _onSwipe,
                            child: _buildCurrentView(song, player),
                          ),
                        ),
                        // Controls
                        _buildControls(song, player),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildViewIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildDot(_ViewMode.cover),
          const SizedBox(width: 8),
          _buildDot(_ViewMode.visualizer),
          const SizedBox(width: 8),
          _buildDot(_ViewMode.lyrics),
        ],
      ),
    );
  }

  Widget _buildDot(_ViewMode mode) {
    final isActive = _viewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = mode),
      child: Container(
        width: isActive ? 24 : 8,
        height: 8,
        decoration: BoxDecoration(
          color: isActive ? AppColors.primary : AppColors.textTertiary.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(4),
        ),
      ),
    );
  }

  Widget _buildCurrentView(Song song, PlayerState player) {
    switch (_viewMode) {
      case _ViewMode.cover:
        return _buildCoverView(song, player);
      case _ViewMode.visualizer:
        return _buildVisualizerView();
      case _ViewMode.lyrics:
        return _buildLyricsView();
    }
  }

  Widget _buildCoverView(Song song, PlayerState player) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Album cover
          Container(
            width: 280,
            height: 280,
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: const Center(
              child: Icon(Icons.music_note, color: AppColors.textTertiary, size: 80),
            ),
          ),
          const SizedBox(height: 32),
          Text(
            song.title,
            style: AppTextStyles.headlineMedium,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          Text(song.artist, style: AppTextStyles.bodyMedium),
          const SizedBox(height: 4),
          Text(song.album, style: AppTextStyles.bodySmall),
        ],
      ),
    );
  }

  Widget _buildVisualizerView() {
    return const Stack(
      children: [
        // Background gradient
        SizedBox.expand(),
        // Visualizer
        WaveVisualizer(),
      ],
    );
  }

  Widget _buildLyricsView() {
    if (_lyrics.isEmpty) {
      return const Center(child: Text('暂无歌词', style: AppTextStyles.bodyMedium));
    }

    final player = ref.watch(playerProvider);
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 32),
      itemCount: _lyrics.length,
      itemBuilder: (context, index) {
        final line = _lyrics[index];
        final isActive = player.position >= line.timestamp &&
            (index == _lyrics.length - 1 ||
                player.position < _lyrics[index + 1].timestamp);

        return GestureDetector(
          onTap: () => ref.read(playerProvider.notifier).seek(line.timestamp),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              children: [
                Text(
                  line.text,
                  style: TextStyle(
                    fontSize: isActive ? 20 : 16,
                    fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                    color: isActive
                        ? AppColors.textPrimary
                        : AppColors.textTertiary,
                  ),
                  textAlign: TextAlign.center,
                ),
                if (line.translatedText != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      line.translatedText!,
                      style: TextStyle(
                        fontSize: isActive ? 14 : 12,
                        color: isActive
                            ? AppColors.textSecondary
                            : AppColors.textTertiary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildControls(Song song, PlayerState player) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // Progress
          Row(
            children: [
              Text(formatDuration(player.position), style: AppTextStyles.bodySmall),
              Expanded(
                child: Slider(
                  value: player.duration.inMilliseconds > 0
                      ? player.position.inMilliseconds /
                          player.duration.inMilliseconds
                      : 0.0,
                  onChanged: (v) {
                    final pos = Duration(
                      milliseconds:
                          (v * player.duration.inMilliseconds).round(),
                    );
                    ref.read(playerProvider.notifier).seek(pos);
                  },
                ),
              ),
              Text(formatDuration(player.duration), style: AppTextStyles.bodySmall),
            ],
          ),
          // Buttons
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              IconButton(
                icon: Icon(
                  _playModeIcon(player.playMode),
                  color: AppColors.textSecondary,
                ),
                onPressed: () =>
                    ref.read(playerProvider.notifier).cyclePlayMode(),
              ),
              IconButton(
                icon: const Icon(Icons.skip_previous, size: 36),
                color: AppColors.textPrimary,
                onPressed: () => ref.read(playerProvider.notifier).previous(),
              ),
              Container(
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primary,
                ),
                child: IconButton(
                  icon: Icon(
                    player.isPlaying ? Icons.pause : Icons.play_arrow,
                    color: Colors.white,
                    size: 36,
                  ),
                  onPressed: () =>
                      ref.read(playerProvider.notifier).togglePlay(),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.skip_next, size: 36),
                color: AppColors.textPrimary,
                onPressed: () => ref.read(playerProvider.notifier).next(),
              ),
              IconButton(
                icon: Icon(
                  _viewMode == _ViewMode.lyrics
                      ? Icons.music_note
                      : Icons.lyrics,
                  color: AppColors.textSecondary,
                ),
                onPressed: () => setState(() {
                  _viewMode = _viewMode == _ViewMode.lyrics
                      ? _ViewMode.cover
                      : _ViewMode.lyrics;
                }),
              ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _playModeIcon(PlayMode mode) {
    switch (mode) {
      case PlayMode.sequential:
        return Icons.repeat;
      case PlayMode.loopAll:
        return Icons.repeat;
      case PlayMode.loopOne:
        return Icons.repeat_one;
      case PlayMode.shuffle:
        return Icons.shuffle;
    }
  }
}
