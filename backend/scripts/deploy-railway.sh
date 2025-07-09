#!/bin/bash

# ByteLecture Backend - Railway Deployment Script

set -e

echo "🚂 Deploying ByteLecture Backend to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway (if not already logged in)
echo "🔐 Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo "Please login to Railway:"
    railway login
fi

# Create project if it doesn't exist
echo "📋 Setting up Railway project..."
if [ ! -f railway.toml ]; then
    echo "Creating new Railway project for ByteLecture..."
    railway link
fi

# Set environment variables
echo "⚙️ Configuring environment variables..."

# Check if .env exists
if [ -f .env ]; then
    echo "📄 Found .env file. Setting variables from file..."
    
    # Required variables
    if grep -q "SUPABASE_URL=" .env; then
        SUPABASE_URL=$(grep "SUPABASE_URL=" .env | cut -d'=' -f2)
        railway variables set SUPABASE_URL="$SUPABASE_URL"
    fi
    
    if grep -q "SUPABASE_ANON_KEY=" .env; then
        SUPABASE_ANON_KEY=$(grep "SUPABASE_ANON_KEY=" .env | cut -d'=' -f2)
        railway variables set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
    fi
    
    if grep -q "SUPABASE_SERVICE_KEY=" .env; then
        SUPABASE_SERVICE_KEY=$(grep "SUPABASE_SERVICE_KEY=" .env | cut -d'=' -f2)
        railway variables set SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY"
    fi
    
    if grep -q "OPENAI_API_KEY=" .env; then
        OPENAI_API_KEY=$(grep "OPENAI_API_KEY=" .env | cut -d'=' -f2)
        railway variables set OPENAI_API_KEY="$OPENAI_API_KEY"
    fi
    
    # Optional variables
    if grep -q "YOUTUBE_API_KEY=" .env; then
        YOUTUBE_API_KEY=$(grep "YOUTUBE_API_KEY=" .env | cut -d'=' -f2)
        railway variables set YOUTUBE_API_KEY="$YOUTUBE_API_KEY"
    fi
    
    if grep -q "YT_CHUNK_MINUTES=" .env; then
        YT_CHUNK_MINUTES=$(grep "YT_CHUNK_MINUTES=" .env | cut -d'=' -f2)
        railway variables set YT_CHUNK_MINUTES="$YT_CHUNK_MINUTES"
    fi
    
    if grep -q "SUMMARY_MAX_TOKENS=" .env; then
        SUMMARY_MAX_TOKENS=$(grep "SUMMARY_MAX_TOKENS=" .env | cut -d'=' -f2)
        railway variables set SUMMARY_MAX_TOKENS="$SUMMARY_MAX_TOKENS"
    fi
    
else
    echo "⚠️ No .env file found. Please set environment variables manually:"
    echo "   railway variables set SUPABASE_URL=your_value"
    echo "   railway variables set SUPABASE_ANON_KEY=your_value"
    echo "   railway variables set OPENAI_API_KEY=your_value"
    echo ""
    echo "Or create a .env file and run this script again."
    exit 1
fi

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up --detach

echo ""
echo "🎉 Deployment initiated!"
echo ""
echo "📊 Monitor deployment:"
echo "   railway logs"
echo "   railway status"
echo ""
echo "🌐 Get deployment URL:"
echo "   railway domain"
echo ""
echo "🔧 Manage variables:"
echo "   railway variables"
echo ""
echo "💡 Your ByteLecture backend will be available at:"
echo "   https://your-project.railway.app"
echo ""
echo "✅ Audio processing features:"
echo "   - yt-dlp for YouTube video downloads"
echo "   - ffmpeg for audio processing and chunking"
echo "   - OpenAI Whisper for transcription"
echo "   - Automatic scaling based on demand" 