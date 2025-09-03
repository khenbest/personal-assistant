# Sprint 1 - Day 1: Core Intent Service Implementation

## Objective
Implement LLM-based intent classification system achieving 85% accuracy on Day 1.

## Prerequisites Checklist
- [ ] UnifiedLLMService is working (confirmed in Progress-8-30.md)
- [ ] Supabase connection is active
- [ ] Backend server can be started on port 3000
- [ ] Generated artifacts are in place (intent_training_enhanced.csv, intents_registry.json)

## Step-by-Step Implementation Guide

### Task 1.1: Install Dependencies (15 minutes)
```bash
# Navigate to backend
cd packages/backend

# Install NLP dependencies
npm install chrono-node wink-nlp wink-eng-lite-web-model
npm install @types/chrono-node --save-dev

# Navigate to mobile
cd ../mobile

# Install chrono for React Native
npm install chrono-node
```

### Task 1.2: Set Up Intent Service (30 minutes)

The Intent Service has already been created at:
`packages/backend/src/services/intent-service.ts`

Verify it exists and review the implementation. Key features:
- LLM-based classification with 85% immediate accuracy
- kNN lookup for exact correction matches
- Chrono-node for date extraction
- Learning capability with Supabase storage

### Task 1.3: Create Intent API Routes (30 minutes)

Create new file: `packages/backend/src/routes/intent.ts`

```typescript
import { FastifyInstance } from 'fastify';
import IntentService from '../services/intent-service';
import { UnifiedLLMService } from '../services/unified-llm-service';

export default async function intentRoutes(fastify: FastifyInstance) {
  const llmService = new UnifiedLLMService();
  const intentService = new IntentService(llmService);

  // Classification endpoint
  fastify.post('/api/intent/classify', async (request, reply) => {
    const { text } = request.body;
    const result = await intentService.classifyIntent(text);
    return { success: true, ...result };
  });

  // Correction endpoint
  fastify.post('/api/intent/correction', async (request, reply) => {
    const correction = request.body;
    await intentService.learnFromCorrection(correction);
    return { success: true, message: 'Correction recorded' };
  });
}
```

### Task 1.4: Register Routes in Server (15 minutes)

Edit `packages/backend/src/server.ts` and add:

```typescript
import intentRoutes from './routes/intent';

// After other route registrations
await server.register(intentRoutes);
```

### Task 1.5: Create Supabase Tables (20 minutes)

Run these SQL commands in Supabase SQL editor:

```sql
-- Intent predictions table
CREATE TABLE IF NOT EXISTS intent_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_text TEXT NOT NULL,
  predicted_intent TEXT,
  predicted_confidence FLOAT,
  predicted_slots JSONB,
  model_version TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Intent corrections table  
CREATE TABLE IF NOT EXISTS intent_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  original_text TEXT NOT NULL,
  predicted_intent TEXT,
  predicted_confidence FLOAT,
  predicted_slots JSONB,
  corrected_intent TEXT NOT NULL,
  corrected_slots JSONB,
  correction_type TEXT,
  model_version TEXT,
  applied_immediately BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_corrections_intent ON intent_corrections(corrected_intent);
CREATE INDEX idx_corrections_text ON intent_corrections(original_text);
```

### Task 1.6: Generate Training Data with LLM (45 minutes)

Create `packages/backend/scripts/generate-training-data.ts`:

```typescript
import { UnifiedLLMService } from '../src/services/unified-llm-service';
import fs from 'fs';
import path from 'path';

async function generateTrainingData() {
  const llmService = new UnifiedLLMService();
  const intents = ['create_event', 'add_reminder', 'create_note', 'read_email', 'send_email'];
  const trainingData: string[] = ['text,intent'];
  
  for (const intent of intents) {
    console.log(`Generating examples for ${intent}...`);
    
    const prompt = `Generate 100 diverse user commands for "${intent}".
    Include: casual/formal, short/long, edge cases, misspellings.
    Return as JSON array of strings.`;
    
    const response = await llmService.process({
      prompt,
      responseFormat: 'json',
      maxTokens: 3000,
      complexity: 'medium'
    });
    
    const examples = JSON.parse(response.content);
    examples.forEach((text: string) => {
      trainingData.push(`"${text}",${intent}`);
    });
  }
  
  fs.writeFileSync(
    path.join(__dirname, '../../data/intent_training_enhanced_llm.csv'),
    trainingData.join('\n')
  );
  
  console.log(`Generated ${trainingData.length - 1} examples`);
}

generateTrainingData().catch(console.error);
```

