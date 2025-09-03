# Naming Conventions - Personal Assistant Codebase

## Overview

This document establishes naming conventions for the Personal Assistant codebase to ensure clarity, consistency, and maintainability. Names should be self-descriptive, follow established patterns, and clearly communicate purpose without redundancy.

## Core Principles

### 1. Descriptive Over Generic
- ❌ `Service`, `Manager`, `Handler` (too generic)
- ✅ `IntentClassificationService`, `CalendarEventManager`, `VoiceCommandHandler`

### 2. Purpose Over Implementation
- ❌ `LocalService`, `RemoteService` (implementation detail)
- ✅ `OfflineIntentClassificationService`, `CloudStorageService` (purpose + context)

### 3. No Redundant Prefixes
- ❌ `UnifiedLLMService`, `SimpleCacheService`, `BaseService`
- ✅ `LLMService`, `CacheService`, `AbstractService` (if truly abstract)

### 4. Pattern Consistency
Services that perform similar roles should follow similar naming patterns:
- Intent classification: `IntentClassificationService`, `OfflineIntentClassificationService`
- Logging services: `IntentClassificationLoggerService`, `PerformanceLoggerService`

## Service Naming Patterns

### Core Services
Pattern: `[Domain][Purpose]Service`

Examples:
- `LLMService` - Language model operations
- `CalendarService` - Calendar management
- `VoiceService` - Voice command processing
- `TranscriptionService` - Audio to text conversion

### Specialized Services
Pattern: `[Qualifier][Domain][Purpose]Service`

Examples:
- `OfflineIntentClassificationService` - Offline-capable intent classification
- `IntentClassificationLoggerService` - Logging for intent classification

### Infrastructure Services
Pattern: `[Implementation][Purpose]Service`

Examples:
- `InMemoryDatabaseService` - In-memory database implementation
- `OllamaLLMService` - Ollama-specific LLM implementation (when needed)

## Registry and Container Patterns

### Service Registries
Pattern: `[Scope]ServiceRegistry`

Examples:
- `SingletonServiceRegistry` - Registry for singleton services
- `RequestScopedServiceRegistry` - Registry for request-scoped services

**NOT**:
- ~~`ServiceFactory`~~ - This is a Service Locator, not a Factory
- ~~`ServiceManager`~~ - Too generic

### Factories
Pattern: `[Product]Factory`

Factories create new instances. If it manages singletons, it's a Registry or Container.

Examples:
- `EventFactory` - Creates event objects
- `RequestFactory` - Creates request objects

## Domain Model Naming

### Entities and Models
Pattern: `[Domain][Entity]`

Examples:
- `CalendarEvent`
- `UserIntent`
- `VoiceCommand`
- `ClassificationResult`

### Data Transfer Objects
Pattern: `[Domain][Purpose]DTO` or `[Domain][Purpose]Request/Response`

Examples:
- `IntentClassificationRequest`
- `CalendarEventResponse`
- `VoiceCommandDTO`

## Interface Naming

### Service Interfaces
Pattern: `I[ServiceName]` or just `[ServiceName]` (if the interface is the contract)

Examples:
- `ILLMService` or `LLMService` (interface)
- `OllamaLLMService` (implementation)

### Capability Interfaces
Pattern: `[Capability]able`

Examples:
- `Cacheable`
- `Retryable`
- `Loggable`

## Method Naming

### Action Methods
Pattern: `[verb][Object]`

Examples:
- `classifyIntent()` - Performs intent classification
- `createCalendarEvent()` - Creates a calendar event
- `processVoiceCommand()` - Processes a voice command

### Query Methods
Pattern: `get[Property]` or `find[Criteria]`

Examples:
- `getIntentConfidence()`
- `findEventsByDate()`
- `getUserPreferences()`

### Boolean Methods
Pattern: `is[State]` or `has[Property]` or `can[Action]`

Examples:
- `isHealthy()`
- `hasActiveSession()`
- `canProcessOffline()`

## File Naming

### Service Files
Pattern: `[service-name].ts`

Examples:
- `llm-service.ts`
- `intent-classification-service.ts`
- `voice-service.ts`

### Test Files
Pattern: `[file-name].test.ts` or `[file-name].spec.ts`

Examples:
- `llm-service.test.ts`
- `intent-classification.spec.ts`

## Common Anti-Patterns to Avoid

### 1. Redundant Type Suffixes
- ❌ `ServiceService`, `ManagerManager`
- ✅ Use one descriptive suffix

### 2. Implementation Leakage
- ❌ `PostgresUserService`, `RedisCache`
- ✅ `UserService`, `CacheService` (implementation in config/DI)

### 3. Ambiguous Abbreviations
- ❌ `IntSvc`, `CalMgr`, `VoiceProc`
- ✅ Use full, clear names

### 4. Mock/Test in Production Code
- ❌ `MockDatabaseService` in production
- ✅ `InMemoryDatabaseService` or `LocalDatabaseService`

### 5. Unclear Modifiers
- ❌ `UnifiedService`, `SimpleManager`, `BasicHandler`
- ✅ Be specific about what makes it unified/simple/basic

## Migration Guidelines

When renaming existing code:

1. **Assess Impact**: Check all references and imports
2. **Maintain Compatibility**: Consider aliases during transition
3. **Update Documentation**: Keep docs in sync with code
4. **Batch Related Changes**: Group similar renamings together
5. **Test Thoroughly**: Ensure no runtime breaks

## Decision Framework

When naming a new service or component, ask:

1. **What does it do?** (Primary responsibility)
2. **What domain does it belong to?** (Business context)
3. **What makes it unique?** (Distinguishing characteristics)
4. **Does it follow existing patterns?** (Consistency check)
5. **Is the name self-explanatory?** (Clarity test)

## Examples of Good Naming

### Before → After
- `UnifiedLLMService` → `LLMService`
- `MockDatabaseService` → `InMemoryDatabaseService`
- `ServiceFactory` → `SingletonServiceRegistry`
- `IntentService` → `IntentClassificationService`
- `LocalIntentService` → `OfflineIntentClassificationService`
- `ClassificationLogger` → `IntentClassificationLoggerService`
- `VoiceProcessor` → `VoiceService`

Each rename improves clarity by:
- Removing redundant prefixes
- Being specific about purpose
- Following consistent patterns
- Using correct design pattern names

## Enforcement

1. **Code Reviews**: Check naming during PR reviews
2. **Linting Rules**: Configure ESLint for naming conventions
3. **Documentation**: Keep this guide updated
4. **Team Agreement**: Discuss and agree on new patterns

## Conclusion

Good naming is about communication. A well-named service, method, or variable should tell its story without needing comments. When in doubt, err on the side of being descriptive rather than clever or abbreviated.