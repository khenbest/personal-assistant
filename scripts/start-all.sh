#!/bin/bash

# Start all services for the Personal Assistant app

echo "🚀 Starting Personal Assistant Services..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check and install dependencies
check_and_install() {
    local dir=$1
    local name=$2
    local original_dir=$(pwd)
    
    echo -e "${YELLOW}Checking ${name} dependencies...${NC}"
    cd $dir
    
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing ${name} dependencies...${NC}"
        npm install
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ ${name} dependencies installed${NC}"
        else
            echo -e "${RED}❌ Failed to install ${name} dependencies${NC}"
            cd "$original_dir"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ ${name} dependencies already installed${NC}"
    fi
    
    # Handle Expo bare workflow iOS setup
    if [ "$name" = "Mobile" ] && [ -f "ios/Podfile" ]; then
        echo -e "${YELLOW}Detected Expo bare workflow with iOS native code...${NC}"
        
        # Check if full Xcode is available
        if xcodebuild -version > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Xcode detected - iOS development available${NC}"
            
            # Check for CocoaPods
            if command -v pod >/dev/null 2>&1; then
                if [ ! -d "ios/Pods" ] || [ "ios/Podfile" -nt "ios/Podfile.lock" ]; then
                    echo -e "${YELLOW}Installing iOS dependencies...${NC}"
                    cd ios
                    pod install
                    pod_result=$?
                    cd ..
                    
                    if [ $pod_result -eq 0 ]; then
                        echo -e "${GREEN}✅ iOS dependencies installed${NC}"
                    else
                        echo -e "${YELLOW}⚠️  iOS pod install had issues${NC}"
                        echo -e "${YELLOW}    You can still use Expo Go for development${NC}"
                    fi
                else
                    echo -e "${GREEN}✅ iOS dependencies up to date${NC}"
                fi
            else
                echo -e "${YELLOW}Installing CocoaPods...${NC}"
                if command -v brew >/dev/null 2>&1; then
                    brew install cocoapods
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  Full Xcode not found (only Command Line Tools detected)${NC}"
            echo -e "${YELLOW}    Skipping iOS native setup - use Expo Go for development${NC}"
            echo -e "${YELLOW}    Install Xcode from App Store for full iOS development${NC}"
        fi
        
        echo -e "${YELLOW}Development options:${NC}"
        echo -e "${YELLOW}    • Expo Go: Use 'npm start' then scan QR code${NC}"
        echo -e "${YELLOW}    • iOS Simulator: Use 'npm run ios' (requires Xcode)${NC}"
        echo -e "${YELLOW}    • Android: Use 'npm run android' (requires Android Studio)${NC}"
    fi
    
    cd "$original_dir"
}

# Check and install backend dependencies
check_and_install "packages/backend" "Backend"

# Check and install mobile dependencies
check_and_install "packages/mobile" "Mobile"

echo ""

# Start backend
echo -e "${GREEN}Starting Backend API on port 3000...${NC}"
if [ -d "packages/backend" ]; then
    cd packages/backend
    if [ -f "package.json" ]; then
        npm run dev &
        BACKEND_PID=$!
        echo "Backend PID: $BACKEND_PID"
        cd ../..
        
        # Wait for backend to start
        echo -e "${YELLOW}Waiting for backend to start...${NC}"
        sleep 5
        
        # Check if backend is running
        curl -s http://localhost:3000/health > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Backend is running!${NC}"
        else
            echo -e "${YELLOW}⚠️  Backend may still be starting up...${NC}"
            echo -e "${YELLOW}    Check http://localhost:3000/health manually${NC}"
        fi
    else
        echo -e "${RED}❌ Backend package.json not found${NC}"
        cd ../..
    fi
else
    echo -e "${RED}❌ Backend directory not found${NC}"
fi

echo ""

# Start mobile app
echo -e "${GREEN}Starting Expo Mobile App...${NC}"
if [ -d "packages/mobile" ]; then
    cd packages/mobile
    if [ -f "package.json" ]; then
        echo -e "${YELLOW}Starting Expo development server...${NC}"
        echo -e "${YELLOW}📱 To test the app:${NC}"
        echo -e "${YELLOW}   • Scan QR code with Expo Go app on your phone${NC}"
        echo -e "${YELLOW}   • Press 'i' for iOS simulator (if Xcode installed)${NC}"
        echo -e "${YELLOW}   • Press 'a' for Android emulator${NC}"
        echo -e "${YELLOW}   • Press 'w' for web browser${NC}"
        echo -e "${YELLOW}${NC}"
        npm start
    else
        echo -e "${RED}❌ Mobile package.json not found${NC}"
    fi
else
    echo -e "${RED}❌ Mobile directory not found${NC}"
fi

# This will run in foreground so you can see the QR code and interact with Expo