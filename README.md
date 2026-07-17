# Local Music

A full-stack web application for managing and playing local music files.

## Tech Stack

- **Web Frontend**: React 19 + TypeScript 5.9 + Vite 7.2 + Tailwind CSS + Zustand
- **Mobile App**: Flutter 3 + Riverpod + GoRouter + just_audio
- **Backend**: Deno 2 + Oak framework + PostgreSQL
- **Features**: Music library scanning, playlist management, play history, audio streaming

## Quick Start

### Development

```bash
# Install Deno (if not installed)
curl -fsSL https://deno.land/install.sh | sh

# Start all services (requires Docker)
docker-compose up -d postgres

# Start backend
deno task server:start:dev

# Start web frontend (in another terminal)
npm run dev
```

Access the web app at <http://localhost:5173>

### Flutter Mobile App

```bash
cd flutter_app

# Install dependencies
flutter pub get

# Generate code (models with json_serializable, riverpod)
dart run build_runner build --delete-conflicting-outputs

# Run on connected device/emulator
flutter run

# Build APK
flutter build apk --release
```

Configure server address in `flutter_app/lib/config.dart` or enter it on first launch.

### Production (Docker)

```bash
# Build and start all services
MUSIC_PATH=/path/to/your/music \
POSTGRES_DATA_PATH=./postgres_data \
DBS_PATH=./dbs \
CONFIG_PATH=./config \
SQL_PASSWORD=your_password \
JWT_SECRET=your-secret-key-change-in-production \
docker-compose up -d --build
```

## Docker Deployment

### Environment Variables

| Variable | Default值 | 说明 |
|----------|-----------|------|
| `MUSIC_PATH` | `./music` | 音乐文件目录 |
| `POSTGRES_DATA_PATH` | `postgres_data` | PostgreSQL 数据卷 |
| `DBS_PATH` | `./dbs` | 数据库初始化脚本 |
| `CONFIG_PATH` | `./config` | 配置文件目录 |
| `SQL_PASSWORD` | (必填) | 数据库密码 |
| `JWT_SECRET` | `your-secret-key-change-in-production` | JWT 密钥 |
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | FFmpeg 路径 |

### Docker Commands

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 只构建镜像（不启动）
docker-compose build --no-cache

# 启动已构建的镜像
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
docker-compose logs -f backend  # 只看后端

# 重启服务
docker-compose restart

# 停止并删除容器
docker-compose down

# 停止并删除数据卷（慎用）
docker-compose down -v

# 重新构建并启动
docker-compose up -d --build --force-recreate
```

### Service URLs

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:8000>

## Project Structure

```
├── api/                    # Backend (Deno + Oak)
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   └── app.ts             # Entry point
├── src/                   # Web Frontend (React)
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── stores/           # Zustand stores
│   └── services/         # API client
├── flutter_app/          # Mobile App (Flutter)
│   ├── lib/
│   │   ├── models/       # Data models (json_serializable)
│   │   ├── pages/        # Screen pages
│   │   ├── providers/    # Riverpod providers
│   │   ├── services/     # API client, audio, cache
│   │   ├── widgets/      # Reusable widgets
│   │   ├── theme/        # App theme & colors
│   │   └── config.dart   # App configuration
│   └── pubspec.yaml      # Flutter dependencies
├── config/               # Configuration files
├── dbs/                  # Database schema & migrations
├── public/               # Static assets
└── docker-compose.yml    # Docker compose config
```

## Features

- Music library scanning with metadata extraction
- Playlist management
- Play history tracking
- Audio streaming with bitrate selection
- CUE sheet support for whole album tracks
- User authentication

## Flutter Development

### Architecture

- **State Management**: Riverpod with code generation (`riverpod_annotation` + `riverpod_generator`)
- **Routing**: GoRouter for declarative navigation
- **Audio**: just_audio for playback, audio_service for background/notification controls
- **Networking**: Dio with interceptors for JWT auth
- **Models**: json_serializable for JSON serialization

### Common Commands

```bash
cd flutter_app

# Install dependencies
flutter pub get

# Code generation (run after modifying models/providers)
dart run build_runner build --delete-conflicting-outputs

# Watch mode for code generation
dart run build_runner watch --delete-conflicting-outputs

# Run on device/emulator
flutter run

# Build debug APK
flutter build apk --debug

# Build release APK
flutter build apk --release

# Run tests
flutter test

# Clean build artifacts
flutter clean
```

### Directory Layout

| Directory | Purpose |
|-----------|---------|
| `lib/models/` | Data classes with `json_serializable` (`.g.dart` files are auto-generated) |
| `lib/pages/` | Screen-level widgets (home, library, search, settings, detail pages) |
| `lib/providers/` | Riverpod providers for state management |
| `lib/services/` | API client, audio handler, cache, equalizer, loudness |
| `lib/widgets/` | Reusable UI components (player bar, song list tiles, etc.) |
| `lib/theme/` | App theme, colors, text styles |
| `lib/config.dart` | App-wide constants (server URL, cache settings, etc.) |

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `flutter_riverpod` | State management |
| `go_router` | Declarative routing |
| `just_audio` | Audio playback |
| `audio_service` | Background audio & notification controls |
| `dio` | HTTP client |
| `json_annotation` | JSON serialization annotations |
| `shared_preferences` | Local key-value storage |

### Configuration

API server address is configured at `flutter_app/lib/config.dart`. Users can also enter the server URL on first launch in the login screen.

## License

MIT
