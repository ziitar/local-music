import 'package:flutter/material.dart';
import '../../models/pagination.dart';

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
  final Future<({List<T> items, Pagination pagination})> Function(
      int page, String? search) fetchItems;

  /// Builds a single item widget (for ListView layout).
  /// Required when gridItemBuilder is not provided.
  final Widget Function(BuildContext context, T item, int index)? itemBuilder;

  /// Builds a grid item widget (for GridView layout).
  /// If provided, uses GridView instead of ListView.
  final Widget Function(BuildContext context, T item, int index)?
      gridItemBuilder;

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
    this.itemBuilder,
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

  Future<void> _loadMore() async {
    if (_isLoadingMoreGuard ||
        _loadingMore ||
        _pagination == null ||
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
                      ? widget.emptyWidget ??
                          const Center(child: Text('暂无数据'))
                      : _buildList(),
        ),
      ],
    );
  }

  Widget _buildErrorState() {
    return widget.errorWidget ??
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.grey),
              const SizedBox(height: 16),
              Text(_errorMessage ?? '加载失败',
                  style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => _loadItems(refresh: true),
                child: const Text('重试'),
              ),
            ],
          ),
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
          final itemData = _items[index];
          return KeyedSubtree(
            key: widget.keyExtractor != null
                ? ValueKey(widget.keyExtractor!(itemData))
                : null,
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
        final item = widget.itemBuilder!(context, itemData, index);

        if (widget.showDivider && index < _items.length - 1) {
          return Column(
            key: widget.keyExtractor != null
                ? ValueKey(widget.keyExtractor!(itemData))
                : null,
            children: [item, const Divider(height: 1)],
          );
        }

        return KeyedSubtree(
          key: widget.keyExtractor != null
              ? ValueKey(widget.keyExtractor!(itemData))
              : null,
          child: item,
        );
      },
    );
  }
}
