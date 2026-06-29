import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/playlist.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../widgets/common/song_list_tile.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_playlist?.name ?? '歌单')),
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
                          Container(
                            width: 200,
                            height: 200,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceVariant,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Center(
                              child: Icon(Icons.playlist_play, color: AppColors.primary, size: 80),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(_playlist!.name, style: AppTextStyles.headlineMedium, textAlign: TextAlign.center),
                          if (_playlist!.description != null && _playlist!.description!.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(_playlist!.description!, style: AppTextStyles.bodyMedium),
                            ),
                          const SizedBox(height: 4),
                          Text(
                            '${_playlist!.songCount ?? _playlist!.songs?.length ?? 0} 首歌曲',
                            style: AppTextStyles.bodySmall,
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
                          );
                        }),
                      ),
                  ],
                ),
    );
  }
}
