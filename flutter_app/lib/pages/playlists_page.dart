import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/playlist.dart';
import '../providers/providers.dart';

class PlaylistsPage extends ConsumerStatefulWidget {
  const PlaylistsPage({super.key});

  @override
  ConsumerState<PlaylistsPage> createState() => _PlaylistsPageState();
}

class _PlaylistsPageState extends ConsumerState<PlaylistsPage> {
  List<Playlist> _playlists = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final playlists = await api.listPlaylists();
      setState(() {
        _playlists = playlists;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _createPlaylist() async {
    final name = await showDialog<String>(
      context: context,
      builder: (context) {
        final controller = TextEditingController();
        return AlertDialog(
          title: const Text('新建歌单'),
          content: TextField(
            controller: controller,
            autofocus: true,
            decoration: const InputDecoration(hintText: '歌单名称'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('取消')),
            FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('创建')),
          ],
        );
      },
    );

    if (name != null && name.isNotEmpty) {
      try {
        final api = ref.read(apiClientProvider);
        await api.createPlaylist(name);
        _load();
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('歌单'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _createPlaylist,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _playlists.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.playlist_play, size: 64, color: AppColors.textTertiary),
                      const SizedBox(height: 16),
                      const Text('暂无歌单', style: AppTextStyles.bodyMedium),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: _createPlaylist,
                        icon: const Icon(Icons.add),
                        label: const Text('创建歌单'),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  itemCount: _playlists.length,
                  itemBuilder: (context, index) {
                    final playlist = _playlists[index];
                    return ListTile(
                      leading: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceVariant,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Icon(Icons.playlist_play, color: AppColors.primary),
                      ),
                      title: Text(playlist.name),
                      subtitle: Text('${playlist.songCount ?? 0} 首歌曲'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/playlists/${playlist.id}'),
                    );
                  },
                ),
    );
  }
}
