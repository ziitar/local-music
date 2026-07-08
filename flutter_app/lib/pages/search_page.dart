import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/song.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../widgets/common/paginated_list_view.dart';
import '../widgets/common/song_list_tile.dart';
import '../widgets/common/add_to_playlist_sheet.dart';

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          decoration: InputDecoration(
            hintText: '搜索歌曲、歌手、专辑...',
            border: InputBorder.none,
            hintStyle: TextStyle(color: colors.textTertiary),
          ),
          style: TextStyle(color: colors.textPrimary),
          onSubmitted: (v) {
            if (v.isNotEmpty) {
              setState(() => _query = v);
            }
          },
          onChanged: (v) {
            if (v.isEmpty) setState(() => _query = '');
          },
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              if (_controller.text.isNotEmpty) {
                setState(() => _query = _controller.text);
              }
            },
          ),
        ],
      ),
      body: _query.isEmpty
          ? Center(
              child: Text(
                '输入关键词搜索',
                style: AppTextStyles.bodyMedium(context),
              ),
            )
          : PaginatedListView<Song>(
              key: ValueKey(_query), // Force new state when query changes
              fetchItems: (page, search) async {
                final api = ref.read(apiClientProvider);
                final result =
                    await api.listSongs(page: page, limit: 50, search: _query);
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
              keyExtractor: (song) => song.id.toString(),
            ),
    );
  }
}
