# Music Library Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development
> (if subagents available) or superpowers:executing-plans to implement this
> plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor database schema to separate songs, artists, and albums;
optimize scanner with bitrate comparison and metadata cleaning; enhance playback
with chunked transfer, playback modes, and bitrate selection.

**Architecture:** Normalize database into three main tables (artists, albums,
songs) with foreign key relationships. Update scanner to handle deduplication
via bitrate comparison. Implement chunked file serving for regular files and
optimized stream management for CUE tracks. Add playback mode state management
and bitrate-based transcoding.

**Tech Stack:** Deno 2 + Oak, PostgreSQL, React 19 + Zustand, FFmpeg,
node-taglib-sharp

---

## File Structure Overview

### Database (New/Migrate)

- `dbs/migrations/001_refactor_schema.sql` - New normalized schema
- `dbs/migrations/002_seed_from_old_data.sql` - Data migration script

### Backend API

- `api/services/db.ts` - Add new table interfaces
- `api/services/scanner.ts` - Major refactor for new schema and bitrate logic
- `api/routes/songs.ts` - Add bitrate selection, chunked transfer, interrupt
  handling
- `api/utils/metadataCleaner.ts` - New metadata cleaning utilities
- `api/utils/coverExtractor.ts` - Cover image extraction from audio files and
  folders

### Frontend

- `src/stores/playerStore.ts` - Add playback modes (random/repeat)
- `src/components/Player/PlayerBar.tsx` - Add mode buttons and bitrate selector
- `src/pages/PlaylistDetail.tsx` - Fix click-to-play like Library
- `src/services/api.ts` - Add bitrate parameter to streamUrl

---

## Task 1: Database Schema Refactor

**Files:**

- Create: `dbs/migrations/001_refactor_schema.sql`
- Modify: `dbs/schema.sql` (reference/update)

### Step 1: Create normalized schema migration

```sql
-- Artists table
CREATE TABLE artists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    alias VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

-- Albums table
CREATE TABLE albums (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
    cover_image VARCHAR(500),
    track_total INTEGER,
    disk_total INTEGER DEFAULT 1,
    disk_no INTEGER DEFAULT 1,
    release_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refactored songs table
CREATE TABLE songs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
    album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
    track_no INTEGER,
    duration INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL UNIQUE,
    quality VARCHAR(50) NOT NULL,
    original_bitrate INTEGER,
    file_size BIGINT,
    format VARCHAR(20),
    cover_image VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- CUE track fields
    is_cue_track BOOLEAN DEFAULT FALSE,
    cue_file_path VARCHAR(500),
    track_start_time INTEGER,
    track_end_time INTEGER
);

-- Create indexes
CREATE INDEX idx_songs_artist ON songs(artist_id);
CREATE INDEX idx_songs_album ON songs(album_id);
CREATE INDEX idx_songs_album_track ON songs(album_id, track_no);
CREATE INDEX idx_albums_artist ON albums(artist_id);
```

- [ ] Write migration file
- [ ] Run: `deno task db:migrate` (or apply via psql)
- [ ] Verify tables created

---

## Task 2: Metadata Cleaner Utility

**Files:**

- Create: `api/utils/metadataCleaner.ts`
- Create: `api/utils/metadataCleaner_test.ts`

### Step 1: Create metadata cleaner

