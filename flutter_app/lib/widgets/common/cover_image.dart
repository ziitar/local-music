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
    return ClipRRect(
      borderRadius: borderRadius,
      child: SizedBox(
        width: size,
        height: size,
        child: imageUrl != null && imageUrl!.isNotEmpty
            ? Image.network(
                imageUrl!,
                fit: fit,
                errorBuilder: (_, __, ___) => _placeholder(),
              )
            : _placeholder(),
      ),
    );
  }

  Widget _placeholder() {
    return Container(
      color: AppColors.surfaceVariant,
      child: Center(
        child: Icon(Icons.music_note, color: AppColors.textTertiary, size: iconSize),
      ),
    );
  }
}
