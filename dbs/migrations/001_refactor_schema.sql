-- Migration: Refactor database schema with many-to-many artist relationships
-- Created: 2026-03-17

-- Enable pg_trgm extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 1: Create artists table
CREATE TABLE IF NOT EXISTS artists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    alias VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

-- Step 2: Create albums table (no direct artist_id - use junction table)
CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    cover_image VARCHAR(500),
    thumbnail VARCHAR(500),
    track_total INTEGER,
    disk_total INTEGER DEFAULT 1,
    disk_no INTEGER DEFAULT 1,
    release_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Album-Artist junction table (many-to-many)
CREATE TABLE IF NOT EXISTS album_artists (
    album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (album_id, artist_id)
);

-- Step 4: Update songs table - remove single artist_id, add album_id
ALTER TABLE songs ADD COLUMN IF NOT EXISTS album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS original_bitrate INTEGER;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS track_no INTEGER;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500);

-- Step 5: Song-Artist junction table (many-to-many)
CREATE TABLE IF NOT EXISTS song_artists (
    song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (song_id, artist_id)
);

-- Step 6: Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_songs_album_id ON songs(album_id);
CREATE INDEX IF NOT EXISTS idx_songs_album_track ON songs(album_id, track_no);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_album_artists_album ON album_artists(album_id);
CREATE INDEX IF NOT EXISTS idx_album_artists_artist ON album_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_song_artists_song ON song_artists(song_id);
CREATE INDEX IF NOT EXISTS idx_song_artists_artist ON song_artists(artist_id);

-- Step 7: Create trigram indexes
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm ON artists USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_albums_title_trgm ON albums USING GIN (title gin_trgm_ops);

-- Set similarity threshold
SET pg_trgm.similarity_threshold = 0.8;

-- NOTE: Run 002_seed_from_old_data.sql AFTER this
-- Then run 003_drop_old_columns.sql to remove legacy columns
