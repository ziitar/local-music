import 'package:flutter/material.dart';
import '../../models/song.dart';

/// Search delegate for filtering songs by title, artist, or album.
///
/// Usage:
/// ```dart
/// showSearch(
///   context: context,
///   delegate: SongSearchDelegate(
///     songs: playlist.songs,
///     onSelected: (song) => playSong(song),
///   ),
/// );
/// ```
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
