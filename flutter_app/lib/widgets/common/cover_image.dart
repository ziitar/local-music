import 'package:flutter/material.dart';
import '../../theme/colors.dart';

/// Reusable cover image widget that loads from network with fallback placeholder.
class CoverImage extends StatelessWidget {
  final String? imageUrl;
  final double size;
  final double iconSize;
  final BorderRadius borderRadius;
  final BoxFit fit;

  const CoverImage({
    super.key,
    this.imageUrl,
    required this.size,
    this.iconSize = 48,
    this.borderRadius = const BorderRadius.all(Radius.circular(8)),
    this.fit = BoxFit.cover,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return ClipRRect(
      borderRadius: borderRadius,
      child: SizedBox(
        width: size,
        height: size,
        child: imageUrl != null && imageUrl!.isNotEmpty
            ? Image.network(
                imageUrl!,
                fit: fit,
                errorBuilder: (_, _, _) => _placeholder(colors),
              )
            : _placeholder(colors),
      ),
    );
  }

  Widget _placeholder(AppColors colors) {
    return Container(
      color: colors.surfaceVariant,
      child: Center(
        child: Icon(
          Icons.music_note,
          color: colors.textTertiary,
          size: iconSize,
        ),
      ),
    );
  }
}
