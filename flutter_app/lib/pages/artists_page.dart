import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/colors.dart';
import '../models/artist.dart';
import '../providers/providers.dart';
import '../widgets/common/paginated_list_view.dart';

class ArtistsPage extends ConsumerWidget {
  const ArtistsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('歌手')),
      body: PaginatedListView<Artist>(
        fetchItems: (page, search) async {
          final api = ref.read(apiClientProvider);
          final result =
              await api.listArtists(page: page, limit: 50, search: search);
          return (items: result.artists, pagination: result.pagination);
        },
        itemBuilder: (context, artist, index) {
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: colors.surfaceVariant,
              child: Text(
                artist.name.isNotEmpty ? artist.name[0] : '?',
                style: TextStyle(color: colors.primary),
              ),
            ),
            title: Text(artist.name),
            subtitle: Text('${artist.songCount ?? 0} 首歌曲'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/artists/${artist.id}'),
          );
        },
        showSearch: true,
        searchHint: '搜索歌手...',
        keyExtractor: (artist) => artist.id.toString(),
      ),
    );
  }
}
