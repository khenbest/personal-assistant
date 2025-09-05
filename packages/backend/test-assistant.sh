#!/bin/bash

# Test Assistant API with Voice Commands
echo "🎤 Voice Assistant Test Suite"
echo "============================="

API_URL="http://localhost:3000/api/assistant/enhanced"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

test_command() {
    local command="$1"
    local description="$2"
    
    echo -e "\n${CYAN}Testing:${NC} $description"
    echo -e "${YELLOW}Command:${NC} \"$command\""
    
    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"$command\",\"userId\":\"test-user\"}")
    
    echo -e "${GREEN}Response:${NC}"
    echo "$response" | jq -C '.' 2>/dev/null || echo "$response"
    echo "---"
}

# Calendar Tests
echo -e "\n📅 CALENDAR TESTS"
test_command "Schedule a meeting tomorrow at 3pm" "Create event"
test_command "What's on my calendar?" "Query events"

# Reminder Tests  
echo -e "\n⏰ REMINDER TESTS"
test_command "Remind me to call mom in 2 hours" "Time reminder"
test_command "What are my reminders?" "List reminders"

# Note Tests
echo -e "\n📝 NOTE TESTS"
test_command "Note that the wifi password is abc123" "Create note"
test_command "Show my notes" "Query notes"

# iOS Action Tests
echo -e "\n📱 iOS ACTION TESTS"
test_command "Open settings" "Launch app"
test_command "Take a photo" "Camera"
test_command "Turn on flashlight" "Device control"

echo -e "\n✅ Test complete!"
