import '../../models/lyrics.dart';

/// LRC format parser.
class LrcParser {
  static final _timeRegex = RegExp(r'\[(\d{2}):(\d{2})\.(\d{2,3})\]');

  /// Parse LRC string into lyric lines.
  static List<LyricLine> parse(String lrc, {String? translatedLrc}) {
    final lines = _parseLrc(lrc);
    final translatedLines = translatedLrc != null ? _parseLrc(translatedLrc) : <LyricLine>[];

    if (translatedLines.isEmpty) return lines;

    // Merge translated lyrics
    final translatedMap = <int, String>{};
    for (final t in translatedLines) {
      translatedMap[t.timestamp.inMilliseconds] = t.text;
    }

    return lines.map((line) {
      final translated = translatedMap[line.timestamp.inMilliseconds];
      return LyricLine(
        timestamp: line.timestamp,
        text: line.text,
        translatedText: translated,
      );
    }).toList();
  }

  static List<LyricLine> _parseLrc(String lrc) {
    final lines = <LyricLine>[];

    for (final rawLine in lrc.split('\n')) {
      final line = rawLine.trim();
      if (line.isEmpty) continue;

      final matches = _timeRegex.allMatches(line).toList();
      if (matches.isEmpty) continue;

      // Extract text after all timestamps
      final text = line.substring(matches.last.end).trim();
      if (text.isEmpty) continue;

      // Create a line for each timestamp
      for (final match in matches) {
        final minutes = int.parse(match.group(1)!);
        final seconds = int.parse(match.group(2)!);
        final millis = match.group(3)!.length == 2
            ? int.parse(match.group(3)!) * 10
            : int.parse(match.group(3)!);

        lines.add(LyricLine(
          timestamp: Duration(
            minutes: minutes,
            seconds: seconds,
            milliseconds: millis,
          ),
          text: text,
        ));
      }
    }

    lines.sort((a, b) => a.timestamp.compareTo(b.timestamp));
    return lines;
  }
}
