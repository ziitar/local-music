import { Router } from "@oak/oak";
import { sql } from "../services/db.ts";
import { scanMusicFiles } from "../services/scanner.ts";
import { parseBitrate } from "../utils/metadataCleaner.ts";
import { requireAdmin } from "../middleware/admin.ts";
import { analyzeLoudness } from "../utils/loudnessAnalyzer.ts";

const router = new Router();

// Global map to track active CUE streams for interrupt handling
const activeCueStreams = new Map<string, Deno.ChildProcess>();

// 读取配置文件获取ffmpeg路径
function getFfmpegPath(): string | null {
  try {
    const ffmpegPath = Deno.env.get("FFMPEG_PATH");
    console.log("FFmpeg path:", ffmpegPath);
    return ffmpegPath || null;
  } catch {
    return null;
  }
}

// Get music source paths from database config table
async function getMusicConfig(): Promise<{ sources: string[]; exclude: string[] }> {
  try {
    const result = await sql`
      SELECT key, value FROM config WHERE key IN ('music_sources', 'exclude_paths')
    `;

    console.log("Database config result:", JSON.stringify(result));

    const config: { sources: string[]; exclude: string[] } = { sources: [], exclude: [] };

    for (const row of result) {
      const value = row.value;
      console.log(`Config row: key=${row.key}, value=${JSON.stringify(value)}`);

      // Handle JSONB value - could be string, object, or array
      let parsedValue = value;
      if (typeof value === 'string') {
        try {
          parsedValue = JSON.parse(value);
        } catch {
          parsedValue = [];
        }
      }

      // Ensure values are arrays for these keys
      if (row.key === 'music_sources' && Array.isArray(parsedValue)) {
        config.sources = parsedValue.filter((v): v is string => typeof v === 'string');
      } else if (row.key === 'exclude_paths' && Array.isArray(parsedValue)) {
        config.exclude = parsedValue.filter((v): v is string => typeof v === 'string');
      }
    }

    console.log("Final config from database:", JSON.stringify(config));
    return config;
  } catch (error) {
    console.error("Database config error:", error);
    return { sources: [], exclude: [] };
  }
}

router.post("/api/songs/scan", requireAdmin, async (ctx) => {
  try {
    const { sources, exclude } = await getMusicConfig();

    console.log(`Scan request - Sources: ${JSON.stringify(sources)}, Exclude: ${JSON.stringify(exclude)}`);

    if (sources.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "No source paths configured",
      };
      return;
    }

    let totalScanned = 0;
    let totalAdded = 0;
    let totalSkipped = 0;

    // Scan each source path
    for (const sourcePath of sources) {
      console.log(`Scanning source path: ${sourcePath}`);
      const result = await scanMusicFiles(sourcePath, exclude);
      totalScanned += result.scanned;
      totalAdded += result.added;
      totalSkipped += result.skipped || 0;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: `Scanned ${totalScanned} items, added ${totalAdded} new songs, skipped ${totalSkipped} unchanged`,
      scanned: totalScanned,
      added: totalAdded,
      skipped: totalSkipped,
    };
  } catch (error) {
    console.error("Scan error:", error);
    ctx.response.status = 500;
    ctx.response.body = { success: false, message: `Scan failed: ${error}` };
  }
});

/**
 * POST /api/songs/analyze-loudness
 * Batch analyze loudness for all songs missing loudness data.
 * Admin only. Runs in background, returns immediately.
 */
