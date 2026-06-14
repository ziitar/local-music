// Cover image extraction and storage utilities
import { File } from "node-taglib-sharp";
import { dirname, extname } from "@std/path";
import { exists } from "@std/fs";
import * as musicMetadata from "music-metadata";

/**
 * Create directory if it doesn't exist
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await Deno.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

const COVER_DIR = "./public/covers";

// Cache for ongoing cover copy operations to prevent concurrent access issues
const coverCopyCache = new Map<string, Promise<string | null>>();

/**
 * Clear the cover copy cache (call this at the start of a scan)
 */
export function clearCoverCache(): void {
  coverCopyCache.clear();
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
 * Extract cover from audio file metadata using music-metadata as fallback
 */
export async function extractCoverFromFile(
  filePath: string,
  outputId: string,
  type: "album" | "song" = "album",
): Promise<string | null> {
  // Try node-taglib-sharp first
  try {
    const file = await File.createFromPath(filePath);
    const pictures = file.tag.pictures;

    if (pictures && pictures.length > 0) {
      // Get largest picture (usually the cover)
      const cover = pictures.reduce((largest, current) =>
        current.data.length > largest.data.length ? current : largest
      );

      // Save original
      const dir = `${COVER_DIR}/${type}s`;
      await ensureDir(dir);

      const ext = cover.mimeType?.includes("png") ? "png" : "jpg";
      const coverPath = `${dir}/${outputId}.${ext}`;
      await Deno.writeFile(coverPath, new Uint8Array(cover.data));

      return `/covers/${type}s/${outputId}.${ext}`;
    }
  } catch (taglibError) {
    // Fallback to music-metadata
    try {
      const formatExt = extname(filePath).toLowerCase();
      const file = await Deno.open(filePath, { read: true });
      const stats = await file.stat();
      const fileBuffer = new Uint8Array(stats.size);
      await file.read(fileBuffer);
      file.close();

      const metadata = await musicMetadata.parseBuffer(fileBuffer, {
        mimeType: getMimeType(formatExt),
      });

      const pictures = metadata.common.picture;
      if (pictures && pictures.length > 0) {
        const cover = pictures.reduce((largest, current) =>
          current.data.length > largest.data.length ? current : largest
        );

        const dir = `${COVER_DIR}/${type}s`;
        await ensureDir(dir);

        const ext = cover.format?.includes("png") ? "png" : "jpg";
        const coverPath = `${dir}/${outputId}.${ext}`;
        await Deno.writeFile(coverPath, new Uint8Array(cover.data));

        return `/covers/${type}s/${outputId}.${ext}`;
      }
    } catch (_) {
      console.error(`Failed to extract cover from ${filePath}:`, taglibError);
    }
  }

  return null;
}

/**
 * Look for cover files in the same directory
 * Common names: cover.jpg, folder.jpg, front.jpg, album.jpg
 */
export async function findCoverInFolder(
  folderPath: string,
): Promise<string | null> {
  const coverNames = [
    "cover.jpg",
    "cover.png",
    "cover.webp",
    "folder.jpg",
    "folder.png",
    "folder.webp",
    "front.jpg",
    "front.png",
    "front.webp",
    "album.jpg",
    "album.png",
    "album.webp",
    "thumb.jpg",
    "thumb.png",
    "thumb.webp",
  ];

  for (const name of coverNames) {
    const coverPath = `${folderPath}/${name}`;
    if (await exists(coverPath)) {
      return coverPath;
    }
  }

  return null;
}

/**
 * Copy external cover file to public directory with retry logic and concurrent access protection
 */
export async function copyExternalCover(
  sourcePath: string,
  outputId: string,
  type: "album" | "song" = "album",
): Promise<string | null> {
  const ext = sourcePath.split(".").pop() || "jpg";
  const cacheKey = `${outputId}.${ext}`;

  // Check if there's already an ongoing copy operation for this cover
  const existing = coverCopyCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  // Start a new copy operation
  const copyPromise = doCopyExternalCover(sourcePath, outputId, type, ext);
  coverCopyCache.set(cacheKey, copyPromise);

  try {
    const result = await copyPromise;
    return result;
  } finally {
    // Clean up cache after operation completes
    coverCopyCache.delete(cacheKey);
  }
}

/**
 * Internal function to perform the actual copy
 */
async function doCopyExternalCover(
  sourcePath: string,
  outputId: string,
  type: "album" | "song",
  ext: string,
): Promise<string | null> {
  const dir = `${COVER_DIR}/${type}s`;
  const destPath = `${dir}/${outputId}.${ext}`;
  const coverUrl = `/covers/${type}s/${outputId}.${ext}`;

  try {
    await ensureDir(dir);

    // Check if destination already exists (another concurrent task may have created it)
    if (await exists(destPath)) {
      return coverUrl;
    }

    // Retry logic for Windows file locking issues
    const maxRetries = 5;
    const baseDelay = 50; // ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check again if destination exists (race condition protection)
        if (await exists(destPath)) {
          return coverUrl;
        }

        await Deno.copyFile(sourcePath, destPath);
        return coverUrl;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isBusyError = errorMsg.includes("EBUSY") ||
          errorMsg.includes("error 32") ||
          errorMsg.includes("正在使用");

        if (isBusyError && attempt < maxRetries - 1) {
          // Exponential backoff: 50ms, 100ms, 200ms, 400ms
          await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
          continue;
        }

        throw error;
      }
    }

    return coverUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (!errorMsg.includes("EBUSY") && !errorMsg.includes("error 32")) {
      console.error(`Failed to copy cover from ${sourcePath}:`, error);
    }
    return null;
  }
}

