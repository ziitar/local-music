import { Application, Router, send } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";
import { join } from "@std/path";
import authRouter from "./routes/auth.ts";
import songsRouter from "./routes/songs.ts";
import playlistsRouter from "./routes/playlists.ts";
import historyRouter from "./routes/history.ts";
import configRouter from "./routes/config.ts";
import artistsRouter from "./routes/artists.ts";
import albumsRouter from "./routes/albums.ts";
import lyricsRouter from "./routes/lyrics.ts";
import { testConnection } from "./services/db.ts";

export const app = new Application();

app.use(oakCors({
  origin: "*",
  credentials: true,
}));

// Custom static file server middleware
app.use(async (ctx, next) => {
  if(ctx.request.method === "GET" && !ctx.request.url.pathname.startsWith("/api")) {
    if(ctx.request.url.pathname.startsWith("/covers")){
      await send(ctx, ctx.request.url.pathname, {
        root: join(Deno.cwd(), "public"),
      });
    }else {
      await send(ctx, ctx.request.url.pathname, {
        root: join(Deno.cwd(), "dist"),
        index: "index.html",
      });
    }
  } else {
    await next();
  }
});

const router = new Router();

// Health check endpoint (no auth required)
router.get("/api/health", (ctx) => {
  ctx.response.body = { status: "ok", timestamp: new Date().toISOString() };
});

router.use(authRouter.routes());
router.use(songsRouter.routes());
router.use(playlistsRouter.routes());
router.use(historyRouter.routes());
router.use(configRouter.routes());
router.use(artistsRouter.routes());
router.use(albumsRouter.routes());
router.use(lyricsRouter.routes());

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = parseInt(Deno.env.get("PORT") || "8000");

console.log(`Server starting on port ${PORT}...`);

async function start() {
  const connected = await testConnection();
  if (connected) {
    console.log("Database connected successfully");
  } else {
    console.error("Failed to connect to database");
  }

  app.listen({ port: PORT });
}

start();
