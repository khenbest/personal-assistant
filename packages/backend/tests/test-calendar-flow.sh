#!/bin/bash

# Test script for calendar creation flow
echo "🧪 Testing Calendar Creation Flow"
echo "=================================="

API_URL="http://localhost:3000/api"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "1️⃣  Testing health check..."
health_response=$(curl -s "${API_URL}/health")
echo "Response: $health_response"

echo ""
echo "2️⃣  Testing voice command endpoint..."
voice_response=$(curl -s -X POST "${API_URL}/voice/command" \
    -H "Content-Type: application/json" \
    -d '{
        "text": "Schedule team meeting tomorrow at 3pm",
        "userId": "demo-user"
    }')

# Check if successful
if echo "$voice_response" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Voice command processed successfully!${NC}"
    echo "Response: $voice_response" | jq '.'
else
    echo -e "${RED}❌ Voice command failed${NC}"
    echo "Response: $voice_response"
fi

echo ""
echo "3️⃣  Testing command endpoint with intent classification..."
command_response=$(curl -s -X POST "${API_URL}/command" \
    -H "Content-Type: application/json" \
    -d '{
        "command": "Book conference room for Friday 2pm to 4pm",
        "type": "auto",
        "userId": "demo-user"
    }')

if echo "$command_response" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Command processed successfully!${NC}"
    echo "Intent: $(echo "$command_response" | jq -r '.intent')"
    echo "Confidence: $(echo "$command_response" | jq -r '.confidence')"
    echo "Event Title: $(echo "$command_response" | jq -r '.event.title')"
else
    echo -e "${RED}❌ Command processing failed${NC}"
    echo "Response: $command_response"
fi

echo ""
echo "4️⃣  Testing various voice commands..."
test_commands=(
    "Schedule lunch tomorrow at noon"
    "Add dentist appointment next Monday at 10am"
    "Create meeting with john@example.com tomorrow at 4pm"
    "Book team standup every Monday at 9am"
)

for cmd in "${test_commands[@]}"; do
    echo ""
    echo "Testing: \"$cmd\""
    response=$(curl -s -X POST "${API_URL}/voice/command" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$cmd\", \"userId\": \"demo-user\"}")
    
    intent=$(echo "$response" | jq -r '.intent')
    confidence=$(echo "$response" | jq -r '.confidence')
    spoken=$(echo "$response" | jq -r '.spokenResponse')
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅${NC} Intent: $intent (confidence: $confidence)"
        echo "   Voice Response: $spoken"
    else
        echo -e "${RED}✗${NC} Failed: $(echo "$response" | jq -r '.error')"
    fi
done

echo ""
echo "5️⃣  Testing intent statistics..."
stats_response=$(curl -s "${API_URL}/intent/stats")
echo "Stats: $stats_response" | jq '.'

echo ""
echo "=================================="
echo "Testing complete!"