import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/album.dart';
import '../providers/providers.dart';

class AlbumsPage extends ConsumerStatefulWidget {
  const AlbumsPage({super.key});

  @override
  ConsumerState<AlbumsPage> createState() => _AlbumsPageState();
}

class _AlbumsPageState extends ConsumerState<AlbumsPage> {
  List<Album> _albums = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final result = await api.listAlbums(limit: 100);
      setState(() {
        _albums = result.albums;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('专辑')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _albums.isEmpty
              ? const Center(child: Text('暂无专辑', style: AppTextStyles.bodyMedium))
              : GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 180,
                    childAspectRatio: 0.75,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: _albums.length,
                  itemBuilder: (context, index) {
                    final album = _albums[index];
                    return GestureDetector(
                      onTap: () => context.push('/albums/${album.id}'),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.surfaceVariant,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Center(
                                child: Icon(Icons.album, color: AppColors.textTertiary, size: 48),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            album.title,
                            style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textPrimary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            album.artist ?? '',
                            style: AppTextStyles.bodySmall,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
