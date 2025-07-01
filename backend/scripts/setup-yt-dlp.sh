#!/bin/bash

# YouTube Processing Setup Script
# This script installs yt-dlp and ffmpeg required for audio extraction

echo "🚀 Setting up YouTube processing dependencies..."

# Detect operating system
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "📋 Detected Linux OS"
    
    # Update package lists
    sudo apt-get update
    
    # Install ffmpeg
    echo "📦 Installing ffmpeg..."
    sudo apt-get install -y ffmpeg
    
    # Install yt-dlp
    echo "📦 Installing yt-dlp..."
    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod a+rx /usr/local/bin/yt-dlp
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "📋 Detected macOS"
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Please install Homebrew first: https://brew.sh"
        exit 1
    fi
    
    # Install ffmpeg
    echo "📦 Installing ffmpeg..."
    brew install ffmpeg
    
    # Install yt-dlp
    echo "📦 Installing yt-dlp..."
    brew install yt-dlp
    
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash/Cygwin)
    echo "📋 Detected Windows"
    echo "⚠️  Please install manually:"
    echo "1. Download yt-dlp.exe from: https://github.com/yt-dlp/yt-dlp/releases"
    echo "2. Download ffmpeg from: https://ffmpeg.org/download.html"
    echo "3. Add both to your PATH environment variable"
    exit 1
    
else
    echo "❌ Unsupported operating system: $OSTYPE"
    echo "Please install yt-dlp and ffmpeg manually:"
    echo "- yt-dlp: https://github.com/yt-dlp/yt-dlp#installation"
    echo "- ffmpeg: https://ffmpeg.org/download.html"
    exit 1
fi

# Verify installations
echo "🔍 Verifying installations..."

if command -v yt-dlp &> /dev/null; then
    echo "✅ yt-dlp installed successfully"
    yt-dlp --version
else
    echo "❌ yt-dlp installation failed"
    exit 1
fi

if command -v ffmpeg &> /dev/null; then
    echo "✅ ffmpeg installed successfully"
    ffmpeg -version | head -1
else
    echo "❌ ffmpeg installation failed"
    exit 1
fi

echo ""
echo "🎉 Setup complete! YouTube processing is now ready."
echo ""
echo "📝 Next steps:"
echo "1. Install Node.js dependencies: npm install"
echo "2. Start the backend server: npm run dev"
echo "3. Test YouTube processing in the mobile app"
echo ""
echo "💡 The system will now:"
echo "   - Extract audio from any YouTube video (no API limits)"
echo "   - Generate transcripts using OpenAI Whisper"
echo "   - Work with videos that don't have captions"
echo "   - Cache results to avoid reprocessing" 