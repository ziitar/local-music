// LRC lyrics parser and sync utility
// Called by: src/pages/SongDetail.tsx
// Parses LRC format lyrics into timestamped lines
// User instruction: "歌词可以根据播放进度滚动显示"

export interface LrcLine {
  time: number;  // seconds
  text: string;
}

export function parseLrc(lrcText: string): LrcLine[] {
  const lines = lrcText.split('\n');
  const result: LrcLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  for (const line of lines) {
    const times: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = match[3].length === 2
        ? parseInt(match[3]) * 10
        : parseInt(match[3]);
      times.push(minutes * 60 + seconds + ms / 1000);
      lastIndex = match.index + match[0].length;
    }

    const text = line.slice(lastIndex).trim();
    if (text) {
      for (const time of times) {
        result.push({ time, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

// Find the active line index based on current playback time
export function findActiveLine(lines: LrcLine[], currentTime: number): number {
  if (lines.length === 0) return -1;

  let low = 0;
  let high = lines.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= currentTime) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}
