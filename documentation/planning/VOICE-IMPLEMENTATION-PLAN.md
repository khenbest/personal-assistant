# Voice Implementation Plan - Local-Only Assistant

## Core Architecture Principle
**100% LOCAL** - No cloud dependencies, everything runs on-device or on local server

## Technology Stack (Corrected)

### Voice Pipeline
1. **Speech-to-Text**: WhisperKit (on-device iOS)
   - Real-time streaming transcription
   - 0.46s latency, 2.2% WER
   - NO audio recording needed - direct stream processing
   
2. **Intent Classification**: Ollama (Qwen2.5:1.5b)
   - Local-only, no internet required
   - <100ms classification time
   - Cached for common phrases
   
3. **Text-to-Speech**: AVSpeechSynthesizer
   - iOS native, 60+ voices
   - Zero latency, offline capable

## Phase 1: Mobile Voice Input (Day 1)
**Goal**: Get voice working end-to-end with WhisperKit

### 1.1 Setup WhisperKit Integration
```typescript
// packages/mobile/src/services/whisper-service.ts
import WhisperKit from '@whisperkit/react-native';

export class WhisperService {
  private whisper: WhisperKit;
  private isListening = false;
  
  async initialize() {
    // Load WhisperKit model (base.en ~39MB)
    this.whisper = await WhisperKit.load({
      model: 'base.en',
      computeUnits: 'cpuAndNeuralEngine',
      enableTimestamps: false
    });
  }
  
  startListening(onTranscription: (text: string) => void) {
    this.isListening = true;
    this.whisper.startRealtimeTranscription({
      onPartialResult: (partial) => {
        // Real-time streaming results
        onTranscription(partial.text);
      },
      onFinalResult: (final) => {
        // Complete utterance
        onTranscription(final.text);
      }
    });
  }
  
  stopListening() {
    this.isListening = false;
    this.whisper.stopTranscription();
  }
}
```

### 1.2 Create Voice Input Component
```typescript
// packages/mobile/src/components/VoiceInput.tsx
import { WhisperService } from '../services/whisper-service';
import { useState, useEffect } from 'react';

export function VoiceInput({ onTranscription }) {
  const [whisperService] = useState(() => new WhisperService());
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  useEffect(() => {
    whisperService.initialize();
  }, []);
  
  const toggleListening = () => {
    if (isListening) {
      whisperService.stopListening();
      // Send final transcript to backend
      if (transcript) {
        onTranscription(transcript);
      }
    } else {
      whisperService.startListening((text) => {
        setTranscript(text);
      });
    }
    setIsListening(!isListening);
  };
  
  return (
    <TouchableOpacity onPress={toggleListening}>
      <Text>{isListening ? '🔴 Listening...' : '🎤 Tap to speak'}</Text>
      {transcript && <Text>{transcript}</Text>}
    </TouchableOpacity>
  );
}
```

### 1.3 Connect to Backend
```typescript
// packages/mobile/src/screens/HomeScreen.tsx
export function HomeScreen() {
  const handleTranscription = async (text: string) => {
    // Send to local backend for intent classification
    const response = await fetch('http://localhost:3001/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    const result = await response.json();
    console.log('Intent:', result.intent);
    console.log('Response:', result.response);
  };
  
  return (
    <View>
      <VoiceInput onTranscription={handleTranscription} />
    </View>
  );
}
```

## Phase 2: Complete Pipeline (Day 2)
**Goal**: Full voice in → intent → action → voice out flow

### 2.1 Backend Processing (Already Done)
```typescript
// packages/backend/src/routes/process.ts
import { unifiedLLMService } from '../services/unified-llm-service';

export async function processVoiceInput(text: string) {
  // 1. Classify intent using Ollama
  const intent = await classifyIntent(text);
  
  // 2. Execute action based on intent
  const response = await executeAction(intent);
  
  // 3. Return response for TTS
  return {
    intent: intent.name,
    response: response.text,
    speak: response.shouldSpeak
  };
}
```

### 2.2 Add Text-to-Speech
```typescript
// packages/mobile/src/services/tts-service.ts
import * as Speech from 'expo-speech';

export class TTSService {
  async speak(text: string, options = {}) {
    return Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 1.0,
      ...options
    });
  }
  
  stop() {
    Speech.stop();
  }
}
```

### 2.3 Complete Voice Loop
```typescript
// packages/mobile/src/screens/HomeScreen.tsx
export function HomeScreen() {
  const [tts] = useState(() => new TTSService());
  
  const handleTranscription = async (text: string) => {
    const response = await fetch('http://localhost:3001/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    const result = await response.json();
    
    // Speak the response
    if (result.speak) {
      await tts.speak(result.response);
    }
  };
  
  return (
    <View>
      <VoiceInput onTranscription={handleTranscription} />
    </View>
  );
}
```

