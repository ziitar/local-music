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

router.get("/api/history", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Unauthorized" };
    return;
  }

  const url = new URL(ctx.request.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const history = await sql`
    SELECT ph.id, ph.played_at,
           s.id as song_id, s.title,
           COALESCE((
             SELECT string_agg(ar2.name, ', ' ORDER BY sa2.position)
             FROM song_artists sa2
             JOIN artists ar2 ON sa2.artist_id = ar2.id
             WHERE sa2.song_id = s.id
           ), 'Unknown Artist') as artist,
           COALESCE(al.title, 'Unknown Album') as album,
           s.duration, s.quality, s.format
    FROM play_history ph
    JOIN songs s ON ph.song_id = s.id
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE ph.user_id = ${userId}
    ORDER BY ph.played_at DESC
    LIMIT ${limit}
  `;

  ctx.response.body = history;
});

router.post("/api/history", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Unauthorized" };
    return;
  }

  const body = await ctx.request.body.json();
  const { songId } = body;

  if (!songId) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Song ID is required" };
    return;
  }

  const song = await sql`SELECT id FROM songs WHERE id = ${songId}`;
  if (song.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { message: "Song not found" };
    return;
  }

  await sql`
    INSERT INTO play_history (user_id, song_id)
    VALUES (${userId}, ${songId})
  `;

  ctx.response.status = 201;
  ctx.response.body = { message: "History recorded" };
});

router.delete("/api/history", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Unauthorized" };
    return;
  }

  await sql`DELETE FROM play_history WHERE user_id = ${userId}`;

  ctx.response.body = { message: "History cleared" };
});

export default router;