/**
 * Get or create cover for an album/song
 * Priority: 1. Audio metadata, 2. Folder cover file
 */
export async function getOrCreateCover(
  filePath: string,
  outputId: string,
  type: "album" | "song" = "album",
): Promise<string | null> {
  // Try extract from metadata first
  let coverUrl = await extractCoverFromFile(filePath, outputId, type);

  if (!coverUrl) {
    // Try find in same folder
    const folderPath = dirname(filePath);
    const externalCover = await findCoverInFolder(folderPath);

    if (externalCover) {
      coverUrl = await copyExternalCover(externalCover, outputId, type);
    }
  }

  return coverUrl;
}

/**
 * Get cover for CUE track (looks in the same directory as the CUE file)
 */
export async function getCueCover(
  cueFilePath: string,
  outputId: string,
  type: "album" | "song" = "album",
): Promise<string | null> {
  // For CUE tracks, look in the same directory as the CUE file
  const cueDir = dirname(cueFilePath);
  const externalCover = await findCoverInFolder(cueDir);

  if (externalCover) {
    return copyExternalCover(externalCover, outputId, type);
  }

  return null;
}

/**
 * Save cover from pre-extracted data (single-pass extraction)
 * This avoids re-reading the audio file for cover extraction
 */
export async function saveCoverFromData(
  coverData: { data: Uint8Array; mimeType: string },
  outputId: string,
  type: "album" | "song" = "album",
  maxSizeMB: number = 5,
): Promise<string | null> {
  try {
    // Check size limit
    const sizeMB = coverData.data.length / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      console.log(`Cover too large (${sizeMB.toFixed(2)}MB), skipping`);
      return null;
    }

    const dir = `${COVER_DIR}/${type}s`;
    await ensureDir(dir);

    const ext = coverData.mimeType.includes("png") ? "png" : "jpg";
    const coverPath = `${dir}/${outputId}.${ext}`;
    await Deno.writeFile(coverPath, coverData.data);

    return `/covers/${type}s/${outputId}.${ext}`;
  } catch (error) {
    console.error(`Failed to save cover data:`, error);
    return null;
  }
}
