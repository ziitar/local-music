import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/song.dart';
import '../models/lyrics.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../utils/format_duration.dart';
import '../widgets/common/cover_image.dart';
import '../widgets/common/add_to_playlist_sheet.dart';
import '../widgets/lyrics/lrc_parser.dart';

/// View mode for the song detail page.
enum _ViewMode { cover, lyrics }

class SongDetailPage extends ConsumerStatefulWidget {
  final int id;
  const SongDetailPage({super.key, required this.id});

  @override
  ConsumerState<SongDetailPage> createState() => _SongDetailPageState();
}

class _SongDetailPageState extends ConsumerState<SongDetailPage> {
  Song? _song;
  List<LyricLine> _lyrics = [];
  bool _songLoading = true;
  bool _lyricsLoading = false;
  String? _songError;
  String? _lyricsError;
  int? _requestedSongId;
  _ViewMode _viewMode = _ViewMode.cover;

  // Lyrics auto-scroll
  static const double _estimatedLyricExtent = 56;
  final ScrollController _lyricsScrollController = ScrollController();
  List<GlobalKey> _lyricKeys = [];
  int _activeLyricIndex = -1;
  bool _userScrolling = false;
  int _songLoadToken = 0;
  int _lyricsLoadToken = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_loadSong(widget.id));
  }

  @override
  void didUpdateWidget(covariant SongDetailPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.id != widget.id) {
      unawaited(_loadSong(widget.id));
    }
  }

  Future<void> _loadSong(int songId, {Song? immediateSong}) async {
    final token = ++_songLoadToken;
    final visibleSong = immediateSong ?? (_song?.id == songId ? _song : null);

    setState(() {
      _requestedSongId = songId;
      _songLoading = visibleSong == null;
      _songError = null;
      _song = visibleSong;
      _resetLyricsState(loading: visibleSong != null);
    });

    if (visibleSong != null) {
      unawaited(_loadLyrics(visibleSong));
    }

    try {
      final api = ref.read(apiClientProvider);
      final song = await api.getSong(songId);
      if (!mounted || token != _songLoadToken) return;

      final shouldReloadLyrics = visibleSong == null ||
          visibleSong.title != song.title ||
          visibleSong.artist != song.artist;

      setState(() {
        _song = song;
        _songLoading = false;
      });

      if (shouldReloadLyrics) {
        unawaited(_loadLyrics(song));
      }
    } catch (_) {
      if (!mounted || token != _songLoadToken) return;
      setState(() {
        _songLoading = false;
        _songError = '加载失败';
        if (visibleSong == null) {
          _lyricsLoading = false;
        }
      });
    }
  }

  Future<void> _loadLyrics(Song song) async {
    final token = ++_lyricsLoadToken;
    setState(() {
      _resetLyricsState(loading: true);
    });

    try {
      final api = ref.read(apiClientProvider);
      final lyricsResp = await api.getLyrics(song.title, song.artist);
      if (!mounted || token != _lyricsLoadToken) return;

      final parsedLyrics = lyricsResp.lrc == null
          ? <LyricLine>[]
          : LrcParser.parse(
              lyricsResp.lrc!,
              translatedLrc: lyricsResp.translatedLrc,
            );

      setState(() {
        _lyrics = parsedLyrics;
        _lyricKeys = List.generate(parsedLyrics.length, (_) => GlobalKey());
        _activeLyricIndex = -1;
        _lyricsLoading = false;
      });
    } catch (_) {
      if (!mounted || token != _lyricsLoadToken) return;
      setState(() {
        _lyrics = [];
        _lyricKeys = [];
        _activeLyricIndex = -1;
        _lyricsLoading = false;
        _lyricsError = '歌词加载失败';
      });
    }
  }

  void _resetLyricsState({required bool loading}) {
    _lyrics = [];
    _lyricKeys = [];
    _activeLyricIndex = -1;
    _userScrolling = false;
    _lyricsLoading = loading;
    _lyricsError = null;
    if (_lyricsScrollController.hasClients) {
      _lyricsScrollController.jumpTo(0);
    }
  }

  @override
  void dispose() {
    _lyricsScrollController.dispose();
    super.dispose();
  }

  int _findActiveLyricIndex(Duration position) {
    for (int i = _lyrics.length - 1; i >= 0; i--) {
      if (position >= _lyrics[i].timestamp) return i;
    }
    return -1;
  }

  void _scrollToActiveLyric(int index) {
    if (_userScrolling) return;
    if (!_lyricsScrollController.hasClients) return;
    if (index < 0 || index >= _lyricKeys.length) return;

    final keyContext = _lyricKeys[index].currentContext;
    if (keyContext == null) {
      final position = _lyricsScrollController.position;
      final targetOffset = (index * _estimatedLyricExtent) -
          (position.viewportDimension / 2) +
          (_estimatedLyricExtent / 2);
      final clampedOffset = targetOffset.clamp(
        position.minScrollExtent,
        position.maxScrollExtent,
      ).toDouble();
      _lyricsScrollController.animateTo(
        clampedOffset,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
      return;
    }

    Scrollable.ensureVisible(
      keyContext,
      alignment: 0.5,
      alignmentPolicy: ScrollPositionAlignmentPolicy.explicit,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  void _onSwipe(DragEndDetails details) {
    if (details.primaryVelocity == null) return;

    setState(() {
      if (details.primaryVelocity! < 0) {
        // Swipe left: cover → lyrics
        _viewMode = _ViewMode.lyrics;
      } else {
        // Swipe right: lyrics → cover
        _viewMode = _ViewMode.cover;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final player = ref.watch(playerProvider);
    final playerSong = player.currentSong;

    // When the player advances to a different song, reload details for it once.
    if (playerSong != null && playerSong.id != _requestedSongId) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && playerSong.id != _requestedSongId) {
          unawaited(_loadSong(playerSong.id, immediateSong: playerSong));
        }
      });
    }

    // Prefer the API-enriched _song if it matches the player's current song;
    // otherwise fall back to player.currentSong (which updates immediately).
    final song =
        (_song != null && playerSong != null && _song!.id == playerSong.id)
        ? _song
        : (playerSong ?? _song);

    return Scaffold(
      appBar: AppBar(
        title: Text(song?.title ?? '歌曲'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (song != null)
            IconButton(
              icon: const Icon(Icons.playlist_add),
              tooltip: '添加到歌单',
              onPressed: () {
                AddToPlaylistSheet.show(context, ref, songId: song.id);
              },
            ),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: _songLoading && song == null
          ? const Center(child: CircularProgressIndicator())
          : song == null
          ? Center(child: Text(_songError ?? '加载失败'))
          : Stack(
              children: [
                // Layer 1: Blurred album cover background
                if (song.coverImage != null)
                  Positioned.fill(
                    child: Image.network(
                      key: ValueKey('background-${song.id}-${song.coverImage}'),
                      '${ref.read(apiClientProvider).baseUrl}${song.coverImage}',
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const SizedBox.shrink(),
                    ),
                  ),
                // Layer 2: Blur + dark overlay for readability
                Positioned.fill(
                  child: Container(
                    color: colors.background.withValues(alpha: 0.75),
                  ),
                ),
                // Layer 3: Gradient tint
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          colors.primaryDark.withValues(alpha: 0.3),
                          colors.background.withValues(alpha: 0.5),
                        ],
                      ),
                    ),
                  ),
                ),
                // Layer 4: Main content
                SafeArea(
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
              ],
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
          _buildDot(_ViewMode.lyrics),
        ],
      ),
    );
  }

  Widget _buildDot(_ViewMode mode) {
    final colors = AppColors.of(context);
    final isActive = _viewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = mode),
      child: Container(
        width: isActive ? 24 : 8,
        height: 8,
        decoration: BoxDecoration(
          color: isActive
              ? colors.primary
              : colors.textTertiary.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(4),
        ),
      ),
    );
  }

  Widget _buildCurrentView(Song song, PlayerState player) {
    switch (_viewMode) {
      case _ViewMode.cover:
        return _buildCoverView(song, player);
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
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: CoverImage(
              key: ValueKey('cover-${song.id}-${song.coverImage}'),
              imageUrl: song.coverImage != null
                  ? '${ref.read(apiClientProvider).baseUrl}${song.coverImage}'
                  : null,
              size: 280,
              iconSize: 80,
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          const SizedBox(height: 32),
          Text(
            song.title,
            style: AppTextStyles.headlineMedium(context),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          Text(song.artist, style: AppTextStyles.bodyMedium(context)),
          const SizedBox(height: 4),
          Text(song.album, style: AppTextStyles.bodySmall(context)),
        ],
      ),
    );
  }

  Widget _buildLyricsView() {
    if (_lyricsLoading) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(height: 12),
            Text('歌词加载中...', style: AppTextStyles.bodyMedium(context)),
          ],
        ),
      );
    }

    if (_lyrics.isEmpty) {
      return Center(
        child: Text(
          _lyricsError ?? '暂无歌词',
          style: AppTextStyles.bodyMedium(context),
        ),
      );
    }

    final colors = AppColors.of(context);
    final player = ref.watch(playerProvider);
    final activeIndex = _findActiveLyricIndex(player.position);

    // Auto-scroll when active line changes (use addPostFrameCallback to avoid build-during-build)
    if (activeIndex != _activeLyricIndex && activeIndex >= 0) {
      _activeLyricIndex = activeIndex;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToActiveLyric(activeIndex);
      });
    }

    // Use LayoutBuilder to get viewport height for proper center padding
    return LayoutBuilder(
      builder: (context, constraints) {
        final centerPadding = constraints.maxHeight / 2;

        return NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            if (notification is ScrollStartNotification &&
                notification.dragDetails != null) {
              _userScrolling = true;
            } else if (notification is ScrollEndNotification) {
              // Resume auto-scroll after 3 seconds of no manual scrolling
              unawaited(
                Future.delayed(const Duration(seconds: 3), () {
                  if (mounted) setState(() => _userScrolling = false);
                }),
              );
            }
            return false;
          },
          child: ListView.builder(
            controller: _lyricsScrollController,
            padding: EdgeInsets.symmetric(
              vertical: centerPadding,
              horizontal: 32,
            ),
            itemCount: _lyrics.length,
            itemBuilder: (context, index) {
              final line = _lyrics[index];
              final isActive = index == activeIndex;

              return GestureDetector(
                key: index < _lyricKeys.length ? _lyricKeys[index] : null,
                onTap: () =>
                    ref.read(playerProvider.notifier).seek(line.timestamp),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    children: [
                      Text(
                        line.text,
                        style: TextStyle(
                          fontSize: isActive ? 20 : 16,
                          fontWeight: isActive
                              ? FontWeight.bold
                              : FontWeight.normal,
                          color: isActive
                              ? colors.textPrimary
                              : colors.textTertiary,
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
                                  ? colors.textSecondary
                                  : colors.textTertiary,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildControls(Song song, PlayerState player) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // Progress
          Row(
            children: [
              Text(
                formatDuration(player.position),
                style: AppTextStyles.bodySmall(context),
              ),
              Expanded(
                child: Slider(
                  value: player.duration.inMilliseconds > 0
                      ? (player.position.inMilliseconds /
                                player.duration.inMilliseconds)
                            .clamp(0.0, 1.0)
                      : 0.0,
                  onChanged: (v) {
                    final pos = Duration(
                      milliseconds: (v * player.duration.inMilliseconds)
                          .round(),
                    );
                    ref.read(playerProvider.notifier).seek(pos);
                  },
                ),
              ),
              Text(
                formatDuration(player.duration),
                style: AppTextStyles.bodySmall(context),
              ),
            ],
          ),
          // Buttons
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              IconButton(
                icon: Icon(
                  _playModeIcon(player.playMode),
                  color: colors.textSecondary,
                ),
                tooltip: _playModeLabel(player.playMode),
                onPressed: () =>
                    ref.read(playerProvider.notifier).cyclePlayMode(),
              ),
              IconButton(
                icon: const Icon(Icons.skip_previous, size: 36),
                color: colors.textPrimary,
                onPressed: () => ref.read(playerProvider.notifier).previous(),
              ),
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colors.primary,
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
                color: colors.textPrimary,
                onPressed: () => ref.read(playerProvider.notifier).next(),
              ),
              IconButton(
                icon: Icon(
                  _viewMode == _ViewMode.lyrics
                      ? Icons.music_note
                      : Icons.lyrics,
                  color: colors.textSecondary,
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
        return Icons.arrow_forward;
      case PlayMode.loopAll:
        return Icons.repeat;
      case PlayMode.loopOne:
        return Icons.repeat_one;
      case PlayMode.shuffle:
        return Icons.shuffle;
    }
  }

  String _playModeLabel(PlayMode mode) {
    switch (mode) {
      case PlayMode.sequential:
        return '顺序播放';
      case PlayMode.loopAll:
        return '列表循环';
      case PlayMode.loopOne:
        return '单曲循环';
      case PlayMode.shuffle:
        return '随机播放';
    }
  }
}
