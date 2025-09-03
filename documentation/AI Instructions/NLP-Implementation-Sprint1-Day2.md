# Sprint 1 - Day 2: Slot Extraction & Mobile Integration

## Objective
Implement comprehensive slot extraction and integrate correction UI into mobile app.

## Prerequisites from Day 1
- [x] Intent Service working with 85% accuracy
- [x] API endpoints `/api/intent/classify` and `/api/intent/correction`
- [x] Supabase tables created
- [x] Training data generated

## Step-by-Step Implementation Guide

### Task 2.1: Integrate Slot Extraction Service (45 minutes)

The Slot Extraction Service has been created at:
`packages/backend/src/services/slot-extraction-service.ts`

Key features:
- Chrono-node for temporal extraction
- WinkNLP for entity recognition
- Intent-specific rules
- LLM fallback for ambiguous cases

Update `intent-service.ts` to use the new service:

```typescript
import SlotExtractionService from './slot-extraction-service';

export class IntentService {
  private slotExtractor: SlotExtractionService;
  
  constructor(private llmService: UnifiedLLMService) {
    this.slotExtractor = new SlotExtractionService(llmService);
    // ... rest of constructor
  }
  
  async classifyIntent(text: string): Promise<IntentResult> {
    // ... existing classification logic
    
    // Use new slot extraction service
    const slots = await this.slotExtractor.extractSlots(text, result.intent);
    
    return { ...result, slots };
  }
}
```

### Task 2.2: Add Correction UI to Mobile App (60 minutes)

The Correction UI component has been created at:
`packages/mobile/src/components/CorrectionUI.tsx`

Integrate into ChatScreen:

```typescript
// packages/mobile/src/screens/ChatScreen.tsx
import { CorrectionUI } from '../components/CorrectionUI';

export function ChatScreen() {
  const [showCorrection, setShowCorrection] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<IntentResult | null>(null);
  
  const processCommand = async (text: string) => {
    // Call intent classification API
    const response = await apiService.classifyIntent(text);
    
    if (response.needsConfirmation || response.confidence < 0.85) {
      setPendingIntent(response);
      setShowCorrection(true);
    } else {
      // Execute directly
      await executeIntent(response);
    }
  };
  
  const handleCorrection = async (correctedIntent: string, correctedSlots: any) => {
    // Send correction to backend
    await apiService.sendCorrection({
      originalText: pendingIntent.originalText,
      predictedIntent: pendingIntent.intent,
      correctedIntent,
      predictedSlots: pendingIntent.slots,
      correctedSlots
    });
    
    // Execute with corrected values
    await executeIntent({ ...pendingIntent, intent: correctedIntent, slots: correctedSlots });
    setShowCorrection(false);
  };
  
  // In render:
  {showCorrection && pendingIntent && (
    <CorrectionUI
      originalText={pendingIntent.originalText}
      prediction={pendingIntent}
      onCorrection={handleCorrection}
      onConfirm={() => executeIntent(pendingIntent)}
      onCancel={() => setShowCorrection(false)}
    />
  )}
}
```

### Task 2.3: Update Mobile API Service (30 minutes)

Update `packages/mobile/src/services/api.ts`:

```typescript
export class APIService {
  async classifyIntent(text: string): Promise<IntentResult> {
    const response = await fetch(`${this.baseUrl}/api/intent/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) throw new Error('Classification failed');
    return response.json();
  }
  
  async sendCorrection(correction: UserCorrection): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/intent/correction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(correction)
    });
    
    if (!response.ok) throw new Error('Failed to send correction');
  }
  
  async executeIntent(intent: IntentResult): Promise<any> {
    // Route to appropriate service based on intent
    switch (intent.intent) {
      case 'create_event':
        return this.createCalendarEvent(intent.slots);
      case 'add_reminder':
        return this.createReminder(intent.slots);
      case 'create_note':
        return this.createNote(intent.slots);
      case 'send_email':
        return this.composeEmail(intent.slots);
      case 'read_email':
        return this.fetchEmails(intent.slots);
      default:
        throw new Error(`Unknown intent: ${intent.intent}`);
    }
  }
}
```

### Task 2.4: Implement Calendar Integration (45 minutes)

Create `packages/mobile/src/services/calendar-service.ts`:

```typescript
import * as Calendar from 'expo-calendar';
import { ExtractedSlots } from '@kenny-assistant/backend/services/slot-extraction-service';

