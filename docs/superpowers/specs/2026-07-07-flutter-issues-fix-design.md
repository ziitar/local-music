# Flutter Issues Fix Design

## Overview

This document outlines the design for fixing 5 critical issues in the Flutter mobile app to align with the web app's functionality and user experience.

## Issues Summary

1. **Playlists not showing** - API returns empty array despite web showing playlists
2. **Infinite loading broken** - Library page stuck loading, other pages don't trigger load more
3. **Settings not triggering immediately** - EQ and quality changes don't take effect instantly
4. **Settings not persisting** - Play mode and quality reset on app restart
5. **Search filtering missing** - Detail pages lack search functionality

## Design Decisions

### Decision 1: Debug Playlists Issue
- **Approach**: Add Logger-based debugging to identify root cause
- **Rationale**: Need to see actual API response to understand why it returns empty

### Decision 2: Unified Paginated List Component
- **Approach**: Create `PaginatedListView` widget supporting both ListView and GridView
- **Rationale**: Code reuse, consistent behavior, easier maintenance
- **User Choice**: Fully customizable layout support

### Decision 3: Unified Settings Trigger Mechanism
- **Approach**: Remove direct service calls from settings page, use provider listeners only
- **Rationale**: Single responsibility, avoid duplicate calls, easier to debug

### Decision 4: Centralized Settings Persistence
- **Approach**: Add `playMode` and `quality` to `PlaybackSettings`
- **Rationale**: All playback settings in one place, consistent persistence

### Decision 5: AppBar-embedded Search
- **Approach**: Add search icon in AppBar that opens search delegate
- **Rationale**: Consistent with Material Design patterns, user preference

## Detailed Design

### 1. Playlists Debugging

**Files to modify:**
- `flutter_app/lib/pages/playlists_page.dart`

**Changes:**
```dart
import 'package:logger/logger.dart';

class _PlaylistsPageState extends ConsumerState<PlaylistsPage> {
  final _logger = Logger();
  
  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      _logger.d('Fetching playlists from ${api.baseUrl}/api/playlists');
      
      final playlists = await api.listPlaylists();
      _logger.d('Playlists fetched: ${playlists.length} items');
      
      if (playlists.isEmpty) {
        _logger.w('Playlists list is empty');
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
}
```

**Debug Steps:**
1. Run app and navigate to playlists page
2. Check console output for Logger messages
3. Identify if issue is:
   - Network error (connection failed)
   - Auth error (401 Unauthorized)
   - Empty response (API returns [])
   - Parsing error (JSON mismatch)

---

### 2. PaginatedListView Component

**New File:** `flutter_app/lib/widgets/common/paginated_list_view.dart`

**Component Interface:**
```dart
/// Generic paginated list view supporting ListView and GridView layouts.
///
/// Usage:
/// ```dart
/// PaginatedListView<Song>(
///   fetchItems: (page, search) => api.listSongs(page: page, search: search),
///   itemBuilder: (context, song, index) => SongListTile(song: song),
///   showSearch: true,
/// )
/// ```
class PaginatedListView<T> extends StatefulWidget {
  /// Fetches items for a given page and optional search query.
  /// Returns a PaginatedResponse containing items and pagination info.
  final Future<PaginatedResponse<T>> Function(int page, String? search) fetchItems;
  
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
  });
}

class _PaginatedListViewState<T> extends State<PaginatedListView<T>> {
  final List<T> _items = [];
  Pagination? _pagination;
  bool _loading = true;
  bool _loadingMore = false;
  int _currentPage = 1;
  String? _search;
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  
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
  
  void _onScroll() {
    if (_scrollController.position.pixels >= 
        _scrollController.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }
  
  Future<void> _loadItems({bool refresh = false}) async {
    if (refresh) {
      setState(() {
        _items.clear();
        _currentPage = 1;
        _loading = true;
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
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }
  
  Future<void> _loadMore() async {
    if (_loadingMore || _pagination == null || 
        _currentPage >= _pagination!.totalPages) {
      return;
    }
    
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
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (widget.showSearch) _buildSearchBar(),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _items.isEmpty
                  ? widget.emptyWidget ?? const Center(child: Text('暂无数据'))
                  : _buildList(),
        ),
      ],
    );
  }
  
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
          return widget.gridItemBuilder!(context, _items[index], index);
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
        
        final item = widget.itemBuilder(context, _items[index], index);
        
        if (widget.showDivider && index < _items.length - 1) {
          return Column(
            children: [item, const Divider(height: 1)],
          );
        }
        
        return item;
      },
    );
  }
}
```

**Supporting Model:**
```dart
// flutter_app/lib/models/pagination.dart
@JsonSerializable()
class PaginatedResponse<T> {
  final List<T> items;
  final Pagination pagination;
  
