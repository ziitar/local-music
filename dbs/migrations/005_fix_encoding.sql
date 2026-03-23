-- Migration: Fix encoding issues in existing data
-- This script attempts to fix mojibake (garbled text) in artists and albums

-- Create a function to attempt encoding fix
-- This is a simplified version - in practice, you'd need to identify the specific encoding issues

-- First, let's see what garbled data looks like
-- Common patterns: Ã¤, Ã©, â€, Ã±, etc.

-- Update artists with common mojibake patterns (these are examples - adjust based on actual data)
-- This is a manual cleanup - the real fix is to re-scan with the new scanner

-- For now, let's just show the problematic records
-- SELECT id, name FROM artists WHERE name ~ 'Ã|â|Ã®|Ã¯';

-- To fix, you would need to either:
-- 1. Re-scan the music files with the fixed scanner
-- 2. Manually update the records

-- Example manual fix (run after identifying specific issues):
-- UPDATE artists SET name = REPLACE(name, 'Ã¤', 'ä') WHERE name LIKE '%Ã¤%';
-- UPDATE albums SET title = REPLACE(title, 'Ã¤', 'ä') WHERE title LIKE '%Ã¤%';

-- After fixing, you might also need to clean up duplicates:
-- SELECT name, COUNT(*) as cnt FROM artists GROUP BY name HAVING COUNT(*) > 1;
-- SELECT title, COUNT(*) as cnt FROM albums GROUP BY title HAVING COUNT(*) > 1;