```typescript
export interface CleanedMetadata {
  title: string;
  artist: string;
  album: string;
  // ... other fields
}

export function cleanTitle(title: string): string {
  // Remove common suffixes like "(Explicit)", "[Remastered]"
  return title
    .replace(/\s*\(Explicit\)/gi, "")
    .replace(/\s*\[.*?\]/g, "")
    .trim();
}

export function cleanArtist(str?: string): string[] {
  // Handle "Artist feat. Artist2" -> primary artist
  let tmp = str?.trimEnd().trimStart() || "";
  const result: string[] = [];
  excludeArtist.forEach((exc) => {
    const reg = new RegExp(`(${exc})`);
    const match = tmp.match(reg);
    if (match !== null) {
      result.push(match[1]);
      tmp = tmp.replace(reg, "");
    }
  });
  return result.concat(
    tmp.replace(
      /\s?([,+×\/\&]|feat\.|featuring)\s?/g,
      "$1",
    ).split(
      /[,+×\/&]|feat\.|featuring/g,
    ) || [],
  ).filter((item) => item !== "");
}

export function splitArtistWithAlias(str: string) {
  const reg = /[\(（](CV:)?(.+)[\)）]/;
  const match = str.match(reg);
  const artist: {
    name: string;
    alias?: string;
  } = {
    name: str.replace(reg, ""),
  };
  if (match) {
    artist.alias = match[2];
  }
  return artist;
}

export function similarityDistance(a: string, b: string): number {
  // Levenshtein distance
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1] ? matrix[i - 1][j - 1] : Math.min(
        matrix[i - 1][j - 1] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1,
      );
    }
  }
  return matrix[b.length][a.length];
}

export function isSimilar(a: string, b: string, maxDiff: number = 1): boolean {
  // Strict similarity: only ±1 character difference allowed
  if (Math.abs(a.length - b.length) > maxDiff) return false;
  return similarityDistance(a.toLowerCase(), b.toLowerCase()) <= maxDiff;
}

/**
 * Convert Traditional Chinese to Simplified Chinese
 * Uses 'chinese-converter' library for accurate conversion
 */
import ChineseConverter from "chinese-converter";

export function t2s(text: string): string {
  return ChineseConverter.toSimplified(text);
}

/**
 * Clean and normalize text for database storage
 * - Remove suffixes
 * - Convert TC to SC
 * - Trim whitespace
 */
export function normalizeText(text: string): string {
  return t2s(cleanTitle(text));
}
```

### Step 2: Add dependency to deno.json

```json
{
  "imports": {
    "chinese-converter": "npm:chinese-converter@^1.2.0"
  }
}
```

- [ ] Add chinese-converter to deno.json imports
- [ ] Create metadataCleaner.ts with library-based t2s
- [ ] Write tests for similarity functions and t2s conversion
- [ ] Run: `deno test api/utils/metadataCleaner_test.ts`

---

## Task 2.5: Cover Image Extraction and Storage

**Files:**

- Create: `api/utils/coverExtractor.ts`
- Modify: `api/services/scanner.ts` - Integrate cover extraction
- Create: `public/covers/` directory structure

### Architecture Decision

Store cover images in **filesystem** (`public/covers/`) and save **URL paths**
in database:

- `albums.cover_image`: `/covers/albums/{albumId}.jpg`
- `albums.thumbnail`: `/covers/albums/{albumId}_thumb.jpg`
- `songs.cover_image`: `/covers/songs/{songId}.jpg` (for single tracks with
  unique covers)

### Step 2.5.1: Create cover extractor utility

