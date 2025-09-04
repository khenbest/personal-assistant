# Claude Context Directory

This directory contains context files that help Claude maintain awareness of:
- What we're currently working on
- Recent decisions and changes
- Project structure and architecture
- Pending tasks and actions

## Files

- **CURRENT_SESSION.md** - Active session context (current task, working items, pending actions)
- **PROJECT_CONTEXT.md** - Project overview, architecture, and key information
- **SESSION_HISTORY.md** - Recent decisions and completed actions
- **history_*.md** - Archived session histories

## Usage

### For Claude
When starting a conversation or losing context, Claude should read these files:
1. Read `CURRENT_SESSION.md` to understand what's happening now
2. Read `PROJECT_CONTEXT.md` for project understanding
3. Check `SESSION_HISTORY.md` for recent work

### For Developers
The context is automatically managed by the `context-doc-service.ts`:
- Context updates automatically as you work
- Files are human-readable markdown
- No database required - just files

### API Integration
```typescript
import { contextDocService } from './services/context-doc-service';

// Set current task
contextDocService.setCurrentTask('Implementing context management for Claude');

// Add what we're working on
contextDocService.addWorkingOn('context-doc-service.ts implementation');

// Record decisions
contextDocService.addDecision('Use file-based context instead of database');

// Add pending actions
contextDocService.addPendingAction('Test context retention with Claude');

// Add important facts
contextDocService.addKeyFact('Claude needs explicit file paths to maintain context');
```

## Benefits
- ✅ Simple file-based approach
- ✅ Claude can read files directly
- ✅ Human-readable markdown format
- ✅ No database complexity
- ✅ Version control friendly
- ✅ Easy to inspect and modify

## Context Retention Tips for Claude
1. Start conversations by reading context files
2. Update context as you work
3. Reference file paths in responses
4. Use the context service API to track progress