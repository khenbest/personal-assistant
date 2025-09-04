# Project Context

## Project Overview
Personal Assistant with voice recognition and intent classification using local Ollama models.

## Architecture
- **Backend**: Node.js + TypeScript
- **LLM**: Local Ollama (qwen2.5:1.5b, llama3.2:3b)
- **Mobile**: React Native
- **Database**: Supabase (PostgreSQL)

## Key Services
- **llm-service.ts**: Ollama integration for all LLM operations
- **intent-classification-service.ts**: Intent detection and slot extraction
- **context-doc-service.ts**: File-based context management for Claude
- **voice-service.ts**: Voice recognition integration
- **calendar-service.ts**: Calendar event management
- **reminder-service.ts**: Reminder creation and management
- **note-service.ts**: Note taking functionality

## Current Focus Areas
- Improving Claude's context retention
- Optimizing intent classification accuracy
- Reducing response latency

## Important Decisions
- Using local Ollama instead of cloud providers
- File-based context instead of database storage
- Simple, offline-first approach

## Known Issues
- Claude forgetting context between interactions
- Need better conversation history management

---
*Last Updated: 2025-09-04T03:54:01.676Z*
