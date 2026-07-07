# Flutter Issues Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 critical Flutter issues: playlists not showing, infinite loading broken, settings not triggering immediately, settings not persisting, and search filtering missing in detail pages.

**Architecture:** 
- Create a reusable `PaginatedListView` widget with Record-based API for consistent pagination
- Centralize settings persistence in `PlaybackSettings` provider
- Use Riverpod listeners for settings trigger mechanism
- Add `SongSearchDelegate` for client-side search in detail pages

**Tech Stack:** Flutter, Riverpod, SharedPreferences, just_audio

---

## File Structure

### New Files
- `flutter_app/lib/widgets/common/paginated_list_view.dart` - Reusable paginated list/grid widget
- `flutter_app/lib/widgets/common/song_search_delegate.dart` - Search delegate for song filtering

### Modified Files
- `flutter_app/lib/config.dart` - Add new storage keys
- `flutter_app/lib/providers/settings_provider.dart` - Add playMode and quality fields
- `flutter_app/lib/providers/player_provider.dart` - Update persistence and cyclePlayMode
- `flutter_app/lib/pages/playlists_page.dart` - Add Logger debugging
- `flutter_app/lib/pages/settings_page.dart` - Remove direct service calls
- `flutter_app/lib/pages/library_page.dart` - Use PaginatedListView
- `flutter_app/lib/pages/artists_page.dart` - Use PaginatedListView
- `flutter_app/lib/pages/albums_page.dart` - Use PaginatedListView
- `flutter_app/lib/pages/search_page.dart` - Use PaginatedListView
- `flutter_app/lib/pages/playlist_detail_page.dart` - Add search
- `flutter_app/lib/pages/artist_detail_page.dart` - Add search
- `flutter_app/lib/pages/album_detail_page.dart` - Add search

---

## Task 1: Debug Playlists Issue

**Files:**
- Modify: `flutter_app/lib/pages/playlists_page.dart`

- [ ] **Step 1: Add Logger import and instance**

```dart
import 'package:logger/logger.dart';

class _PlaylistsPageState extends ConsumerState<PlaylistsPage> {
  final _logger = Logger();
  List<Playlist> _playlists = [];
  bool _loading = true;
```

- [ ] **Step 2: Update _load() with Logger**

```dart
Future<void> _load() async {
  try {
    final api = ref.read(apiClientProvider);
    _logger.d('Fetching playlists from ${api.baseUrl}/api/playlists');
    
    final playlists = await api.listPlaylists();
    _logger.d('Playlists fetched: ${playlists.length} items');
    
    if (playlists.isEmpty) {
      _logger.w('Playlists list is empty - check if user has playlists');
    }
    
    setState(() {
      _playlists = playlists;
      _loading = false;
    });
  } catch (e, stackTrace) {
    _logger.e('Failed to load playlists', error: e, stackTrace: stackTrace);
    setState(() => _loading = false);
  }
}
```

- [ ] **Step 3: Run the app and check console output** (requires human judgment)

Run: `cd flutter_app && flutter run`
Expected: Navigate to playlists page and see Logger output in console

- [ ] **Step 4: Identify root cause from logs**

Check for:
- Network error (connection failed)
- Auth error (401 Unauthorized)
- Empty response (API returns [])
- Parsing error (JSON mismatch)

- [ ] **Step 5: Fix identified issue**

Based on logs, fix the root cause. Common fixes:
- If auth error: Check token storage and API interceptor
- If parsing error: Verify Playlist.fromJson matches API response
- If empty: Verify API endpoint returns user's playlists

- [ ] **Step 6: Verify fix**

Run app again and confirm playlists load correctly.

- [ ] **Step 7: Commit**

```bash
git add flutter_app/lib/pages/playlists_page.dart
git commit -m "fix: debug and fix playlists not showing"
```

---

## Task 2: Add Settings Persistence Keys

**Files:**
- Modify: `flutter_app/lib/config.dart`

- [ ] **Step 1: Add new storage keys**

