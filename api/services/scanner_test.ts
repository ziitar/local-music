import {
  assertEquals,
  assertExists,
  assertGreater,
  assertNotEquals,
} from "@std/assert";
import {
  checkSongExists,
  getAudioDuration,
  getOrCreateAlbum,
  getOrCreateArtists,
  getQualityFromMetadata,
  insertSong,
  isBetterQuality,
  isFileReferencedByCue,
  parseAudioFile,
  parseCueTracks,
  scanDirectory,
  scanMusicFiles,
  shouldReplaceSong,
  SongMetadata,
} from "./scanner.ts";
import {
  cleanArtist,
  cleanTitle,
  normalizeArtist,
  normalizeTitle,
  processAllArtists,
  splitArtistWithAlias,
  t2s,
} from "../utils/metadataCleaner.ts";
import { File } from "node-taglib-sharp";
import { extname } from "@std/path";

// 测试用的真实音乐目录路径
const TEST_PATHS = {
  // 单曲音乐目录
  singleSongs: "Y:/蔡健雅",
  // WAV整轨音乐目录
  wavWholeTrack:
    "Y:/林俊杰46专辑54CD/2005-编号89757[内地版][WAV]/2005-编号89757[内地版][WAV]",
  // APE整轨音乐目录
  apeWholeTrack: "Y:/陈奕迅63专辑/1996粤语 陳奕迅.-.[陳奕迅].专辑.(APE)",
};

// ==================== 单元测试（无需数据库/文件系统） ====================

Deno.test("metadataCleaner: t2s 单元测试", async (t) => {
  await t.step("转换常见繁体字为简体", () => {
    assertEquals(t2s("為"), "为");
    assertEquals(t2s("於"), "于");
    assertEquals(t2s("後"), "后");
    assertEquals(t2s("發"), "发");
  });

  await t.step("保留简体字不变", () => {
    assertEquals(t2s("为"), "为");
    assertEquals(t2s("于"), "于");
  });

  await t.step("处理混合文本", () => {
    assertEquals(t2s("為你於後"), "为你于后");
  });
});

Deno.test("metadataCleaner: cleanTitle 单元测试", async (t) => {
  await t.step("移除 [Remastered] 后缀", () => {
    assertEquals(cleanTitle("Song [Remastered]"), "Song");
    assertEquals(cleanTitle("Song [2024 Remaster]"), "Song");
  });

  await t.step("移除 (Explicit) 后缀", () => {
    assertEquals(cleanTitle("Song (Explicit)"), "Song");
  });

  await t.step("移除中文括号内容", () => {
    assertEquals(cleanTitle("歌曲（特别版）"), "歌曲");
  });

  await t.step("处理多个后缀", () => {
    const result = cleanTitle("Song (Explicit) [Remastered]");
    assertEquals(result, "Song");
  });

  await t.step("保留普通标题", () => {
    assertEquals(cleanTitle("Normal Song Title"), "Normal Song Title");
  });
});

Deno.test("metadataCleaner: cleanArtist 单元测试", async (t) => {
  await t.step("按逗号分割", () => {
    const result = cleanArtist("Artist1, Artist2");
    assertEquals(result.length, 2);
    assertEquals(result[0], "Artist1");
    assertEquals(result[1], "Artist2");
  });

  await t.step("按 feat. 分割", () => {
    const result = cleanArtist("Artist1 feat. Artist2");
    assertEquals(result.length, 2);
    assertEquals(result[0], "Artist1");
    assertEquals(result[1], "Artist2");
  });

  await t.step("按 ft. 分割", () => {
    const result = cleanArtist("Artist1 ft. Artist2");
    assertEquals(result.length, 2);
  });

  await t.step("按 × 分割", () => {
    const result = cleanArtist("Artist1 × Artist2");
    assertEquals(result.length, 2);
  });

  await t.step("处理空字符串", () => {
    assertEquals(cleanArtist(""), []);
    assertEquals(cleanArtist(undefined), []);
  });

  await t.step("处理单个艺术家", () => {
    const result = cleanArtist("SingleArtist");
    assertEquals(result.length, 1);
    assertEquals(result[0], "SingleArtist");
  });
});

