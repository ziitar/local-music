import { Router } from "@oak/oak";
import { sql } from "../services/db.ts";
import { verifyToken } from "../services/auth.ts";

const router = new Router();

function getUserId(ctx: any): number | null {
  const authHeader = ctx.request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  return payload?.userId || null;
}

router.post("/api/playlists", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Unauthorized" };
    return;
  }

  const body = await ctx.request.body.json();
  const { name, description } = body;

  if (!name) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Playlist name is required" };
    return;
  }

  const result = await sql`
    INSERT INTO playlists (user_id, name, description)
    VALUES (${userId}, ${name}, ${description || null})
    RETURNING id, user_id, name, description, created_at
  `;

  ctx.response.status = 201;
  ctx.response.body = result[0];
});

router.get("/api/playlists", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Unauthorized" };
    return;
  }

  // Get playlists with song count and cover image from last added song's album
  const playlists = await sql`
    SELECT p.id, p.name, p.description, p.created_at,
           COUNT(ps.song_id) as song_count,
           (
             SELECT s2.cover_image
             FROM playlist_songs ps2
             JOIN songs s2 ON ps2.song_id = s2.id
             WHERE ps2.playlist_id = p.id
             ORDER BY ps2.added_at DESC
             LIMIT 1
           ) as cover_image
    FROM playlists p
    LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
    WHERE p.user_id = ${userId}
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;

  ctx.response.body = playlists;
});

router.get("/api/playlists/:id", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Unauthorized" };
    return;
  }

  const id = parseInt(ctx.params.id);
  if (isNaN(id)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Invalid playlist ID" };
    return;
  }

  const playlist = await sql`
    SELECT id, user_id, name, description, created_at, updated_at
    FROM playlists WHERE id = ${id} AND user_id = ${userId}
  `;

  if (playlist.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { message: "Playlist not found" };
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
           s.duration, s.quality, s.format, s.cover_image,
           ps.position, ps.added_at
    FROM playlist_songs ps
    JOIN songs s ON ps.song_id = s.id
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE ps.playlist_id = ${id}
    ORDER BY ps.position ASC
  `;

  ctx.response.body = {
    ...playlist[0],
    songs,
  };
});

router.put("/api/playlists/:id", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Unauthorized" };
    return;
  }

  const id = parseInt(ctx.params.id);
  if (isNaN(id)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Invalid playlist ID" };
    return;
  }

  const body = await ctx.request.body.json();
  const { name, description } = body;

  const existing = await sql`
    SELECT id FROM playlists WHERE id = ${id} AND user_id = ${userId}
  `;

  if (existing.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { message: "Playlist not found" };
    return;
  }

  await sql`
    UPDATE playlists
    SET name = ${name}, description = ${description}, updated_at = NOW()
    WHERE id = ${id}
  `;

  ctx.response.body = { message: "Playlist updated" };
});

router.delete("/api/playlists/:id", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Unauthorized" };
    return;
  }

  const id = parseInt(ctx.params.id);
  if (isNaN(id)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Invalid playlist ID" };
    return;
  }

  await sql`DELETE FROM playlists WHERE id = ${id} AND user_id = ${userId}`;

  ctx.response.body = { message: "Playlist deleted" };
});

router.post("/api/playlists/:id/songs", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Unauthorized" };
    return;
  }

  const playlistId = parseInt(ctx.params.id);
  if (isNaN(playlistId)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Invalid playlist ID" };
    return;
  }

  const body = await ctx.request.body.json();
  const { songId } = body;

  if (!songId) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Song ID is required" };
    return;
  }

  const playlist = await sql`
    SELECT id FROM playlists WHERE id = ${playlistId} AND user_id = ${userId}
  `;

  if (playlist.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { message: "Playlist not found" };
    return;
  }

  const song = await sql`SELECT id FROM songs WHERE id = ${songId}`;
  if (song.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { message: "Song not found" };
    return;
  }

  const maxPosition = await sql`
    SELECT COALESCE(MAX(position), 0) as max_pos FROM playlist_songs WHERE playlist_id = ${playlistId}
  `;

  await sql`
    INSERT INTO playlist_songs (playlist_id, song_id, position)
    VALUES (${playlistId}, ${songId}, ${maxPosition[0].max_pos + 1})
    ON CONFLICT DO NOTHING
  `;

  await sql`UPDATE playlists SET updated_at = NOW() WHERE id = ${playlistId}`;

  ctx.response.status = 201;
  ctx.response.body = { message: "Song added to playlist" };
});

router.delete("/api/playlists/:id/songs/:songId", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Unauthorized" };
    return;
  }

  const playlistId = parseInt(ctx.params.id);
  const songId = parseInt(ctx.params.songId);

  if (isNaN(playlistId) || isNaN(songId)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Invalid ID" };
    return;
  }

  const playlist = await sql`
    SELECT id FROM playlists WHERE id = ${playlistId} AND user_id = ${userId}
  `;

  if (playlist.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { message: "Playlist not found" };
    return;
  }

  await sql`
    DELETE FROM playlist_songs WHERE playlist_id = ${playlistId} AND song_id = ${songId}
  `;

  ctx.response.body = { message: "Song removed from playlist" };
});

export default router;
