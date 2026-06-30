/**
 * Loudness Analyzer — FFmpeg EBU R128 loudness measurement
 *
 * Uses FFmpeg's loudnorm filter in print_format=json mode to measure:
 * - integrated_loudness (LUFS): overall perceived loudness
 * - true_peak (dBTP): maximum peak level
 *
 * The target loudness is -14 LUFS (Spotify/YouTube standard).
 * Frontend uses these values to apply playback gain compensation.
 */

export interface LoudnessResult {
  integratedLoudness: number; // LUFS, e.g. -14.2
  truePeak: number; // dBTP, e.g. -1.0
}

/**
 * Analyze a single audio file's loudness using FFmpeg.
 * Runs: ffmpeg -i <file> -af loudnorm=print_format=json -f null -
 * Parses the JSON output from stderr.
 */
export async function analyzeLoudness(
  filePath: string,
): Promise<LoudnessResult | null> {
  const ffmpegPath = Deno.env.get("FFMPEG_PATH") || "ffmpeg";

  try {
    const command = new Deno.Command(ffmpegPath, {
      args: [
        "-i", filePath,
        "-af", "loudnorm=print_format=json",
        "-f", "null",
        "-",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const process = command.spawn();
    // Consume stdout (we don't need it, but must drain the pipe)
    const stdoutReader = process.stdout.getReader();
    const stderrChunks: Uint8Array[] = [];

    // Read stderr in parallel
    const stderrReader = process.stderr.getReader();

    // Read both streams concurrently
    const readStderr = async () => {
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        stderrChunks.push(value);
      }
    };

    const readStdout = async () => {
      while (true) {
        const { done } = await stdoutReader.read();
        if (done) break;
      }
    };

    await Promise.all([readStderr(), readStdout()]);
    const status = await process.status;

    if (!status.success) {
      console.error(`FFmpeg loudnorm failed for ${filePath}: exit ${status.code}`);
      return null;
    }

    // Parse JSON from stderr output
    const stderrText = new TextDecoder().decode(
      new Uint8Array(
        stderrChunks.reduce((acc, chunk) => acc + chunk.length, 0) > 0
          ? concatUint8Arrays(stderrChunks)
          : new Uint8Array(0),
      ),
    );

    return parseLoudnormOutput(stderrText);
  } catch (error) {
    console.error(`Loudness analysis error for ${filePath}:`, error);
    return null;
  }
}

/**
 * Parse FFmpeg loudnorm JSON output from stderr.
 *
 * FFmpeg outputs the JSON block at the end of stderr, wrapped in a summary section.
 * We look for the JSON object containing "input_i" and "input_tp".
 */
function parseLoudnormOutput(stderr: string): LoudnessResult | null {
  // Find the JSON block — it's between the last `{` and `}` in stderr
  const jsonMatch = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s);
  if (!jsonMatch) {
    console.error("Could not find loudnorm JSON in FFmpeg output");
    return null;
  }

  try {
    const data = JSON.parse(jsonMatch[0]);
    const integratedLoudness = parseFloat(data.input_i);
    const truePeak = parseFloat(data.input_tp);

    if (isNaN(integratedLoudness) || isNaN(truePeak)) {
      console.error("Invalid loudness values:", data);
      return null;
    }

    return { integratedLoudness, truePeak };
  } catch (error) {
    console.error("Failed to parse loudnorm JSON:", error);
    return null;
  }
}

/**
 * Concatenate Uint8Arrays into one.
 */
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Calculate the playback volume multiplier to normalize loudness to target.
 *
 * Target: -14 LUFS (Spotify/YouTube standard)
 * Formula: gain_dB = target_LUFS - actual_LUFS
 *          multiplier = 10^(gain_dB / 20)
 *
 * Clamped to [0.1, 10.0] to prevent extreme values.
 */
export function calculateLoudnessMultiplier(
  integratedLoudness: number,
  targetLufs: number = -14,
): number {
  const gainDb = targetLufs - integratedLoudness;
  const multiplier = Math.pow(10, gainDb / 20);
  // Clamp to reasonable range
  return Math.max(0.1, Math.min(10.0, multiplier));
}