Add these 2 new keys to `AppConfig` (existing keys `storageKeyEqEnabled`, `storageKeyEqPreset`, `storageKeyLoudnessNormEnabled` are already present):

```dart
static const String storageKeyPlayMode = 'play_mode';
static const String storageKeyQuality = 'quality';
```

- [ ] **Step 2: Verify existing code still compiles**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add flutter_app/lib/config.dart
git commit -m "feat: add storage keys for playMode and quality persistence"
```

---

## Task 3: Update Settings Provider with New Fields

**Files:**
- Modify: `flutter_app/lib/providers/settings_provider.dart`

- [ ] **Step 1: Add playMode and quality to PlaybackSettings**

```dart
class PlaybackSettings {
  final bool eqEnabled;
  final String eqPresetName;
  final bool loudnessNormalizationEnabled;
  final String playMode;
  final String? quality;

  const PlaybackSettings({
    this.eqEnabled = false,
    this.eqPresetName = 'flat',
    this.loudnessNormalizationEnabled = true,
    this.playMode = 'sequential',
    this.quality,
  });
```

- [ ] **Step 2: Update copyWith method**

```dart
PlaybackSettings copyWith({
  bool? eqEnabled,
  String? eqPresetName,
  bool? loudnessNormalizationEnabled,
  String? playMode,
  String? quality,
}) {
  return PlaybackSettings(
    eqEnabled: eqEnabled ?? this.eqEnabled,
    eqPresetName: eqPresetName ?? this.eqPresetName,
    loudnessNormalizationEnabled: loudnessNormalizationEnabled ?? this.loudnessNormalizationEnabled,
    playMode: playMode ?? this.playMode,
    quality: quality ?? this.quality,
  );
}
```

- [ ] **Step 3: Update _load() method**

```dart
void _load() {
  state = PlaybackSettings(
    eqEnabled: _storage.prefs.getBool(AppConfig.storageKeyEqEnabled) ?? false,
    eqPresetName: _storage.prefs.getString(AppConfig.storageKeyEqPreset) ?? 'flat',
    loudnessNormalizationEnabled: _storage.prefs.getBool(AppConfig.storageKeyLoudnessNormEnabled) ?? true,
    playMode: _storage.prefs.getString(AppConfig.storageKeyPlayMode) ?? 'sequential',
    quality: _storage.prefs.getString(AppConfig.storageKeyQuality),
  );
}
```

- [ ] **Step 4: Add setPlayMode method**

```dart
void setPlayMode(String mode) {
  state = state.copyWith(playMode: mode);
  _storage.prefs.setString(AppConfig.storageKeyPlayMode, mode);
}
```

- [ ] **Step 5: Add setQuality method**

```dart
void setQuality(String? quality) {
  state = state.copyWith(quality: quality);
  if (quality != null) {
    _storage.prefs.setString(AppConfig.storageKeyQuality, quality);
  } else {
    _storage.prefs.remove(AppConfig.storageKeyQuality);
  }
}
```

- [ ] **Step 6: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add flutter_app/lib/providers/settings_provider.dart
git commit -m "feat: add playMode and quality to PlaybackSettings"
```

---

## Task 4: Update Player Provider for Persistence

**Files:**
- Modify: `flutter_app/lib/providers/player_provider.dart`

- [ ] **Step 1: Update setPlayMode to not persist directly**

```dart
void setPlayMode(PlayMode mode) {
  state = state.copyWith(playMode: mode);
}
```

- [ ] **Step 2: Update setQuality to not persist directly**

```dart
void setQuality(String? quality) {
  state = state.copyWith(quality: quality);
}
```

- [ ] **Step 3: Update cyclePlayMode to use setPlayMode**

```dart
void cyclePlayMode() {
  const modes = PlayMode.values;
  final nextIndex = (modes.indexOf(state.playMode) + 1) % modes.length;
  setPlayMode(modes[nextIndex]);
}
```

- [ ] **Step 4: Update playerProvider factory**

```dart
final playerProvider = StateNotifierProvider<PlayerNotifier, PlayerState>((ref) {
  final handler = ref.watch(audioHandlerProvider);
  final api = ref.watch(apiClientProvider);
  final cache = ref.watch(cacheServiceProvider);
  final loudness = ref.watch(loudnessServiceProvider);
  final notifier = PlayerNotifier(handler, api, cache, loudness);

  // Load persisted settings on startup
  final initialSettings = ref.read(playbackSettingsProvider);
  notifier.setPlayMode(PlayMode.values.firstWhere(
    (e) => e.name == initialSettings.playMode,
    orElse: () => PlayMode.sequential,
  ));
  notifier.setQuality(initialSettings.quality);

  // Sync loudness normalization toggle
  ref.listen<PlaybackSettings>(playbackSettingsProvider, (prev, next) {
    if (prev?.loudnessNormalizationEnabled != next.loudnessNormalizationEnabled) {
      notifier.setLoudnessNormalization(next.loudnessNormalizationEnabled);
    }
  });

  // Sync equalizer settings
  final eqService = EqualizerService();
  ref.listen<PlaybackSettings>(playbackSettingsProvider, (prev, next) {
    if (prev?.eqEnabled != next.eqEnabled) {
      eqService.setEnabled(next.eqEnabled);
    }
    if (prev?.eqPresetName != next.eqPresetName) {
      eqService.applyPreset(next.eqPresetName);
    }
  });

  // Apply persisted EQ settings on startup
  eqService.applyPreset(initialSettings.eqPresetName);
  if (initialSettings.eqEnabled) {
    eqService.setEnabled(true);
  }

  // Reload current song when quality changes
  ref.listen<String?>(playerProvider.select((s) => s.quality), (prev, next) {
    if (prev != next && notifier.state.currentSong != null && notifier.state.isPlaying) {
      notifier.playSong(
        notifier.state.currentSong!,
        queue: notifier.state.queue,
        index: notifier.state.currentIndex,
      );
    }
  });

  return notifier;
});
```

- [ ] **Step 5: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add flutter_app/lib/providers/player_provider.dart
git commit -m "feat: persist playMode and quality via PlaybackSettings"
```

---

## Task 5: Fix Settings Trigger Mechanism

**Files:**
- Modify: `flutter_app/lib/pages/settings_page.dart`

- [ ] **Step 1: Remove direct EqualizerService calls from EQ toggle**

Find and update the EQ toggle SwitchListTile:

```dart
// BEFORE
SwitchListTile(
  value: settings.eqEnabled,
  onChanged: (value) {
    ref.read(playbackSettingsProvider.notifier).setEqEnabled(value);
    EqualizerService().setEnabled(value);  // REMOVE THIS LINE
  },
)

// AFTER
SwitchListTile(
  value: settings.eqEnabled,
  onChanged: (value) {
    ref.read(playbackSettingsProvider.notifier).setEqEnabled(value);
  },
)
```

- [ ] **Step 2: Remove direct EqualizerService calls from preset selector**

Find and update the ChoiceChip onSelected:

```dart
// BEFORE
ChoiceChip(
  selected: isSelected,
  onSelected: (_) {
    ref.read(playbackSettingsProvider.notifier).setEqPreset(preset.name);
    EqualizerService().applyPreset(preset.name);  // REMOVE THIS LINE
  },
)

// AFTER
ChoiceChip(
  selected: isSelected,
  onSelected: (_) {
    ref.read(playbackSettingsProvider.notifier).setEqPreset(preset.name);
  },
)
```

- [ ] **Step 3: Remove unused EqualizerService import if present**

Check if `EqualizerService` import is still needed. If not used elsewhere in the file, remove it.

- [ ] **Step 4: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 5: Test EQ toggle**

Run app, toggle EQ on/off, verify audio changes immediately.

- [ ] **Step 6: Commit**

```bash
git add flutter_app/lib/pages/settings_page.dart
git commit -m "fix: remove direct service calls, use provider listeners only"
```

---

## Task 6: Create PaginatedListView Widget

**Files:**
- Create: `flutter_app/lib/widgets/common/paginated_list_view.dart`

- [ ] **Step 1: Create the file with imports**

```dart
import 'package:flutter/material.dart';
import '../../models/pagination.dart';
```

- [ ] **Step 2: Add the widget class with parameters**

```dart
/// Generic paginated list view supporting ListView and GridView layouts.
///
/// Usage:
/// ```dart
/// PaginatedListView<Song>(
///   fetchItems: (page, search) async {
///     final response = await api.listSongs(page: page, search: search);
///     return (items: response.songs, pagination: response.pagination);
///   },
///   itemBuilder: (context, song, index) => SongListTile(song: song),
///   showSearch: true,
/// )
/// ```
class PaginatedListView<T> extends StatefulWidget {
  /// Fetches items for a given page and optional search query.
  /// Returns a Record containing items list and pagination info.
  final Future<({List<T> items, Pagination pagination})> Function(int page, String? search) fetchItems;
  
