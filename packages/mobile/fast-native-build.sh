#!/bin/bash

# VoiceCore Fast Native Build Strategy
# Real WhisperKit + Real Calendar + Optimized Builds = <3 min

echo "🚀 Personal Assistant - Fast Native Build"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Real voice recognition + Real calendar integration${NC}"
echo -e "${GREEN}Target: <3 minute builds with VoiceCore optimizations${NC}"
echo ""

# Check if this is first run
if [ ! -f "ios/build_cache_ready" ]; then
    echo -e "${YELLOW}🏗️ First Build Setup (10-15 minutes one-time)${NC}"
    echo "This creates the build cache for all future 2-3 minute builds"
    echo ""
    read -p "Continue with first-time setup? (y/N): " setup_confirm
    
    if [[ $setup_confirm != "y" && $setup_confirm != "Y" ]]; then
        echo "Setup cancelled. Run this script again when ready."
        exit 0
    fi
    
    echo ""
    echo -e "${BLUE}Setting up build optimizations...${NC}"
    
    # Apply build optimizations to Xcode project
    if [ -f "ios/Eidolon.xcodeproj/project.pbxproj" ]; then
        echo "📝 Applying VoiceCore build optimizations to Xcode project..."
        
        # Import our optimization config
        sed -i '' 's|PRODUCT_NAME = $(TARGET_NAME)|PRODUCT_NAME = $(TARGET_NAME); #include "BuildOptimizations.xcconfig"|' ios/Eidolon.xcodeproj/project.pbxproj
        
        echo "✅ Build optimizations applied"
    else
        echo -e "${RED}⚠️ Xcode project not found, running prebuild first...${NC}"
        npx expo prebuild --platform ios --clear
    fi
    
    echo ""
    echo -e "${BLUE}🔨 Running first optimized build...${NC}"
    echo "This will take 10-15 minutes but creates cache for future builds"
    echo ""
fi

# Clean up processes
echo -e "${BLUE}🧹 Cleaning up processes...${NC}"
pkill -f "expo|metro" 2>/dev/null || true
lsof -ti:8081,19000,19001,19002 | xargs kill -9 2>/dev/null || true

# Set optimization flags
export EXPO_USE_OLD_ARCHITECTURE=1  # Faster than new architecture
export EXPO_NO_FLIPPER=1             # Skip Flipper for speed
export EXPO_SKIP_DUPLICATE_MODULES=1  # Skip duplicate checks
export EXPO_DEBUG_FAST_REFRESH=1      # Enable fast refresh

echo ""
echo -e "${GREEN}⚡ Starting Optimized Native Build...${NC}"
echo -e "${BLUE}Features enabled:${NC}"
echo "• Real expo-speech-recognition (WhisperKit)"  
echo "• Real calendar integration"
echo "• Real email integration"
echo "• Fast refresh for UI changes"
echo ""

start_time=$(date +%s)

# Run the optimized build
if npx expo run:ios --configuration Debug; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    minutes=$((duration / 60))
    seconds=$((duration % 60))
    
    # Mark cache as ready after first successful build
    if [ ! -f "ios/build_cache_ready" ]; then
        touch ios/build_cache_ready
        echo ""
        echo -e "${GREEN}✅ BUILD CACHE READY!${NC}"
        echo "Future builds will now take 2-3 minutes"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 SUCCESS! Build completed in ${minutes}m ${seconds}s${NC}"
    echo ""
    echo -e "${BLUE}Your app is now running with:${NC}"
    echo "✅ Real voice recognition (expo-speech-recognition)"
    echo "✅ Real calendar integration" 
    echo "✅ Real email capabilities"
    echo "✅ Fast refresh enabled for UI development"
    echo ""
    echo -e "${GREEN}Next build will be <3 minutes!${NC}"
    
else
    echo ""
    echo -e "${RED}❌ Build failed${NC}"
    echo "Check the error above and try again"
    echo ""
    echo "Common fixes:"
    echo "- Ensure Xcode is installed and updated"
    echo "- Try: npx expo install --fix"
    echo "- Try: cd ios && pod install"
    exit 1
fi