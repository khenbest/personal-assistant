#!/bin/bash

# Fast Native Build Script for iOS Development
# Optimized for rapid testing with native builds

echo "⚡ Fast Native iOS Build"
echo "========================"

# Configuration
PROJECT_DIR="$(pwd)"
IOS_DIR="$PROJECT_DIR/ios"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

# Setup build optimizations
export SKIP_BUNDLING=1
export RCT_NO_LAUNCH_PACKAGER=1

# Kill existing Metro
pkill -f "metro" 2>/dev/null || true

# Start optimized Metro
print_status "Starting optimized Metro bundler..."
npx react-native start --reset-cache=false --max-workers=4 &>/dev/null &
METRO_PID=$!
sleep 2

# Build with optimizations
print_status "Building iOS app with optimizations..."
cd "$IOS_DIR"
xcodebuild \
    -workspace PersonalAssistant.xcworkspace \
    -scheme PersonalAssistant \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
    -derivedDataPath build/DerivedData \
    -quiet \
    ONLY_ACTIVE_ARCH=YES \
    GCC_OPTIMIZATION_LEVEL=0 \
    COMPILER_INDEX_STORE_ENABLE=NO

print_status "Build complete! Launching app..."
xcrun simctl install booted build/DerivedData/Build/Products/Debug-iphonesimulator/PersonalAssistant.app
xcrun simctl launch --console booted com.kenny-assistant.mobile

print_status "App running. Press Ctrl+C to stop."
wait $METRO_PID