  /// Builds a single item widget (for ListView layout).
  final Widget Function(BuildContext context, T item, int index) itemBuilder;
  
  /// Builds a grid item widget (for GridView layout).
  /// If provided, uses GridView instead of ListView.
  final Widget Function(BuildContext context, T item, int index)? gridItemBuilder;
  
  /// Grid delegate for GridView layout.
  /// Only used when gridItemBuilder is provided.
  final SliverGridDelegate? gridDelegate;
  
  /// Whether to show search bar.
  final bool showSearch;
  
  /// Search hint text.
  final String? searchHint;
  
  /// Widget to show when list is empty.
  final Widget? emptyWidget;
  
  /// Items per page (default: 50).
  final int pageSize;
  
  /// Whether to show divider between items.
  final bool showDivider;
  
  /// Padding around the list.
  final EdgeInsetsGeometry? padding;
  
  /// Scroll physics.
  final ScrollPhysics? physics;
  
  /// Whether the list should shrink wrap.
  final bool shrinkWrap;

  /// Extracts a stable key for each item.
  final String Function(T item)? keyExtractor;

  /// Widget to show when loading fails.
  final Widget? errorWidget;

  const PaginatedListView({
    super.key,
    required this.fetchItems,
    required this.itemBuilder,
    this.gridItemBuilder,
    this.gridDelegate,
    this.showSearch = false,
    this.searchHint,
    this.emptyWidget,
    this.pageSize = 50,
    this.showDivider = true,
    this.padding,
    this.physics,
    this.shrinkWrap = false,
    this.keyExtractor,
    this.errorWidget,
  });

