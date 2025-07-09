#!/bin/bash

# ByteLecture Backend Production Setup Script
# This script sets up the production environment for audio processing

set -e  # Exit on any error

echo "🚀 Setting up ByteLecture Backend for Production..."

# Detect operating system
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "📋 Detected Linux OS"
    
    # Update package lists
    sudo apt-get update
    
    # Install Node.js 18 (if not already installed)
    if ! command -v node &> /dev/null || ! node --version | grep -q "v18"; then
        echo "📦 Installing Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install Python and pip (required for yt-dlp)
    echo "📦 Installing Python and pip..."
    sudo apt-get install -y python3 python3-pip
    
    # Install ffmpeg
    echo "📦 Installing ffmpeg..."
    sudo apt-get install -y ffmpeg
    
    # Install yt-dlp globally
    echo "📦 Installing yt-dlp..."
    sudo pip3 install yt-dlp
    
    # Install PM2 for process management
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "❌ This script is for production Linux servers only"
    echo "For macOS development, use: ./scripts/setup-yt-dlp.sh"
    exit 1
    
else
    echo "❌ Unsupported operating system: $OSTYPE"
    echo "This script supports Linux production servers only"
    exit 1
fi

# Verify installations
echo "🔍 Verifying installations..."

if command -v node &> /dev/null; then
    echo "✅ Node.js $(node --version) installed"
else
    echo "❌ Node.js installation failed"
    exit 1
fi

if command -v npm &> /dev/null; then
    echo "✅ npm $(npm --version) installed"
else
    echo "❌ npm installation failed"
    exit 1
fi

if command -v yt-dlp &> /dev/null; then
    echo "✅ yt-dlp $(yt-dlp --version) installed"
else
    echo "❌ yt-dlp installation failed"
    exit 1
fi

if command -v ffmpeg &> /dev/null; then
    echo "✅ ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3) installed"
else
    echo "❌ ffmpeg installation failed"
    exit 1
fi

if command -v pm2 &> /dev/null; then
    echo "✅ PM2 $(pm2 --version) installed"
else
    echo "❌ PM2 installation failed"
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p temp logs

# Set up log rotation for large temp files
echo "📋 Setting up log rotation..."
sudo tee /etc/logrotate.d/bytelecture > /dev/null <<EOF
$(pwd)/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    sharedscripts
    create 0644 $(whoami) $(whoami)
}

$(pwd)/temp/* {
    daily
    missingok
    rotate 1
    compress
    delaycompress
    size 100M
    sharedscripts
    create 0644 $(whoami) $(whoami)
}
EOF

# Install dependencies
if [ -f package.json ]; then
    echo "📦 Installing Node.js dependencies..."
    npm ci --only=production
    
    echo "🔨 Building TypeScript..."
    npm run build
else
    echo "⚠️ package.json not found. Run this script from the backend directory."
    exit 1
fi

# Create PM2 ecosystem file
echo "⚙️ Creating PM2 configuration..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'bytelecture-backend',
    script: 'dist/index.js',
    instances: 1, // Single instance for audio processing to avoid conflicts
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Graceful shutdown for audio processing cleanup
    kill_timeout: 30000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
EOF

# Create systemd service for PM2 (optional but recommended)
echo "🔧 Setting up systemd service..."
sudo tee /etc/systemd/system/bytelecture.service > /dev/null <<EOF
[Unit]
Description=ByteLecture Backend
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/pm2 start ecosystem.config.js --no-daemon
ExecReload=/usr/local/bin/pm2 reload ecosystem.config.js
ExecStop=/usr/local/bin/pm2 delete all
Restart=always

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "🎉 Production setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Copy your .env file with production environment variables"
echo "2. Start the application:"
echo "   sudo systemctl enable bytelecture"
echo "   sudo systemctl start bytelecture"
echo ""
echo "📊 Monitor the application:"
echo "   pm2 status"
echo "   pm2 logs"
echo "   pm2 monit"
echo ""
echo "🔧 Useful commands:"
echo "   pm2 restart bytelecture-backend   # Restart app"
echo "   pm2 reload bytelecture-backend    # Zero-downtime reload"
echo "   pm2 stop bytelecture-backend      # Stop app"
echo "   sudo systemctl status bytelecture # Check service status"
echo ""
echo "💡 The application will:"
echo "   - Process audio files up to 200MB (chunked processing)"
echo "   - Handle concurrent transcription jobs"
echo "   - Auto-restart on crashes or memory limits"
echo "   - Clean up temporary files automatically"
echo "   - Log all activities to ./logs/" 