```typescript
// api/utils/coverExtractor.ts
import { File } from "node-taglib-sharp";
import { dirname } from "@std/path";
import { exists } from "@std/fs";

const COVER_DIR = "./public/covers";
const THUMB_SIZE = 300; // pixels

/**
 * Extract cover from audio file metadata
 */
export async function extractCoverFromFile(
  filePath: string,
  outputId: string,
  type: "album" | "song" = "album",
): Promise<string | null> {
  try {
    const file = await File.createFromPath(filePath);
    const pictures = file.tag.pictures;

    if (!pictures || pictures.length === 0) {
      return null;
    }

    // Get largest picture (usually the cover)
    const cover = pictures.reduce((largest, current) =>
      current.data.length > largest.data.length ? current : largest
    );

    // Save original
    const dir = `${COVER_DIR}/${type}s`;
    await Deno.mkdir(dir, { recursive: true });

    const ext = cover.mimeType?.includes("png") ? "png" : "jpg";
    const coverPath = `${dir}/${outputId}.${ext}`;
    await Deno.writeFile(coverPath, new Uint8Array(cover.data));

    // Generate thumbnail (optional - can use CSS for small sizes)
    // For now, serve original and let frontend resize

    return `/covers/${type}s/${outputId}.${ext}`;
  } catch (error) {
    console.error(`Failed to extract cover from ${filePath}:`, error);
    return null;
  }
}

/**
 * Look for cover files in the same directory
 * Common names: cover.jpg, folder.jpg, front.jpg, album.jpg
 */
export async function findCoverInFolder(
  folderPath: string,
): Promise<string | null> {
  const coverNames = [
    "cover.jpg",
    "cover.png",
    "cover.webp",
    "folder.jpg",
    "folder.png",
    "folder.webp",
    "front.jpg",
    "front.png",
    "front.webp",
    "album.jpg",
    "album.png",
    "album.webp",
    " thumb.jpg",
    "thumb.png", // some folders have this
  ];

  for (const name of coverNames) {
    const coverPath = `${folderPath}/${name}`;
    if (await exists(coverPath)) {
      return coverPath;
    }
  }

  return null;
}

/**
 * Copy external cover file to public directory
 */
export async function copyExternalCover(
  sourcePath: string,
  outputId: string,
  type: "album" | "song" = "album",
): Promise<string | null> {
  try {
    const ext = sourcePath.split(".").pop() || "jpg";
    const dir = `${COVER_DIR}/${type}s`;
    await Deno.mkdir(dir, { recursive: true });

    const destPath = `${dir}/${outputId}.${ext}`;
    await Deno.copyFile(sourcePath, destPath);

    return `/covers/${type}s/${outputId}.${ext}`;
  } catch (error) {
    console.error(`Failed to copy cover from ${sourcePath}:`, error);
    return null;
  }
}

/**
 * Get or create cover for an album/song
 * Priority: 1. Audio metadata, 2. Folder cover file
 */
export async function getOrCreateCover(
  filePath: string,
  outputId: string,
  type: "album" | "song" = "album",
): Promise<string | null> {
  // Try extract from metadata first
  let coverUrl = await extractCoverFromFile(filePath, outputId, type);

  if (!coverUrl) {
    // Try find in same folder
    const folderPath = dirname(filePath);
    const externalCover = await findCoverInFolder(folderPath);

    if (externalCover) {
      coverUrl = await copyExternalCover(externalCover, outputId, type);
    }
  }

  return coverUrl;
}
```

### Step 2.5.2: Update database schema for covers

Add to `dbs/migrations/001_refactor_schema.sql`:

```sql
-- Albums with cover support
CREATE TABLE albums (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
    cover_image VARCHAR(500),      -- URL path: /covers/albums/1.jpg
    thumbnail VARCHAR(500),        -- URL path: /covers/albums/1_thumb.jpg
    track_total INTEGER,
    disk_total INTEGER DEFAULT 1,
    disk_no INTEGER DEFAULT 1,
    release_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Songs with optional individual cover
CREATE TABLE songs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
    album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
    track_no INTEGER,
    duration INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL UNIQUE,
    quality VARCHAR(50) NOT NULL,
    original_bitrate INTEGER,
    file_size BIGINT,
    format VARCHAR(20),
    cover_image VARCHAR(500),      -- Optional: override album cover
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- CUE track fields
    is_cue_track BOOLEAN DEFAULT FALSE,
    cue_file_path VARCHAR(500),
    track_start_time INTEGER,
    track_end_time INTEGER
);
```

### Step 2.5.3: Integrate into scanner

Modify `api/services/scanner.ts`:

