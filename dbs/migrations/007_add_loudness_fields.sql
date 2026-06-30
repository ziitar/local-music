-- 响度归一化字段
ALTER TABLE songs ADD COLUMN IF NOT EXISTS integrated_loudness REAL;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS true_peak REAL;
