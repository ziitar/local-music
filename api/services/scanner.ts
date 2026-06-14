import { File } from "node-taglib-sharp";
import { sql } from "../services/db.ts";
import { exists, walk } from "@std/fs";
import { basename, dirname, extname } from "@std/path";
import * as musicMetadata from "music-metadata";
import {
  calculateTrackEndTimes,
  resolveAudioFilePath,
} from "../utils/cueParser.ts";
import { parse as parseCue } from "cue-parser";
import {
  cleanArtist,
  cleanTitle,
  compareBitrate,
  getDbValue,
  isSimilar,
  normalizeText,
  processAllArtists,
  splitArtistWithAlias,
} from "../utils/index.ts";
import { getCueCover, getOrCreateCover, saveCoverFromData, clearCoverCache } from "../utils/coverExtractor.ts";
import { calculateFileHash } from "../utils/hash.ts";
const SUPPORTED_FORMATS = [
  ".mp3",
  ".flac",
  ".ogg",
  ".m4a",
  ".aac",
  ".wma",
  ".wav",
  ".ape",
];
const CUE_FORMATS = [".cue"];
// 常见的整轨音乐格式（通常与.cue文件配对）
const WHOLE_TRACK_FORMATS = [".wav", ".ape", ".flac", ".wv"];

export interface SongMetadata {
  title: string;
  artist: string; // Legacy single artist string for backward compatibility
  artists: string[]; // Array of individual artists
  album: string;
  duration: number;
  quality: string;
  fileSize: number;
  format: string;
  filePath: string;
  originalBitrate?: number;
  trackNo?: number;
  trackTotal?: number;
  year?: number;
  coverPath?: string;
  coverData?: {
    data: Uint8Array;
    mimeType: string;
  };
  // 整轨音乐相关字段
  isCueTrack?: boolean;
  cueFilePath?: string;
  trackStartTime?: number;
  trackEndTime?: number;
  // File hash for incremental scanning
  fileHash?: string;
}

export function getQualityFromMetadata(
  lossless: boolean,
  bitrate: number | undefined,
  format: string,
): string {
  if (
    lossless ||
    format === ".flac" ||
    format === ".wav" ||
    format === ".aiff" ||
    format === ".ape"
  ) {
    return "lossless";
  }

  const kbps = (bitrate || 0) / 1000;

  if (kbps >= 320) return "320k";
  if (kbps >= 192) return "192k";
  if (kbps >= 128) return "128k";

  return "128k";
}
// 音频质量对比函数，优先级：lossless > bitrate > format
export function isBetterQuality(
  newMeta: Pick<SongMetadata, "quality">,
  existingMeta: Pick<SongMetadata, "quality">,
): boolean {
  const qualityRank = (quality: string) => {
    if (quality === "lossless") return 3;
    if (quality.endsWith("k")) return parseInt(quality) / 1000; // 320k -> 0.32
    return 0;
  };

  const newQuality = qualityRank(newMeta.quality);
  const existingQuality = qualityRank(existingMeta.quality);

  return newQuality > existingQuality;
}
export async function parseAudioFile(
  filePath: string,
): Promise<SongMetadata | null> {
  const formatExt = extname(filePath).toLowerCase();

  try {
    // Try node-taglib-sharp first
    const file = await File.createFromPath(filePath);
    const tag = file.tag;
    const properties = file.properties;

    const bitrate = properties.audioBitrate;
    const originalBitrate = Math.round(bitrate || 0);

    const quality = getQualityFromMetadata(
      formatExt === ".flac" || formatExt === ".wav" || formatExt === ".ape",
      (bitrate || 0) * 1000,
      formatExt,
    );

    // Normalize metadata using cleaner utilities
    const rawTitle = tag.title ||
      filePath
        .split(/[/\\]/)
        .pop()
        ?.replace(/\.[^.]+$/, "") ||
      "Unknown";

    // Extract all performers (array) instead of just first
    const performers = tag.performers || [];
    const rawArtist = performers.length > 0
      ? performers.join(", ")
      : (tag.firstPerformer || "Unknown Artist");

    // Process artists: split by separators and clean
    const processedArtists = processAllArtists(performers);

    const rawAlbum = tag.album || "Unknown Album";

    // Extract cover if available
    let coverData: { data: Uint8Array; mimeType: string } | undefined;
    if (tag.pictures && tag.pictures.length > 0) {
      const cover = tag.pictures.reduce((largest, current) =>
        current.data.length > largest.data.length ? current : largest
      );
      coverData = {
        data: new Uint8Array(cover.data),
        mimeType: cover.mimeType || "image/jpeg",
      };
    }

    return {
      title: normalizeText(rawTitle),
      artist: normalizeText(rawArtist),
      artists: processedArtists,
      album: normalizeText(rawAlbum),
      duration: Math.round((properties.durationMilliseconds || 0) / 1000),
      quality,
      trackNo: tag.track,
      trackTotal: tag.trackCount,
      year: tag.year || undefined,
      coverData,
      fileSize: (await Deno.stat(filePath)).size,
      format: formatExt,
      filePath,
      originalBitrate,
    };
  } catch (taglibError) {
    // Fallback to music-metadata for unsupported formats
    console.log(
      `node-taglib-sharp failed for ${filePath}, trying music-metadata fallback...`,
    );
    try {
      return await parseWithMusicMetadata(filePath, formatExt);
    } catch (musicMetadataError) {
      console.error(`Error parsing ${filePath}:`, taglibError);
      console.error(`music-metadata also failed:`, musicMetadataError);
      return null;
    }
  }
}