```typescript
import { getOrCreateCover } from "../utils/coverExtractor.ts";

// In scan process, after creating album:
const albumCoverUrl = await getOrCreateCover(
  audioFilePath,
  albumId.toString(),
  "album",
);

await sql`
  UPDATE albums
  SET cover_image = ${albumCoverUrl}
  WHERE id = ${albumId}
`;

// For single songs (if they have different cover than album):
const songCoverUrl = await getOrCreateCover(
  audioFilePath,
  songId.toString(),
  "song",
);
// Only save if different from album cover or album has no cover
```

### Step 2.5.4: Static file serving

Ensure `api/app.ts` serves the covers directory:

```typescript
app.use(staticServer("./public", {
  prefix: "/covers",
  maxAge: 86400 * 30, // Cache 30 days
}));
```

### Step 2.5.5: Frontend usage

```tsx
// Album cover (large)
<img
  src={album.cover_image || "/covers/default-album.png"}
  alt={album.title}
  className="w-40 h-40 object-cover rounded-lg shadow"
  loading="lazy"
/>

// Song cover (small, fallback to album)
<img
  src={song.cover_image || album.cover_image || "/covers/default-album.png"}
  alt={song.title}
  className="w-10 h-10 object-cover rounded"
/>
```

### Step 2.5.6: Default cover

Place a default album cover at `public/covers/default-album.png`.

- [ ] Create coverExtractor.ts utility
- [ ] Update database schema with cover_image fields
- [ ] Integrate cover extraction into scanner
- [ ] Test cover extraction from metadata
- [ ] Test cover discovery in folder
- [ ] Add default album cover image

---

## Task 3: Refactor Scanner for New Schema

**Files:**

- Modify: `api/services/scanner.ts`
- Modify: `api/services/scanner_test.ts`

### Step 3.1: Update database queries

Replace direct song insertion with artist/album lookup/creation:

```typescript
async function getOrCreateArtist(name: string): Promise<number[]> {
  const add = [];
  const cleaned = cleanArtist(name);
  for (const artist of cleaned) {
    const artistObj = splitArtistWithAlias(artist);
    // Try exact match first
    const existing =
      await sql`SELECT id FROM artists WHERE name = ${artistObj.name}`;
    if (existing.length > 0) {
      continue;
    }
    // Create new
    const result =
      await sql`INSERT INTO artists (name, alias) VALUES (${artistObj.name}, ${artistObj.alias}) RETURNING id`;
    add.push(result[0].id);
  }
  return add;
}

async function getOrCreateAlbum(
  title: string,
  artistId: number,
  metadata: { trackTotal?: number; year?: number },
): Promise<number> {
  const cleaned = cleanTitle(title);
  const existing = await sql`
    SELECT id FROM albums
    WHERE title = ${cleaned} AND artist_id = ${artistId}
  `;
  if (existing.length > 0) {
    // Update metadata if needed
    return existing[0].id;
  }

  const result = await sql`
    INSERT INTO albums (title, artist_id, track_total, release_year)
    VALUES (${cleaned}, ${artistId}, ${metadata.trackTotal}, ${metadata.year})
    RETURNING id
  `;
  return result[0].id;
}
```

### Step 3.2: Update bitrate comparison logic

```typescript
export function compareBitrate(
  newBitrate: number,
  existingQuality: string,
): "better" | "equal" | "worse" {
  const existingBitrate = parseBitrate(existingQuality);
  if (newBitrate > existingBitrate) return "better";
  if (newBitrate < existingBitrate) return "worse";
  return "equal";
}

async function shouldInsertSong(metadata: SongMetadata): Promise<boolean> {
  // Try exact match first
  const exact = await sql`
    SELECT s.*, a.name as artist_name, al.title as album_title
    FROM songs s
    LEFT JOIN artists a ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE s.title = ${metadata.title}
    AND a.name = ${metadata.artist}
    AND al.title = ${metadata.album}
  `;

  if (exact.length > 0) {
    const comparison = compareBitrate(
      metadata.bitrate || 0,
      exact[0].quality,
    );
    if (comparison === "equal") return false;
    if (comparison === "better") {
      // Delete old and insert new
      await sql`DELETE FROM songs WHERE id = ${exact[0].id}`;
      return true;
    }
    return false;
  }

  // Try similarity match with strict threshold
  const similar = await sql`
    SELECT s.*, a.name as artist_name, al.title as album_title
    FROM songs s
    LEFT JOIN artists a ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE similarity(s.title, ${metadata.title}) > 0.9
  `;

  for (const song of similar) {
    if (
      isSimilar(song.title, metadata.title) &&
      isSimilar(song.artist_name, metadata.artist)
    ) {
      // Found similar song
      return false;
    }
  }

  return true;
}
```

