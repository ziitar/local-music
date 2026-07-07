import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/song.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../widgets/common/paginated_list_view.dart';
import '../widgets/common/song_list_tile.dart';
import '../widgets/common/add_to_playlist_sheet.dart';

class LibraryPage extends ConsumerWidget {
  const LibraryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('曲库'),
      ),
      body: PaginatedListView<Song>(
        fetchItems: (page, search) async {
          final api = ref.read(apiClientProvider);
          final result =
              await api.listSongs(page: page, limit: 50, search: search);
          return (items: result.songs, pagination: result.pagination);
        },
        itemBuilder: (context, song, index) {
          return SongListTile(
            title: song.title,
            artist: song.artist,
            duration: song.duration,
            onTap: () {
              ref.read(playerProvider.notifier).playSong(
                    song,
                    queue: [],
                    index: index,
                  );
            },
            onLongPress: () {
              AddToPlaylistSheet.show(context, ref, songId: song.id);
            },
          );
        },
        showSearch: true,
        searchHint: '搜索歌曲...',
        keyExtractor: (song) => song.id.toString(),
      ),
    );
  }
}