  const PaginatedResponse({required this.items, required this.pagination});
}
```

**Pages to update:**
- `library_page.dart` - Replace with PaginatedListView
- `artists_page.dart` - Replace with PaginatedListView
- `albums_page.dart` - Replace with PaginatedListView
- `search_page.dart` - Replace with PaginatedListView

---

### 3. Settings Trigger Mechanism

**Files to modify:**
- `flutter_app/lib/pages/settings_page.dart`
- `flutter_app/lib/providers/player_provider.dart`
- `flutter_app/lib/services/equalizer_service.dart`

**Changes in settings_page.dart:**
```dart
// BEFORE (incorrect - direct service call)
SwitchListTile(
  value: settings.eqEnabled,
  onChanged: (value) {
    ref.read(playbackSettingsProvider.notifier).setEqEnabled(value);
    EqualizerService().setEnabled(value);  // REMOVE THIS
  },
)

// AFTER (correct - only update provider)
SwitchListTile(
  value: settings.eqEnabled,
  onChanged: (value) {
    ref.read(playbackSettingsProvider.notifier).setEqEnabled(value);
  },
)
```

**Changes in player_provider.dart:**
```dart
// Ensure EqualizerService is singleton
class EqualizerService {
  static final EqualizerService _instance = EqualizerService._();
  factory EqualizerService() => _instance;
  EqualizerService._();
  
  // ... existing code
}

// In playerProvider, ensure listeners are set up correctly
final playerProvider = StateNotifierProvider<PlayerNotifier, PlayerState>((ref) {
  final handler = ref.watch(audioHandlerProvider);
  final api = ref.watch(apiClientProvider);
  final cache = ref.watch(cacheServiceProvider);
  final loudness = ref.watch(loudnessServiceProvider);
  final notifier = PlayerNotifier(handler, api, cache, loudness);

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
  final initialSettings = ref.read(playbackSettingsProvider);
  eqService.applyPreset(initialSettings.eqPresetName);
  if (initialSettings.eqEnabled) {
    eqService.setEnabled(true);
  }

  return notifier;
});
```

---

### 4. Settings Persistence

**Files to modify:**
- `flutter_app/lib/providers/settings_provider.dart`
- `flutter_app/lib/providers/player_provider.dart`
- `flutter_app/lib/config.dart`

**Changes in config.dart:**
```dart
class AppConfig {
  // ... existing keys
  
  // New persistence keys
  static const String storageKeyPlayMode = 'play_mode';
  static const String storageKeyQuality = 'quality';
}
```

**Changes in settings_provider.dart:**
```dart
class PlaybackSettings {
  final bool eqEnabled;
  final String eqPresetName;
  final bool loudnessNormalizationEnabled;
  final String playMode;  // NEW
  final String? quality;  // NEW

  const PlaybackSettings({
    this.eqEnabled = false,
    this.eqPresetName = 'flat',
    this.loudnessNormalizationEnabled = true,
    this.playMode = 'sequential',  // NEW
    this.quality,  // NEW
  });

  PlaybackSettings copyWith({
    bool? eqEnabled,
    String? eqPresetName,
    bool? loudnessNormalizationEnabled,
    String? playMode,  // NEW
    String? quality,  // NEW
  }) {
    return PlaybackSettings(
      eqEnabled: eqEnabled ?? this.eqEnabled,
      eqPresetName: eqPresetName ?? this.eqPresetName,
      loudnessNormalizationEnabled: loudnessNormalizationEnabled ?? this.loudnessNormalizationEnabled,
      playMode: playMode ?? this.playMode,  // NEW
      quality: quality ?? this.quality,  // NEW
    );
  }
}

class PlaybackSettingsNotifier extends StateNotifier<PlaybackSettings> {
  final StorageService _storage;

  PlaybackSettingsNotifier(this._storage) : super(const PlaybackSettings()) {
    _load();
  }

  void _load() {
    state = PlaybackSettings(
      eqEnabled: _storage.prefs.getBool(AppConfig.storageKeyEqEnabled) ?? false,
      eqPresetName: _storage.prefs.getString(AppConfig.storageKeyEqPreset) ?? 'flat',
      loudnessNormalizationEnabled: _storage.prefs.getBool(AppConfig.storageKeyLoudnessNormEnabled) ?? true,
      playMode: _storage.prefs.getString(AppConfig.storageKeyPlayMode) ?? 'sequential',  // NEW
      quality: _storage.prefs.getString(AppConfig.storageKeyQuality),  // NEW
    );
  }

