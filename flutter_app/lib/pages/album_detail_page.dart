import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/text_styles.dart';
import '../models/album.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../widgets/common/cover_image.dart';
import '../widgets/common/song_list_tile.dart';
import '../widgets/common/song_search_delegate.dart';

class AlbumDetailPage extends ConsumerStatefulWidget {
  final int id;
  const AlbumDetailPage({super.key, required this.id});

  @override
  ConsumerState<AlbumDetailPage> createState() => _AlbumDetailPageState();
}

class _AlbumDetailPageState extends ConsumerState<AlbumDetailPage> {
  Album? _album;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final album = await api.getAlbum(widget.id);
      setState(() {
        _album = album;
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
        songs: _album!.songs!,
        onSelected: (song) {
          final index = _album!.songs!.indexOf(song);
          ref.read(playerProvider.notifier).playSong(
                song,
                queue: _album!.songs!,
                index: index,
              );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_album?.title ?? '专辑'),
        actions: [
          if (_album?.songs != null && _album!.songs!.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.search),
              onPressed: () => _showSearch(),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _album == null
              ? const Center(child: Text('加载失败'))
              : ListView(
                  children: [
                    // Header
                    Container(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          CoverImage(
                            imageUrl: _album!.coverImage != null
                                ? '${ref.read(apiClientProvider).baseUrl}${_album!.coverImage}'
                                : null,
                            size: 200,
                            iconSize: 80,
                          ),
                          const SizedBox(height: 16),
                          Text(_album!.title, style: AppTextStyles.headlineMedium(context), textAlign: TextAlign.center),
                          if (_album!.artist != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(_album!.artist!, style: AppTextStyles.bodyMedium(context)),
                            ),
                          const SizedBox(height: 4),
                          Text(
                            '${_album!.songCount ?? _album!.songs?.length ?? 0} 首歌曲',
                            style: AppTextStyles.bodySmall(context),
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: () {
                              final songs = _album!.songs;
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
                    if (_album!.songs != null)
                      ...ListTile.divideTiles(
                        context: context,
                        tiles: _album!.songs!.asMap().entries.map((entry) {
                          final song = entry.value;
                          return SongListTile(
                            title: song.title,
                            artist: song.artist,
                            duration: song.duration,
                            trackNo: song.trackNo,
                            onTap: () {
                              ref.read(playerProvider.notifier).playSong(
                                song,
                                queue: _album!.songs!,
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
