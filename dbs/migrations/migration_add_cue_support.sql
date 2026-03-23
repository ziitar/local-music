-- 添加整轨音乐（CUE）支持的数据库迁移
-- 在现有数据库上运行此脚本来添加CUE相关字段

-- 添加整轨音乐支持字段
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS is_cue_track BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cue_file_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS track_start_time INT,
ADD COLUMN IF NOT EXISTS track_end_time INT;

-- 添加索引优化CUE音轨查询
CREATE INDEX IF NOT EXISTS idx_songs_cue_track ON songs(is_cue_track);
CREATE INDEX IF NOT EXISTS idx_songs_cue_file ON songs(cue_file_path);