/**
 * Fallback parser using music-metadata library
 */
async function parseWithMusicMetadata(
  filePath: string,
  formatExt: string,
): Promise<SongMetadata | null> {
  const file = await Deno.open(filePath, { read: true });
  const stats = await file.stat();
  const fileBuffer = new Uint8Array(stats.size);
  await file.read(fileBuffer);
  file.close();

  const metadata = await musicMetadata.parseBuffer(fileBuffer, {
    mimeType: getMimeType(formatExt),
  });

  const bitrate = metadata.format.bitrate || 0;
  const originalBitrate = Math.round(bitrate / 1000);

  const quality = getQualityFromMetadata(
    formatExt === ".flac" || formatExt === ".wav" || formatExt === ".ape",
    bitrate,
    formatExt,
  );

  const rawTitle = metadata.common.title ||
    filePath
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.[^.]+$/, "") ||
    "Unknown";

  // Extract all artists
  const artists = metadata.common.artists || [];
  const rawArtist = artists.length > 0
    ? artists.join(", ")
    : (metadata.common.artist || "Unknown Artist");

  // Process artists: split by separators and clean
  const processedArtists = processAllArtists(artists);

  const rawAlbum = metadata.common.album || "Unknown Album";

  // Extract cover if available
  let coverData: { data: Uint8Array; mimeType: string } | undefined;
  if (metadata.common.picture && metadata.common.picture.length > 0) {
    const cover = metadata.common.picture.reduce((largest, current) =>
      current.data.length > largest.data.length ? current : largest
    );
    coverData = {
      data: new Uint8Array(cover.data),
      mimeType: cover.format || "image/jpeg",
    };
  }

  return {
    title: normalizeText(rawTitle),
    artist: normalizeText(rawArtist),
    artists: processedArtists,
    album: normalizeText(rawAlbum),
    duration: Math.round(metadata.format.duration || 0),
    quality,
    trackNo: metadata.common.track?.no ?? undefined,
    trackTotal: metadata.common.track?.of ?? undefined,
    year: metadata.common.year,
    coverData,
    fileSize: stats.size,
    format: formatExt,
    filePath,
    originalBitrate,
  };
}

/**
 * Get MIME type for music-metadata based on file extension
 */
function getMimeType(formatExt: string): string | undefined {
  const mimeTypes: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wma": "audio/x-ms-wma",
    ".ape": "audio/ape",
    ".wv": "audio/x-wavpack",
  };
  return mimeTypes[formatExt];
}

/**
 * 获取音频文件时长（用于整轨文件）
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const file = await File.createFromPath(filePath);
    return Math.round((file.properties.durationMilliseconds || 0) / 1000);
  } catch (error) {
    console.error(`Error getting duration for ${filePath}:`, error);
    return 0;
  }
}

/**
 * Get or create artist(s) from metadata
 * Returns array of artist IDs with their positions
 *
 * @param artistNameOrArray - Either a string with artist name(s) or an array of pre-processed artist names
 */
