# Salvaged Patterns from Orphaned Services

## Rule-Based Pattern Matching for Intent Classification

These patterns provide fast, rule-based intent classification that can skip LLM calls for obvious cases:

```typescript
// Fast pattern matching for common intents
private readonly intentPatterns = {
  create_event: /\b(schedule|meeting|appointment|event|calendar)\b/i,
  add_reminder: /\b(remind|reminder|ping|nudge|alert)\b/i,
  create_note: /\b(note|notes|write down|capture|jot|memo)\b/i,
  send_email: /\b(send|email|mail|compose|write to)\b/i,
  read_email: /\b(read|check|show|list|view).*(email|mail|message|inbox)\b/i,
};

// Confidence scoring based on specific keywords
private calculateRuleConfidence(text: string, intent: string): number {
  let confidence = 0.7; // Base confidence for pattern match
  
  if (intent === 'add_reminder' && /\bremind me\b/i.test(text)) {
    confidence = 0.95;
  } else if (intent === 'create_event' && /\b(schedule|meeting)\b/i.test(text)) {
    confidence = 0.9;
  }
  
  return confidence;
}
```

## Hybrid Classification Strategy

Skip LLM calls when rule-based matching has high confidence:

```typescript
async classifyIntent(text: string): Promise<IntentResult> {
  // Try rules first (instant response)
  const ruleResult = this.classifyWithRules(text);
  
  // Skip LLM if we have high confidence
  if (ruleResult && ruleResult.confidence > 0.8) {
    return {
      ...ruleResult,
      source: 'rules',
      responseTime: 0 // Instant
    };
  }
  
  // Fall back to LLM for uncertain cases
  return this.classifyWithLLM(text);
}
```

## Rule-Based Slot Extraction

Quick slot extraction without LLM for common patterns:

```typescript
private extractSlotsWithRules(text: string, intent: string): Record<string, any> {
  const slots: Record<string, any> = {};
  
  // Extract quoted strings as titles
  const quotedMatch = text.match(/["']([^"']+)["']/);
  if (quotedMatch) {
    slots.title = quotedMatch[1];
  }
  
  // Extract email addresses
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    slots.email_to = [emailMatch[0]];
  }
  
  // Intent-specific extraction
  if (intent === 'add_reminder' && !slots.title) {
    const reminderMatch = text.match(/remind (?:me )?(?:to |about )?(.*?)(?:at|on|tomorrow|next|\.|$)/i);
    if (reminderMatch?.[1]) {
      slots.title = reminderMatch[1].trim();
    }
  }
  
  // Default durations based on keywords
  if (intent === 'create_event' && !slots.duration_minutes) {
    if (/\blunch\b/i.test(text)) {
      slots.duration_minutes = 60;
    } else if (/\bmeeting\b/i.test(text)) {
      slots.duration_minutes = 30;
    }
  }
  
  return slots;
}
```

## Optimized LLM Prompts

Minimal, focused prompts for specific tasks:

```typescript
// Intent classification with minimal tokens
const INTENT_CLASSIFICATION_PROMPT = `Task: Classify the user's intent.

Intents: create_event, add_reminder, create_note, read_email, send_email

User text: "{text}"

Respond with ONLY the intent name, nothing else.`;

// Slot extraction with structured output
const SLOT_EXTRACTION_PROMPT = `Extract information from this text for a {intent} action.

Text: "{text}"

Extract these slots if present:
- title/subject
- datetime (ISO-8601 format)
- duration_minutes
- recipients (email addresses)
- body/content

Respond in JSON format with only found slots.`;
```

## Performance Optimization Strategy

```typescript
interface PerformanceMetrics {
  ruleBasedCalls: number;
  llmCalls: number;
  averageResponseTime: number;
  cacheHitRate: number;
}

// Track performance to optimize thresholds
private trackPerformance(source: 'rules' | 'llm' | 'cache', responseTime: number): void {
  this.metrics[source + 'Calls']++;
  this.metrics.totalResponseTime += responseTime;
  this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.getTotalCalls();
  
  // Log if LLM is being called too often
  if (this.metrics.llmCalls / this.getTotalCalls() > 0.5) {
    console.warn('Consider adjusting rule confidence thresholds - too many LLM calls');
  }
}
```

## Implementation Notes

1. **Integration Points**: These patterns can be added to `IntentClassificationService` as optimization methods
2. **Configuration**: Consider making confidence thresholds configurable
3. **Monitoring**: Track rule vs LLM usage to optimize thresholds over time
4. **Testing**: Ensure rule-based patterns are tested against real user inputs
5. **Fallback**: Always have LLM as fallback for patterns not covered by rules