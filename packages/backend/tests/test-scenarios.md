# 🧪 Personal Assistant Backend Test Scenarios

## 📋 Test Categories

### 1. Calendar Management Tests

#### Basic Scheduling
```bash
# Test 1: Schedule a simple meeting
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Schedule a meeting with John tomorrow at 2pm"
  }'

# Expected Response:
# {
#   "intent": "create_event",
#   "confidence": 0.9+,
#   "slots": {
#     "event_type": "meeting",
#     "attendee": "John",
#     "time": "tomorrow at 2pm"
#   }
# }
```

#### Complex Scheduling
```bash
# Test 2: Multi-participant meeting with duration
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Set up a 2 hour product review with the design team next Monday at 10am"
  }'

# Test 3: Recurring event
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Add a weekly standup every Tuesday at 9:30am"
  }'
```

#### Time Modifications
```bash
# Test 4: Reschedule event
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Move my 3pm meeting to 4:30pm"
  }'

# Test 5: Cancel event
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Cancel my lunch with Sarah tomorrow"
  }'
```

### 2. Query and Information Retrieval

#### Calendar Queries
```bash
# Test 6: Check availability
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What do I have scheduled for tomorrow?"
  }'

# Test 7: Specific time query
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Am I free at 2pm on Friday?"
  }'

# Test 8: Next event query
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "When is my next meeting?"
  }'
```

### 3. Task Management

#### Create Tasks
```bash
# Test 9: Simple reminder
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Remind me to call the dentist tomorrow"
  }'

# Test 10: Deadline-based task
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I need to submit the report by end of day Friday"
  }'
```

### 4. Edge Cases and Error Handling

#### Ambiguous Inputs
```bash
# Test 11: Vague time reference
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Schedule a meeting later"
  }'

# Test 12: Multiple intents
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Cancel my 2pm and schedule a new one at 3pm with Mike"
  }'
```

#### Natural Language Variations
```bash
# Test 13: Informal speech
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Can you pencil in coffee with Amy next week sometime?"
  }'

# Test 14: Contextual references
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Push that back an hour"
  }'
```

### 5. Time Parsing Tests

#### Relative Times
```bash
# Test 15: Various relative times
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Book a call in 30 minutes"
  }'

# Test 16: Day references
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Schedule lunch this Thursday"
  }'
```

### 6. System Health Checks

#### API Health
```bash
# Test 17: Health endpoint
curl http://localhost:3000/health

# Test 18: Ollama connectivity
curl http://localhost:3000/api/llm/health
```

## 🔄 Automated Test Script

Create `run-tests.sh`:
```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🧪 Running Personal Assistant Backend Tests"
echo "==========================================="

# Check if server is running
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${RED}❌ Backend server is not running!${NC}"
    echo "Start it with: cd packages/backend && npm start"
    exit 1
fi

echo -e "${GREEN}✅ Backend server is running${NC}"

# Test counter
PASSED=0
FAILED=0

# Function to test intent classification
test_intent() {
    local description=$1
    local input=$2
    local expected_intent=$3
    
    echo -n "Testing: $description... "
    
    response=$(curl -s -X POST http://localhost:3000/api/classify-intent \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$input\"}")
    
    if echo "$response" | grep -q "\"intent\":\"$expected_intent\""; then
        echo -e "${GREEN}✅${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC}"
        echo "  Expected: $expected_intent"
        echo "  Got: $response"
        ((FAILED++))
    fi
}

# Run tests
test_intent "Simple meeting" "Schedule a meeting tomorrow at 2pm" "create_event"
test_intent "Cancel event" "Cancel my lunch tomorrow" "cancel_event"
test_intent "Query calendar" "What's on my schedule today?" "query_events"
test_intent "Create reminder" "Remind me to call mom" "create_reminder"

echo "==========================================="
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
```

## 📊 Performance Benchmarks

### Response Time Targets
- Intent Classification: < 500ms
- Simple queries: < 200ms
- Complex scheduling: < 1000ms

### Load Testing
```bash
# Simple load test (10 concurrent requests)
for i in {1..10}; do
    curl -X POST http://localhost:3000/api/classify-intent \
        -H "Content-Type: application/json" \
        -d '{"text": "Schedule a meeting tomorrow"}' &
done
wait
```

## 🐛 Debug Mode Testing

Enable verbose logging:
```bash
# Set debug environment variable
export DEBUG=true
npm start

# Test with debug output
curl -X POST http://localhost:3000/api/classify-intent \
  -H "Content-Type: application/json" \
  -d '{"text": "Complex scheduling request with multiple participants"}' \
  -v
```

## 📝 Notes

1. **Ollama Model**: Ensure `qwen2.5:1.5b` is running
2. **Port Conflicts**: Backend should be on port 3000
3. **CORS**: Mobile app needs proper CORS headers
4. **Timeout**: Long Ollama responses may need timeout adjustments