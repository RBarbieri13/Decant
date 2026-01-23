#!/bin/bash
# Decant Development Launcher - Double-click to start
# This script starts the development server and opens the browser

cd "$(dirname "$0")"

echo "======================================"
echo "  Decant Development Server Starting"
echo "======================================"
echo ""

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "Error: pnpm is not installed or not in PATH"
    echo "Please install pnpm: npm install -g pnpm"
    read -p "Press Enter to close..."
    exit 1
fi

# Kill any existing server on default port
echo "Checking for existing server on port 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null

# Start the development server
echo "Starting server at http://localhost:8080..."
echo ""
pnpm server:start &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
for i in {1..30}; do
    if curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo ""
        echo "Server ready! Opening browser..."
        open http://localhost:8080
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 1
done

# Check if server actually started
if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo ""
    echo "Error: Server failed to start within 30 seconds"
    echo "Check the console output above for errors"
    read -p "Press Enter to close..."
    exit 1
fi

echo ""
echo "======================================"
echo "  Server running (PID: $SERVER_PID)"
echo "  URL: http://localhost:8080"
echo "  Press Ctrl+C to stop"
echo "======================================"
echo ""

wait $SERVER_PID