Deno.test("metadataCleaner: splitArtistWithAlias 单元测试", async (t) => {
  await t.step("提取别名 CV: 格式", () => {
    const result = splitArtistWithAlias("Artist (CV: VoiceActor)");
    assertEquals(result.name, "Artist");
    assertEquals(result.alias, "VoiceActor");
  });

  await t.step("提取括号中的别名", () => {
    const result = splitArtistWithAlias("Artist (Alias)");
    assertEquals(result.name, "Artist");
    assertEquals(result.alias, "Alias");
  });

  await t.step("处理中文括号", () => {
    const result = splitArtistWithAlias("艺术家（别名）");
    assertEquals(result.name, "艺术家");
    assertEquals(result.alias, "别名");
  });

  await t.step("处理无别名的艺术家", () => {
    const result = splitArtistWithAlias("Artist");
    assertEquals(result.name, "Artist");
    assertEquals(result.alias, undefined);
  });
});

Deno.test("metadataCleaner: normalizeTitle 单元测试", async (t) => {
  await t.step("移除后缀并转换繁简", () => {
    const result = normalizeTitle("為你 [Remastered]");
    assertEquals(result, "为你");
  });

  await t.step("保留正常标题", () => {
    assertEquals(normalizeTitle("Song Title"), "Song Title");
  });
});

Deno.test("metadataCleaner: normalizeArtist 单元测试", async (t) => {
  await t.step("仅转换繁简，不移除后缀", () => {
    const result = normalizeArtist("為你");
    assertEquals(result, "为你");
  });

  await t.step("保留括号内容", () => {
    const result = normalizeArtist("Artist (CV: Voice)");
    assertEquals(result.includes("("), true);
  });
});

Deno.test("metadataCleaner: processAllArtists 单元测试", async (t) => {
  await t.step("处理单个艺术家", () => {
    const result = processAllArtists(["Artist1"]);
    assertEquals(result.length, 1);
    assertEquals(result[0], "Artist1");
  });

  await t.step("处理多个艺术家", () => {
    const result = processAllArtists(["Artist1", "Artist2"]);
    assertEquals(result.length, 2);
  });

  await t.step("处理带分隔符的字符串", () => {
    const result = processAllArtists(["Artist1, Artist2"]);
    assertEquals(result.length, 2);
    assertEquals(result[0], "Artist1");
    assertEquals(result[1], "Artist2");
  });

  await t.step("处理带别名的艺术家", () => {
    const result = processAllArtists(["Artist (CV: VoiceActor)"]);
    assertEquals(result.length, 1);
    assertEquals(result[0], "Artist");
  });

  await t.step("去重相同艺术家", () => {
    const result = processAllArtists(["Artist1", "Artist1"]);
    assertEquals(result.length, 1);
  });

  await t.step("处理空数组", () => {
    const result = processAllArtists([]);
    assertEquals(result.length, 0);
  });

  await t.step("处理复杂情况：分隔符+别名+繁简转换", () => {
    const result = processAllArtists(["為你 (CV: Voice), Artist2"]);
    assertEquals(result.includes("为你"), true);
    assertEquals(result.includes("Artist2"), true);
  });
});

Deno.test("scanner: getQualityFromMetadata 单元测试", async (t) => {
  await t.step("无损格式返回 lossless", () => {
    assertEquals(getQualityFromMetadata(true, 1000000, ".flac"), "lossless");
    assertEquals(getQualityFromMetadata(false, 0, ".flac"), "lossless");
    assertEquals(getQualityFromMetadata(false, 0, ".wav"), "lossless");
    assertEquals(getQualityFromMetadata(false, 0, ".ape"), "lossless");
  });

  await t.step("有损格式根据比特率判断", () => {
    assertEquals(getQualityFromMetadata(false, 320000, ".mp3"), "320k");
    assertEquals(getQualityFromMetadata(false, 256000, ".mp3"), "192k");
    assertEquals(getQualityFromMetadata(false, 192000, ".mp3"), "192k");
    assertEquals(getQualityFromMetadata(false, 128000, ".mp3"), "128k");
    assertEquals(getQualityFromMetadata(false, 96000, ".mp3"), "unknown");
  });

  await t.step("未知格式返回 unknown", () => {
    assertEquals(getQualityFromMetadata(false, 0, ".unknown"), "unknown");
  });
});