export class CalendarService {
  async requestPermissions(): Promise<boolean> {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  }
  
  async createEvent(slots: ExtractedSlots): Promise<string> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission denied');
    }
    
    // Get default calendar
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCalendar = calendars.find(cal => cal.allowsModifications) 
      || await Calendar.getDefaultCalendarAsync();
    
    // Parse datetime
    const startDate = slots.datetime_point 
      ? new Date(slots.datetime_point)
      : new Date();
    
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + (slots.duration_min || 60));
    
    // Create event
    const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
      title: slots.title || 'Untitled Event',
      startDate,
      endDate,
      location: slots.location,
      notes: `Created by AI Assistant`,
      alarms: [{ relativeOffset: -15 }] // 15 min reminder
    });
    
    return eventId;
  }
  
  async createReminder(slots: ExtractedSlots): Promise<string> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Reminders permission denied');
    }
    
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
    const reminderCalendar = calendars[0];
    
    const reminderId = await Calendar.createReminderAsync(reminderCalendar.id, {
      title: slots.title || slots.reminder_text || 'Reminder',
      dueDate: slots.datetime_point ? new Date(slots.datetime_point) : undefined,
      completed: false
    });
    
    return reminderId;
  }
}
```

### Task 2.5: Create Comprehensive Test Suite (45 minutes)

Create `packages/backend/src/__tests__/intent-classification.test.ts`:

```typescript
import { IntentService } from '../services/intent-service';
import { SlotExtractionService } from '../services/slot-extraction-service';
import { UnifiedLLMService } from '../services/unified-llm-service';

describe('Intent Classification', () => {
  let intentService: IntentService;
  
  beforeAll(() => {
    const llmService = new UnifiedLLMService();
    intentService = new IntentService(llmService);
  });
  
  describe('Calendar Events', () => {
    test('should classify meeting scheduling', async () => {
      const result = await intentService.classifyIntent(
        'Schedule a meeting with John tomorrow at 3pm'
      );
      
      expect(result.intent).toBe('create_event');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.slots.title).toContain('meeting');
      expect(result.slots.datetime_point).toBeDefined();
    });
    
    test('should extract duration', async () => {
      const result = await intentService.classifyIntent(
        'Book conference room for 2 hours next Tuesday'
      );
      
      expect(result.slots.duration_min).toBe(120);
    });
  });
  
  describe('Reminders', () => {
    test('should classify reminder creation', async () => {
      const result = await intentService.classifyIntent(
        'Remind me to call mom in 2 hours'
      );
      
      expect(result.intent).toBe('add_reminder');
      expect(result.slots.reminder_text).toBe('call mom');
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle ambiguous requests', async () => {
      const result = await intentService.classifyIntent(
        'meeting reminder for tomorrow'
      );
      
      expect(result.needsConfirmation).toBe(true);
      expect(['create_event', 'add_reminder']).toContain(result.intent);
    });
  });
});
```

Run tests: `npm test`

### Task 2.6: Create Learning Analytics Dashboard (30 minutes)

Create `packages/backend/scripts/learning-analytics.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