  // ... existing setters

  void setPlayMode(String mode) {  // NEW
    state = state.copyWith(playMode: mode);
    _storage.prefs.setString(AppConfig.storageKeyPlayMode, mode);
  }

  void setQuality(String? quality) {  // NEW
    state = state.copyWith(quality: quality);
    if (quality != null) {
      _storage.prefs.setString(AppConfig.storageKeyQuality, quality);
    } else {
      _storage.prefs.remove(AppConfig.storageKeyQuality);
    }
  }
}
```

**Changes in player_provider.dart:**
```dart
class PlayerNotifier extends StateNotifier<PlayerState> {
  final AudioPlayerHandler _handler;
  final ApiClient _api;
  final CacheService _cache;
  final LoudnessService _loudness;
  final Ref _ref;  // NEW - need ref to read settings

  PlayerNotifier(this._handler, this._api, this._cache, this._loudness, this._ref)
      : super(const PlayerState()) {
    _init();
    _loadPersistedSettings();  // NEW
  }

  void _loadPersistedSettings() {  // NEW
    final settings = _ref.read(playbackSettingsProvider);
    state = state.copyWith(
      playMode: PlayMode.values.firstWhere(
        (e) => e.name == settings.playMode,
        orElse: () => PlayMode.sequential,
      ),
      quality: settings.quality,
    );
  }

  // Update setPlayMode to persist
  void setPlayMode(PlayMode mode) {
    state = state.copyWith(playMode: mode);
    _ref.read(playbackSettingsProvider.notifier).setPlayMode(mode.name);
  }

  // Update setQuality to persist
  void setQuality(String? quality) {
    state = state.copyWith(quality: quality);
    _ref.read(playbackSettingsProvider.notifier).setQuality(quality);
  }
}

// Update provider to pass ref
final playerProvider = StateNotifierProvider<PlayerNotifier, PlayerState>((ref) {
  final handler = ref.watch(audioHandlerProvider);
  final api = ref.watch(apiClientProvider);
  final cache = ref.watch(cacheServiceProvider);
  final loudness = ref.watch(loudnessServiceProvider);
  return PlayerNotifier(handler, api, cache, loudness, ref);  // Pass ref
});
```

---

### 5. Search Filtering in Detail Pages

**New File:** `flutter_app/lib/widgets/common/song_search_delegate.dart`

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
             (song.album?.toLowerCase().contains(queryLower) ?? false);
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

**Changes in playlist_detail_page.dart:**
```dart
class _PlaylistDetailPageState extends ConsumerState<PlaylistDetailPage> {
  // ... existing code

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
      // ... existing body
    );
  }

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
}
```

**Similar changes for:**
- `artist_detail_page.dart`
- `album_detail_page.dart`

---

## Implementation Order

1. **Phase 1: Playlists Debug** (30 min)
   - Add Logger to playlists_page.dart
   - Test and identify root cause
   - Fix identified issue

2. **Phase 2: Settings Persistence** (1 hour)
   - Update config.dart with new keys
   - Update settings_provider.dart with new fields
   - Update player_provider.dart to use persisted settings

3. **Phase 3: Settings Trigger** (30 min)
   - Remove direct service calls from settings_page.dart
   - Ensure EqualizerService is singleton
   - Test EQ and loudness changes

4. **Phase 4: PaginatedListView** (2 hours)
   - Create PaginatedListView widget
   - Create PaginatedResponse model
   - Update library_page.dart
   - Update artists_page.dart
   - Update albums_page.dart
   - Update search_page.dart

5. **Phase 5: Search Filtering** (1 hour)
   - Create SongSearchDelegate
   - Update playlist_detail_page.dart
   - Update artist_detail_page.dart
   - Update album_detail_page.dart

## Testing

### Unit Tests
- PaginatedListView widget tests
- Settings persistence tests
- Search delegate tests

### Integration Tests
- Playlists loading flow
- Settings change → immediate effect
- Settings persistence across app restarts
- Infinite scroll behavior
- Search filtering accuracy

### Manual Testing Checklist
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

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PaginatedListView complexity | High | Start simple, add features incrementally |
| Settings state management | Medium | Use Riverpod listeners correctly |
| Search performance | Low | Client-side filtering for small lists |
| Breaking existing functionality | High | Test each change thoroughly |

## Success Criteria

1. All 5 issues resolved
2. No regression in existing functionality
3. Performance comparable to web app
4. Code follows existing patterns
5. All tests passing