Deno.test("scanner: isBetterQuality 单元测试", async (t) => {
  await t.step("lossless 比有损格式质量高", () => {
    assertEquals(
      isBetterQuality({ quality: "lossless" }, { quality: "320k" }),
      true,
    );
    assertEquals(
      isBetterQuality({ quality: "lossless" }, { quality: "128k" }),
      true,
    );
  });

  await t.step("高比特率比低比特率质量高", () => {
    assertEquals(
      isBetterQuality({ quality: "320k" }, { quality: "192k" }),
      true,
    );
  });

  await t.step("低比特率比高比特率质量低", () => {
    assertEquals(
      isBetterQuality({ quality: "128k" }, { quality: "320k" }),
      false,
    );
  });

  await t.step("相同质量返回 false", () => {
    assertEquals(
      isBetterQuality({ quality: "320k" }, { quality: "320k" }),
      false,
    );
    assertEquals(
      isBetterQuality({ quality: "lossless" }, { quality: "lossless" }),
      false,
    );
  });

  await t.step("unknown 质量最低", () => {
    assertEquals(
      isBetterQuality({ quality: "128k" }, { quality: "unknown" }),
      true,
    );
    assertEquals(
      isBetterQuality({ quality: "unknown" }, { quality: "128k" }),
      false,
    );
  });
});

Deno.test("scanner: isFileReferencedByCue 单元测试", async (t) => {
  await t.step("正确识别被 CUE 引用的文件", () => {
    const cueData = new Map<string, SongMetadata[]>();
    cueData.set("/path/to/album.cue", [{
      title: "Track 1",
      artist: "Artist",
      artists: ["Artist"],
      album: "Album",
      duration: 300,
      quality: "lossless",
      fileSize: 1000000,
      format: ".flac",
      filePath: "/path/to/audio.flac#track-0",
      isCueTrack: true,
      cueFilePath: "/path/to/album.cue",
      trackStartTime: 0,
      trackEndTime: 300,
    }]);

    assertEquals(isFileReferencedByCue("/path/to/audio.flac", cueData), true);
    assertEquals(isFileReferencedByCue("/path/to/other.flac", cueData), false);
  });

  await t.step("Windows 路径分隔符兼容", () => {
    const cueData = new Map<string, SongMetadata[]>();
    cueData.set("C:/Music/album.cue", [{
      title: "Track 1",
      artist: "Artist",
      artists: ["Artist"],
      album: "Album",
      duration: 300,
      quality: "lossless",
      fileSize: 1000000,
      format: ".flac",
      filePath: "C:/Music/audio.flac#track-0",
      isCueTrack: true,
      cueFilePath: "C:/Music/album.cue",
      trackStartTime: 0,
      trackEndTime: 300,
    }]);

    // Windows 使用反斜杠
    assertEquals(isFileReferencedByCue("C:\\Music\\audio.flac", cueData), true);
  });

  await t.step("空 CUE 数据返回 false", () => {
    const cueData = new Map<string, SongMetadata[]>();
    assertEquals(isFileReferencedByCue("/path/to/audio.flac", cueData), false);
  });
});

// ==================== 文件系统集成测试（需要实际文件，无数据库） ====================

