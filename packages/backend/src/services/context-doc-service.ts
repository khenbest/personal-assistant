/**
 * Context Documentation Service
 * Uses markdown files to maintain context for Claude
 * Simple, file-based approach that Claude can read directly
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SessionContext {
  sessionId: string;
  startTime: Date;
  currentTask?: string;
  workingOn: string[];
  decisions: string[];
  pendingActions: string[];
  keyFacts: string[];
  lastUpdated: Date;
}

export class ContextDocService {
  private readonly contextDir: string;
  private readonly currentContextFile: string;
  private readonly sessionHistoryFile: string;
  private readonly projectContextFile: string;
  private sessionContext: SessionContext;

  constructor() {
    // Create context directory in project root
    this.contextDir = path.join(process.cwd(), '.claude-context');
    this.currentContextFile = path.join(this.contextDir, 'CURRENT_SESSION.md');
    this.sessionHistoryFile = path.join(this.contextDir, 'SESSION_HISTORY.md');
    this.projectContextFile = path.join(this.contextDir, 'PROJECT_CONTEXT.md');
    
    this.sessionContext = {
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      workingOn: [],
      decisions: [],
      pendingActions: [],
      keyFacts: [],
      lastUpdated: new Date()
    };

    this.initializeContextFiles();
  }

  /**
   * Initialize context directory and files
   */
  private initializeContextFiles(): void {
    // Create directory if it doesn't exist
    if (!fs.existsSync(this.contextDir)) {
      fs.mkdirSync(this.contextDir, { recursive: true });
    }

    // Create project context file if it doesn't exist
    if (!fs.existsSync(this.projectContextFile)) {
      this.createProjectContextFile();
    }

    // Create or update current session file
    this.updateCurrentSessionFile();
  }

  /**
   * Create initial project context file
   */
  private createProjectContextFile(): void {
    const template = `# Project Context

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
*Last Updated: ${new Date().toISOString()}*
`;

    fs.writeFileSync(this.projectContextFile, template);
  }

  /**
   * Update current session file
   */
  private updateCurrentSessionFile(): void {
    const content = `# Current Session Context

**Session ID**: ${this.sessionContext.sessionId}  
**Started**: ${this.sessionContext.startTime.toISOString()}  
**Last Updated**: ${this.sessionContext.lastUpdated.toISOString()}

## 🎯 Current Task
${this.sessionContext.currentTask || '*No specific task set*'}

## 🔧 Working On
${this.sessionContext.workingOn.length > 0 
  ? this.sessionContext.workingOn.map(item => `- ${item}`).join('\n')
  : '*No active work items*'}

## ✅ Recent Decisions
${this.sessionContext.decisions.length > 0
  ? this.sessionContext.decisions.slice(-5).map(item => `- ${item}`).join('\n')
  : '*No decisions recorded*'}

## 📋 Pending Actions
${this.sessionContext.pendingActions.length > 0
  ? this.sessionContext.pendingActions.map(item => `- [ ] ${item}`).join('\n')
  : '*No pending actions*'}

## 💡 Key Facts & Context
${this.sessionContext.keyFacts.length > 0
  ? this.sessionContext.keyFacts.map(item => `- ${item}`).join('\n')
  : '*No key facts recorded*'}

## 📝 Quick Reference
- **Project Root**: ${process.cwd()}
- **Context Files**: ${this.contextDir}
- **Read Context**: \`cat ${this.currentContextFile}\`
- **Read Project**: \`cat ${this.projectContextFile}\`

---
*This file is automatically updated. Claude should read this to understand current context.*
`;

    fs.writeFileSync(this.currentContextFile, content);
  }

  /**
   * Add to current task
   */
  setCurrentTask(task: string): void {
    this.sessionContext.currentTask = task;
    this.sessionContext.lastUpdated = new Date();
    this.updateCurrentSessionFile();
    this.appendToHistory(`Task set: ${task}`);
  }

  /**
   * Add working on item
   */
  addWorkingOn(item: string): void {
    if (!this.sessionContext.workingOn.includes(item)) {
      this.sessionContext.workingOn.push(item);
      // Keep only last 10 items
      if (this.sessionContext.workingOn.length > 10) {
        this.sessionContext.workingOn.shift();
      }
      this.sessionContext.lastUpdated = new Date();
      this.updateCurrentSessionFile();
    }
  }

  /**
   * Add a decision made
   */
  addDecision(decision: string): void {
    const timePart = new Date().toISOString().split('T')[1];
    const timeWithoutMs = timePart ? timePart.split('.')[0] : '';
    this.sessionContext.decisions.push(`[${timeWithoutMs}] ${decision}`);
    // Keep only last 20 decisions
    if (this.sessionContext.decisions.length > 20) {
      this.sessionContext.decisions.shift();
    }
    this.sessionContext.lastUpdated = new Date();
    this.updateCurrentSessionFile();
    this.appendToHistory(`Decision: ${decision}`);
  }

  /**
   * Add pending action
   */
  addPendingAction(action: string): void {
    if (!this.sessionContext.pendingActions.includes(action)) {
      this.sessionContext.pendingActions.push(action);
      // Keep only last 15 actions
      if (this.sessionContext.pendingActions.length > 15) {
        this.sessionContext.pendingActions.shift();
      }
      this.sessionContext.lastUpdated = new Date();
      this.updateCurrentSessionFile();
    }
  }

  /**
   * Complete a pending action
   */
  completePendingAction(action: string): void {
    this.sessionContext.pendingActions = this.sessionContext.pendingActions.filter(
      a => !a.includes(action)
    );
    this.sessionContext.lastUpdated = new Date();
    this.updateCurrentSessionFile();
    this.appendToHistory(`Completed: ${action}`);
  }

  /**
   * Add key fact
   */
  addKeyFact(fact: string): void {
    if (!this.sessionContext.keyFacts.includes(fact)) {
      this.sessionContext.keyFacts.push(fact);
      // Keep only last 25 facts
      if (this.sessionContext.keyFacts.length > 25) {
        this.sessionContext.keyFacts.shift();
      }
      this.sessionContext.lastUpdated = new Date();
      this.updateCurrentSessionFile();
    }
  }

  /**
   * Append to session history
   */
  private appendToHistory(entry: string): void {
    const timestamp = new Date().toISOString();
    const historyEntry = `\n- **[${timestamp}]** ${entry}`;
    
    // Create or append to history file
    if (!fs.existsSync(this.sessionHistoryFile)) {
      const header = `# Session History\n\n## Session ${this.sessionContext.sessionId}\n`;
      fs.writeFileSync(this.sessionHistoryFile, header + historyEntry);
    } else {
      fs.appendFileSync(this.sessionHistoryFile, historyEntry);
    }
  }

  /**
   * Get context for Claude (returns file paths)
   */
  getContextForClaude(): string {
    return `
## 📚 Context Files for Claude

Claude should read these files to understand the current context:

1. **Current Session**: ${this.currentContextFile}
   - Current task, working items, pending actions
   
2. **Project Context**: ${this.projectContextFile}
   - Project overview, architecture, key services
   
3. **Session History**: ${this.sessionHistoryFile}
   - Recent decisions and completed actions

You can read these files using the Read tool to maintain context.
`;
  }

  /**
   * Update project context with new information
   */
  updateProjectContext(section: string, content: string): void {
    const currentContent = fs.readFileSync(this.projectContextFile, 'utf8');
    
    // Simple append for now - could be enhanced to update specific sections
    const updatedContent = currentContent.replace(
      '*Last Updated:',
      `\n## ${section}\n${content}\n\n*Last Updated:`
    );
    
    fs.writeFileSync(this.projectContextFile, updatedContent);
  }

  /**
   * Clear session and start fresh
   */
  clearSession(): void {
    this.sessionContext = {
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      workingOn: [],
      decisions: [],
      pendingActions: [],
      keyFacts: [],
      lastUpdated: new Date()
    };
    
    this.updateCurrentSessionFile();
    
    // Archive old history
    if (fs.existsSync(this.sessionHistoryFile)) {
      const archivePath = path.join(
        this.contextDir, 
        `history_${Date.now()}.md`
      );
      fs.renameSync(this.sessionHistoryFile, archivePath);
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all context files
   */
  getContextFiles(): string[] {
    return [
      this.currentContextFile,
      this.projectContextFile,
      this.sessionHistoryFile
    ];
  }

  /**
   * Create a summary of current context
   */
  createContextSummary(): string {
    return `
## Quick Context Summary

**Current Task**: ${this.sessionContext.currentTask || 'None set'}
**Active Work Items**: ${this.sessionContext.workingOn.length}
**Pending Actions**: ${this.sessionContext.pendingActions.length}
**Key Facts Stored**: ${this.sessionContext.keyFacts.length}

Read full context with:
- \`cat ${this.currentContextFile}\`
- \`cat ${this.projectContextFile}\`
`;
  }
}

// Export singleton instance
export const contextDocService = new ContextDocService();