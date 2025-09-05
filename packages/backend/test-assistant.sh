#!/bin/bash

# Test the new assistant endpoint

echo "🧪 Testing Personal Assistant API"
echo "================================"

# Test health check
echo -e "\n📍 Testing health endpoint..."
curl -s http://localhost:3000/api/assistant/health | jq .

# Test creating a session
echo -e "\n🆕 Creating new session..."
SESSION=$(curl -s -X POST http://localhost:3000/api/assistant/session/new | jq -r '.sessionId')
echo "Session ID: $SESSION"

# Test various intents
echo -e "\n🗓️ Test 1: Schedule a meeting"
curl -s -X POST http://localhost:3000/api/assistant/process \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Schedule a meeting with John tomorrow at 2pm",
    "sessionId": "'$SESSION'"
  }' | jq .

echo -e "\n📅 Test 2: Query calendar"
curl -s -X POST http://localhost:3000/api/assistant/process \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What is on my calendar tomorrow?",
    "sessionId": "'$SESSION'"
  }' | jq .

echo -e "\n⏰ Test 3: Set reminder"
curl -s -X POST http://localhost:3000/api/assistant/process \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Remind me to call Sarah at 5pm",
    "sessionId": "'$SESSION'"
  }' | jq .

echo -e "\n📝 Test 4: Create note"
curl -s -X POST http://localhost:3000/api/assistant/process \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Note that the project deadline is next Friday",
    "sessionId": "'$SESSION'"
  }' | jq .

echo -e "\n✅ Tests complete!"