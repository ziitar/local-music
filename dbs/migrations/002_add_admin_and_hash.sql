-- Migration: Add admin role, file hash, and config table
-- Date: 2026-03-18

-- 1. Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Set first user as admin (if any users exist)
UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users);

-- 2. Add file_hash column to songs table for incremental scanning
ALTER TABLE songs ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_songs_file_hash ON songs(file_hash);

-- 3. Create config table for database-backed configuration
CREATE TABLE IF NOT EXISTS config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id)
);

-- 4. Insert default config values from existing config.json
-- Note: These will be updated by the application when first run
INSERT INTO config (key, value) VALUES
    ('music_sources', '[]'::jsonb),
    ('exclude_paths', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