export async function getOrCreateArtists(
  artistNameOrArray: string | string[],
): Promise<{ id: number; position: number }[]> {
  // If array provided, use directly; otherwise process string
  const cleanedArtists = Array.isArray(artistNameOrArray)
    ? artistNameOrArray
    : cleanArtist(artistNameOrArray);

  const artistResults: { id: number; position: number }[] = [];

  for (let i = 0; i < cleanedArtists.length; i++) {
    const artist = cleanedArtists[i];
    const artistObj = splitArtistWithAlias(artist);

    // Normalize artist name
    const normalizedArtist = normalizeText(artistObj.name);

    // Try exact match first
    const existing = await sql`
      SELECT id FROM artists WHERE name = ${normalizedArtist}
    `;

    if (existing.length > 0) {
      artistResults.push({ id: existing[0].id, position: i });
      continue;
    }

    // Create new artist
    const result = await sql`
      INSERT INTO artists (name, alias)
      VALUES (${normalizedArtist}, ${artistObj.alias || null})
      RETURNING id
    `;

    if (result.length > 0) {
      artistResults.push({ id: result[0].id, position: i });
    }
  }

  return artistResults;
}

/**
 * Link artists to a song via junction table
 */
async function linkSongArtists(
  songId: number,
  artists: { id: number; position: number }[],
): Promise<void> {
  for (const artist of artists) {
    await sql`
      INSERT INTO song_artists (song_id, artist_id, position)
      VALUES (${songId}, ${artist.id}, ${artist.position})
      ON CONFLICT DO NOTHING
    `;
  }
}

/**
 * Link artists to an album via junction table
 */
async function linkAlbumArtists(
  albumId: number,
  artists: { id: number; position: number }[],
): Promise<void> {
  for (const artist of artists) {
    await sql`
      INSERT INTO album_artists (album_id, artist_id, position)
      VALUES (${albumId}, ${artist.id}, ${artist.position})
      ON CONFLICT DO NOTHING
    `;
  }
}

/**
 * Get or create album (artist relationship is handled via junction table)
 */
export async function getOrCreateAlbum(
  albumTitle: string,
  _artistId: number | null, // Deprecated - artists linked via junction table
  metadata: { trackTotal?: number; year?: number } = {},
): Promise<number> {
  const cleaned = cleanTitle(albumTitle);

  // Just look up by title (artist is handled via album_artists table)
  const existing = await sql`
    SELECT id FROM albums WHERE title = ${cleaned}
  `;

  if (existing.length > 0) {
    return existing[0].id;
  }

  const result = await sql`
    INSERT INTO albums (title, track_total, release_year)
    VALUES (${cleaned}, ${metadata.trackTotal || null}, ${
    metadata.year || null
  })
    RETURNING id
  `;

  return result[0].id;
}

/**
 * Compare bitrate and decide if we should replace existing song
 * Uses junction tables for many-to-many artist relationship
 */
export async function shouldReplaceSong(
  metadata: SongMetadata,
): Promise<{ shouldInsert: boolean; existingId: number | null }> {
  // Clean album title to match how it's stored in database
  const cleanedAlbum = cleanTitle(metadata.album);

  // Try exact match first - check if song with same title and album exists
  const exact = await sql`
    SELECT s.id, s.quality, s.file_path
    FROM songs s
    LEFT JOIN song_artists sa ON s.id = sa.song_id
    LEFT JOIN artists ar ON sa.artist_id = ar.id
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE s.title = ${metadata.title}
    AND al.title = ${cleanedAlbum}
    GROUP BY s.id
    HAVING COUNT(DISTINCT ar.name) > 0
    LIMIT 1
  `;

  if (exact.length > 0) {
    const comparison = compareBitrate(
      metadata.originalBitrate || 0,
      exact[0].quality,
    );

    if (comparison === "equal") {
      return { shouldInsert: false, existingId: exact[0].id };
    }

    if (comparison === "better") {
      // Delete old and insert new
      await sql`DELETE FROM songs WHERE id = ${exact[0].id}`;
      return { shouldInsert: true, existingId: null };
    }

    // worse quality - skip
    return { shouldInsert: false, existingId: exact[0].id };
  }

  // Try similarity match with strict threshold
  const similar = await sql`
    SELECT s.id, s.title, string_agg(DISTINCT ar.name, ', ') as artist_names
    FROM songs s
    LEFT JOIN song_artists sa ON s.id = sa.song_id
    LEFT JOIN artists ar ON sa.artist_id = ar.id
    WHERE s.title % ${metadata.title}
    GROUP BY s.id
  `;

  for (const song of similar) {
    if (
      isSimilar(song.title, metadata.title) &&
      isSimilar(song.artist_names || "", metadata.artist)
    ) {
      // Found similar song - skip
      return { shouldInsert: false, existingId: song.id };
    }
  }

  return { shouldInsert: true, existingId: null };
}

