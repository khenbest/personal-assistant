#!/bin/bash

# Start all services for the Personal Assistant app

echo "🚀 Starting Personal Assistant Services..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Start backend
echo -e "${GREEN}Starting Backend API on port 3000...${NC}"
cd packages/backend
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
    echo -e "${RED}❌ Backend failed to start${NC}"
fi

echo ""

# Start mobile app
echo -e "${GREEN}Starting Expo Mobile App...${NC}"
cd packages/mobile
npm start

# This will run in foreground so you can see the QR code and interact with Expo