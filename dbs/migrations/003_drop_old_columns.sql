-- Migration: Drop old denormalized columns from songs table
-- Run this AFTER 002_seed_from_old_data.sql

-- Drop old columns that have been migrated to artists/albums tables
ALTER TABLE songs DROP COLUMN IF EXISTS artist;
ALTER TABLE songs DROP COLUMN IF EXISTS album;
