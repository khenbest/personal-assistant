#!/bin/bash

# Test script for Unified Architecture
# Tests the new consolidated flow with single orchestrator

API_URL="http://localhost:3000"

echo "🏗️  Testing Unified Architecture"
echo "=================================="

# Test 1: Standard text request (replaces /api/assistant/process)
echo -e "\n📝 Test 1: Standard text request..."
curl -s -X POST "$API_URL/api/unified/process" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Schedule a meeting with Sarah tomorrow at 3pm",
    "userId": "test-user"
  }' | jq '.'

# Test 2: Enhanced request with iOS context (replaces /api/assistant/enhanced)
echo -e "\n📱 Test 2: iOS enhanced request..."
curl -s -X POST "$API_URL/api/unified/process" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Remind me to call the dentist",
    "context": {
      "deviceInfo": {
        "platform": "ios",
        "version": "17.0"
      }
    }
  }' | jq '.'

# Test 3: Voice request (replaces /api/voice)
echo -e "\n🎤 Test 3: Voice request..."
curl -s -X POST "$API_URL/api/unified/process" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What is on my calendar today?",
    "context": {
      "isVoice": true
    }
  }' | jq '.'

# Test 4: Get available actions
echo -e "\n⚡ Test 4: Get available iOS actions..."
curl -s "$API_URL/api/unified/actions" | jq '.[0:3]'

# Test 5: Search actions
echo -e "\n🔍 Test 5: Search for calendar actions..."
curl -s "$API_URL/api/unified/actions/search?q=calendar" | jq '.'

# Test 6: Health check
echo -e "\n❤️ Test 6: Health check..."
curl -s "$API_URL/api/unified/health" | jq '.'

# Test 7: Test legacy endpoint mapping
echo -e "\n🔄 Test 7: Legacy endpoint compatibility..."
curl -s -X POST "$API_URL/api/assistant/process" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Create a note about the architecture update"
  }' | jq '.'

echo -e "\n✅ Unified Architecture Testing Complete!"
echo "=========================================="
echo ""
echo "Architecture Benefits:"
echo "  • Single orchestrator managing all flows"
echo "  • Singleton services (no duplicate instances)"
echo "  • iOS actions available everywhere"
echo "  • Unified conversation context"
echo "  • Legacy endpoint compatibility maintained"