- [ ] Update scanner.ts with new schema
- [ ] Update scanner tests
- [ ] Run tests: `deno test api/services/scanner_test.ts`

---

## Task 4: Chunked Transfer for Regular Files

**Files:**

- Modify: `api/routes/songs.ts`

### Step 4.1: Implement chunked file serving

Replace `streamRegularFile` with proper chunked streaming:

```typescript
async function streamRegularFile(ctx: any, song: any) {
  const file = await Deno.open(song.file_path, { read: true });
  const fileStat = await file.stat();
  const fileSize = fileStat.size;

  const range = ctx.request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0]);
    const end = parts[1] ? parseInt(parts[1]) : fileSize - 1;
    const chunkSize = end - start + 1;

    ctx.response.status = 206;
    ctx.response.headers.set(
      "Content-Range",
      `bytes ${start}-${end}/${fileSize}`,
    );
    ctx.response.headers.set("Accept-Ranges", "bytes");
    ctx.response.headers.set("Content-Length", chunkSize.toString());
    ctx.response.headers.set("Content-Type", getContentType(song.format));

    await file.seek(start, Deno.SeekMode.Start);

    // Stream in chunks
    const stream = new ReadableStream({
      async pull(controller) {
        const buffer = new Uint8Array(64 * 1024); // 64KB chunks
        const bytesRead = await file.read(buffer);
        if (bytesRead === null) {
          controller.close();
          file.close();
        } else {
          controller.enqueue(buffer.slice(0, bytesRead));
        }
      },
      cancel() {
        file.close();
      },
    });

    ctx.response.body = stream;
  } else {
    ctx.response.status = 200;
    ctx.response.headers.set("Content-Length", fileSize.toString());
    ctx.response.headers.set("Content-Type", getContentType(song.format));
    ctx.response.headers.set("Accept-Ranges", "bytes");

    ctx.response.body = file.readable;
  }
}
```

- [ ] Implement chunked transfer
- [ ] Test with large files

---

## Task 5: Interruptible CUE Stream

**Files:**

- Modify: `api/routes/songs.ts`

Track active streams and interrupt on client disconnect:

```typescript
// Global map to track active ffmpeg processes
const activeStreams = new Map<string, Deno.ChildProcess>();

async function streamCueTrack(ctx: any, song: any) {
  const streamId = `${song.id}_${Date.now()}`;

  // ... setup ffmpeg ...

  const process = command.spawn();
  activeStreams.set(streamId, process);

  // Set up client disconnect detection
  const abortController = new AbortController();
  ctx.request.signal?.addEventListener("abort", () => {
    abortController.abort();
    const proc = activeStreams.get(streamId);
    if (proc) {
      proc.kill();
      activeStreams.delete(streamId);
    }
  });

  // ... rest of streaming logic ...

  // Clean up on stream end
  stream.finally(() => {
    activeStreams.delete(streamId);
  });
}

// Cleanup endpoint for explicit interruption
router.post("/api/songs/stop-stream", async (ctx) => {
  const { songId } = await ctx.request.body().value;
  for (const [id, proc] of activeStreams) {
    if (id.startsWith(`${songId}_`)) {
      proc.kill();
      activeStreams.delete(id);
    }
  }
  ctx.response.body = { message: "Stream stopped" };
});
```