router.post("/api/songs/analyze-loudness", requireAdmin, async (ctx) => {
  try {
    const songs = await sql`
      SELECT id, title, file_path, is_cue_track
      FROM songs
      WHERE integrated_loudness IS NULL
      ORDER BY id
    `;

    if (songs.length === 0) {
      ctx.response.body = { success: true, message: "All songs already have loudness data", analyzed: 0 };
      return;
    }

    ctx.response.body = {
      success: true,
      message: `Starting loudness analysis for ${songs.length} songs`,
      total: songs.length,
    };

    // Run analysis in background (respond immediately)
    (async () => {
      let analyzed = 0;
      let failed = 0;
      for (const song of songs) {
        try {
          const audioPath = song.is_cue_track
            ? song.file_path.split("#track-")[0]
            : song.file_path;
          const loudness = await analyzeLoudness(audioPath);
          if (loudness) {
            await sql`
              UPDATE songs
              SET integrated_loudness = ${loudness.integratedLoudness},
                  true_peak = ${loudness.truePeak}
              WHERE id = ${song.id}
            `;
            analyzed++;
            console.log(`[loudness] ${analyzed}/${songs.length} — "${song.title}": ${loudness.integratedLoudness} LUFS`);
          } else {
            failed++;
          }
        } catch (err) {
          failed++;
          console.warn(`[loudness] Failed for "${song.title}":`, err);
        }
      }
      console.log(`[loudness] Batch complete: ${analyzed} analyzed, ${failed} failed`);
    })();
  } catch (error) {
    console.error("Loudness analysis error:", error);
    ctx.response.status = 500;
    ctx.response.body = { success: false, message: `Analysis failed: ${error}` };
  }
});

