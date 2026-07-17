import { Router } from "@oak/oak";
import { sql } from "../services/db.ts";

const router = new Router();

// List all artists with optional search filter
router.get("/api/artists", async (ctx) => {
  const url = new URL(ctx.request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const search = url.searchParams.get("search") || "";

  const offset = (page - 1) * limit;

  let query = sql`
    SELECT a.id, a.name, a.alias,
           COUNT(DISTINCT sa.song_id) as song_count,
           COUNT(DISTINCT aa.album_id) as album_count
    FROM artists a
    LEFT JOIN song_artists sa ON a.id = sa.artist_id
    LEFT JOIN album_artists aa ON a.id = aa.artist_id
    WHERE 1=1
  `;

  if (search) {
    query = sql`${query} AND a.name ILIKE ${"%" + search + "%"}`;
  }

  query = sql`${query}
    GROUP BY a.id
    ORDER BY a.name
    LIMIT ${limit} OFFSET ${offset}
  `;

  let countQuery = sql`
    SELECT COUNT(*) as total FROM artists a WHERE 1=1
  `;

  if (search) {
    countQuery = sql`${countQuery} AND a.name ILIKE ${"%" + search + "%"}`;
  }

  const artists = (await query).map((a: Record<string, unknown>) => ({
    ...a,
    song_count: Number(a.song_count),
    album_count: Number(a.album_count),
  }));
  const countResult = await countQuery;
  const total = Number(countResult[0]?.total || 0);

  ctx.response.body = {
    artists,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
});

// Get artist detail with their albums and songs
router.get("/api/artists/:id", async (ctx) => {
  const id = parseInt(ctx.params.id);

  if (isNaN(id)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Invalid artist ID" };
    return;
  }

  const artistResult = await sql`
    SELECT a.id, a.name, a.alias,
           COUNT(DISTINCT sa.song_id) as song_count,
           COUNT(DISTINCT aa.album_id) as album_count
    FROM artists a
    LEFT JOIN song_artists sa ON a.id = sa.artist_id
    LEFT JOIN album_artists aa ON a.id = aa.artist_id
    WHERE a.id = ${id}
    GROUP BY a.id
  `;

  if (artistResult.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { message: "Artist not found" };
    return;
  }

  const albums = (await sql`
    SELECT al.id, al.title, al.cover_image, al.release_year,
           COUNT(s.id) as song_count
    FROM albums al
    JOIN album_artists aa ON al.id = aa.album_id
    LEFT JOIN songs s ON s.album_id = al.id
    WHERE aa.artist_id = ${id}
    GROUP BY al.id
    ORDER BY al.release_year DESC NULLS LAST, al.title
  `).map((a: Record<string, unknown>) => ({
    ...a,
    song_count: Number(a.song_count),
  }));

  const songs = await sql`
    SELECT s.id, s.title,
           COALESCE((
             SELECT string_agg(ar2.name, ', ' ORDER BY sa2.position)
             FROM song_artists sa2
             JOIN artists ar2 ON sa2.artist_id = ar2.id
             WHERE sa2.song_id = s.id
           ), 'Unknown Artist') as artist,
           COALESCE(al.title, 'Unknown Album') as album,
           s.duration, s.quality, s.format, s.cover_image,
           s.album_id, s.track_no, s.is_cue_track, s.cue_file_path,
           s.track_start_time, s.track_end_time,
           s.integrated_loudness, s.true_peak
    FROM songs s
    JOIN song_artists sa ON s.id = sa.song_id
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE sa.artist_id = ${id}
    ORDER BY al.release_year DESC NULLS LAST, al.title, s.track_no NULLS LAST, s.id
  `;

  ctx.response.body = {
    ...artistResult[0],
    song_count: Number(artistResult[0].song_count),
    album_count: Number(artistResult[0].album_count),
    albums,
    songs,
  };
});

export default router;
