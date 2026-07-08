import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/text_styles.dart';
import '../models/playlist.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../widgets/common/song_list_tile.dart';
import '../widgets/common/song_search_delegate.dart';
import '../widgets/common/cover_image.dart';

class PlaylistDetailPage extends ConsumerStatefulWidget {
  final int id;
  const PlaylistDetailPage({super.key, required this.id});

  @override
  ConsumerState<PlaylistDetailPage> createState() => _PlaylistDetailPageState();
}

class _PlaylistDetailPageState extends ConsumerState<PlaylistDetailPage> {
  Playlist? _playlist;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final playlist = await api.getPlaylist(widget.id);
      setState(() {
        _playlist = playlist;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _showSearch() {
    showSearch(
      context: context,
      delegate: SongSearchDelegate(
        songs: _playlist!.songs!,
        onSelected: (song) {
          final index = _playlist!.songs!.indexOf(song);
          ref.read(playerProvider.notifier).playSong(
                song,
                queue: _playlist!.songs!,
                index: index,
              );
        },
      ),
    );
  }

  Future<void> _showRemoveDialog(int songId, String songTitle) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('移除歌曲'),
        content: Text('确定要将「$songTitle」从歌单中移除吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('移除', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final api = ref.read(apiClientProvider);
        await api.removeSongFromPlaylist(_playlist!.id, songId);
        _load(); // Refresh the playlist
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('已从歌单中移除「$songTitle」')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('移除失败: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_playlist?.name ?? '歌单'),
        actions: [
          if (_playlist?.songs != null && _playlist!.songs!.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.search),
              onPressed: () => _showSearch(),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _playlist == null
              ? const Center(child: Text('加载失败'))
              : ListView(
                  children: [
                    // Header
                    Container(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          CoverImage(
                            imageUrl: _playlist!.coverImage != null
                                ? '${ref.read(apiClientProvider).baseUrl}${_playlist!.coverImage}'
                                : null,
                            size: 200,
                            iconSize: 80,
                          ),
                          const SizedBox(height: 16),
                          Text(_playlist!.name, style: AppTextStyles.headlineMedium(context), textAlign: TextAlign.center),
                          if (_playlist!.description != null && _playlist!.description!.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(_playlist!.description!, style: AppTextStyles.bodyMedium(context)),
                            ),
                          const SizedBox(height: 4),
                          Text(
                            '${_playlist!.songCount ?? _playlist!.songs?.length ?? 0} 首歌曲',
                            style: AppTextStyles.bodySmall(context),
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: () {
                              final songs = _playlist!.songs;
                              if (songs != null && songs.isNotEmpty) {
                                ref.read(playerProvider.notifier).playQueue(songs);
                              }
                            },
                            icon: const Icon(Icons.play_arrow),
                            label: const Text('播放全部'),
                          ),
                        ],
                      ),
                    ),
                    // Songs
                    if (_playlist!.songs != null)
                      ...ListTile.divideTiles(
                        context: context,
                        tiles: _playlist!.songs!.asMap().entries.map((entry) {
                          final song = entry.value;
                          return SongListTile(
                            title: song.title,
                            artist: song.artist,
                            duration: song.duration,
                            onTap: () {
                              ref.read(playerProvider.notifier).playSong(
                                song,
                                queue: _playlist!.songs!,
                                index: entry.key,
                              );
                            },
                            onLongPress: () => _showRemoveDialog(song.id, song.title),
                          );
                        }),
                      ),
                  ],
                ),
    );
  }
}