- [ ] Add active stream tracking
- [ ] Implement interrupt on disconnect
- [ ] Add cleanup endpoint

---

## Task 6: Bitrate Selection & Transcoding

**Files:**

- Modify: `api/routes/songs.ts`
- Modify: `src/services/api.ts`

### Step 6.1: Update stream endpoint

```typescript
router.get("/api/songs/:id/stream", async (ctx) => {
  const id = parseInt(ctx.params.id);
  const requestedBitrate = ctx.request.url.searchParams.get("bitrate");

  // Get song with original bitrate info
  const song = await sql`
    SELECT s.*, s.original_bitrate
    FROM songs s WHERE id = ${id}
  `;

  if (requestedBitrate && song.original_bitrate) {
    const requested = parseBitrate(requestedBitrate);

    if (requested >= song.original_bitrate) {
      // Requested higher than available - serve original
      await streamRegularFile(ctx, song);
    } else if (requested < song.original_bitrate) {
      // Need to transcode down
      await streamTranscoded(ctx, song, requested);
    }
  }
});

async function streamTranscoded(ctx: any, song: any, targetBitrate: number) {
  const ffmpegPath = await getFfmpegPath();
  const args = [
    "-i",
    song.file_path,
    "-b:a",
    `${targetBitrate}`,
    "-f",
    "mp3",
    "-",
  ];
  // ... spawn ffmpeg and stream ...
}
```

### Step 6.2: Update frontend API

```typescript
async streamUrl(id: number, options?: {
  isCueTrack?: boolean;
  bitrate?: string;
}): Promise<string> {
  const params = new URLSearchParams();
  if (options?.isCueTrack) params.set("cue", "1");
  if (options?.bitrate) params.set("bitrate", options.bitrate);
  const query = params.toString();
  return `${API_BASE}/api/songs/${id}/stream${query ? `?${query}` : ''}`;
}
```

- [ ] Add bitrate parameter to stream endpoint
- [ ] Implement transcoding logic
- [ ] Update frontend API client

---

## Task 7: Player Store - Playback Modes

**Files:**

- Modify: `src/stores/playerStore.ts`

```typescript
interface PlayerState {
  // ... existing fields ...
  playMode: "sequential" | "random" | "repeat-one" | "repeat-all";
  setPlayMode: (mode: PlayMode) => void;
}

type PlayMode = "sequential" | "random" | "repeat-one" | "repeat-all";

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // ... existing state ...
  playMode: "sequential",

  setPlayMode: (mode) => set({ playMode: mode }),

  playNext: () => {
    const { playlist, playlistIndex, playMode } = get();
    if (playlist.length === 0) return;

    let nextIndex: number;

    switch (playMode) {
      case "random":
        nextIndex = Math.floor(Math.random() * playlist.length);
        break;
      case "repeat-one":
        nextIndex = playlistIndex;
        break;
      case "repeat-all":
      case "sequential":
      default:
        nextIndex = (playlistIndex + 1) % playlist.length;
        break;
    }

    set({
      playlistIndex: nextIndex,
      currentSong: playlist[nextIndex],
    });
  },

  playPrev: () => {
    const { playlist, playlistIndex, playMode } = get();
    if (playlist.length === 0) return;

    let prevIndex: number;

    switch (playMode) {
      case "random":
        prevIndex = Math.floor(Math.random() * playlist.length);
        break;
      case "repeat-one":
        prevIndex = playlistIndex;
        break;
      default:
        prevIndex = playlistIndex <= 0
          ? playlist.length - 1
          : playlistIndex - 1;
        break;
    }

    set({
      playlistIndex: prevIndex,
      currentSong: playlist[prevIndex],
    });
  },
}));
```