Deno.test("scanner: 文件扫描测试", async (t) => {
  const { audioFiles, cueFiles } = await scanDirectory(TEST_PATHS.singleSongs);

  await t.step("scanDirectory 返回正确格式", () => {
    assertEquals(Array.isArray(audioFiles), true, "audioFiles 应该是数组");
    assertEquals(Array.isArray(cueFiles), true, "cueFiles 应该是数组");
  });

  // 如果目录不存在或无文件，跳过后续测试
  if (audioFiles.length === 0) {
    console.log("跳过文件扫描测试：目录不存在或无文件");
    return;
  }

  // 测试解析第一个音频文件
  if (audioFiles.length > 0) {
    await t.step("parseAudioFile 解析音频文件", async () => {
      const audioFile = await parseAudioFile(audioFiles[0]);
      if (audioFile) {
        assertExists(audioFile.title, "应该解析出标题");
        assertExists(audioFile.artist, "应该解析出艺术家");
        assertExists(audioFile.album, "应该解析出专辑");
        assertGreater(audioFile.duration, 0, "应该有有效的时长");
        assertExists(audioFile.quality, "应该有音质信息");
      }
    });

    await t.step("parseAudioFile 提取所有艺术家数组", async () => {
      const audioFile = await parseAudioFile(audioFiles[0]);
      if (audioFile) {
        assertExists(audioFile.artists, "应该有 artists 数组");
        assertEquals(Array.isArray(audioFile.artists), true, "artists 应该是数组");
        assertGreater(audioFile.artists.length, 0, "应该至少有一个艺术家");
      }
    });

    await t.step("parseAudioFile 提取音轨号和年份（如果存在）", async () => {
      const audioFile = await parseAudioFile(audioFiles[0]);
      if (audioFile) {
        // trackNo and year are optional, just verify they're valid if present
        if (audioFile.trackNo !== undefined) {
          assertGreater(audioFile.trackNo, 0, "音轨号应该大于 0");
        }
        if (audioFile.trackTotal !== undefined) {
          assertGreater(audioFile.trackTotal, 0, "总音轨数应该大于 0");
        }
        if (audioFile.year !== undefined) {
          assertGreater(audioFile.year, 1900, "年份应该合理");
        }
      }
    });

    await t.step("parseAudioFile 单次提取封面（如果存在）", async () => {
      const audioFile = await parseAudioFile(audioFiles[0]);
      if (audioFile && audioFile.coverData) {
        assertExists(audioFile.coverData.data, "应该有封面数据");
        assertExists(audioFile.coverData.mimeType, "应该有 MIME 类型");
        assertGreater(audioFile.coverData.data.length, 0, "封面数据不应为空");
      }
    });

    await t.step("getQualityFromMetadata 从实际文件获取质量", async () => {
      const file = await File.createFromPath(audioFiles[0]);
      const quality = getQualityFromMetadata(
        false,
        file.properties.audioBitrate,
        extname(audioFiles[0]),
      );
      assertNotEquals(quality, "unknown", "应该正确识别音频质量");
    });

    await t.step("getAudioDuration 获取时长", async () => {
      const duration = await getAudioDuration(audioFiles[0]);
      assertGreater(duration, 0, "应该返回有效的音频时长");
    });
  }
});

Deno.test("scanner: CUE文件解析测试", async (t) => {
  const { audioFiles, cueFiles } = await scanDirectory(
    TEST_PATHS.wavWholeTrack,
  );
  await t.step("CUE文件解析测试", () => {
    assertGreater(cueFiles.length, 0, "应该解析出CUE文件");
  });
  if (cueFiles.length === 0) {
    console.log("跳过CUE解析测试：无CUE文件");
    return;
  }

  const cueFile = await parseCueTracks(cueFiles[0]);

  await t.step("parseCueTracks 解析CUE文件", () => {
    if (cueFile.length > 0) {
      assertGreater(cueFile.length, 0, "应该成功解析CUE文件");
      assertExists(cueFile[0].title, "应该解析出标题");
      assertExists(cueFile[0].artist, "应该解析出艺术家");
      assertExists(cueFile[0].album, "应该解析出专辑");
      assertEquals(cueFile[0].isCueTrack, true, "应该标记为CUE音轨");
      assertExists(cueFile[0].cueFilePath, "应该有CUE文件路径");
      assertExists(cueFile[0].trackStartTime, "应该有起始时间");
    }
  });

  await t.step("parseCueTracks 提取艺术家数组", () => {
    if (cueFile.length > 0) {
      assertExists(cueFile[0].artists, "应该有 artists 数组");
      assertEquals(Array.isArray(cueFile[0].artists), true, "artists 应该是数组");
      assertGreater(cueFile[0].artists.length, 0, "应该至少有一个艺术家");
    }
  });

  await t.step("parseCueTracks 提取音轨号和总数", () => {
    if (cueFile.length > 0) {
      assertExists(cueFile[0].trackNo, "应该有音轨号");
      assertExists(cueFile[0].trackTotal, "应该有总音轨数");
      assertGreater(cueFile[0].trackNo, 0, "音轨号应该大于 0");
      assertGreater(cueFile[0].trackTotal, 0, "总音轨数应该大于 0");
    }
  });

  if (cueFile.length > 0 && audioFiles.length > 0) {
    await t.step("isFileReferencedByCue 集成测试", () => {
      const cueTracksMap = new Map<string, SongMetadata[]>();
      cueTracksMap.set(cueFiles[0], cueFile);
      const isReferenced = isFileReferencedByCue(audioFiles[0], cueTracksMap);
      assertEquals(isReferenced, true, "音频文件应该被CUE文件引用");
    });
  }
});

