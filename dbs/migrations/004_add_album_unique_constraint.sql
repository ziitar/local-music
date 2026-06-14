-- Migration: Add UNIQUE constraint to albums.title
-- This migration removes duplicate albums before adding the constraint

-- Step 1: Create temp table to track which albums to keep (min id per title)
CREATE TEMP TABLE albums_to_keep AS
SELECT MIN(id) as keep_id, title
FROM albums
GROUP BY title
HAVING COUNT(*) > 1;

-- Step 2: Update songs to point to kept albums
UPDATE songs s
SET album_id = a.keep_id
FROM albums_to_keep a
JOIN albums a2 ON a2.title = a.title AND a2.id = a.keep_id
WHERE s.album_id = a2.id;

-- Step 3: Update album_artists to point to kept albums
UPDATE album_artists aa
SET album_id = a.keep_id
FROM albums_to_keep a
JOIN albums a2 ON a2.title = a.title AND a2.id = a.keep_id
WHERE aa.album_id = a2.id;

-- Step 4: Delete album_artists that would become duplicates after update
DELETE FROM album_artists
WHERE (album_id, artist_id) IN (
  SELECT aa1.album_id, aa1.artist_id
  FROM album_artists aa1
  JOIN albums a1 ON aa1.album_id = a1.id
  JOIN albums_to_keep a2 ON a1.title = a2.title AND a1.id != a2.keep_id
  WHERE EXISTS (
    SELECT 1 FROM album_artists aa2
    JOIN albums a3 ON aa2.album_id = a3.id
    JOIN albums_to_keep a4 ON a3.title = a4.title AND a3.id = a4.keep_id
    WHERE aa2.artist_id = aa1.artist_id AND a4.title = a2.title
  )
);

-- Step 5: Update album_artists again (now no duplicates)
UPDATE album_artists aa
SET album_id = a.keep_id
FROM albums_to_keep a
JOIN albums a2 ON a2.title = a.title AND a2.id = a.keep_id
WHERE aa.album_id = a2.id;

-- Step 6: Delete duplicate albums (keep the one with lowest id)
DELETE FROM albums a1
WHERE EXISTS (
  SELECT 1 FROM albums_to_keep a2
  WHERE a1.title = a2.title AND a1.id != a2.keep_id
);

-- Step 7: Add unique constraint
ALTER TABLE albums ADD CONSTRAINT albums_title_unique UNIQUE (title);

-- Clean up
DROP TABLE albums_to_keep;
