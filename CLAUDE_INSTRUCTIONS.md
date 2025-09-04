# Instructions for Claude - Context Management

## 🧠 The Problem
You (Claude) tend to forget what we're working on between conversations. This leads to repeated explanations and lost context.

## ✅ The Solution
We've created a file-based context management system using markdown files that you can read directly.

## 📚 Context Files to Read

When starting a conversation or feeling lost, **ALWAYS** read these files first:

1. **Current Session Context** 
   ```
   /Users/kenny/repos/personal-assistant/packages/backend/.claude-context/CURRENT_SESSION.md
   ```
   - Current task we're working on
   - Active work items
   - Pending actions
   - Recent decisions
   - Key facts to remember

2. **Project Context**
   ```
   /Users/kenny/repos/personal-assistant/packages/backend/.claude-context/PROJECT_CONTEXT.md
   ```
   - Project overview and architecture
   - Key services and their purposes
   - Important decisions made
   - Current focus areas

3. **Session History**
   ```
   /Users/kenny/repos/personal-assistant/packages/backend/.claude-context/SESSION_HISTORY.md
   ```
   - Timeline of recent work
   - Completed actions
   - Decision history

## 🔄 How to Use This System

### At Start of Conversation
1. Read all three context files
2. Acknowledge what we're currently working on
3. Reference the current task in your response

### During Work
- Update context as we make progress
- Reference file paths when discussing changes
- Keep track of decisions and pending actions

### When Confused
1. Re-read the context files
2. Ask clarifying questions based on the context
3. Update context with new understanding

## 💻 Managing Context via CLI

We can update context using npm scripts:

```bash
# Set current task
npm run context task "Working on X feature"

# Add what we're working on
npm run context working "file-name.ts implementation"

# Record a decision
npm run context decision "Decided to use approach Y"

# Add pending action
npm run context action "Need to test Z"

# Complete an action
npm run context complete "Tested Z"

# Add important fact
npm run context fact "System requires X to work"

# Show current context
npm run context:show

# Clear and start fresh
npm run context:clear
```

## 🎯 Key Benefits
- You can always know what we're working on
- No more repeating context
- Decisions are documented
- Progress is tracked
- Human-readable markdown format

## 🚨 Important Notes
1. **Always check context files when starting**
2. **Update context as we work**
3. **Reference specific file paths**
4. **Use the context service to track progress**
5. **These are local files - they persist between conversations**

## Example Context Check
When you start a conversation, you might say:
```
I see from the context files that we're working on [current task].
The recent decisions include [recent decision].
There are [X] pending actions including [action].
Let me continue from where we left off...
```

## Service Integration
The context system is implemented in:
```
/Users/kenny/repos/personal-assistant/packages/backend/src/services/context-doc-service.ts
```

This service automatically manages the markdown files and provides an API for updating context programmatically.