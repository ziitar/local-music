-- Migration: Seed artists and albums from existing song data
-- Run this after 001_refactor_schema.sql

-- Step 1: Insert distinct artists from existing songs
INSERT INTO artists (name)
SELECT DISTINCT artist
FROM songs
WHERE artist IS NOT NULL
AND artist != ''
AND NOT EXISTS (
    SELECT 1 FROM artists WHERE name = songs.artist
)
ON CONFLICT (name) DO NOTHING;

-- Step 2: Insert distinct albums from existing songs
INSERT INTO albums (title, track_total)
SELECT
    DISTINCT s.album,
    (SELECT COUNT(*) FROM songs s2 WHERE s2.album = s.album)::integer
FROM songs s
WHERE s.album IS NOT NULL
AND s.album != ''
AND NOT EXISTS (
    SELECT 1 FROM albums al WHERE al.title = s.album
)
ON CONFLICT DO NOTHING;

-- Step 3: Link songs to albums
UPDATE songs s
SET album_id = al.id
FROM albums al
WHERE s.album = al.title
AND s.album_id IS NULL;

-- Step 4: Create song-artist relationships
INSERT INTO song_artists (song_id, artist_id, position)
SELECT s.id, a.id, 0
FROM songs s
JOIN artists a ON a.name = s.artist
WHERE s.artist IS NOT NULL
AND s.artist != ''
ON CONFLICT DO NOTHING;

-- Step 5: Create album-artist relationships (from songs in each album)
INSERT INTO album_artists (album_id, artist_id, position)
SELECT DISTINCT al.id, a.id, 0
FROM songs s
JOIN albums al ON s.album_id = al.id
JOIN artists a ON a.name = s.artist
WHERE s.artist IS NOT NULL
AND s.artist != ''
ON CONFLICT DO NOTHING;

-- Step 6: Calculate track numbers within each album
WITH ranked_songs AS (
    SELECT
        id,
        album_id,
        ROW_NUMBER() OVER (PARTITION BY album_id ORDER BY id) as track_number
    FROM songs
    WHERE album_id IS NOT NULL
)
UPDATE songs s
SET track_no = r.track_number
FROM ranked_songs r
WHERE s.id = r.id
AND s.track_no IS NULL;
