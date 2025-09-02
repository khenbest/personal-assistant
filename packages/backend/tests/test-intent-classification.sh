#!/bin/bash

# Test script for intent classification
echo "🧪 Testing Intent Classification System"
echo "========================================"

API_URL="http://localhost:3000/api/intent"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test function
test_intent() {
    local text="$1"
    local expected_intent="$2"
    
    echo -n "Testing: \"$text\" -> "
    
    response=$(curl -s -X POST "${API_URL}/classify" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$text\"}")
    
    intent=$(echo "$response" | jq -r '.intent')
    confidence=$(echo "$response" | jq -r '.confidence')
    
    if [ "$intent" == "$expected_intent" ]; then
        echo -e "${GREEN}✓${NC} Intent: $intent (confidence: $confidence)"
    else
        echo -e "${RED}✗${NC} Expected: $expected_intent, Got: $intent (confidence: $confidence)"
    fi
    
    # Show slots if any
    slots=$(echo "$response" | jq '.slots')
    if [ "$slots" != "{}" ] && [ "$slots" != "null" ]; then
        echo "  Slots: $slots"
    fi
}

echo ""
echo "Testing CREATE_EVENT intents:"
echo "------------------------------"
test_intent "Schedule a meeting tomorrow at 3pm with the product team" "create_event"
test_intent "Book conference room for Friday 2-4pm" "create_event"
test_intent "Add dentist appointment May 15th at 2:30" "create_event"
test_intent "Create recurring weekly sync with engineering" "create_event"

echo ""
echo "Testing ADD_REMINDER intents:"
echo "------------------------------"
test_intent "Remind me to call mom tomorrow" "add_reminder"
test_intent "Set reminder in 2 hours to take medication" "add_reminder"
test_intent "Ping me next Friday about the deadline" "add_reminder"
test_intent "Don't let me forget to submit the report by 5pm" "add_reminder"

echo ""
echo "Testing CREATE_NOTE intents:"
echo "-----------------------------"
test_intent "Take a note about the new project requirements" "create_note"
test_intent "Save this idea: implement voice commands" "create_note"
test_intent "Document the meeting notes from today" "create_note"
test_intent "Write down: API key expires in 30 days" "create_note"

echo ""
echo "Testing EMAIL intents:"
echo "----------------------"
test_intent "Send email to john@example.com about the proposal" "send_email"
test_intent "Check my emails from yesterday" "read_email"
test_intent "Read the latest email from Sarah" "read_email"
test_intent "Reply to Bob's message with approval" "send_email"

echo ""
echo "Testing ambiguous/edge cases:"
echo "------------------------------"
test_intent "Tomorrow" "none"
test_intent "Meeting notes" "create_note"
test_intent "Email reminder for tomorrow" "add_reminder"
test_intent "Schedule reminder for meeting" "add_reminder"

echo ""
echo "========================================"
echo "Testing complete!"