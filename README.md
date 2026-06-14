# Local Music

A full-stack web application for managing and playing local music files.

## Tech Stack

- **Frontend**: React 19 + TypeScript 5.9 + Vite 7.2 + Tailwind CSS + Zustand
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

# Start frontend (in another terminal)
npm run dev
```

Access the app at http://localhost:5173

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

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

## Project Structure

```
├── api/                    # Backend (Deno + Oak)
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   └── app.ts             # Entry point
├── src/                   # Frontend (React)
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── stores/           # Zustand stores
│   └── services/         # API client
├── config/               # Configuration files
├── dbs/                  # Database schema
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

## License

MIT