  @override
  State<PaginatedListView<T>> createState() => _PaginatedListViewState<T>();
}
```

- [ ] **Step 3: Add state class with fields**

```dart
class _PaginatedListViewState<T> extends State<PaginatedListView<T>> {
  final List<T> _items = [];
  Pagination? _pagination;
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasError = false;
  String? _errorMessage;
  int _currentPage = 1;
  String? _search;
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  bool _isLoadingMoreGuard = false;
```

- [ ] **Step 4: Add initState and dispose**

```dart
@override
void initState() {
  super.initState();
  _loadItems();
  _scrollController.addListener(_onScroll);
}

@override
void dispose() {
  _searchController.dispose();
  _scrollController.dispose();
  super.dispose();
}
```

- [ ] **Step 5: Add _onScroll method**

```dart
void _onScroll() {
  if (_scrollController.position.pixels >=
      _scrollController.position.maxScrollExtent - 200) {
    _loadMore();
  }
}
```

- [ ] **Step 6: Add _loadItems method**

```dart
Future<void> _loadItems({bool refresh = false}) async {
  if (refresh) {
    setState(() {
      _items.clear();
      _currentPage = 1;
      _loading = true;
      _hasError = false;
      _errorMessage = null;
    });
  }

  try {
    final response = await widget.fetchItems(_currentPage, _search);
    setState(() {
      if (refresh || _currentPage == 1) {
        _items.clear();
      }
      _items.addAll(response.items);
      _pagination = response.pagination;
      _loading = false;
      _hasError = false;
    });
  } catch (e) {
    setState(() {
      _loading = false;
      _hasError = true;
      _errorMessage = e.toString();
    });
  }
}
```

- [ ] **Step 7: Add _loadMore method**

```dart
Future<void> _loadMore() async {
  if (_isLoadingMoreGuard || _loadingMore || _pagination == null ||
      _currentPage >= _pagination!.totalPages) {
    return;
  }

  _isLoadingMoreGuard = true;
  setState(() => _loadingMore = true);
  _currentPage++;

  try {
    final response = await widget.fetchItems(_currentPage, _search);
    setState(() {
      _items.addAll(response.items);
      _pagination = response.pagination;
      _loadingMore = false;
    });
  } catch (e) {
    setState(() => _loadingMore = false);
    _currentPage--; // Revert page on error
  } finally {
    _isLoadingMoreGuard = false;
  }
}
```

- [ ] **Step 8: Add build method**

```dart
@override
Widget build(BuildContext context) {
  return Column(
    children: [
      if (widget.showSearch) _buildSearchBar(),
      Expanded(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _hasError && _items.isEmpty
                ? _buildErrorState()
                : _items.isEmpty
                    ? widget.emptyWidget ?? const Center(child: Text('暂无数据'))
                    : _buildList(),
      ),
    ],
  );
}
```

- [ ] **Step 9: Add _buildErrorState method**

```dart
Widget _buildErrorState() {
  return widget.errorWidget ?? Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.error_outline, size: 48, color: Colors.grey),
        const SizedBox(height: 16),
        Text(_errorMessage ?? '加载失败', style: const TextStyle(color: Colors.grey)),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: () => _loadItems(refresh: true),
          child: const Text('重试'),
        ),
      ],
    ),
  );
}
```

- [ ] **Step 10: Add _buildSearchBar method**

```dart
Widget _buildSearchBar() {
  return Padding(
    padding: const EdgeInsets.all(16),
    child: TextField(
      controller: _searchController,
      decoration: InputDecoration(
        hintText: widget.searchHint ?? '搜索...',
        prefixIcon: const Icon(Icons.search),
        suffixIcon: _searchController.text.isNotEmpty
            ? IconButton(
                icon: const Icon(Icons.clear),
                onPressed: () {
                  _searchController.clear();
                  setState(() => _search = null);
                  _loadItems(refresh: true);
                },
              )
            : null,
        filled: true,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
      ),
      onSubmitted: (v) {
        setState(() => _search = v.isEmpty ? null : v);
        _loadItems(refresh: true);
      },
    ),
  );
}
```

- [ ] **Step 11: Add _buildList method**

```dart
Widget _buildList() {
  if (widget.gridItemBuilder != null) {
    return GridView.builder(
      controller: _scrollController,
      padding: widget.padding ?? const EdgeInsets.all(16),
      gridDelegate: widget.gridDelegate ??
          const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 180,
            childAspectRatio: 0.75,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
      itemCount: _items.length + (_loadingMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == _items.length) {
          return const Center(child: CircularProgressIndicator());
        }
        final itemData = _items[index];
        return KeyedSubtree(
          key: widget.keyExtractor != null ? ValueKey(widget.keyExtractor!(itemData)) : null,
          child: widget.gridItemBuilder!(context, itemData, index),
        );
      },
    );
  }
  
  return ListView.builder(
    controller: _scrollController,
    padding: widget.padding,
    physics: widget.physics,
    shrinkWrap: widget.shrinkWrap,
    itemCount: _items.length + (_loadingMore ? 1 : 0),
    itemBuilder: (context, index) {
      if (index == _items.length) {
        return const Center(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: CircularProgressIndicator(),
          ),
        );
      }

      final itemData = _items[index];
      final item = widget.itemBuilder(context, itemData, index);

      if (widget.showDivider && index < _items.length - 1) {
        return Column(
          key: widget.keyExtractor != null ? ValueKey(widget.keyExtractor!(itemData)) : null,
          children: [item, const Divider(height: 1)],
        );
      }

      return KeyedSubtree(
        key: widget.keyExtractor != null ? ValueKey(widget.keyExtractor!(itemData)) : null,
        child: item,
      );
    },
  );
}
```

- [ ] **Step 12: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 13: Commit**

```bash
git add flutter_app/lib/widgets/common/paginated_list_view.dart
git commit -m "feat: create PaginatedListView widget with pagination support"
```

---

## Task 7: Update Library Page with PaginatedListView

**Files:**
- Modify: `flutter_app/lib/pages/library_page.dart`

- [ ] **Step 1: Add PaginatedListView import**

```dart
import '../widgets/common/paginated_list_view.dart';
```

- [ ] **Step 2: Replace ListView with PaginatedListView**

Replace the entire build method body to use PaginatedListView:

```dart
@override
Widget build(BuildContext context) {
  return Scaffold(
    appBar: AppBar(
      title: const Text('曲库'),
    ),
    body: PaginatedListView<Song>(
      fetchItems: (page, search) async {
        final api = ref.read(apiClientProvider);
        final result = await api.listSongs(page: page, limit: 50, search: search);
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
              queue: [], // Will be populated by PaginatedListView
              index: index,
            );
          },
        );
      },
      showSearch: true,
      searchHint: '搜索歌曲...',
      keyExtractor: (song) => song.id.toString(),
    ),
  );
}
```

- [ ] **Step 3: Remove unused state and methods**

Remove:
- `_songs` list
- `_pagination`
- `_loading`
- `_currentPage`
- `_search`
- `_searchController`
- `_loadSongs()` method

- [ ] **Step 4: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add flutter_app/lib/pages/library_page.dart
git commit -m "refactor: use PaginatedListView in library page"
```

