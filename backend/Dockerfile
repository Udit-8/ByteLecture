# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install system dependencies and download yt-dlp standalone binary (avoids pip and unavailable apk packages)
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    curl \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

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