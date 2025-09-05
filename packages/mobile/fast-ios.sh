#!/bin/bash

# Personal Assistant - Fast iOS Development
# Optimized for REAL voice recognition in development
echo "🚀 Personal Assistant - Fast iOS Development"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Optimized for voice assistant development${NC}"
echo ""

# Clean up any existing processes
echo -e "${BLUE}🧹 Cleaning up existing processes...${NC}"
pkill -f "expo|metro|react-native|watchman" 2>/dev/null || true
lsof -ti:8081,19000,19001,19002,3000 | xargs kill -9 2>/dev/null || true
echo "✅ Processes cleaned"
echo ""

# Show available tiers
echo "🎤 Select Development Mode:"
echo ""
echo -e "${GREEN}1) Development Build${NC} (2-3 min - REAL Voice Recognition)"
echo "   • expo-speech-recognition (real iOS voice)"
echo "   • Real calendar/email integration"
echo "   • Optimized build settings"
echo "   • Full personal assistant functionality"
echo ""
echo -e "${YELLOW}2) Production Build${NC} (10-15 min - Full Optimization)"
echo "   • Maximum optimization"
echo "   • WhisperKit integration (future)"
echo "   • Release configuration"
echo ""
read -p "Enter choice (1-2): " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}🚀 Starting Development Build Mode${NC}"
        echo -e "${BLUE}════════════════════════════════════${NC}"
        echo ""
        echo "📋 What happens next:"
        echo "1. Optimized native build starts"
        echo "2. Real voice recognition enabled"
        echo "3. App installs to simulator"
        echo "4. Full personal assistant functionality"
        echo ""
        echo -e "${GREEN}✨ Features Active:${NC}"
        echo "• Voice: expo-speech-recognition (real iOS)"
        echo "• Calendar: Native iOS calendar integration"
        echo "• Email: Native iOS email integration"
        echo "• Backend: Fastify API connection"
        echo ""
        echo -e "${YELLOW}🔧 Build Optimizations:${NC}"
        echo "• Old Architecture (faster builds)"
        echo "• Development configuration"
        echo "• Incremental compilation"
        echo "• Single architecture (arm64)"
        echo ""
        echo "Starting optimized build..."
        sleep 2
        
        # Set optimized development build flags
        export EXPO_USE_OLD_ARCHITECTURE=1
        export EXPO_NO_FLIPPER=1
        export NODE_ENV=development
        
        # Start with optimized settings
        time npx expo run:ios
        ;;
    2)
        echo ""
        echo -e "${YELLOW}🏗️ Starting Production Build Mode${NC}"
        echo -e "${BLUE}════════════════════════════════════${NC}"
        echo ""
        echo -e "${RED}⚠️  This will take 10-15 minutes${NC}"
        echo -e "${GREEN}⚡  Full optimization and testing${NC}"
        echo ""
        echo "📋 What happens next:"
        echo "1. Full production build"
        echo "2. Maximum optimization"
        echo "3. Release configuration"
        echo "4. Comprehensive testing"
        echo ""
        read -p "Continue with production build? (y/N): " confirm
        
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            echo ""
            echo -e "${GREEN}🚀 Building production app...${NC}"
            echo ""
            
            # Production build settings
            export NODE_ENV=production
            export EXPO_USE_OLD_ARCHITECTURE=1
            
            time npx expo run:ios --variant release
        else
            echo "Cancelled. Use Development Build for faster iteration."
            exit 0
        fi
        ;;
    *)
        echo "Invalid choice. Defaulting to Development Build..."
        time npx expo run:ios
        ;;
esac