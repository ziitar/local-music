-- 本地音乐播放器数据库 Schema

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 艺术家表
CREATE TABLE IF NOT EXISTS artists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    alias VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name)
);

-- 专辑表
CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    cover_image VARCHAR(500),
    thumbnail VARCHAR(500),
    track_total INTEGER,
    disk_total INTEGER DEFAULT 1,
    disk_no INTEGER DEFAULT 1,
    release_year INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 专辑-艺术家关联表 (多对多)
CREATE TABLE IF NOT EXISTS album_artists (
    album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (album_id, artist_id)
);

-- 歌曲表
CREATE TABLE IF NOT EXISTS songs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
    track_no INTEGER,
    duration INT,
    file_path VARCHAR(500) UNIQUE NOT NULL,
    quality VARCHAR(20) CHECK (quality IN ('128k', '192k', '320k', 'lossless')),
    original_bitrate INTEGER,
    file_size BIGINT,
    format VARCHAR(10),
    cover_image VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    -- 整轨音乐支持字段
    is_cue_track BOOLEAN DEFAULT FALSE,
    cue_file_path VARCHAR(500),
    track_start_time INT,
    track_end_time INT,
    file_hash VARCHAR(64)
);

-- 歌曲-艺术家关联表 (多对多)
CREATE TABLE IF NOT EXISTS song_artists (
    song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (song_id, artist_id)
);

-- 歌单表
CREATE TABLE IF NOT EXISTS playlists (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 歌单-歌曲关联表
CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id INT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id INT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (playlist_id, song_id)
);

-- 播放历史表
CREATE TABLE IF NOT EXISTS play_history (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id INT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    played_at TIMESTAMP DEFAULT NOW()
);

-- 配置表
CREATE TABLE IF NOT EXISTS config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id)
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- 创建索引
CREATE INDEX IF NOT EXISTS idx_songs_album_id ON songs(album_id);
CREATE INDEX IF NOT EXISTS idx_songs_album_track ON songs(album_id, track_no);
CREATE INDEX IF NOT EXISTS idx_songs_quality ON songs(quality);
CREATE INDEX IF NOT EXISTS idx_songs_cue_track ON songs(is_cue_track);
CREATE INDEX IF NOT EXISTS idx_songs_cue_file ON songs(cue_file_path);
CREATE INDEX IF NOT EXISTS idx_songs_file_hash ON songs(file_hash);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_play_history_user ON play_history(user_id);
CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_album_artists_album ON album_artists(album_id);
CREATE INDEX IF NOT EXISTS idx_album_artists_artist ON album_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_song_artists_song ON song_artists(song_id);
CREATE INDEX IF NOT EXISTS idx_song_artists_artist ON song_artists(artist_id);
-- Trigram 索引
CREATE INDEX IF NOT EXISTS idx_songs_title_trgm ON songs USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm ON artists USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_albums_title_trgm ON albums USING GIN (title gin_trgm_ops);

SET pg_trgm.similarity_threshold = 0.8;