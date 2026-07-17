import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/playlist.dart';
import '../../providers/providers.dart';
import '../../theme/colors.dart';

/// Bottom sheet for adding one or more songs to a playlist.
class AddToPlaylistSheet extends ConsumerStatefulWidget {
  final List<int> songIds;

  const AddToPlaylistSheet({super.key, required this.songIds});

  /// Show the sheet as a modal bottom sheet.
  static Future<void> show(
    BuildContext context,
    WidgetRef ref, {
    int? songId,
    List<int>? songIds,
  }) {
    final ids = <int>{
      if (songId != null) songId,
      ...?songIds,
    }.toList();

    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => AddToPlaylistSheet(songIds: ids),
    );
  }

  @override
  ConsumerState<AddToPlaylistSheet> createState() =>
      _AddToPlaylistSheetState();
}

class _AddToPlaylistSheetState extends ConsumerState<AddToPlaylistSheet> {
  List<Playlist> _playlists = [];
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadPlaylists();
  }

  Future<void> _loadPlaylists() async {
    try {
      final api = ref.read(apiClientProvider);
      final playlists = await api.listPlaylists();
      setState(() {
        _playlists = playlists;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('加载歌单失败: $e')),
        );
      }
    }
  }

  Future<void> _addToPlaylist(int playlistId, String playlistName) async {
    if (widget.songIds.isEmpty) return;

    setState(() => _submitting = true);
    try {
      final api = ref.read(apiClientProvider);
      if (widget.songIds.length == 1) {
        await api.addSongToPlaylist(playlistId, widget.songIds.first);
      } else {
        await api.addSongsToPlaylist(playlistId, widget.songIds);
      }

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('已添加到「$playlistName」')),
        );
      }
    } catch (e) {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('添加失败: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Text(
                    '添加到歌单',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: colors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '将 ${widget.songIds.length} 首歌曲添加到：',
                  style: TextStyle(color: colors.textSecondary, fontSize: 13),
                ),
              ),
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(),
              )
            else if (_playlists.isEmpty)
              Padding(
                padding: const EdgeInsets.all(32),
                child: Text(
                  '暂无歌单，请先创建歌单',
                  style: TextStyle(color: colors.textTertiary),
                ),
              )
            else
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.4,
                ),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _playlists.length,
                  itemBuilder: (context, index) {
                    final playlist = _playlists[index];
                    return ListTile(
                      leading: Icon(Icons.playlist_add, color: colors.primary),
                      title: Text(
                        playlist.name,
                        style: TextStyle(color: colors.textPrimary),
                      ),
                      subtitle: Text(
                        '${playlist.songCount ?? 0} 首歌曲',
                        style: TextStyle(
                          color: colors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      enabled: !_submitting,
                      onTap: () => _addToPlaylist(playlist.id, playlist.name),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
