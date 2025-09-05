#!/bin/bash

# Test script for Enhanced Assistant with iOS Actions
# Run this to test the new enhanced endpoints

API_URL="http://localhost:3000"

echo "🧪 Testing Enhanced Assistant with iOS Actions"
echo "============================================="

# Test 1: Get available actions
echo -e "\n📱 Test 1: Getting available iOS actions..."
curl -s "$API_URL/api/assistant/actions" | jq '.'

# Test 2: Search for specific actions
echo -e "\n🔍 Test 2: Searching for calendar actions..."
curl -s "$API_URL/api/assistant/actions/search?q=calendar" | jq '.'

# Test 3: Test calendar event creation
echo -e "\n📅 Test 3: Creating calendar event..."
curl -X POST "$API_URL/api/assistant/enhanced" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Schedule a meeting with John tomorrow at 2pm",
    "context": {
      "deviceInfo": {
        "platform": "ios",
        "version": "17.0"
      }
    }
  }' | jq '.'

# Test 4: Test reminder creation
echo -e "\n⏰ Test 4: Creating reminder..."
curl -X POST "$API_URL/api/assistant/enhanced" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Remind me to call the dentist tomorrow"
  }' | jq '.'

# Test 5: Test location query
echo -e "\n📍 Test 5: Getting current location..."
curl -X POST "$API_URL/api/assistant/enhanced" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Where am I?"
  }' | jq '.'

# Test 6: Test contact search
echo -e "\n👥 Test 6: Searching contacts..."
curl -X POST "$API_URL/api/assistant/enhanced" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Find John Smith phone number"
  }' | jq '.'

# Test 7: Test battery status
echo -e "\n🔋 Test 7: Checking battery status..."
curl -X POST "$API_URL/api/assistant/enhanced" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What is my battery level?"
  }' | jq '.'

# Test 8: Test notification scheduling
echo -e "\n🔔 Test 8: Scheduling notification..."
curl -X POST "$API_URL/api/assistant/enhanced" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Notify me in 30 minutes to take a break"
  }' | jq '.'

# Test 9: Test text-to-speech
echo -e "\n🗣️ Test 9: Text to speech..."
curl -X POST "$API_URL/api/assistant/enhanced" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Say hello world"
  }' | jq '.'

# Test 10: Test haptic feedback
echo -e "\n📳 Test 10: Haptic feedback..."
curl -X POST "$API_URL/api/assistant/enhanced" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Give me haptic feedback"
  }' | jq '.'

echo -e "\n✅ Enhanced Assistant tests completed!"