async function analyzeLearning() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );
  
  // Get correction statistics
  const { data: corrections } = await supabase
    .from('intent_corrections')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  // Analyze patterns
  const intentAccuracy: Record<string, number> = {};
  const commonMistakes: Array<{from: string, to: string, count: number}> = [];
  
  corrections?.forEach(correction => {
    // Track accuracy by intent
    if (!intentAccuracy[correction.corrected_intent]) {
      intentAccuracy[correction.corrected_intent] = 0;
    }
    intentAccuracy[correction.corrected_intent]++;
    
    // Track common mistakes
    const mistake = `${correction.predicted_intent} → ${correction.corrected_intent}`;
    // ... aggregate mistakes
  });
  
  console.log('\n=== Learning Analytics ===\n');
  console.log('Corrections by Intent:', intentAccuracy);
  console.log('Common Mistakes:', commonMistakes);
  console.log('Total Corrections:', corrections?.length || 0);
}

analyzeLearning().catch(console.error);
```

### Task 2.7: Mobile UI Testing (30 minutes)

Test the correction UI in the mobile app:

```bash
# Start backend
cd packages/backend
npm run dev

# In another terminal, start mobile app
cd packages/mobile
npm start

# Test these scenarios:
# 1. "Schedule meeting tomorrow" - should show correction UI
# 2. "Remind me at 5pm to check email" - high confidence, direct execution
# 3. "Email John about the project" - should extract email slots
```

## Validation Checklist

### Slot Extraction Tests
- [ ] Dates parsed correctly with chrono-node
- [ ] Email addresses extracted from text
- [ ] Duration patterns recognized (lunch = 60 min)
- [ ] Recurring events detected
- [ ] Location extraction working

### Mobile Integration Tests
- [ ] Correction UI appears for low confidence
- [ ] Corrections sent to backend
- [ ] Calendar events created successfully
- [ ] Reminders added to iOS Reminders
- [ ] User feedback improves accuracy

### Learning System Tests
- [ ] Corrections stored in Supabase
- [ ] kNN index updated with corrections
- [ ] Exact matches return high confidence
- [ ] Analytics show improvement over time

## Expected Outcomes

By end of Day 2:

1. **Advanced Slot Extraction** with 90%+ accuracy on dates
2. **Mobile Correction UI** fully integrated
3. **Calendar/Reminder Creation** working on device
4. **Learning System** collecting and applying corrections
5. **Test Coverage** >80% for critical paths

## Common Issues & Solutions

### Issue: WinkNLP not working in React Native
**Solution**: Use chrono-node only on mobile, full extraction on backend

### Issue: Calendar permission denied
**Solution**: Add to app.json: `"ios": { "infoPlist": { "NSCalendarsUsageDescription": "..." } }`

### Issue: Corrections not improving accuracy
**Solution**: Ensure kNN index is being queried before LLM

### Issue: Slot extraction missing fields
**Solution**: Add intent-specific rules or use LLM fallback

## Next Steps (Day 3 Preview)

Tomorrow we will:
1. Implement voice input with real STT
2. Add TF.js model for faster classification
3. Set up embedding generation
4. Create batch learning pipeline

## AI Assistance for Testing

Generate test cases with your LLM:

```javascript
// Generate edge case tests
await llmService.process({
  prompt: `Generate 50 test cases for slot extraction including:
  - Ambiguous dates (next Friday vs this Friday)
  - Multiple attendees with complex names
  - Recurring events with exceptions
  - Email addresses with special characters
  Return as JSON with expected slots.`,
  responseFormat: 'json'
});

// Generate correction scenarios
await llmService.process({
  prompt: `Create 30 scenarios where users would correct the AI:
  - Wrong intent classification
  - Missing or incorrect slots
  - Ambiguous interpretations
  Include original, predicted, and corrected values.`,
  responseFormat: 'json'
});
```

## Success Metrics

- **Slot Extraction Accuracy**: ≥90% for dates, ≥85% for other fields
- **Correction UI Usage**: <15% of interactions need correction
- **Calendar Integration**: 100% success rate with permissions
- **Learning Effectiveness**: 10% accuracy improvement after 50 corrections
- **User Satisfaction**: Smooth correction flow, immediate improvements