/**
 * 扫描目录查找所有相关文件
 */
export async function scanDirectory(
  dirPath: string,
  exclude: string[] = [],
): Promise<{ audioFiles: string[]; cueFiles: string[] }> {
  const audioFiles: string[] = [];
  const cueFiles: string[] = [];

  // Ensure exclude is an array
  const excludeList = Array.isArray(exclude) ? exclude : [];

  console.log(`scanDirectory called with dirPath="${dirPath}", exclude=${JSON.stringify(excludeList)}`);

  // Convert exclude patterns to regex for walk
  // Supports both plain names (e.g., "tmp") and paths (e.g., "Y:\\Music\\tmp")
  const skipPatterns = excludeList.map((pattern) => {
    // Escape special regex characters but allow * as wildcard
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars except *
      .replace(/\*/g, '.*');  // Convert * to .*
    // Match the pattern anywhere in the path
    return new RegExp(escaped, 'i');  // Case insensitive for Windows
  });

  if (skipPatterns.length > 0) {
    console.log(`Skip regex patterns: ${skipPatterns.map(r => r.source).join(', ')}`);
  }

  try {
    // Note: walk's skip parameter uses regex to match against full paths
    // If skip patterns are provided but not working, we need to filter manually
    for await (
      const entry of await walk(dirPath, {
        exts: Array.from(
          new Set([
            ...SUPPORTED_FORMATS,
            ...CUE_FORMATS,
            ...WHOLE_TRACK_FORMATS,
          ]),
        ),
      })
    ) {
      // Manual exclude check as backup
      const pathToCheck = entry.path.replace(/\\/g, '/');
      const shouldExclude = skipPatterns.some(pattern => pattern.test(entry.path) || pattern.test(pathToCheck));

      if (shouldExclude) {
        continue;
      }

      if (entry.isFile) {
        const ext = extname(entry.name).toLowerCase();
        if (SUPPORTED_FORMATS.includes(ext)) {
          audioFiles.push(entry.path);
        } else if (CUE_FORMATS.includes(ext)) {
          cueFiles.push(entry.path);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }

  console.log(`Found ${audioFiles.length} audio files, ${cueFiles.length} CUE files`);
  return { audioFiles, cueFiles };
}

/**
 * 从CUE文件解析整轨音乐，生成虚拟单曲记录
 */
export async function parseCueTracks(
  cueFilePath: string,
): Promise<SongMetadata[]> {
  const songs: SongMetadata[] = [];

  try {
    // 读取CUE文件内容
    const cueSheet = parseCue(cueFilePath);

    if (!cueSheet || cueSheet.files?.length === 0) {
      console.log(`No valid tracks found in CUE file: ${cueFilePath}`);
      return [];
    }
    if (cueSheet.files) {
      for (const file of cueSheet.files) {
        // 解析音频文件路径
        const audioFilePath = resolveAudioFilePath(cueFilePath, file.name!);

        // 检查音频文件是否存在
        if (!(await exists(audioFilePath))) {
          // 尝试其他可能的文件名（有些cue文件使用不同的音频文件名）
          const cueDir = dirname(cueFilePath);
          const cueBaseName = basename(cueFilePath, ".cue");

          // 尝试同名的各种音频格式
          let found = false;
          for (const ext of WHOLE_TRACK_FORMATS) {
            const altPath = `${cueDir}/${cueBaseName}${ext}`;
            if (await exists(altPath)) {
              console.log(`Found alternative audio file: ${altPath}`);
              // 更新cueSheet中的文件路径
              file.name = altPath;
              found = true;
              break;
            }
          }

          if (!found) {
            console.error(
              `Audio file not found for CUE: ${cueFilePath}, expected: ${audioFilePath}`,
            );
            return [];
          }
        }

        // 获取音频文件信息
        const finalAudioPath = resolveAudioFilePath(cueFilePath, file.name!);
        const audioStat = await Deno.stat(finalAudioPath);
        const totalDuration = await getAudioDuration(finalAudioPath);

        // 计算每首歌曲的结束时间
        const trackEndTimes = calculateTrackEndTimes(
          file.tracks!,
          totalDuration,
        );

        // 获取音频文件质量信息
        let quality = "lossless";
        let originalBitrate = 1000; // Default for lossless
        let coverData: { data: Uint8Array; mimeType: string } | undefined;
        let trackTotal: number | undefined;
        let year: number | undefined;

        try {
          const audioFile = await File.createFromPath(finalAudioPath);
          const bitrate = audioFile.properties.audioBitrate;
          originalBitrate = Math.round(bitrate || 0);
          const formatExt = extname(finalAudioPath).toLowerCase();
          quality = getQualityFromMetadata(
            true,
            (bitrate || 0) * 1000,
            formatExt,
          );

          // Extract cover in single pass
          const tag = audioFile.tag;
          if (tag.pictures && tag.pictures.length > 0) {
            const cover = tag.pictures.reduce((largest, current) =>
              current.data.length > largest.data.length ? current : largest
            );
            coverData = {
              data: new Uint8Array(cover.data),
              mimeType: cover.mimeType || "image/jpeg",
            };
          }

          // Extract track total and year from audio file metadata
          trackTotal = tag.trackCount;
          year = tag.year || undefined;
        } catch (error) {
          console.warn(`Could not get quality for ${finalAudioPath}:`, error);
        }
        if (file.tracks) {
          // 为每个track创建虚拟单曲记录
          for (let i = 0; i < file.tracks.length; i++) {
            const track = file.tracks[i];
            const timeMap = track.indexes?.filter(
              (item) => item.number === 1,
            )[0].time;
            const time = timeMap
              ? parseFloat(`${timeMap.min * 60 + timeMap.sec}.${timeMap.frame}`)
              : 0;
            const duration = Math.round(
              (trackEndTimes && trackEndTimes[i]) ||
                totalDuration / file.tracks.length ||
                0,
            );

            // Process artist(s) from track performer or CUE performer
            const rawArtist = track.performer || cueSheet.performer || "Unknown Artist";
            const trackArtists = processAllArtists([rawArtist]);

            songs.push({
              title: normalizeText(track.title || `Unknown Title`),
              artist: normalizeText(rawArtist),
              artists: trackArtists,
              album: normalizeText(cueSheet.title || "Unknown Album"),
              duration,
              quality: quality,
              fileSize: audioStat.size, // 整轨文件大小（所有track共享）
              format: extname(finalAudioPath).toLowerCase(),
              filePath: `${finalAudioPath}#track-${i}`, // 使用特殊格式标记这是整轨中的一首
              originalBitrate,
              trackNo: i + 1,
              trackTotal: trackTotal || file.tracks.length,
              year,
              coverData,
              isCueTrack: true,
              cueFilePath: cueFilePath,
              trackStartTime: Math.round(time),
              trackEndTime: Math.round(time + duration),
            });
          }
        }
      }
    }
    console.log(`Parsed ${songs.length} tracks from CUE: ${cueFilePath}`);
  } catch (error) {
    console.error(`Error parsing CUE file ${cueFilePath}:`, error);
  }

  return songs;
}

/**
 * 检查音频文件是否被任何CUE文件引用
 */
export function isFileReferencedByCue(
  audioFilePath: string,
  cueData: Map<string, SongMetadata[]>,
): boolean {
  // 规范化路径：统一使用正斜杠（跨平台兼容）
  // Windows 使用 \，Linux/macOS 使用 /，统一为 / 进行比较
  const normalizedAudioPath = audioFilePath.replace(/\\/g, "/");

  for (const [, tracks] of cueData) {
    if (tracks.length) {
      // 比较原始音频文件路径（去掉#track后缀）
      const trackSourcePath = tracks[0].filePath.split("#track-")[0];
      const normalizedTrackPath = trackSourcePath.replace(/\\/g, "/");
      // 在 Windows 上不区分大小写，在 Linux/macOS 上区分大小写
      // 使用 Deno.build.os 检测平台
      if (Deno.build.os === "windows") {
        if (
          normalizedTrackPath.toLowerCase() ===
            normalizedAudioPath.toLowerCase()
        ) {
          return true;
        }
      } else {
        if (normalizedTrackPath === normalizedAudioPath) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Check if song exists using the new normalized schema with bitrate comparison
 * Returns: { exists: boolean, shouldReplace: boolean, existingId: number | null }
 */
export async function checkSongExists(
  metadata: SongMetadata,
): Promise<
  { exists: boolean; shouldReplace: boolean; existingId: number | null }
> {
  // Use the new shouldReplaceSong function
  const { shouldInsert, existingId } = await shouldReplaceSong(metadata);
  return {
    exists: !shouldInsert,
    shouldReplace: false, // shouldReplaceSong handles deletion
    existingId,
  };
}

/**
 * Get existing file hashes from database for incremental scanning
 * Returns a map of file_path -> { hash, id }
 */
export async function getExistingFileHashes(): Promise<
  Map<string, { hash: string; id: number }>
> {
  const result = await sql`
    SELECT id, file_path, file_hash FROM songs WHERE file_hash IS NOT NULL
  `;
  const map = new Map<string, { hash: string; id: number }>();
  for (const row of result) {
    if (row.file_hash) {
      map.set(row.file_path, { hash: row.file_hash, id: row.id });
    }
  }
  return map;
}

/**
 * Insert song using normalized schema with many-to-many artists
 */
export async function insertSong(metadata: SongMetadata): Promise<boolean> {
  try {
    // Get or create artist(s) - use pre-processed artists array if available
    const artists = metadata.artists && metadata.artists.length > 0
      ? await getOrCreateArtists(metadata.artists)
      : await getOrCreateArtists(metadata.artist);

    // Get or create album (without artist_id, we'll link later)
    const albumId = await getOrCreateAlbum(metadata.album, null, {
      trackTotal: metadata.trackTotal,
      year: metadata.year,
    });

    // Link artists to album
    if (artists.length > 0) {
      await linkAlbumArtists(albumId, artists);
    }

    // Extract and save cover image
    let coverUrl: string | null = null;
    const audioFilePath = metadata.isCueTrack
      ? metadata.filePath.split("#track-")[0]
      : metadata.filePath;

    // Priority 1: Use pre-extracted coverData (single-pass)
    if (metadata.coverData) {
      coverUrl = await saveCoverFromData(
        metadata.coverData,
        albumId.toString(),
        "album",
      );
    }

    // Priority 2: For CUE tracks, look in CUE directory
    if (!coverUrl && metadata.isCueTrack && metadata.cueFilePath) {
      coverUrl = await getCueCover(
        metadata.cueFilePath,
        albumId.toString(),
        "album",
      );
    }

    // Priority 3: For regular files, extract from metadata or folder
    if (!coverUrl && !metadata.coverData && await exists(audioFilePath)) {
      coverUrl = await getOrCreateCover(
        audioFilePath,
        albumId.toString(),
        "album",
      );
    }

    // Update album with cover if found
    if (coverUrl) {
      await sql`
        UPDATE albums SET cover_image = ${coverUrl} WHERE id = ${albumId}
      `;
    }

    // Insert song (no artist_id field anymore)
    const result = await sql`
      INSERT INTO songs (
        title, album_id, duration, file_path, quality,
        original_bitrate, file_size, format, cover_image,
        is_cue_track, cue_file_path, track_start_time, track_end_time,
        file_hash
      ) VALUES (
        ${metadata.title}, ${albumId},
        ${metadata.duration}, ${metadata.filePath}, ${metadata.quality},
        ${
      metadata.originalBitrate || null
    }, ${metadata.fileSize}, ${metadata.format}, ${coverUrl},
        ${getDbValue(metadata.isCueTrack, false)}, ${
      getDbValue(metadata.cueFilePath, null)
    },
        ${getDbValue(metadata.trackStartTime, null)}, ${
      getDbValue(metadata.trackEndTime, null)
    },
        ${metadata.fileHash || null}
      )
      RETURNING id
    `;

    // Link artists to song via junction table
    if (result.length > 0 && artists.length > 0) {
      await linkSongArtists(result[0].id, artists);
    }

    return !!result.length;
  } catch (error: unknown) {
    // 如果是唯一键冲突（歌曲已存在），也算成功
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return true;
    }
    console.error(`Error inserting song ${metadata.title}:`, error);
    return false;
  }
}

// Maximum concurrent file processing to prevent memory issues
const MAX_CONCURRENT_FILES = 2;
const BATCH_SIZE = 50; // Process files in batches

/**
 * Process items in batches with limited concurrency using a simple semaphore approach
 */
async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number,
  concurrency: number,
): Promise<{ results: R[]; errors: Array<{ item: T; error: Error }> }> {
  const results: R[] = [];
  const errors: Array<{ item: T; error: Error }> = [];
  const totalBatches = Math.ceil(items.length / batchSize);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} items)`);

    // Process items sequentially within batch, but with concurrency limit
    const activePromises: Promise<void>[] = [];

    for (const item of batch) {
      // Wait if we've reached concurrency limit
      if (activePromises.length >= concurrency) {
        await Promise.race(activePromises);
      }

      // Remove completed promises
      const stillActive: Promise<void>[] = [];
      for (const p of activePromises) {
        const done = await Promise.race([p.then(() => true, () => true), Promise.resolve(false)]);
        if (!done) {
          stillActive.push(p);
        }
      }
      activePromises.length = 0;
      activePromises.push(...stillActive);

      // Start new task
      const taskPromise = processor(item)
        .then((result) => {
          results.push(result);
        })
        .catch((error) => {
          errors.push({ item, error });
        });

      activePromises.push(taskPromise);
    }

    // Wait for all remaining tasks in batch to complete
    await Promise.allSettled(activePromises);

    // Small delay between batches to allow garbage collection
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { results, errors };
}

export async function scanMusicFiles(
  sourcePath: string,
  exclude: string[] = [],
  options: { batchSize?: number; concurrency?: number } = {},
): Promise<{
  success: boolean;
  message: string;
  scanned: number;
  added: number;
  skipped: number;
}> {
  // Use very conservative concurrency to prevent memory issues
  const concurrency = Math.min(options.concurrency || 2, MAX_CONCURRENT_FILES);
  const batchSize = options.batchSize || BATCH_SIZE;
  // Ensure exclude is always an array
  const excludeList = Array.isArray(exclude) ? exclude : [];

  console.log(`Scan settings: concurrency=${concurrency}, batchSize=${batchSize}`);

  if (!sourcePath) {
    return {
      success: false,
      message: "Source path is required",
      scanned: 0,
      added: 0,
      skipped: 0,
    };
  }

  try {
    console.log(`Scanning directory: ${sourcePath}`);

    // Clear cover cache to start fresh
    clearCoverCache();

    const { audioFiles, cueFiles } = await scanDirectory(sourcePath, excludeList);
    console.log(
      `Found ${audioFiles.length} audio files, ${cueFiles.length} CUE files`,
    );

    let added = 0;
    let scanned = 0;
    let skipped = 0;

    // Get existing file hashes for incremental scanning
    const existingHashes = await getExistingFileHashes();
    console.log(`Found ${existingHashes.size} previously scanned files in database`);

    if (existingHashes.size === 0) {
      console.log("First scan detected - skipping hash calculation for better performance");
    }

    // Step 1: Parse CUE files with limited concurrency
    console.log("Parsing CUE files...");
    const cueResults = await processInBatches(
      cueFiles,
      async (cueFile: string) => {
        // Check if CUE file has changed (only if we have existing hashes)
        // Skip hash check on first scan to save memory
        if (existingHashes.size > 0) {
          const existingInfo = existingHashes.get(cueFile);
          if (existingInfo) {
            try {
              const currentHash = await calculateFileHash(cueFile);
              if (currentHash === existingInfo.hash) {
                console.log(`CUE file unchanged, skipping: ${cueFile}`);
                return { cueFile, tracks: [], unchanged: true };
              }
              // File changed, delete old tracks
              console.log(`CUE file changed, re-scanning: ${cueFile}`);
              await sql`DELETE FROM songs WHERE cue_file_path = ${cueFile}`;
            } catch {
              // If hash calculation fails, proceed with parsing
            }
          }
        }

        const tracks = await parseCueTracks(cueFile);

        // Calculate hash for CUE file (only if we have existing hashes to compare)
        let cueHash: string | undefined;
        if (existingHashes.size > 0) {
          try {
            cueHash = await calculateFileHash(cueFile);
          } catch {
            // Ignore hash errors
          }
        }

        return { cueFile, tracks, cueHash, unchanged: false };
      },
      batchSize,
      concurrency,
    );

    // Build CUE tracks map
    const cueTracksMap = new Map<string, SongMetadata[]>();
    for (const result of cueResults.results) {
      if (result && result.tracks.length > 0) {
        // Add hash to each track
        if (result.cueHash) {
          for (const track of result.tracks) {
            track.fileHash = result.cueHash;
          }
        }
        cueTracksMap.set(result.cueFile, result.tracks);
      }
      if (result?.unchanged) {
        skipped++;
      }
    }

    // Log CUE parsing errors
    for (const error of cueResults.errors) {
      console.error(`Error parsing CUE file:`, error.error);
    }

    // Step 2: Process CUE tracks
    console.log("Processing CUE tracks...");
    const allCueTracks: SongMetadata[] = [];
    for (const [, tracks] of cueTracksMap) {
      allCueTracks.push(...tracks);
    }

    const cueTrackResults = await processInBatches(
      allCueTracks,
      async (track: SongMetadata) => {
        const { exists } = await checkSongExists(track);
        if (exists) {
          return { status: "skipped" as const, reason: "exists" };
        }

        const inserted = await insertSong(track);
        return inserted
          ? { status: "added" as const }
          : { status: "failed" as const };
      },
      batchSize,
      concurrency,
    );

    // Count CUE track results
    for (const result of cueTrackResults.results) {
      scanned++;
      if (result?.status === "added") {
        added++;
      }
    }

    for (const error of cueTrackResults.errors) {
      console.error(`Error processing CUE track:`, error.error);
    }

    // Step 3: Process audio files (excluding CUE-referenced files)
    const filteredAudioFiles = audioFiles.filter(
      (filePath) => !isFileReferencedByCue(filePath, cueTracksMap),
    );

    console.log(
      `Processing ${filteredAudioFiles.length} audio files (excluding ${audioFiles.length - filteredAudioFiles.length} CUE-referenced)...`,
    );

    const audioResults = await processInBatches(
      filteredAudioFiles,
      async (filePath: string) => {
        // Check if file has changed using hash (only if we have existing hashes)
        // Skip hash check on first scan to save memory
        if (existingHashes.size > 0) {
          const existingInfo = existingHashes.get(filePath);
          if (existingInfo) {
            try {
              const currentHash = await calculateFileHash(filePath);
              if (currentHash === existingInfo.hash) {
                // File unchanged, skip
                return { status: "skipped" as const, reason: "unchanged" };
              }
              // File changed, delete old and re-scan
              console.log(`File changed, re-scanning: ${filePath}`);
              await sql`DELETE FROM songs WHERE id = ${existingInfo.id}`;
            } catch {
              // If hash calculation fails, proceed with parsing
            }
          }
        }

        const metadata = await parseAudioFile(filePath);
        if (!metadata) {
          return { status: "failed" as const, reason: "no_metadata" };
        }

        // Calculate file hash for new files (only if we have existing hashes to compare)
        // Skip hash on first scan to save memory and time
        if (existingHashes.size > 0) {
          try {
            metadata.fileHash = await calculateFileHash(filePath);
          } catch {
            // Ignore hash errors
          }
        }

        const { exists } = await checkSongExists(metadata);
        if (exists) {
          return { status: "skipped" as const, reason: "exists" };
        }

        const inserted = await insertSong(metadata);
        return inserted
          ? { status: "added" as const, metadata }
          : { status: "failed" as const };
      },
      batchSize,
      concurrency,
    );

    // Count audio file results
    for (const result of audioResults.results) {
      scanned++;
      if (result?.status === "added") {
        added++;
      } else if (result?.reason === "unchanged") {
        skipped++;
      }
    }

    for (const error of audioResults.errors) {
      console.error(`Error processing audio file:`, error.error);
    }

    return {
      success: true,
      message: `Scanned ${scanned} items, added ${added} new songs, skipped ${skipped} unchanged`,
      scanned,
      added,
      skipped,
    };
  } catch (error) {
    console.error("Scan error:", error);
    return {
      success: false,
      message: `Scan failed: ${error}`,
      scanned: 0,
      added: 0,
      skipped: 0,
    };
  }
}
