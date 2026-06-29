import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/song.dart';
import '../models/pagination.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../widgets/common/song_list_tile.dart';

class LibraryPage extends ConsumerStatefulWidget {
  const LibraryPage({super.key});

  @override
  ConsumerState<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends ConsumerState<LibraryPage> {
  List<Song> _songs = [];
  Pagination? _pagination;
  bool _loading = true;
  int _currentPage = 1;
  String? _search;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadSongs();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadSongs({int page = 1}) async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final result = await api.listSongs(page: page, limit: 50, search: _search);
      setState(() {
        if (page == 1) {
          _songs = result.songs;
        } else {
          _songs = [..._songs, ...result.songs];
        }
        _pagination = result.pagination;
        _currentPage = page;
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
        title: const Text('曲库'),
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: '搜索歌曲...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _search = null);
                          _loadSongs();
                        },
                      )
                    : null,
                filled: true,
                fillColor: AppColors.surfaceVariant,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onSubmitted: (v) {
                setState(() => _search = v.isEmpty ? null : v);
                _loadSongs();
              },
            ),
          ),
          // Song list
          Expanded(
            child: _loading && _songs.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : _songs.isEmpty
                    ? const Center(child: Text('暂无歌曲', style: AppTextStyles.bodyMedium))
                    : ListView.builder(
                        itemCount: _songs.length + (_pagination != null && _currentPage < _pagination!.totalPages ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (index == _songs.length) {
                            // Load more
                            _loadSongs(page: _currentPage + 1);
                            return const Center(
                              child: Padding(
                                padding: EdgeInsets.all(16),
                                child: CircularProgressIndicator(),
                              ),
                            );
                          }
                          final song = _songs[index];
                          return SongListTile(
                            title: song.title,
                            artist: song.artist,
                            duration: song.duration,
                            onTap: () {
                              ref.read(playerProvider.notifier).playSong(
                                song,
                                queue: _songs,
                                index: index,
                              );
                            },
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
