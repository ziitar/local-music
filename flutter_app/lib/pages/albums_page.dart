import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/album.dart';
import '../providers/providers.dart';
import '../widgets/common/cover_image.dart';
import '../widgets/common/paginated_list_view.dart';

class AlbumsPage extends ConsumerWidget {
  const AlbumsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('专辑')),
      body: PaginatedListView<Album>(
        fetchItems: (page, search) async {
          final api = ref.read(apiClientProvider);
          final result =
              await api.listAlbums(page: page, limit: 50, search: search);
          return (items: result.albums, pagination: result.pagination);
        },
        gridItemBuilder: (context, album, index) {
          return GestureDetector(
            onTap: () => context.push('/albums/${album.id}'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: CoverImage(
                    imageUrl: album.coverImage != null
                        ? '${ref.read(apiClientProvider).baseUrl}${album.coverImage}'
                        : null,
                    size: double.infinity,
                    iconSize: 48,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  album.title,
                  style: AppTextStyles.bodyMedium
                      .copyWith(color: AppColors.textPrimary),
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
        showSearch: true,
        searchHint: '搜索专辑...',
        keyExtractor: (album) => album.id.toString(),
      ),
    );
  }
}
