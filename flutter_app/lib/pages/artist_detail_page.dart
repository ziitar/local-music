import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/artist.dart';
import '../models/song.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../widgets/common/add_to_playlist_sheet.dart';
import '../widgets/common/song_list_tile.dart';
import '../widgets/common/song_search_delegate.dart';

class ArtistDetailPage extends ConsumerStatefulWidget {
  final int id;
  const ArtistDetailPage({super.key, required this.id});

  @override
  ConsumerState<ArtistDetailPage> createState() => _ArtistDetailPageState();
}

class _ArtistDetailPageState extends ConsumerState<ArtistDetailPage> {
  Artist? _artist;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final artist = await api.getArtist(widget.id);
      setState(() {
        _artist = artist;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<Song> get _songs => _artist?.songs ?? const [];
  List<int> get _songIds => _songs.map((song) => song.id).toList();

  void _showSearch() {
    if (_songs.isEmpty) return;

    showSearch(
      context: context,
      delegate: SongSearchDelegate(
        songs: _songs,
        onSelected: (song) {
          final index = _songs.indexOf(song);
          ref.read(playerProvider.notifier).playSong(
                song,
                queue: _songs,
                index: index,
              );
        },
      ),
    );
  }

  void _addAllToPlaylist() {
    if (_songIds.isEmpty) return;
    AddToPlaylistSheet.show(context, ref, songIds: _songIds);
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_artist?.name ?? '歌手'),
        actions: [
          if (_songs.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.playlist_add),
              tooltip: '添加全部到歌单',
              onPressed: _addAllToPlaylist,
            ),
          if (_songs.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.search),
              onPressed: _showSearch,
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _artist == null
              ? const Center(child: Text('加载失败'))
              : ListView(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 48,
                            backgroundColor: colors.primaryLight,
                            child: Text(
                              _artist!.name.isNotEmpty ? _artist!.name[0] : '?',
                              style: const TextStyle(
                                fontSize: 36,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _artist!.name,
                            style: AppTextStyles.headlineMedium(context),
                          ),
                          if (_artist!.alias != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                _artist!.alias!,
                                style: AppTextStyles.bodyMedium(context),
                              ),
                            ),
                          const SizedBox(height: 8),
                          Text(
                            '${_artist!.songCount ?? _songs.length} 首歌曲 · ${_artist!.albumCount ?? 0} 张专辑',
                            style: AppTextStyles.bodySmall(context),
                          ),
                          const SizedBox(height: 16),
                          OutlinedButton.icon(
                            onPressed: _songs.isEmpty ? null : _addAllToPlaylist,
                            icon: const Icon(Icons.playlist_add),
                            label: const Text('添加全部到歌单'),
                          ),
                        ],
                      ),
                    ),
                    ..._buildSongs(),
                  ],
                ),
    );
  }

  List<Widget> _buildSongs() {
    return _songs.asMap().entries.map((entry) {
      final song = entry.value;
      return SongListTile(
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        trackNo: song.trackNo,
        onTap: () {
          ref.read(playerProvider.notifier).playSong(
                song,
                queue: _songs,
                index: entry.key,
              );
        },
      );
    }).toList();
  }
}
