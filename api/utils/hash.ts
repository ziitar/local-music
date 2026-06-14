import { crypto } from "@std/crypto";

/**
 * Calculate SHA-256 hash of a file
 * @param filePath - Path to the file
 * @returns Hex string of the file hash
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  const file = await Deno.open(filePath, { read: true });
  try {
    const readableStream = file.readable;
    const hashBuffer = await crypto.subtle.digest("SHA-256", readableStream);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } finally {
    file.close();
  }
}
