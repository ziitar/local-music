import { Router } from "@oak/oak";

const router = new Router();

// Simple in-memory cache for lyrics (key: "title|artist", value: { lrc, expiry })
const lyricsCache = new Map<string, { lrc: string | null; translated_lrc: string | null; expiry: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCached(key: string): { lrc: string | null; translated_lrc: string | null } | null {
  const cached = lyricsCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return { lrc: cached.lrc, translated_lrc: cached.translated_lrc };
  }
  if (cached) {
    lyricsCache.delete(key);
  }
  return null;
}

function setCache(key: string, lrc: string | null, translated_lrc: string | null): void {
  lyricsCache.set(key, { lrc, translated_lrc, expiry: Date.now() + CACHE_TTL });
}

// Proxy NetEase Cloud Music API for lyrics
router.get("/api/lyrics", async (ctx) => {
  const url = new URL(ctx.request.url);
  const title = url.searchParams.get("title") || "";
  const artist = url.searchParams.get("artist") || "";

  if (!title) {
    ctx.response.status = 400;
    ctx.response.body = { message: "title parameter is required" };
    return;
  }

  const cacheKey = `${title}|${artist}`;

  // Check cache first
  const cached = getCached(cacheKey);
  if (cached) {
    ctx.response.body = cached;
    return;
  }

  try {
    // Step 1: Search for the song on NetEase
    const keyword = `${title} ${artist}`.trim();
    const searchUrl = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=1&limit=5`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://music.163.com/",
      },
    });

    if (!searchResponse.ok) {
      setCache(cacheKey, null, null);
      ctx.response.body = { lrc: null };
      return;
    }

    const searchData = await searchResponse.json();

    if (!searchData?.result?.songs || searchData.result.songs.length === 0) {
      setCache(cacheKey, null, null);
      ctx.response.body = { lrc: null };
      return;
    }

    // Step 2: Find the best match by comparing title similarity
    let bestMatch: { id: number; name: string; artists: { name: string }[] } | null = null;
    let bestScore = 0;

    for (const song of searchData.result.songs) {
      let score = 0;
      const neteaseTitle = (song.name || "").toLowerCase();
      const searchTitle = title.toLowerCase();

      // Title similarity
      if (neteaseTitle === searchTitle) {
        score += 10;
      } else if (neteaseTitle.includes(searchTitle) || searchTitle.includes(neteaseTitle)) {
        score += 5;
      }

      // Artist similarity
      if (artist && song.artists) {
        const neteaseArtist = song.artists.map((a: { name: string }) => a.name.toLowerCase()).join(", ");
        const searchArtist = artist.toLowerCase();
        if (neteaseArtist.includes(searchArtist) || searchArtist.includes(neteaseArtist)) {
          score += 8;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = song;
      }
    }

    // Require minimum score to avoid wrong lyrics
    if (!bestMatch || bestScore < 3) {
      setCache(cacheKey, null, null);
      ctx.response.body = { lrc: null };
      return;
    }

    // Step 3: Fetch lyrics for the best match
    const lyricsUrl = `https://music.163.com/api/song/lyric?id=${bestMatch.id}&lv=1`;

    const lyricsResponse = await fetch(lyricsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://music.163.com/",
      },
    });

    if (!lyricsResponse.ok) {
      setCache(cacheKey, null, null);
      ctx.response.body = { lrc: null };
      return;
    }

    const lyricsData = await lyricsResponse.json();

    const lrc = lyricsData?.lrc?.lyric || null;
    const translated_lrc = lyricsData?.tlyric?.lyric || null;

    setCache(cacheKey, lrc, translated_lrc);
    ctx.response.body = { lrc, translated_lrc };
  } catch (error) {
    console.error("Lyrics fetch error:", error);
    ctx.response.body = { lrc: null };
  }
});

export default router;
