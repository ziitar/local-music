import { Router } from "@oak/oak";
import { sql } from "../services/db.ts";

const router = new Router();

// List all albums with search/filter
router.get("/api/albums", async (ctx) => {
  const url = new URL(ctx.request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const search = url.searchParams.get("search") || "";
  const artist = url.searchParams.get("artist") || "";

  const offset = (page - 1) * limit;

  let query = sql`
    SELECT al.id, al.title, al.cover_image, al.release_year,
           COALESCE(
             (SELECT string_agg(ar2.name, ', ' ORDER BY aa2.position)
              FROM album_artists aa2
              JOIN artists ar2 ON aa2.artist_id = ar2.id
              WHERE aa2.album_id = al.id),
             'Unknown Artist'
           ) as artist,
           COUNT(s.id) as song_count
    FROM albums al
    LEFT JOIN songs s ON s.album_id = al.id
    WHERE 1=1
  `;

  if (search) {
    query = sql`${query} AND al.title ILIKE ${"%" + search + "%"}`;
  }

  if (artist) {
    query = sql`${query} AND EXISTS (
      SELECT 1 FROM album_artists aa2
      JOIN artists ar2 ON aa2.artist_id = ar2.id
      WHERE aa2.album_id = al.id AND ar2.name ILIKE ${"%" + artist + "%"}
    )`;
  }

  query = sql`${query}
    GROUP BY al.id
    ORDER BY al.title
    LIMIT ${limit} OFFSET ${offset}
  `;

  let countQuery = sql`
    SELECT COUNT(*) as total FROM albums al WHERE 1=1
  `;

  if (search) {
    countQuery = sql`${countQuery} AND al.title ILIKE ${"%" + search + "%"}`;
  }

  if (artist) {
    countQuery = sql`${countQuery} AND EXISTS (
      SELECT 1 FROM album_artists aa2
      JOIN artists ar2 ON aa2.artist_id = ar2.id
      WHERE aa2.album_id = al.id AND ar2.name ILIKE ${"%" + artist + "%"}
    )`;
  }

  const albums = await query;
  const countResult = await countQuery;
  const total = countResult[0]?.total || 0;

  ctx.response.body = {
    albums,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
});

// Get album detail with all songs
router.get("/api/albums/:id", async (ctx) => {
  const id = parseInt(ctx.params.id);

  if (isNaN(id)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Invalid album ID" };
    return;
  }

  const albumResult = await sql`
    SELECT al.id, al.title, al.cover_image, al.thumbnail,
           al.track_total, al.disk_total, al.release_year,
           COALESCE(
             (SELECT string_agg(ar2.name, ', ' ORDER BY aa2.position)
              FROM album_artists aa2
              JOIN artists ar2 ON aa2.artist_id = ar2.id
              WHERE aa2.album_id = al.id),
             'Unknown Artist'
           ) as artist
    FROM albums al
    WHERE al.id = ${id}
  `;

  if (albumResult.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { message: "Album not found" };
    return;
  }

  const songs = await sql`
    SELECT s.id, s.title,
           COALESCE((
             SELECT string_agg(ar2.name, ', ' ORDER BY sa2.position)
             FROM song_artists sa2
             JOIN artists ar2 ON sa2.artist_id = ar2.id
             WHERE sa2.song_id = s.id
           ), 'Unknown Artist') as artist,
           COALESCE(al.title, 'Unknown Album') as album,
           s.duration, s.quality, s.file_size, s.format, s.cover_image,
           s.track_no, s.is_cue_track, s.cue_file_path,
           s.track_start_time, s.track_end_time,
           s.integrated_loudness, s.true_peak
    FROM songs s
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE s.album_id = ${id}
    ORDER BY s.track_no NULLS LAST, s.id
  `;

  ctx.response.body = {
    ...albumResult[0],
    songs,
  };
});

export default router;