---

## Task 8: Update Artists Page with PaginatedListView

**Files:**
- Modify: `flutter_app/lib/pages/artists_page.dart`

- [ ] **Step 1: Add PaginatedListView import**

```dart
import '../widgets/common/paginated_list_view.dart';
```

- [ ] **Step 2: Replace ListView with PaginatedListView**

```dart
@override
Widget build(BuildContext context) {
  return Scaffold(
    appBar: AppBar(title: const Text('歌手')),
    body: PaginatedListView<Artist>(
      fetchItems: (page, search) async {
        final api = ref.read(apiClientProvider);
        final result = await api.listArtists(page: page, limit: 50, search: search);
        return (items: result.artists, pagination: result.pagination);
      },
      itemBuilder: (context, artist, index) {
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
      showSearch: true,
      searchHint: '搜索歌手...',
      keyExtractor: (artist) => artist.id.toString(),
    ),
  );
}
```

- [ ] **Step 3: Remove unused state and methods**

Remove:
- `_artists` list
- `_loading`
- `_load()` method

- [ ] **Step 4: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add flutter_app/lib/pages/artists_page.dart
git commit -m "refactor: use PaginatedListView in artists page"
```

---

## Task 9: Update Albums Page with PaginatedListView

**Files:**
- Modify: `flutter_app/lib/pages/albums_page.dart`

- [ ] **Step 1: Add PaginatedListView import**

```dart
import '../widgets/common/paginated_list_view.dart';
```

- [ ] **Step 2: Replace GridView with PaginatedListView**

```dart
@override
Widget build(BuildContext context) {
  return Scaffold(
    appBar: AppBar(title: const Text('专辑')),
    body: PaginatedListView<Album>(
      fetchItems: (page, search) async {
        final api = ref.read(apiClientProvider);
        final result = await api.listAlbums(page: page, limit: 50, search: search);
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
      showSearch: true,
      searchHint: '搜索专辑...',
      keyExtractor: (album) => album.id.toString(),
    ),
  );
}
```

- [ ] **Step 3: Remove unused state and methods**

Remove:
- `_albums` list
- `_loading`
- `_load()` method

- [ ] **Step 4: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add flutter_app/lib/pages/albums_page.dart
git commit -m "refactor: use PaginatedListView in albums page"
```

---

## Task 10: Update Search Page with PaginatedListView

**Files:**
- Modify: `flutter_app/lib/pages/search_page.dart`

- [ ] **Step 1: Add PaginatedListView import**

```dart
import '../widgets/common/paginated_list_view.dart';
```

- [ ] **Step 2: Replace ListView with PaginatedListView**

```dart
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
              style: AppTextStyles.bodyMedium,
            ),
          )
        : PaginatedListView<Song>(
            key: ValueKey(_query), // Force new state when query changes
            fetchItems: (page, search) async {
              final api = ref.read(apiClientProvider);
              final result = await api.listSongs(page: page, limit: 50, search: _query);
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
              );
            },
            keyExtractor: (song) => song.id.toString(),
          ),
  );
}
```

- [ ] **Step 3: Remove unused state and methods**

Remove:
- `_results` list
- `_loading`
- `_search()` method

- [ ] **Step 4: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add flutter_app/lib/pages/search_page.dart
git commit -m "refactor: use PaginatedListView in search page"
```

---

## Task 11: Create SongSearchDelegate

**Files:**
- Create: `flutter_app/lib/widgets/common/song_search_delegate.dart`

- [ ] **Step 1: Create the file with imports**

```dart
import 'package:flutter/material.dart';
import '../../models/song.dart';
```

- [ ] **Step 2: Add SongSearchDelegate class**

```dart
class SongSearchDelegate extends SearchDelegate<Song?> {
  final List<Song> songs;
  final void Function(Song) onSelected;

  SongSearchDelegate({
    required this.songs,
    required this.onSelected,
  });

  @override
  List<Widget> buildActions(BuildContext context) {
    return [
      IconButton(
        icon: const Icon(Icons.clear),
        onPressed: () => query = '',
      ),
    ];
  }

  @override
  Widget buildLeading(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back),
      onPressed: () => close(context, null),
    );
  }

  @override
  Widget buildResults(BuildContext context) {
    return _buildSongList(context);
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    return _buildSongList(context);
  }

  Widget _buildSongList(BuildContext context) {
    final filtered = songs.where((song) {
      final queryLower = query.toLowerCase();
      return song.title.toLowerCase().contains(queryLower) ||
             song.artist.toLowerCase().contains(queryLower) ||
             song.album.toLowerCase().contains(queryLower);
    }).toList();

    if (filtered.isEmpty) {
      return const Center(child: Text('未找到匹配的歌曲'));
    }

    return ListView.builder(
      itemCount: filtered.length,
      itemBuilder: (context, index) {
        final song = filtered[index];
        return ListTile(
          title: Text(song.title),
          subtitle: Text(song.artist),
          onTap: () {
            onSelected(song);
            close(context, song);
          },
        );
      },
    );
  }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add flutter_app/lib/widgets/common/song_search_delegate.dart
