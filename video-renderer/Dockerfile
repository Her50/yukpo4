# syntax=docker/dockerfile:1.6

############################################
# Build stage: compile TypeScript sources  #
############################################
FROM node:20-bullseye AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json remotion.config.ts ./
COPY src ./src
COPY samples ./samples

RUN npm run build

############################################
# Runtime stage (CUDA + Node.js + FFmpeg) #
############################################
FROM nvidia/cuda:12.3.2-base-ubuntu22.04

ENV NODE_ENV=production \
    VIDEO_RENDERER_PROJECT_ROOT=/app \
    VIDEO_RENDERER_ENABLE_GPU=false

WORKDIR /app

# Install Node.js 20, FFmpeg and Chromium dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main\n' > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    nodejs \
    ffmpeg \
    libglib2.0-0 \
    libnss3 \
    libx11-6 \
    libxcomposite1 \
    libxcursor1 \
    libxi6 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxkbcommon0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libpango-1.0-0 \
    libxshmfence1 \
    fonts-liberation \
    libasound2 && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/remotion.config.ts ./remotion.config.ts
COPY --from=builder /app/samples ./samples
COPY --from=builder /app/src ./src

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

VOLUME ["/app/renders", "/app/cache"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD []

