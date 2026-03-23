// Metadata cleaning utilities for music library normalization
import { detect } from "chardet";
import {toSimplified } from '@raise/han-convert'
/**
 * Try to fix common encoding issues (mojibake)
 * Handles cases where GBK/GB2312 text was incorrectly decoded as UTF-8
 */
export async function fixEncoding(path: string): Promise<void> {
  const buffer = await Deno.readFile(path);
  const encoding = detect(buffer);
  if(encoding && !["unicode-1-1-utf-8", "utf-8","utf8"].includes(encoding)) {
    const decoder = new TextDecoder(encoding);
    const text = decoder.decode(buffer);
    const encoder =  new TextEncoder();
    await Deno.writeFile(path, encoder.encode(text));
  }
}

/**
 * Simple Traditional to Simplified Chinese conversion
 * Uses a basic mapping - can be enhanced with a full library later
 */
export function t2s(text: string): string {
  return toSimplified(text);
}

/**
 * Remove common suffixes from track titles
 * Examples: "(Explicit)", "[Remastered]", "[2024 Remaster]"
 */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(Explicit\)/gi, "")
    .replace(/\s*\[.*?\]/g, "")
    .replace(/\s*（.*?）/g, "") // Handle Chinese parentheses
    .trim();
}

/**
 * List of artists to exclude when splitting "Artist feat. Artist2"
 */
const excludeArtist = [
  "feat.",
  "featuring",
  "ft.",
  "feat",
  "featuring",
  "ft",
  " Featuring ",
  " Featuring",
  " Feat.",
  " Feat",
];

/**
 * Clean and split artist string
 * "Artist1 feat. Artist2" -> ["Artist1", "Artist2"]
 * "Artist1, Artist2" -> ["Artist1", "Artist2"]
 */
export function cleanArtist(str?: string): string[] {
  if (!str) return [];

  let tmp = str.trim();

  // Replace all feat/ft patterns with a common separator
  excludeArtist.forEach((exc) => {
    const reg = new RegExp(`\\s*${exc}\\s*`, "gi");
    tmp = tmp.replace(reg, " & ");
  });

  // Split by common separators
  const result = tmp
    .split(/[,+×/&]/)
    .map((item) => item.trim())
    .filter((item) => item !== "");

  return result;
}

/**
 * Split artist with alias in parentheses
 * "Artist (CV: Voice Actor)" -> { name: "Artist", alias: "Voice Actor" }
 */
export function splitArtistWithAlias(str: string): {
  name: string;
  alias?: string;
} {
  // Handle both English and Chinese parentheses
  const reg = /[(（](CV:)?(.+)[)）]/;
  const match = str.match(reg);

  const artist: { name: string; alias?: string } = {
    name: str.replace(reg, "").trim(),
  };

  if (match) {
    artist.alias = match[2].trim();
  }

  return artist;
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function similarityDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Check if two strings are similar (strict threshold)
 * @param maxDiff - Maximum allowed character difference (default: 1)
 */
export function isSimilar(a: string, b: string, maxDiff: number = 1): boolean {
  if (Math.abs(a.length - b.length) > maxDiff) return false;
  return similarityDistance(a.toLowerCase(), b.toLowerCase()) <= maxDiff;
}

/**
 * Clean and normalize text for database storage
 * - Fix encoding issues (mojibake)
 * - Remove suffixes like (Explicit), [Remastered]
 * - Convert Traditional Chinese to Simplified Chinese
 * - Trim whitespace
 */
export function normalizeText(text: string): string {
  return t2s(cleanTitle(text));
}

/**
 * Normalize title/album - remove suffixes AND convert TC to SC
 * Examples: "Song [Remastered]" -> "Song"
 */
export function normalizeTitle(text: string): string {
  return t2s(cleanTitle(text));
}

/**
 * Normalize artist - TC to SC conversion only (no suffix removal)
 */
export function normalizeArtist(text: string): string {
  return t2s(text.trim());
}

/**
 * Process all artists from metadata
 * Takes an array of performer strings and returns an array of individual artist names
 *
 * Example: ["Artist1, Artist2", "Artist3"] -> ["Artist1", "Artist2", "Artist3"]
 */
export function processAllArtists(performers: string[]): string[] {
  const result: string[] = [];

  for (const performer of performers) {
    // Split by common separators
    const splitArtists = cleanArtist(performer);
    for (const artist of splitArtists) {
      // Extract alias if present and normalize
      const { name } = splitArtistWithAlias(artist);
      const normalized = normalizeArtist(name);
      if (normalized && !result.includes(normalized)) {
        result.push(normalized);
      }
    }
  }

  return result;
}

/**
 * Parse bitrate from quality string
 * "320k" -> 320, "lossless" -> 1411, "128k" -> 128
 */
export function parseBitrate(quality: string): number {
  if (quality === "lossless") return 1411; // Treat lossless as CD quality 1411kbps
  const match = quality.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Compare bitrate between new and existing quality
 * If both are lossless (>= 1000 kbps), treat as equal
 */
export function compareBitrate(
  newBitrate: number,
  existingQuality: string,
): "better" | "equal" | "worse" {
  const existingBitrate = parseBitrate(existingQuality);
  // If both are lossless quality (>= 1000 kbps), treat as equal
  if (newBitrate >= 1000 && existingBitrate >= 1000) {
    return "equal";
  }
  if (newBitrate > existingBitrate) return "better";
  if (newBitrate < existingBitrate) return "worse";
  return "equal";
}
