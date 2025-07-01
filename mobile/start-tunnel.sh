#!/bin/bash

# Script to start Expo with tunnel and retry if ngrok fails
echo "🚀 Starting Expo with tunnel (auto-retry)..."

MAX_ATTEMPTS=5
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "🔄 Attempt $ATTEMPT/$MAX_ATTEMPTS"
    
    # Start expo with tunnel
    npx expo start --tunnel --clear
    
    # Check if it succeeded (you can customize this check)
    if [ $? -eq 0 ]; then
        echo "✅ Tunnel started successfully!"
        break
    else
        echo "❌ Tunnel failed, retrying in 5 seconds..."
        sleep 5
        ATTEMPT=$((ATTEMPT + 1))
    fi
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "❌ Failed to start tunnel after $MAX_ATTEMPTS attempts"
    echo "💡 Try using --lan mode instead: npx expo start --lan"
    exit 1
fi 