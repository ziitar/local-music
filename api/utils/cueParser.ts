import { dirname, isAbsolute, join } from "@std/path";
import { ITrack } from "cue-parser/lib/types.d.ts";
/**
 * CUE文件解析器
 * 支持解析整轨音乐的.cue文件，提取每首歌曲的信息
 */

export interface CueTrack {
  trackNumber: number;
  title: string;
  artist: string;
  album: string;
  startTime: number; // 开始时间（秒）
  endTime?: number; // 结束时间（秒），最后一首可能没有
  index01: string; // 原始INDEX 01时间格式 MM:SS:FF
}

export interface CueSheet {
  album: string;
  artist: string;
  file: string; // 音频文件路径
  tracks: CueTrack[];
}

/**
 * 将MM:SS:FF格式转换为秒数
 * FF (frames) 是CD帧，每秒75帧
 */
export function timeToSeconds(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  if (parts.length === 3) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    const frames = parseInt(parts[2], 10);
    return minutes * 60 + seconds + frames / 75;
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return minutes * 60 + seconds;
  }
  return 0;
}

/**
 * 清理字符串值，移除引号
 */
function cleanValue(value: string): string {
  return value.replace(/^["']|["']$/g, "").trim();
}

/**
 * 解析CUE文件内容
 */
export function parseCueFile(content: string): CueSheet | null {
  const lines = content.split("\n").map((line) => line.trim()).filter((line) =>
    line.length > 0
  );

  let album = "Unknown Album";
  let artist = "Unknown Artist";
  let audioFile = "";
  const tracks: CueTrack[] = [];

  let currentTrack: Partial<CueTrack> | null = null;
  let currentTrackIndex01 = "";

  for (const line of lines) {
    const upperLine = line.toUpperCase();

    // 解析PERFORMER (艺术家)
    if (upperLine.startsWith("PERFORMER")) {
      const value = line.substring("PERFORMER".length).trim();
      if (currentTrack) {
        currentTrack.artist = cleanValue(value);
      } else {
        artist = cleanValue(value);
      }
    } // 解析TITLE (标题)
    else if (upperLine.startsWith("TITLE")) {
      const value = line.substring("TITLE".length).trim();
      if (currentTrack) {
        currentTrack.title = cleanValue(value);
      } else {
        album = cleanValue(value);
      }
    } // 解析FILE (音频文件)
    else if (upperLine.startsWith("FILE")) {
      const match = line.match(/FILE\s+["'](.+?)["']\s+/i);
      if (match) {
        audioFile = match[1];
      }
    } // 解析TRACK (音轨开始)
    else if (upperLine.startsWith("TRACK")) {
      // 保存之前的音轨
      if (currentTrack && currentTrack.trackNumber && currentTrack.title) {
        tracks.push({
          trackNumber: currentTrack.trackNumber,
          title: currentTrack.title || `Track ${currentTrack.trackNumber}`,
          artist: currentTrack.artist || artist,
          album: album,
          startTime: timeToSeconds(currentTrackIndex01 || "00:00:00"),
          index01: currentTrackIndex01 || "00:00:00",
        });
      }

      const match = line.match(/TRACK\s+(\d+)\s+/i);
      if (match) {
        currentTrack = {
          trackNumber: parseInt(match[1], 10),
        };
        currentTrackIndex01 = "";
      }
    } // 解析INDEX 01 (开始时间)
    else if (
      upperLine.startsWith("INDEX 01") || upperLine.startsWith("INDEX01")
    ) {
      const match = line.match(/INDEX\s*01\s+([\d:]+)/i);
      if (match) {
        currentTrackIndex01 = match[1];
      }
    }
  }

  // 保存最后一个音轨
  if (currentTrack && currentTrack.trackNumber && currentTrack.title) {
    tracks.push({
      trackNumber: currentTrack.trackNumber,
      title: currentTrack.title || `Track ${currentTrack.trackNumber}`,
      artist: currentTrack.artist || artist,
      album: album,
      startTime: timeToSeconds(currentTrackIndex01 || "00:00:00"),
      index01: currentTrackIndex01 || "00:00:00",
    });
  }

  if (tracks.length === 0 || !audioFile) {
    return null;
  }

  return {
    album,
    artist,
    file: audioFile,
    tracks,
  };
}

/**
 * 获取音频文件的完整路径
 * CUE文件中的路径可能是相对路径
 */
export function resolveAudioFilePath(
  cueFilePath: string,
  audioFile: string,
): string {
  // 如果是绝对路径，直接返回
  if (isAbsolute(audioFile)) {
    return audioFile;
  }
  // 使用 CUE 文件所在目录作为基础路径
  return join(dirname(cueFilePath), audioFile);
}
export function msToTime(duration: number): string {
  const seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  return `${hours.toString().padStart(2, "0")}:${
    minutes.toString().padStart(2, "0")
  }:${
    seconds
      .toString()
      .padStart(2, "0")
  }`;
}

/**
 * 计算每首歌曲的结束时间
 * 需要根据下一首歌曲的开始时间来计算
 */
export function calculateTrackEndTimes(
  tracks: ITrack[],
  totalDuration: number,
): (number | undefined)[] | undefined {
  if (tracks) {
    const result: (number | undefined)[] = [];
    tracks.reduceRight<number>((pre, current) => {
      let duration;
      const timeMap = current.indexes?.filter((item) => item.number === 1)[0]
        .time;
      const time = timeMap
        ? parseFloat(`${timeMap.min * 60 + timeMap.sec}.${timeMap.frame}`)
        : 0;
      if (!pre) {
        if (totalDuration) {
          duration = totalDuration - time;
        }
      } else {
        duration = pre - time;
      }
      if (duration) {
        result.push(duration);
      } else {
        result.push(undefined);
      }
      return time;
    }, 0);
    return result.reverse();
  }
  return undefined;
}