- [ ] Add playMode state
- [ ] Update playNext/playPrev logic
- [ ] Add mode selector UI (next task)

---

## Task 8: PlayerBar UI Updates

**Files:**

- Modify: `src/components/Player/PlayerBar.tsx`

Add playback mode buttons and bitrate selector:

```tsx
import { Repeat, Repeat1, Shuffle } from "lucide-react";

// In component:
const { playMode, setPlayMode } = usePlayerStore();
const [selectedBitrate, setSelectedBitrate] = useState<string>("");

// Mode toggle button
const togglePlayMode = () => {
  const modes: PlayMode[] = [
    "sequential",
    "random",
    "repeat-all",
    "repeat-one",
  ];
  const currentIndex = modes.indexOf(playMode);
  setPlayMode(modes[(currentIndex + 1) % modes.length]);
};

// Mode icon
const getModeIcon = () => {
  switch (playMode) {
    case "random":
      return <Shuffle className="h-4 w-4" />;
    case "repeat-one":
      return <Repeat1 className="h-4 w-4" />;
    case "repeat-all":
      return <Repeat className="h-4 w-4" />;
    default:
      return <Repeat className="h-4 w-4 opacity-50" />;
  }
};

// Bitrate selector
<select
  value={selectedBitrate}
  onChange={(e) => setSelectedBitrate(e.target.value)}
  className="text-xs bg-transparent border rounded px-1"
>
  <option value="">原始</option>
  <option value="lossless">无损</option>
  <option value="320k">320K</option>
  <option value="128k">128K</option>
</select>;
```

- [ ] Add mode toggle button
- [ ] Add bitrate selector dropdown
- [ ] Style and position new controls

---

## Task 9: Playlist Detail Page Fix

**Files:**

- Modify: `src/pages/PlaylistDetail.tsx`

Change song row click behavior to play immediately like Library:

```tsx
const handlePlaySong = (song: Song, index: number) => {
  setPlaylist(playlist.songs || [], index);
  setIsPlaying(true);
};

// In render:
<tr
  key={song.id}
  className="..."
  onClick={() => handlePlaySong(song, index)}
>
  {/* ... */}
</tr>;
```

- [ ] Update PlaylistDetail to use same play logic as Library
- [ ] Test click-to-play functionality

---

## Task 10: Integration Testing

- [ ] Run full scanner test: `deno task test:scanner`
- [ ] Test chunked transfer with large FLAC files
- [ ] Test CUE interruption (play then quickly skip)
- [ ] Test bitrate selection and transcoding
- [ ] Test playback modes (random/repeat)
- [ ] Test playlist click-to-play

---

## Commit Strategy

1. **Task 1-2:** Database + metadata cleaner (atomic commit)
2. **Task 2.5:** Cover image extraction (separate commit)
3. **Task 3:** Scanner refactor (separate commit - large change)
4. **Task 4:** Chunked transfer (commit)
5. **Task 5:** CUE interruption (commit)
6. **Task 6:** Bitrate selection (commit)
7. **Task 7-9:** Frontend player changes (can be combined or separate)
8. **Task 10:** Final integration fixes

---

## Execution Notes

### Cover Image Handling (Task 2.5)

- For **CUE tracks**: Look for cover in the same directory as the audio file
  (typically `folder.jpg` or `cover.jpg` in the album directory)
- For **single tracks**: Extract from audio metadata, fallback to folder cover
- Storage path: `public/covers/{type}s/{id}.{ext}`
- Database stores URL paths, not binary data
- Default cover image at `public/covers/default-album.png`

---

**Plan complete and saved to
`docs/superpowers/plans/2026-03-17-music-library-refactor.md`. Ready to
execute?**

Execution recommendation: Use @superpowers:subagent-driven-development with
separate subagents for:

- Database + Scanner + Covers (Tasks 1-3, 2.5)
- Streaming improvements (Tasks 4-6)
- Frontend player (Tasks 7-9)
