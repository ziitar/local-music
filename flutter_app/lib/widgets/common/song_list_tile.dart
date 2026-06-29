import 'package:flutter/material.dart';
import '../../theme/colors.dart';
import '../../utils/format_duration.dart';

/// Reusable song list tile.
class SongListTile extends StatelessWidget {
  final String title;
  final String artist;
  final int duration;
  final int? trackNo;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final Widget? trailing;

  const SongListTile({
    super.key,
    required this.title,
    required this.artist,
    required this.duration,
    this.trackNo,
    this.onTap,
    this.onLongPress,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: SizedBox(
        width: 32,
        child: trackNo != null
            ? Text(
                '$trackNo',
                style: const TextStyle(color: AppColors.textTertiary, fontSize: 14),
                textAlign: TextAlign.center,
              )
            : const Icon(Icons.music_note, color: AppColors.textTertiary, size: 20),
      ),
      title: Text(
        title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
      ),
      subtitle: Text(
        artist,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
      ),
      trailing: trailing ?? Text(
        formatDuration(Duration(seconds: duration)),
        style: const TextStyle(color: AppColors.textTertiary, fontSize: 12),
      ),
      onTap: onTap,
      onLongPress: onLongPress,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
    );
  }
}
