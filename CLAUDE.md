# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Local Music is a full-stack web application for managing and playing local music
files. It consists of:

- **Frontend**: React 19 + TypeScript 5.9 + Vite 7.2 (rolldown-vite) + Tailwind
  CSS + Zustand
- **Backend**: Deno 2 + Oak framework + PostgreSQL
- **Features**: Music library scanning, playlist management, play history, audio
  streaming

## Architecture

### Frontend (Port 5173)

- **Entry**: `src/main.tsx` → `src/App.tsx`
- **State Management**: Zustand stores in `src/stores/` (authStore.ts,
  playerStore.ts)
- **Routing**: React Router with protected routes via `ProtectedRoute` component
- **API Client**: `src/services/api.ts` - uses fetch with JWT auth, talks to
  backend on port 8000
- **UI**: Tailwind CSS with custom CSS variables for theming (defined in
  `src/index.css`)
- **Components**:
  - `src/components/Layout/` - Sidebar and layout shell
  - `src/components/Player/` - Player bar with audio controls
  - `src/components/ui/` - Reusable UI primitives (Button, Card, Input)

### Backend (Port 8000)

- **Entry**: `api/app.ts` - Oak application setup
- **Routes**: `api/routes/` - auth.ts, songs.ts, playlists.ts, history.ts
- **Services**: `api/services/` - db.ts (postgres), auth.ts (JWT/bcrypt),
  scanner.ts (metadata extraction)
- **Database**: PostgreSQL via `postgres` npm package, schema in
  `dbs/schema.sql`
- **Music Scanning**: Uses `node-taglib-sharp` to extract metadata from audio
  files (MP3, FLAC, OGG, etc.)

### Database Schema

- **users**: id, username, password_hash, created_at
- **songs**: id, title, artist, album, duration, file_path, quality, file_size,
  format
- **playlists**: id, user_id, name, description, created_at, updated_at
- **playlist_songs**: playlist_id, song_id, position, added_at
- **play_history**: id, user_id, song_id, played_at

### Proxy Configuration

Vite dev server proxies `/api` requests to `http://localhost:8000` (see
`vite.config.ts`).

## Commands

### Development

```bash
# Start frontend dev server (Vite on port 5173)
npm run dev

# Start backend dev server (Deno Oak on port 8000 with watch)
deno task server:start:dev

# Start both (concurrently)
deno task dev
```

### Building

```bash
# Type-check and build frontend for production
npm run build

# Build with Deno
deno task build
```

### Linting

```bash
# Run ESLint on all files
npm run lint
```

### Type Checking

```bash
# Build project references (type-check)
npx tsc -b
```

### Production

```bash
# Build frontend and start backend server
deno task serve
```

### Database (Docker)

```bash
# Start PostgreSQL container
docker-compose up -d postgres

# Execute a migration script
docker compose exec postgres psql -U ziitar -d localmusic -f /docker-entrypoint-initdb.d/migrations/XXX_migration_name.sql
```

### Database Migration Rules

**涉及数据库变动时，必须遵循以下流程：**

1. 将变动 SQL 写入 `dbs/migrations/XXX_migration_name.sql`（编号递增，描述性命名）
2. 脚本内使用 `CREATE TABLE IF NOT EXISTS`、`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 等幂等语句
3. **不要自动执行迁移** — 通知用户手动在 Docker 中执行，等待用户确认完成后再继续
4. 同步更新 `dbs/schema.sql` 保持完整 schema 一致

## Key Files

### Configuration

- `deno.json` - Deno imports, tasks, compiler options (JSX config)
- `vite.config.ts` - Vite + React + Deno plugin, dev server proxy
- `tailwind.config.js` - Tailwind with custom color system (CSS variables)
- `config/config.json` - allowed hosts
- `.env` - Database credentials, JWT secret

### Type Definitions

- `src/types/index.ts` - Shared TypeScript interfaces (User, Song, Playlist,
  etc.)

### Utilities

- `src/lib/utils.ts` - `cn()` helper for Tailwind class merging,
  formatDuration(), formatFileSize()

## Code Style

- **Formatting**: 2 spaces, single quotes, trailing commas, semicolons
- **Imports**: External libs → Internal modules → CSS/assets; use relative
  imports (no path aliases)
- **Naming**: PascalCase components, camelCase functions/variables/hooks,
  UPPER_SNAKE constants
- **Types**: Prefer interfaces for objects, explicit function param/return types
  when not obvious
- **Components**: Functional components only, `.tsx` for JSX, `.ts` for pure
  TypeScript

## Environment Variables

Backend expects these environment variables (from `.env` file):

- `SQL_HOST`, `SQL_PORT`, `SQL_USER`, `SQL_PASSWORD` (or `SQL_PASSWORD_FILE`),
  `SQL_DATABASE`
- `JWT_SECRET`