git commit -m "feat: create SongSearchDelegate for song filtering"
```

---

## Task 12: Add Search to Playlist Detail Page

**Files:**
- Modify: `flutter_app/lib/pages/playlist_detail_page.dart`

- [ ] **Step 1: Add SongSearchDelegate import**

```dart
import '../widgets/common/song_search_delegate.dart';
```

- [ ] **Step 2: Add search icon to AppBar**

Update the build method's AppBar:

```dart
appBar: AppBar(
  title: Text(_playlist?.name ?? '歌单'),
  actions: [
    if (_playlist?.songs != null && _playlist!.songs!.isNotEmpty)
      IconButton(
        icon: const Icon(Icons.search),
        onPressed: () => _showSearch(),
      ),
  ],
),
```

- [ ] **Step 3: Add _showSearch method**

```dart
void _showSearch() {
  showSearch(
    context: context,
    delegate: SongSearchDelegate(
      songs: _playlist!.songs!,
      onSelected: (song) {
        final index = _playlist!.songs!.indexOf(song);
        ref.read(playerProvider.notifier).playSong(
          song,
          queue: _playlist!.songs!,
          index: index,
        );
      },
    ),
  );
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add flutter_app/lib/pages/playlist_detail_page.dart
git commit -m "feat: add search to playlist detail page"
```

---

## Task 13: Add Search to Artist Detail Page

**Files:**
- Modify: `flutter_app/lib/pages/artist_detail_page.dart`

- [ ] **Step 1: Add SongSearchDelegate import**

```dart
import '../widgets/common/song_search_delegate.dart';
```

- [ ] **Step 2: Add search icon to AppBar**

```dart
appBar: AppBar(
  title: Text(_artist?.name ?? '歌手'),
  actions: [
    if (_artist?.albums != null && _artist!.albums!.isNotEmpty)
      IconButton(
        icon: const Icon(Icons.search),
        onPressed: () => _showSearch(),
      ),
  ],
),
```

- [ ] **Step 3: Add _showSearch method**

```dart
void _showSearch() {
  // Flatten songs from all albums
  final allSongs = <Song>[];
  for (final album in _artist!.albums!) {
    if (album.songs != null) {
      allSongs.addAll(album.songs!);
    }
  }

  showSearch(
    context: context,
    delegate: SongSearchDelegate(
      songs: allSongs,
      onSelected: (song) {
        final index = allSongs.indexOf(song);
        ref.read(playerProvider.notifier).playSong(
          song,
          queue: allSongs,
          index: index,
        );
      },
    ),
  );
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add flutter_app/lib/pages/artist_detail_page.dart
git commit -m "feat: add search to artist detail page"
```

---

## Task 14: Add Search to Album Detail Page

**Files:**
- Modify: `flutter_app/lib/pages/album_detail_page.dart`

- [ ] **Step 1: Add SongSearchDelegate import**

```dart
import '../widgets/common/song_search_delegate.dart';
```

- [ ] **Step 2: Add search icon to AppBar**

```dart
appBar: AppBar(
  title: Text(_album?.title ?? '专辑'),
  actions: [
    if (_album?.songs != null && _album!.songs!.isNotEmpty)
      IconButton(
        icon: const Icon(Icons.search),
        onPressed: () => _showSearch(),
      ),
  ],
),
```

- [ ] **Step 3: Add _showSearch method**

```dart
void _showSearch() {
  showSearch(
    context: context,
    delegate: SongSearchDelegate(
      songs: _album!.songs!,
      onSelected: (song) {
        final index = _album!.songs!.indexOf(song);
        ref.read(playerProvider.notifier).playSong(
          song,
          queue: _album!.songs!,
          index: index,
        );
      },
    ),
  );
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add flutter_app/lib/pages/album_detail_page.dart
git commit -m "feat: add search to album detail page"
```

---

## Task 15: Final Verification

- [ ] **Step 1: Run full analysis**

Run: `cd flutter_app && flutter analyze`
Expected: No errors

- [ ] **Step 2: Run tests**

Run: `cd flutter_app && flutter test`
Expected: All tests pass

- [ ] **Step 3: Build APK**

Run: `cd flutter_app && flutter build apk --debug`
Expected: Build succeeds

- [ ] **Step 4: Manual testing checklist**

Test each feature:
- [ ] Playlists page shows user's playlists
- [ ] Library page infinite scroll works
- [ ] Artists page infinite scroll works
- [ ] Albums page infinite scroll works
- [ ] Search page infinite scroll works
- [ ] EQ toggle takes effect immediately
- [ ] EQ preset change takes effect immediately
- [ ] Quality change reloads current song
- [ ] Play mode persists across app restart
- [ ] Quality persists across app restart
- [ ] Search in playlist detail works
- [ ] Search in artist detail works
- [ ] Search in album detail works

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Flutter issues fix - playlists, pagination, settings, search"
```

---

## Summary

**Total Tasks:** 15
**Estimated Time:** 4-5 hours
**Files Created:** 2
**Files Modified:** 11

**Key Features Implemented:**
1. ✅ Playlists debugging and fix
2. ✅ PaginatedListView widget with Record-based API
3. ✅ Settings persistence for playMode and quality
4. ✅ Settings trigger mechanism via provider listeners
5. ✅ SongSearchDelegate for detail page filtering
