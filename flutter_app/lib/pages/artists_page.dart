import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/artist.dart';
import '../providers/providers.dart';

class ArtistsPage extends ConsumerStatefulWidget {
  const ArtistsPage({super.key});

  @override
  ConsumerState<ArtistsPage> createState() => _ArtistsPageState();
}

class _ArtistsPageState extends ConsumerState<ArtistsPage> {
  List<Artist> _artists = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final result = await api.listArtists(limit: 100);
      setState(() {
        _artists = result.artists;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('歌手')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _artists.isEmpty
              ? const Center(child: Text('暂无歌手', style: AppTextStyles.bodyMedium))
              : ListView.builder(
                  itemCount: _artists.length,
                  itemBuilder: (context, index) {
                    final artist = _artists[index];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppColors.surfaceVariant,
                        child: Text(
                          artist.name.isNotEmpty ? artist.name[0] : '?',
                          style: const TextStyle(color: AppColors.primary),
                        ),
                      ),
                      title: Text(artist.name),
                      subtitle: Text('${artist.songCount ?? 0} 首歌曲'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/artists/${artist.id}'),
                    );
                  },
                ),
    );
  }
}