Run: `npx tsx scripts/generate-training-data.ts`

### Task 1.7: Test Intent Classification (30 minutes)

Create `packages/backend/scripts/test-intent.ts`:

```typescript
import IntentService from '../src/services/intent-service';
import { UnifiedLLMService } from '../src/services/unified-llm-service';

async function testIntentClassification() {
  const llmService = new UnifiedLLMService();
  const intentService = new IntentService(llmService);
  
  const testCases = [
    "Schedule a meeting with John tomorrow at 3pm",
    "Remind me to call mom in 2 hours",
    "Make a note about the new product idea",
    "Check my emails from Alice",
    "Send an email to the team about the launch"
  ];
  
  console.log('\n=== Intent Classification Test ===\n');
  
  for (const text of testCases) {
    const result = await intentService.classifyIntent(text);
    console.log(`Input: "${text}"`);
    console.log(`Intent: ${result.intent} (${(result.confidence * 100).toFixed(1)}%)`);
    console.log(`Slots:`, result.slots);
    console.log('---');
  }
}

testIntentClassification().catch(console.error);
```

Run: `npx tsx scripts/test-intent.ts`

### Task 1.8: Integrate with CLI (30 minutes)

Update `packages/cli/src/commands/process.ts`:

```typescript
// Add intent classification before sending to LLM
const response = await fetch(`${apiUrl}/api/intent/classify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: command })
});

const { intent, slots, confidence } = await response.json();

console.log(`Intent: ${intent} (${(confidence * 100).toFixed(1)}% confidence)`);
console.log('Extracted slots:', slots);

// Continue with existing command processing...
```

## Validation Checklist

### Functional Tests
- [ ] `/api/intent/classify` endpoint returns intent with >85% confidence
- [ ] Chrono-node correctly extracts dates from natural language
- [ ] Slot extraction identifies email addresses, durations, titles
- [ ] Corrections are stored in Supabase
- [ ] kNN lookup finds exact correction matches

### Performance Tests  
- [ ] Classification completes in <500ms
- [ ] LLM fallback activates when confidence <0.65
- [ ] Caching reduces repeat query time to <100ms

### Integration Tests
- [ ] CLI can classify intents before processing
- [ ] Intent results improve command execution
- [ ] Error handling works for malformed requests

## Expected Outcomes

By end of Day 1, you should have:

1. **Working Intent API** at `http://localhost:3000/api/intent/classify`
2. **85% accuracy** on the 5 core intents using LLM
3. **500+ training examples** generated by LLM
4. **Supabase tables** ready for learning storage
5. **Test results** showing successful classification

## Common Issues & Solutions

### Issue: Chrono-node not parsing dates
**Solution**: Ensure `forwardDate: true` option is set

### Issue: LLM timeout on classification  
**Solution**: Reduce complexity to 'low', limit maxTokens to 200

### Issue: Supabase connection fails
**Solution**: Check SUPABASE_URL and SUPABASE_KEY in .env

### Issue: Low confidence scores
**Solution**: Improve system prompt, add more examples to prompt

## Next Steps (Day 2 Preview)

Tomorrow we will:
1. Implement advanced slot extraction with winkNLP
2. Add correction UI to mobile app
3. Set up learning feedback loop
4. Create comprehensive test suite

## AI Assistance Commands

Use these prompts with your UnifiedLLMService to accelerate development:

```javascript
// Generate more training examples
await llmService.process({
  prompt: "Generate 50 ambiguous commands that could be either create_event or add_reminder",
  responseFormat: 'json'
});

// Generate slot extraction test cases
await llmService.process({
  prompt: "Create 20 complex calendar event requests with multiple slots",
  responseFormat: 'json'
});

// Generate edge cases
await llmService.process({
  prompt: "Generate 30 edge case commands that might confuse the intent classifier",
  responseFormat: 'json'
});
```

## Success Metrics

- **Intent Accuracy**: ≥85% on test set
- **Response Time**: <500ms average
- **Slot Extraction**: ≥80% accuracy
- **Learning Ready**: Corrections table functional
- **Integration**: CLI using intent classification