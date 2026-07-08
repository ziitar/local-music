import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../providers/player_provider.dart';
import '../../providers/providers.dart';
import '../../utils/format_duration.dart';
import '../common/cover_image.dart';

/// Compact player bar shown at the bottom of the app shell.
class PlayerBar extends ConsumerWidget {
  const PlayerBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final player = ref.watch(playerProvider);
    final song = player.currentSong;

    if (song == null) return const SizedBox.shrink();

    return GestureDetector(
      onTap: () => context.push('/song/${song.id}'),
      child: Container(
        color: colors.surfaceVariant,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Progress bar
            SliderTheme(
              data: SliderThemeData(
                activeTrackColor: colors.primary,
                inactiveTrackColor: colors.divider,
                thumbColor: colors.primary,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 4),
                overlayShape: const RoundSliderOverlayShape(overlayRadius: 8),
                trackHeight: 2,
              ),
              child: Slider(
                value: player.duration.inMilliseconds > 0
                    ? (player.position.inMilliseconds / player.duration.inMilliseconds)
                        .clamp(0.0, 1.0)
                    : 0.0,
                onChanged: (value) {
                  final pos = Duration(
                    milliseconds: (value * player.duration.inMilliseconds).round(),
                  );
                  ref.read(playerProvider.notifier).seek(pos);
                },
              ),
            ),
            // Song info + controls
            Row(
              children: [
                // Cover image
                CoverImage(
                  imageUrl: song.coverImage != null
                      ? '${ref.read(apiClientProvider).baseUrl}${song.coverImage}'
                      : null,
                  size: 40,
                  iconSize: 20,
                  borderRadius: BorderRadius.circular(4),
                ),
                const SizedBox(width: 10),
                // Title & artist
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        song.title,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        song.artist,
                        style: TextStyle(
                          color: colors.textSecondary,
                          fontSize: 11,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                // Time
                Text(
                  '${formatDuration(player.position)} / ${formatDuration(player.duration)}',
                  style: TextStyle(color: colors.textTertiary, fontSize: 11),
                ),
                const SizedBox(width: 8),
                // Play/pause
                IconButton(
                  icon: Icon(
                    player.isPlaying ? Icons.pause : Icons.play_arrow,
                    color: colors.textPrimary,
                  ),
                  onPressed: () => ref.read(playerProvider.notifier).togglePlay(),
                ),
                // Next
                IconButton(
                  icon: Icon(Icons.skip_next, color: colors.textPrimary),
                  onPressed: () => ref.read(playerProvider.notifier).next(),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
