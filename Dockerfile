FROM denoland/deno:2.6.10
WORKDIR /app

USER root

# 构建时变量（前端 base path）
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

# Install VAAPI (Video Acceleration API) for Intel GPU hardware acceleration
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates curl \
        # VAAPI drivers for Intel
        libva-drm2 \
        # ffmpeg (built with VAAPI support in Debian)
        ffmpeg \
        # i965 driver for older Intel GPUs (Broadwell and newer)
        i965-va-driver \
        && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY deno.json ./

# Keep node_modules from build for Deno to use at runtime

COPY api/ ./api/
COPY config/ ./config/
COPY dbs/ ./dbs/
COPY public/ ./public/
COPY src/ ./src/
COPY index.html ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY tsconfig.json ./
COPY tsconfig.app.json ./
COPY tsconfig.node.json ./
COPY package*.json ./

# Build frontend using Deno + Vite
RUN deno task build

# Cache Deno dependencies
RUN deno cache ./api/app.ts

# Set permissions - keep node_modules for Deno to use
RUN chown -R deno:deno /app
# USER deno

EXPOSE 8000

CMD ["deno", "run", "-A", "./api/app.ts"]