## Phase 3: First Real Feature - Calendar (Days 3-5)
**Goal**: Voice-controlled calendar management

### 3.1 iOS Calendar Permissions
```typescript
// packages/mobile/src/services/calendar-service.ts
import * as Calendar from 'expo-calendar';

export class CalendarService {
  async requestPermissions() {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  }
  
  async getCalendars() {
    const calendars = await Calendar.getCalendarsAsync();
    return calendars;
  }
  
  async createEvent(details: EventDetails) {
    const defaultCalendar = await this.getDefaultCalendar();
    
    return Calendar.createEventAsync(defaultCalendar.id, {
      title: details.title,
      startDate: details.startDate,
      endDate: details.endDate,
      location: details.location,
      notes: details.notes
    });
  }
  
  async getEvents(startDate: Date, endDate: Date) {
    const calendars = await this.getCalendars();
    const calendarIds = calendars.map(c => c.id);
    
    return Calendar.getEventsAsync(
      calendarIds,
      startDate,
      endDate
    );
  }
}
```

### 3.2 Calendar Intent Handlers
```typescript
// packages/backend/src/services/calendar-actions.ts
export class CalendarActions {
  async handleScheduleIntent(intent: ScheduleIntent) {
    // Parse the intent slots
    const { date, time, duration, title } = intent.slots;
    
    // Create calendar event
    const event = {
      title: title || 'Meeting',
      startDate: parseDateTime(date, time),
      duration: duration || 60,
      endDate: calculateEndDate(date, time, duration)
    };
    
    return {
      action: 'CREATE_EVENT',
      data: event,
      response: `I've scheduled "${event.title}" for ${formatDateTime(event.startDate)}`
    };
  }
  
  async handleQueryIntent(intent: QueryIntent) {
    const { date, timeRange } = intent.slots;
    
    return {
      action: 'GET_EVENTS',
      data: { date, timeRange },
      response: 'Let me check your calendar...'
    };
  }
}
```

### 3.3 Mobile Calendar Integration
```typescript
// packages/mobile/src/hooks/useCalendarIntegration.ts
export function useCalendarIntegration() {
  const calendarService = new CalendarService();
  
  const handleCalendarAction = async (action: any) => {
    switch (action.action) {
      case 'CREATE_EVENT':
        await calendarService.createEvent(action.data);
        break;
        
      case 'GET_EVENTS':
        const events = await calendarService.getEvents(
          action.data.startDate,
          action.data.endDate
        );
        return formatEventsForSpeech(events);
        
      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  };
  
  return { handleCalendarAction };
}
```

## Testing Plan

### Phase 1 Tests
- [ ] WhisperKit loads and initializes
- [ ] Voice input captures audio and transcribes
- [ ] Transcription sent to backend
- [ ] Backend responds with intent

### Phase 2 Tests
- [ ] Complete voice loop works
- [ ] TTS speaks responses
- [ ] Multiple intents handled correctly
- [ ] Error handling for failed transcriptions

### Phase 3 Tests
- [ ] Calendar permissions granted
- [ ] Events created via voice
- [ ] Calendar queries work
- [ ] Natural language date/time parsing

## Implementation Checklist

### Day 1: Voice Input
- [ ] Install WhisperKit dependencies
- [ ] Create WhisperService
- [ ] Build VoiceInput component
- [ ] Test transcription accuracy
- [ ] Connect to backend

### Day 2: Complete Pipeline
- [ ] Add TTS service
- [ ] Implement response speaking
- [ ] Test full voice loop
- [ ] Handle edge cases

### Days 3-5: Calendar Feature
- [ ] Setup expo-calendar
- [ ] Request permissions
- [ ] Create calendar service
- [ ] Implement intent handlers
- [ ] Test voice commands

## Success Metrics
- Voice recognition accuracy: >95%
- Intent classification accuracy: >90%
- Response time: <1 second end-to-end
- All processing local: 0ms network latency
- Works offline: 100% functionality

## Dependencies to Install

### Mobile (React Native)
```bash
npm install @whisperkit/react-native
npm install expo-speech
npm install expo-calendar
```

### Backend
```bash
# Already installed - using Ollama
```

## Next Steps After MVP
1. Add more calendar intents (reschedule, cancel, recurring)
2. Implement email integration
3. Add task management
4. Create shortcuts/quick actions
5. Implement conversation memory