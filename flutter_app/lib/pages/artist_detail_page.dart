import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/text_styles.dart';
import '../models/artist.dart';
import '../models/song.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../widgets/common/song_list_tile.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_artist?.name ?? '歌手')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _artist == null
              ? const Center(child: Text('加载失败'))
              : ListView(
                  children: [
                    // Header
                    Container(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 48,
                            backgroundColor: Colors.orange.shade200,
                            child: Text(
                              _artist!.name.isNotEmpty ? _artist!.name[0] : '?',
                              style: const TextStyle(fontSize: 36, color: Colors.white),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(_artist!.name, style: AppTextStyles.headlineMedium),
                          if (_artist!.alias != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(_artist!.alias!, style: AppTextStyles.bodyMedium),
                            ),
                          const SizedBox(height: 8),
                          Text(
                            '${_artist!.songCount ?? 0} 首歌曲 · ${_artist!.albumCount ?? 0} 张专辑',
                            style: AppTextStyles.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    // Songs from albums
                    if (_artist!.albums != null)
                      ..._buildAlbumSongs(),
                  ],
                ),
    );
  }

  List<Widget> _buildAlbumSongs() {
    final allSongs = <Song>[];
    for (final album in _artist!.albums!) {
      if (album.songs != null) {
        allSongs.addAll(album.songs!);
      }
    }

    return allSongs.asMap().entries.map((entry) {
      final song = entry.value;
      return SongListTile(
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        onTap: () {
          ref.read(playerProvider.notifier).playSong(
            song,
            queue: allSongs,
            index: entry.key,
          );
        },
      );
    }).toList();
  }
}
