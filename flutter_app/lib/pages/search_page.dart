import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/song.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../widgets/common/song_list_tile.dart';

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final _controller = TextEditingController();
  List<Song> _results = [];
  bool _loading = false;
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    if (query.isEmpty) return;
    setState(() {
      _loading = true;
      _query = query;
    });
    try {
      final api = ref.read(apiClientProvider);
      final result = await api.listSongs(search: query, limit: 50);
      setState(() {
        _results = result.songs;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: '搜索歌曲、歌手、专辑...',
            border: InputBorder.none,
            hintStyle: TextStyle(color: AppColors.textTertiary),
          ),
          style: const TextStyle(color: AppColors.textPrimary),
          onSubmitted: _search,
          onChanged: (v) {
            if (v.isEmpty) setState(() => _results = []);
          },
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => _search(_controller.text),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _results.isEmpty
              ? Center(
                  child: Text(
                    _query.isEmpty ? '输入关键词搜索' : '未找到结果',
                    style: AppTextStyles.bodyMedium,
                  ),
                )
              : ListView.builder(
                  itemCount: _results.length,
                  itemBuilder: (context, index) {
                    final song = _results[index];
                    return SongListTile(
                      title: song.title,
                      artist: song.artist,
                      duration: song.duration,
                      onTap: () {
                        ref.read(playerProvider.notifier).playSong(
                          song,
                          queue: _results,
                          index: index,
                        );
                      },
                    );
                  },
                ),
    );
  }
}
