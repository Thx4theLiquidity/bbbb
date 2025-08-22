#!/bin/bash

# Vanity Mining Worker Startup Script
# This script helps set up and start the vanity mining worker

set -e

echo "🚀 Starting Vanity Mining Worker..."

# Check if required environment variables are set
if [ -z "$REDIS_HOST" ]; then
    echo "⚠️  REDIS_HOST not set, using default: localhost"
    export REDIS_HOST=localhost
fi

if [ -z "$REDIS_PORT" ]; then
    echo "⚠️  REDIS_PORT not set, using default: 6379"
    export REDIS_PORT=6379
fi

if [ -z "$DEVICE_ID" ]; then
    echo "⚠️  DEVICE_ID not set, using default: 0"
    export DEVICE_ID=0
fi

if [ -z "$MINER_PATH" ]; then
    export MINER_PATH="$(pwd)/target/release/fourfourfourfour"
    echo "⚠️  MINER_PATH not set, using: $MINER_PATH"
fi

# Check if the miner binary exists
if [ ! -f "$MINER_PATH" ]; then
    echo "❌ Miner binary not found at: $MINER_PATH"
    echo "Building the Rust binary..."
    cargo build --release
fi

# Check if Node.js dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Display configuration
echo ""
echo "🔧 Configuration:"
echo "   Redis Host: $REDIS_HOST:$REDIS_PORT"
echo "   Device ID: $DEVICE_ID"
echo "   Miner Path: $MINER_PATH"
echo "   Redis Password: $(if [ -n "$REDIS_PASS" ]; then echo "***SET***"; else echo "NOT SET"; fi)"
echo ""

# Test Redis connection
echo "🔍 Testing Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli -h $REDIS_HOST -p $REDIS_PORT ${REDIS_PASS:+-a $REDIS_PASS} ping > /dev/null 2>&1; then
        echo "✅ Redis connection successful"
    else
        echo "❌ Redis connection failed"
        exit 1
    fi
else
    echo "⚠️  redis-cli not available, skipping connection test"
fi

# Test GPU availability
echo "🔍 Testing GPU availability..."
if command -v clinfo &> /dev/null; then
    clinfo | grep -q "Number of devices" && echo "✅ OpenCL devices found" || echo "⚠️  No OpenCL devices found"
else
    echo "⚠️  clinfo not available, skipping GPU test"
fi

echo ""
echo "🎯 Starting worker for vanity salt mining..."
echo "   Looking for addresses with 8+ leading 'b' nibbles (0xBBBBBBBB...)"
echo "   Press Ctrl+C to stop"
echo ""

# Start the worker
exec npm start