// ==================== 数据库集成测试（需要数据库连接） ====================
// 运行此测试需要确保数据库连接正常
// 使用 deno test -A --env-file api/services/scanner_test.ts 运行
// 注意：postgres 库在连接失败时会留下未清理的资源，需要禁用资源检查

Deno.test({
  name: "scanner: 数据库集成测试",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async (t) => {
    // 首先检查数据库连接
    let dbAvailable = false;
    try {
      const { audioFiles } = await scanDirectory(TEST_PATHS.singleSongs);
      if (audioFiles.length > 0) {
        const audioFile = await parseAudioFile(audioFiles[0]);
        if (audioFile) {
          // 尝试获取艺术家，如果失败说明数据库不可用
          await getOrCreateArtists(audioFile.artist);
          dbAvailable = true;
        }
      }
    } catch (error) {
      console.log(
        "数据库连接不可用，跳过数据库集成测试:",
        (error as Error).message,
      );
      return;
    }

    if (!dbAvailable) {
      console.log("跳过数据库集成测试：无法连接数据库");
      return;
    }

    const { audioFiles } = await scanDirectory(TEST_PATHS.singleSongs);
    if (audioFiles.length === 0) {
      console.log("跳过数据库测试：无音频文件");
      return;
    }

    const audioFile = await parseAudioFile(audioFiles[0]);
    if (!audioFile) {
      console.log("跳过数据库测试：无法解析音频文件");
      return;
    }

    await t.step("getOrCreateArtists 创建或获取艺术家", async () => {
      const artists = await getOrCreateArtists(audioFile.artist);
      assertGreater(artists.length, 0, "应该成功创建或获取艺术家");
      assertExists(artists[0].id, "应该返回艺术家ID");
      assertExists(artists[0].position, "应该返回艺术家位置");
    });

    await t.step("getOrCreateAlbum 创建或获取专辑", async () => {
      const albumId = await getOrCreateAlbum(audioFile.album, null, {});
      assertExists(albumId, "应该成功创建或获取专辑");
    });

    await t.step("insertSong 插入歌曲", async () => {
      const sqlResult = await insertSong(audioFile);
      assertEquals(sqlResult, true, "应该成功插入歌曲到数据库");
    });

    await t.step("checkSongExists 检查歌曲存在", async () => {
      // 如果歌曲不存在（可能被 better quality 删除了），先插入
      const { exists: preCheck } = await checkSongExists(audioFile);
      if (!preCheck) {
        await insertSong(audioFile);
      }

      const { exists, shouldReplace, existingId } = await checkSongExists(
        audioFile,
      );
      assertEquals(exists, true, "应该在数据库中找到已存在的歌曲");
      assertEquals(
        typeof shouldReplace,
        "boolean",
        "shouldReplace应该是布尔值",
      );
      assertExists(existingId, "应该返回已存在歌曲的ID");
    });

    await t.step("shouldReplaceSong 质量对比", async () => {
      const { shouldInsert, existingId } = await shouldReplaceSong(audioFile);
      assertEquals(typeof shouldInsert, "boolean", "shouldInsert应该是布尔值");
      if (!shouldInsert) {
        assertExists(existingId, "如果不插入，应该返回已存在歌曲的ID");
      }
    });

    await t.step("scanMusicFiles 完整扫描", async () => {
      const result = await scanMusicFiles(TEST_PATHS.singleSongs);
      assertEquals(result.success, true, "应该成功扫描音乐目录");
      assertGreater(result.scanned, 0, "应该扫描了文件");
    });
  },
});
