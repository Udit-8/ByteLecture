# Use Node.js 22 Alpine (meets pdfjs-dist engine requirement)
FROM node:22-alpine

# Install system and build dependencies, plus yt-dlp standalone binary
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    curl \
    build-base \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    pixman-dev \
    pkgconf \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (omit dev deps for production build)
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create temp directory with proper permissions
RUN mkdir -p temp && chmod 755 temp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["npm", "start"] 