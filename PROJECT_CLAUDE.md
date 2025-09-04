# 🚨 CLAUDE START HERE - CONTEXT SYSTEM ACTIVE

## 🔴 CRITICAL: READ PARADIGMS FIRST!
```bash
# STEP 1: Read workflow instructions (NO EXCEPTIONS)
cat /Users/kenny/repos/personal-assistant/documentation/paradigms/prompt.md

# STEP 2: Reality check paradigm
cat /Users/kenny/repos/personal-assistant/documentation/paradigms/RealityCheck.md

# STEP 3: Naming conventions
cat /Users/kenny/repos/personal-assistant/documentation/paradigms/NAMING-CONVENTIONS.md
```

**OR JUST GO TO: `.claude/START_HERE.md` for complete startup sequence**

## ⚡ Quick Context Check (RUN AFTER PARADIGMS!)
```bash
cd packages/backend && npm run context:show
```

## 📍 Essential Context Files
You MUST read these files to understand what we're working on:

### 1. Current Work Session
```bash
cat /Users/kenny/repos/personal-assistant/packages/backend/.claude-context/CURRENT_SESSION.md
```
Shows: Current task, working items, pending actions, decisions

### 2. Project Overview
```bash
cat /Users/kenny/repos/personal-assistant/packages/backend/.claude-context/PROJECT_CONTEXT.md
```
Shows: Architecture, services, key decisions, focus areas

### 3. Recent History
```bash
cat /Users/kenny/repos/personal-assistant/packages/backend/.claude-context/SESSION_HISTORY.md
```
Shows: Timeline of work, completed actions, decision log

## 🎯 Context Management Commands

```bash
# View all context
npm run context:show

# Set what we're working on
npm run context task "Description of current task"

# Track work in progress
npm run context working "file or feature being worked on"

# Record decisions
npm run context decision "What was decided and why"

# Add action items
npm run context action "What needs to be done"

# Complete actions
npm run context complete "What was finished"

# Remember important facts
npm run context fact "Key information to retain"
```

## 🔴 Warning Signs You Need Context
- User mentions "we were working on..."
- User references previous discussion
- You feel confused about the task
- You're about to ask what to work on
- User seems frustrated about repetition

## 📂 Project Structure Reminders
- **Backend**: `/packages/backend/` - Node.js + TypeScript API
- **Mobile**: `/packages/mobile/` - React Native app
- **Context**: `/packages/backend/.claude-context/` - Your memory system
- **Claude Docs**: `/.claude/` - Instructions for you

## 🧠 Why This Exists
You (Claude) forget context between conversations. This system:
- Persists what we're working on
- Tracks decisions and progress
- Maintains project understanding
- Prevents repeated explanations

## 📝 Example: Starting a Conversation

```markdown
Let me check our current context...
[Read context files]

Based on the context:
- We're working on: [current task from CURRENT_SESSION.md]
- Recent decisions: [from SESSION_HISTORY.md]
- Pending actions: [from CURRENT_SESSION.md]

I'll continue with...
```

## 🔗 Key Documentation
- **Main Claude Instructions**: `.claude/CLAUDE.md`
- **Context System Docs**: `.claude-context/README.md`
- **Project README**: `README.md` (has context reminder)
- **This File**: `PROJECT_CLAUDE.md` (start here!)

---

## ⚠️ CRITICAL REMINDER
**ALWAYS CHECK CONTEXT BEFORE STARTING WORK!**

The context system is implemented in:
`packages/backend/src/services/context-doc-service.ts`

It uses simple markdown files that persist between your conversations. Read them, use them, update them!