router.get("/api/songs", async (ctx) => {
  const url = new URL(ctx.request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const search = url.searchParams.get("search") || "";
  const quality = url.searchParams.get("quality") || "";
  const artist = url.searchParams.get("artist") || "";

  const offset = (page - 1) * limit;

  // Query with multiple artists via subquery
  let query = sql`
    SELECT s.id, s.title,
           COALESCE((
             SELECT string_agg(ar2.name, ', ' ORDER BY sa2.position)
             FROM song_artists sa2
             JOIN artists ar2 ON sa2.artist_id = ar2.id
             WHERE sa2.song_id = s.id
           ), 'Unknown Artist') as artist,
           COALESCE(al.title, 'Unknown Album') as album,
           s.duration, s.quality, s.file_size, s.format, s.created_at,
           s.is_cue_track, s.cue_file_path, s.track_start_time, track_end_time,
           s.cover_image, s.integrated_loudness, s.true_peak
    FROM songs s
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE 1=1
  `;

  if (search) {
    query = sql`${query} AND (s.title ILIKE ${"%" + search + "%"} OR EXISTS (
      SELECT 1 FROM song_artists sa2 JOIN artists ar2 ON sa2.artist_id = ar2.id
      WHERE sa2.song_id = s.id AND ar2.name ILIKE ${"%" + search + "%"}
    ) OR al.title ILIKE ${"%" + search + "%"})`;
  }

  if (quality) {
    query = sql`${query} AND s.quality = ${quality}`;
  }

  if (artist) {
    query = sql`${query} AND EXISTS (
      SELECT 1 FROM song_artists sa2 JOIN artists ar2 ON sa2.artist_id = ar2.id
      WHERE sa2.song_id = s.id AND ar2.name = ${artist}
    )`;
  }

  query =
    sql`${query} ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  // Separate count query
  let countQuery = sql`
    SELECT COUNT(*) as total FROM songs s
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE 1=1
  `;

  if (search) {
    countQuery = sql`${countQuery} AND (s.title ILIKE ${
      "%" + search + "%"
    } OR EXISTS (
      SELECT 1 FROM song_artists sa2 JOIN artists ar2 ON sa2.artist_id = ar2.id
      WHERE sa2.song_id = s.id AND ar2.name ILIKE ${"%" + search + "%"}
    ) OR al.title ILIKE ${"%" + search + "%"})`;
  }
  if (quality) {
    countQuery = sql`${countQuery} AND s.quality = ${quality}`;
  }
  if (artist) {
    countQuery = sql`${countQuery} AND EXISTS (
      SELECT 1 FROM song_artists sa2 JOIN artists ar2 ON sa2.artist_id = ar2.id
      WHERE sa2.song_id = s.id AND ar2.name = ${artist}
    )`;
  }

  const songs = (await query).map((s: Record<string, unknown>) => ({
    ...s,
    file_size: Number(s.file_size),
  }));
  const countResult = await countQuery;
  const total = Number(countResult[0]?.total || 0);

  ctx.response.body = {
    songs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
});

router.get("/api/songs/:id", async (ctx) => {
  const id = parseInt(ctx.params.id);

  if (isNaN(id)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Invalid song ID" };
    return;
  }

  const result = await sql`
    SELECT s.id, s.title,
           COALESCE((
             SELECT string_agg(ar2.name, ', ' ORDER BY sa2.position)
             FROM song_artists sa2
             JOIN artists ar2 ON sa2.artist_id = ar2.id
             WHERE sa2.song_id = s.id
           ), 'Unknown Artist') as artist,
           COALESCE(al.title, 'Unknown Album') as album,
           s.duration, s.file_path, s.quality, s.file_size, s.format, s.created_at,
           s.is_cue_track, s.cue_file_path, s.track_start_time, s.track_end_time,
           s.cover_image, s.integrated_loudness, s.true_peak
    FROM songs s
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE s.id = ${id}
  `;

  if (result.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { message: "Song not found" };
    return;
  }

  ctx.response.body = {
    ...result[0],
    file_size: Number(result[0].file_size),
  };
});

router.get("/api/songs/:id/stream", async (ctx) => {
  const id = parseInt(ctx.params.id);
  const requestedBitrate = ctx.request.url.searchParams.get("bitrate");

  if (isNaN(id)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Invalid song ID" };
    return;
  }

  const result = await sql`
    SELECT s.id, s.title, s.file_path, s.format, s.quality, s.original_bitrate,
           s.is_cue_track, s.cue_file_path, s.track_start_time, s.track_end_time
    FROM songs s
    WHERE s.id = ${id}
  `;

  if (result.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { message: "Song not found" };
    return;
  }

  const song = result[0];

  try {
    // Handle bitrate transcoding request for regular files
    if (requestedBitrate && !song.is_cue_track && song.original_bitrate) {
      const targetBitrate = parseBitrate(requestedBitrate);

      // Only transcode if target is lower than original
      // For "lossless" requests on lossy files, just stream original
      if (targetBitrate > 0 && targetBitrate < song.original_bitrate) {
        console.log(
          `Transcoding song ${song.id} from ${song.original_bitrate}kbps to ${targetBitrate}kbps`,
        );
        await streamTranscoded(ctx, song, targetBitrate);
        return;
      }

      // If target is equal or higher than original, just stream original
      if (targetBitrate >= song.original_bitrate) {
        console.log(
          `Streaming original (requested ${targetBitrate}kbps, original is ${song.original_bitrate}kbps)`,
        );
      }
    }

    // 处理整轨音乐（CUE音轨）
    if (song.is_cue_track) {
      const targetBitrate = requestedBitrate
        ? parseBitrate(requestedBitrate)
        : null;
      await streamCueTrack(ctx, song, targetBitrate);
      return;
    }

    // 普通单曲播放
    await streamRegularFile(ctx, song);
  } catch (error) {
    console.error("Stream error:", error);
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to stream file" };
  }
});

/**
 * 流式传输普通音频文件（支持断点续传和Chunked Transfer）
 */
async function streamRegularFile(ctx: any, song: any) {
  const file = await Deno.open(song.file_path, { read: true });
  const fileStat = await file.stat();
  const fileSize = fileStat.size;

  const range = ctx.request.headers.get("range");

  // Default chunk size when no end range specified (2MB)
  const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024;

  if (range) {
    // Handle Range request for seeking/resuming
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0]) || 0;

    // If no end specified, limit to DEFAULT_CHUNK_SIZE for better streaming
    let end: number;
    if (parts[1] && parts[1].trim() !== "") {
      end = parseInt(parts[1]);
    } else {
      // No end specified - return a chunk instead of entire file
      end = Math.min(start + DEFAULT_CHUNK_SIZE - 1, fileSize - 1);
    }

    const chunkSize = end - start + 1;

    ctx.response.status = 206;
    ctx.response.headers.set(
      "Content-Range",
      `bytes ${start}-${end}/${fileSize}`,
    );
    ctx.response.headers.set("Accept-Ranges", "bytes");
    ctx.response.headers.set("Content-Length", chunkSize.toString());
    ctx.response.headers.set("Content-Type", getContentType(song.format));

    // Stream the requested range
    await file.seek(start, Deno.SeekMode.Start);
    const buffer = new Uint8Array(chunkSize); // 2MB chunks
    const bytesRead = await file.read(buffer);
    if(!bytesRead) {
      ctx.response.status = 500;
      ctx.response.body = { message: "Failed to read file" };
    }
    ctx.response.body = buffer;
  } else {
    // Full file streaming with chunked transfer
    ctx.response.status = 200;
    ctx.response.headers.set("Content-Length", fileSize.toString());
    ctx.response.headers.set("Content-Type", getContentType(song.format));
    ctx.response.headers.set("Accept-Ranges", "bytes");

    // Stream file in chunks
    const stream = new ReadableStream({
      async pull(controller) {
        const buffer = new Uint8Array(64 * 1024); // 64KB chunks
        const bytesRead = await file.read(buffer);

        if (bytesRead === null) {
          file.close();
          controller.close();
        } else {
          controller.enqueue(buffer.slice(0, bytesRead));
        }
      },
      cancel() {
        file.close();
      },
    });

    ctx.response.body = stream;
  }
}

/**
 * 使用ffmpeg流式传输整轨音乐中的特定音轨（支持中断和转码）
 */
async function streamCueTrack(ctx: any, song: any, targetBitrate?: number | null) {
  const ffmpegPath = getFfmpegPath();

  if (!ffmpegPath) {
    ctx.response.status = 500;
    ctx.response.body = { message: "FFmpeg not configured" };
    return;
  }

  // 提取源音频文件路径（去掉#track-后缀）
  const sourceFile = song.file_path.split("#track-")[0];
  const startTime = song.track_start_time || 0;
  const endTime = song.track_end_time;

  // 检查源文件是否存在
  try {
    await Deno.stat(sourceFile);
  } catch {
    ctx.response.status = 404;
    ctx.response.body = { message: "Source audio file not found" };
    return;
  }

  // 生成唯一的stream ID用于追踪
  const streamId = `${song.id}_${Date.now()}`;

  // 判断是否需要转码（目标比特率小于原始比特率）
  const originalBitrate = song.original_bitrate || 1411; // Default to CD quality for lossless
  const shouldTranscode = targetBitrate && targetBitrate > 0 && targetBitrate < originalBitrate;

  // 构建ffmpeg命令参数
  const { format: outputFormat, codec } = getFfmpegFormat(song.format);
  const args = [
    "-hwaccel",
    "vaapi", // Intel GPU hardware acceleration
    "-ss",
    startTime.toString(), // 开始时间
    ...(endTime ? ["-to", endTime.toString()] : []), // 结束时间（如果有）
    "-i",
    sourceFile, // 输入文件
    ...(shouldTranscode ? ["-b:a", `${targetBitrate}k`] : []), // 目标比特率（如果需要转码）
    "-f",
    shouldTranscode ? "mp3" : outputFormat, // 转码时输出MP3，否则保持原格式
    "-acodec",
    shouldTranscode ? "libmp3lame" : codec, // 转码时使用libmp3lame，否则按原格式
    "-vn", // 禁用视频
    "-map_metadata",
    "-1", // 跳过元数据以加快处理
    "-", // 输出到stdout
  ];

  if (shouldTranscode) {
    console.log(
      `Transcoding CUE track ${song.id} from ${originalBitrate}kbps to ${targetBitrate}kbps`,
    );
  }

  // 执行ffmpeg命令
  const command = new Deno.Command(ffmpegPath, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();

  // 追踪这个活动流
  activeCueStreams.set(streamId, process);

  // 设置响应头（注意：APE格式输出为FLAC，转码时输出MP3）
  ctx.response.status = 200;
  let outputContentType: string;
  if (shouldTranscode) {
    outputContentType = "audio/mpeg";
  } else if (song.format === ".ape") {
    outputContentType = "audio/flac";
  } else {
    outputContentType = getContentType(song.format);
  }
  ctx.response.headers.set("Content-Type", outputContentType);
  ctx.response.headers.set("Accept-Ranges", "none"); // ffmpeg流不支持range请求
  if (shouldTranscode) {
    ctx.response.headers.set("Cache-Control", "no-cache");
  }

  // 流式传输
  const reader = process.stdout.getReader();
  const stderrReader = process.stderr.getReader();
  const decoder = new TextDecoder();
  let isCancelled = false;

  const stream = new ReadableStream({
    async pull(controller) {
      if (isCancelled) return;
      try {
        const { done, value } = await reader.read();
        // Check again after async operation - stream might be cancelled during read
        if (isCancelled) return;
        if (done) {
          activeCueStreams.delete(streamId);
          try {
            controller.close();
          } catch {
            // Controller might already be closed
          }
        } else {
          try {
            controller.enqueue(value);
          } catch {
            // Stream might be cancelled during enqueue
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("CUE stream error:", error);
        }
        activeCueStreams.delete(streamId);
        try {
          controller.close();
        } catch {
          // Controller might already be closed
        }
      }
    },
    cancel() {
      isCancelled = true;
      activeCueStreams.delete(streamId);
      try {
        reader.releaseLock();
      } catch {
        // Locks might already be released
      }
      try {
        stderrReader.releaseLock();
      } catch {
        // Locks might already be released
      }
      try {
        process.kill();
      } catch {
        // 进程可能已结束
      }
    },
  });

  ctx.response.body = stream;

  // 处理ffmpeg错误输出（当客户端断开时停止读取）
  (async () => {
    try {
      while (!isCancelled) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        if (!isCancelled) {
          console.log(decoder.decode(value));
        }
      }
    } catch {
      // 忽略错误（可能是流被取消）
    } finally {
      activeCueStreams.delete(streamId);
    }
  })();
}

/**
 * 使用ffmpeg转码音频流（用于降低比特率）
 */
async function streamTranscoded(ctx: any, song: any, targetBitrate: number) {
  const ffmpegPath = getFfmpegPath();

  if (!ffmpegPath) {
    ctx.response.status = 500;
    ctx.response.body = { message: "FFmpeg not configured" };
    return;
  }

  // 检查源文件是否存在
  try {
    await Deno.stat(song.file_path);
  } catch {
    ctx.response.status = 404;
    ctx.response.body = { message: "Source audio file not found" };
    return;
  }

  const streamId = `transcode_${song.id}_${Date.now()}`;

  // 构建ffmpeg转码命令
  // Use -map_metadata -1 to skip metadata for faster transcoding
  const args = [
    "-hwaccel",
    "vaapi", // Intel GPU hardware acceleration
    "-i",
    song.file_path, // 输入文件
    "-map_metadata",
    "-1", // Skip metadata for speed
    "-b:a",
    `${targetBitrate}k`, // 目标比特率
    "-f",
    "mp3", // 输出为MP3
    "-vn", // No video
    "-", // 输出到stdout
  ];

  console.log(`FFmpeg transcoding args: ${args.join(" ")}`);

  // 执行ffmpeg命令
  const command = new Deno.Command(ffmpegPath, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  let process: Deno.ChildProcess;
  try {
    process = command.spawn();
  } catch (error) {
    console.error("Failed to spawn ffmpeg:", error);
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to start transcoding" };
    return;
  }

  activeCueStreams.set(streamId, process);

  // 设置响应头
  ctx.response.status = 200;
  ctx.response.headers.set("Content-Type", "audio/mpeg");
  ctx.response.headers.set("Accept-Ranges", "none");
  ctx.response.headers.set("Cache-Control", "no-cache");

  // 流式传输
  const reader = process.stdout.getReader();
  const stderrReader = process.stderr.getReader();
  let isCancelled = false;

  const stream = new ReadableStream({
    async pull(controller) {
      if (isCancelled) return;
      try {
        const { done, value } = await reader.read();
        // Check again after async operation - stream might be cancelled during read
        if (isCancelled) return;
        if (done) {
          activeCueStreams.delete(streamId);
          try {
            controller.close();
          } catch {
            // Controller might already be closed
          }
        } else {
          try {
            controller.enqueue(value);
          } catch {
            // Stream might be cancelled during enqueue
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Transcoding stream error:", error);
        }
        activeCueStreams.delete(streamId);
        try {
          controller.close();
        } catch {
          // Controller might already be closed
        }
      }
    },
    cancel() {
      isCancelled = true;
      activeCueStreams.delete(streamId);
      try {
        reader.releaseLock();
      } catch {
        // Locks might already be released
      }
      try {
        stderrReader.releaseLock();
      } catch {
        // Locks might already be released
      }
      try {
        process.kill();
      } catch {
        // 进程可能已结束
      }
    },
  });

  ctx.response.body = stream;

  // 处理ffmpeg错误输出
  const decoder = new TextDecoder();
  (async () => {
    try {
      while (!isCancelled) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        if (!isCancelled) {
          const msg = decoder.decode(value);
          if (msg.includes("error") || msg.includes("Error")) {
            console.error("FFmpeg error:", msg);
          }
        }
      }
    } catch {
      // 忽略错误
    } finally {
      activeCueStreams.delete(streamId);
    }
  })();
}

/**
 * 停止指定歌曲的所有活动流
 */
router.post("/api/songs/stop-stream", async (ctx) => {
  const body = await ctx.request.body.json();
  const songId = body?.songId;

  if (!songId) {
    ctx.response.status = 400;
    ctx.response.body = { message: "songId is required" };
    return;
  }

  let stopped = false;
  for (const [id, proc] of activeCueStreams) {
    if (id.startsWith(`${songId}_`) || id.startsWith(`transcode_${songId}_`)) {
      try {
        proc.kill();
        activeCueStreams.delete(id);
        stopped = true;
      } catch {
        // 忽略错误
      }
    }
  }

  ctx.response.body = {
    message: stopped ? "Stream stopped" : "No active stream",
  };
});

/**
 * 获取ffmpeg格式参数和编码设置
 * 返回 { format: 输出格式, codec: 编码器 }
 * codec 为 'copy' 表示直接复制，为其他值表示需要重新编码
 */
function getFfmpegFormat(format: string): { format: string; codec: string } {
  const formats: Record<string, { format: string; codec: string }> = {
    ".mp3": { format: "mp3", codec: "copy" },
    ".flac": { format: "flac", codec: "copy" },
    ".wav": { format: "wav", codec: "copy" },
    ".ogg": { format: "ogg", codec: "copy" },
    ".m4a": { format: "ipod", codec: "copy" },
    ".aac": { format: "adts", codec: "copy" },
    ".wma": { format: "asf", codec: "copy" },
    ".ape": { format: "flac", codec: "flac" }, // APE需要转码为FLAC（无损转换）
    ".wv": { format: "wv", codec: "copy" },
  };
  return formats[format] ?? { format: "mp3", codec: "libmp3lame" };
}

router.delete("/api/songs/:id", async (ctx) => {
  const id = parseInt(ctx.params.id);

  if (isNaN(id)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Invalid song ID" };
    return;
  }

  await sql`DELETE FROM songs WHERE id = ${id}`;

  ctx.response.body = { message: "Song deleted" };
});

function getContentType(format: string): string {
  const types: Record<string, string> = {
    mp3: "audio/mpeg",
    flac: "audio/flac",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    wma: "audio/x-ms-wma",
    ape: "audio/ape",
    wv: "audio/x-wavpack",
  };
  // 移除可能的点前缀
  const cleanFormat = format.replace(/^\./, "");
  return types[cleanFormat] || "audio/mpeg";
}

export default router;
