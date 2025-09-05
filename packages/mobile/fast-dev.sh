#!/bin/bash

# Fast Development Script for iOS Testing
# Optimized for rapid iteration and testing

echo "🚀 Fast Dev Mode for iOS Personal Assistant"
echo "=========================================="

# Configuration
SKIP_BUNDLING=${SKIP_BUNDLING:-false}
USE_CACHE=${USE_CACHE:-true}
CLEAR_CACHE=${CLEAR_CACHE:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Clear cache if requested
if [ "$CLEAR_CACHE" = "true" ]; then
    print_status "Clearing Metro cache..."
    npx expo start --clear
    rm -rf $TMPDIR/metro-*
    rm -rf $TMPDIR/react-*
    rm -rf $TMPDIR/haste-*
    watchman watch-del-all 2>/dev/null || true
fi

# 2. Kill any existing Metro bundler
print_status "Killing existing Metro bundler..."
pkill -f "metro" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true

# 3. Start Metro bundler in background with optimizations
print_status "Starting optimized Metro bundler..."
RCT_METRO_PORT=8081 npx expo start \
    --dev-client \
    --ios \
    --localhost \
    --minify=false \
    --max-workers=4 \
    &>/dev/null &

METRO_PID=$!
echo "Metro PID: $METRO_PID"

# Wait for Metro to be ready
print_status "Waiting for Metro bundler to be ready..."
sleep 3

# 4. Check if simulator is running
if ! xcrun simctl list devices | grep -q "Booted"; then
    print_status "Starting iOS Simulator..."
    open -a Simulator
    sleep 5
    
    # Wait for simulator to boot
    while ! xcrun simctl list devices | grep -q "Booted"; do
        sleep 1
    done
fi

# 5. Get the booted simulator ID
SIMULATOR_ID=$(xcrun simctl list devices | grep "Booted" | grep -E -o "[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}" | head -1)

if [ -z "$SIMULATOR_ID" ]; then
    print_error "No iOS Simulator found running"
    exit 1
fi

print_status "Using Simulator: $SIMULATOR_ID"

# 6. Check if app is already installed
APP_BUNDLE_ID="com.kenny-assistant.mobile"
if xcrun simctl get_app_container "$SIMULATOR_ID" "$APP_BUNDLE_ID" 2>/dev/null; then
    print_status "App already installed, launching..."
    
    # Terminate if running
    xcrun simctl terminate "$SIMULATOR_ID" "$APP_BUNDLE_ID" 2>/dev/null || true
    
    # Launch the app
    xcrun simctl launch --console "$SIMULATOR_ID" "$APP_BUNDLE_ID"
else
    print_warning "App not installed, running full build..."
    npx expo run:ios --device "$SIMULATOR_ID"
fi

# 7. Set up file watching for hot reload
print_status "Setting up hot reload watchers..."

# Function to handle file changes
handle_change() {
    local file="$1"
    echo -e "${YELLOW}♻${NC} File changed: $file"
    
    # Trigger reload in simulator
    xcrun simctl openurl "$SIMULATOR_ID" "http://localhost:8081/reload" 2>/dev/null || true
}

# 8. Monitor logs
print_status "Monitoring app logs (Ctrl+C to stop)..."
echo "=========================================="
echo ""

# Tail logs from simulator
xcrun simctl spawn "$SIMULATOR_ID" log stream --style compact --predicate 'process == "PersonalAssistant" OR process == "expo"' &

# Keep script running
wait $METRO_PID