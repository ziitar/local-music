import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/play_history.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../widgets/common/song_list_tile.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  List<PlayHistory> _history = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final api = ref.read(apiClientProvider);
    try {
      final history = await api.listHistory(limit: 20);
      setState(() {
        _history = history;
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
        title: const Text('Local Music'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => context.go('/search'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text('曲库', style: AppTextStyles.titleLarge(context)),
                  const SizedBox(height: 12),
                  // Quick access cards
                  Row(
                    children: [
                      _QuickAccessCard(
                        icon: Icons.person,
                        label: '歌手',
                        onTap: () => context.push('/artists'),
                      ),
                      const SizedBox(width: 12),
                      _QuickAccessCard(
                        icon: Icons.album,
                        label: '专辑',
                        onTap: () => context.push('/albums'),
                      ),
                      const SizedBox(width: 12),
                      _QuickAccessCard(
                        icon: Icons.playlist_play,
                        label: '歌单',
                        onTap: () => context.push('/playlists'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  if (_history.isNotEmpty) ...[
                    Text('最近播放', style: AppTextStyles.titleLarge(context)),
                    const SizedBox(height: 12),
                    ...ListTile.divideTiles(
                      context: context,
                      tiles: _history.take(10).map((h) => SongListTile(
                        title: h.title,
                        artist: h.artist,
                        duration: h.duration,
                        onTap: () {
                          ref.read(playerProvider.notifier).playSong(h.toSong());
                        },
                      )),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _QuickAccessCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickAccessCard({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 20),
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Icon(icon, color: colors.primary, size: 32),
              const SizedBox(height: 8),
              Text(label, style: AppTextStyles.bodyMedium(context)),
            ],
          ),
        ),
      ),
    );
  }
}
