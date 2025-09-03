# LLM Service Analysis

## Current Architecture Issues

You have **two separate LLM services** that appear to have overlapping responsibilities:

### 1. LLMService (formerly UnifiedLLMService)
**Location**: `packages/backend/src/services/llm-service.ts`

**Current Usage**:
- Used by IntentClassificationService for intent classification
- Used by TranscriptionService (though currently unused in constructor)
- Used by SlotExtractionService for extracting event details
- Configured to use ONLY Ollama (local models)
- Contains caching logic and health checking
- Has response formatting capabilities (JSON/text)

**Key Methods**:
- `generateCompletion()` - Main method for all LLM operations
- `checkHealth()` - Verifies Ollama is running
- `getProviderStats()` - Returns health status

### 2. LocalLLMService
**Location**: `packages/backend/src/services/llm-service-local.ts`

**Current Usage**:
- Referenced in offline-intent-classification-service.ts
- Also configured to use ONLY Ollama
- Has specialized methods for intent and slot extraction
- Contains similar health checking and caching logic

**Key Methods**:
- `generateCompletion()` - General LLM completion
- `classifyIntent()` - Specialized intent classification
- `extractSlots()` - Specialized slot extraction
- `getStatus()` - Health check

## The Problem

Both services:
1. Use the same underlying Ollama service
2. Have overlapping functionality (generateCompletion, health checks, caching)
3. Have similar initialization logic
4. Both position themselves as "local-only" services

The main differences:
- LocalLLMService has specialized methods for intent/slot operations
- LLMService is more generic but still handles the same use cases

## Recommendation

**Merge into a single service** with clear responsibilities:

### Option A: Single LLMService with Specialized Methods
```typescript
export class LLMService {
  // Core LLM functionality
  async generateCompletion(request: LLMRequest): Promise<LLMResponse> { }
  
  // Specialized domain methods
  async classifyIntent(text: string): Promise<IntentResult> { }
  async extractSlots(text: string, intent: string): Promise<SlotResult> { }
  async generateTranscription(audio: Buffer): Promise<string> { }
  
  // Health and stats
  async checkHealth(): Promise<boolean> { }
  getProviderStats(): ProviderStats[] { }
}
```

### Option B: LLMService with Strategy Pattern
```typescript
export class LLMService {
  async generateCompletion(
    request: LLMRequest,
    strategy?: 'intent' | 'slots' | 'general'
  ): Promise<LLMResponse> { }
}
```

### Option C: Keep Separate but Clarify Roles
- `LLMService` - Infrastructure service for raw LLM operations
- `NLPService` - Domain service for NLP operations (intent, slots, etc.)

## Current Duplicate Code

Both services contain:
- Ollama initialization
- Health checking logic
- Caching mechanisms
- Response formatting
- Error handling patterns

This violates DRY principles and creates maintenance burden.

## Migration Path

1. Audit all usages of both services
2. Consolidate shared functionality into base LLMService
3. Move specialized NLP operations to appropriate domain services
4. Update all consumers to use the unified service
5. Remove the duplicate service

## Decision Needed

Which approach would you prefer:
1. **Single unified LLMService** with all functionality
2. **LLMService + NLPService** separation of concerns
3. **Keep both but refactor** to eliminate duplication

The naming should reflect the chosen architecture.