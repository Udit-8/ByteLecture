#!/bin/bash
# ByteLecture Testing Script

echo "🚀 ByteLecture Testing Suite"
echo "=========================="

# Build the project
echo "📦 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix compilation errors."
    exit 1
fi

# Check if server is running
echo "🔍 Checking if server is running..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Server is running"
    WAIT_FOR_SERVER=false
else
    echo "⚠️  Server not running. Starting server..."
    npm start &
    SERVER_PID=$!
    WAIT_FOR_SERVER=true
    
    # Wait for server to start
    echo "⏳ Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/api/health > /dev/null; then
            echo "✅ Server started successfully"
            break
        fi
        sleep 1
    done
fi

# Run tests based on argument
case "$1" in
    "pdf")
        echo "🧪 Testing PDF Processing Service..."
        npm run test:pdf
        ;;
    "api")
        echo "🌐 Testing API Endpoints..."
        npm run test:api
        ;;
    "upload")
        echo "📤 Testing Upload Service..."
        npm run test:upload
        ;;
    "all"|"")
        echo "🎯 Running all tests..."
        npm run test:pdf
        npm run test:api
        npm run test:upload
        ;;
    *)
        echo "Usage: ./test.sh [pdf|api|upload|all]"
        exit 1
        ;;
esac

# Cleanup
if [ "$WAIT_FOR_SERVER" = true ]; then
    echo "🧹 Stopping test server..."
    kill $SERVER_PID
fi

echo "✅ Testing completed"
