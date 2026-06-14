# 整轨音乐（CUE）支持说明

## 功能概述

本项目现已支持扫描和播放整轨音乐文件。整轨音乐是指整张专辑存储在一个音频文件中（如
WAV、APE、FLAC 等），配合 .cue 文件记录每首歌曲的分轨信息。

## 数据库变更

为支持整轨音乐，`songs` 表新增了以下字段：

| 字段               | 类型         | 说明                     |
| ------------------ | ------------ | ------------------------ |
| `is_cue_track`     | BOOLEAN      | 标记是否为CUE音轨        |
| `cue_file_path`    | VARCHAR(500) | CUE文件路径              |
| `track_start_time` | INT          | 在整轨中的开始时间（秒） |
| `track_end_time`   | INT          | 在整轨中的结束时间（秒） |

## 扫描逻辑

1. **扫描CUE文件**：扫描器首先扫描所有 `.cue` 文件
2. **解析整轨信息**：解析每个CUE文件，提取每首歌曲的标题、艺术家、专辑、开始时间、持续时间
3. **生成虚拟单曲**：为CUE中的每首歌曲生成虚拟单曲记录，存储在数据库中
4. **避免重复**：如果整轨音频文件已被CUE引用，则不再作为普通单曲扫描

## 播放逻辑

### 普通单曲

直接流式传输音频文件，支持Range请求（断点续传）。

### 整轨音乐（CUE音轨）

使用FFmpeg截取整轨文件的特定时间段：

```bash
ffmpeg -ss <start_time> -to <end_time> -i <source_file> -f <format> -acodec copy -
```

参数说明：

- `-ss`：开始时间（秒）
- `-to`：结束时间（秒）
- `-i`：输入文件（整轨音频文件）
- `-f`：输出格式
- `-acodec copy`：直接复制音频流，不重新编码
- `-`：输出到stdout

## CUE文件格式支持

支持的CUE文件格式示例：

```
PERFORMER "艺术家名称"
TITLE "专辑名称"
FILE "专辑文件名.wav" WAVE
  TRACK 01 AUDIO
    TITLE "第一首歌标题"
    PERFORMER "艺术家名称"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "第二首歌标题"
    PERFORMER "艺术家名称"
    INDEX 01 04:30:15
  TRACK 03 AUDIO
    TITLE "第三首歌标题"
    PERFORMER "艺术家名称"
    INDEX 01 08:45:30
```

## 配置文件

确保 `config/config.json` 中包含FFmpeg路径：

```json
{
  "source": "音乐文件目录路径",
  "exclude": ["tmp"],
  "ffmpegPath": "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
  "allowedHost": ["http://localhost:5173"]
}
```

## 支持的音频格式

### 单曲格式

- MP3、FLAC、OGG、M4A、AAC、WMA

### 整轨格式

- WAV、APE、FLAC、WV（WavPack）、BIN

## 数据库迁移

对于已有数据库，运行以下迁移脚本添加CUE支持：

```bash
psql -U your_username -d localmusic -f dbs/migration_add_cue_support.sql
```

或者使用Docker：

```bash
docker exec -i local-music-db psql -U ziitar -d localmusic < dbs/migration_add_cue_support.sql
```

## 注意事项

1. **FFmpeg必须安装并配置正确路径**：整轨音乐的播放依赖FFmpeg
2. **整轨文件命名**：如果CUE文件中的FILE与实际音频文件名不符，扫描器会尝试使用同名但不同扩展名的文件
3. **性能考虑**：整轨音乐的播放需要实时FFmpeg处理，首次播放可能有轻微延迟
4. **不支持Seek**：整轨音乐的FFmpeg流暂不支持Seek操作（拖动进度条）
