# Voice Assistant Test Scenarios

## Quick Test Commands

### Basic Functionality
```bash
# Calendar
"Schedule a meeting tomorrow at 3pm"
"What's on my calendar today?"

# Reminders  
"Remind me to call mom in 2 hours"
"Show my reminders"

# Notes
"Take a note: wifi password is abc123"
"Show my recent notes"
```

### iOS Native Actions
```bash
# Apps
"Open Settings"
"Take a photo"
"Turn on flashlight"
```

## Testing Flow

1. Start Backend: `npm run dev`
2. Run Tests: `./test-assistant.sh`
3. Start Mobile: `./fast-dev.sh`

## Performance Targets
- Voice recognition: <1s
- Intent classification: <200ms
- Action execution: <500ms
- Total response: <2s
