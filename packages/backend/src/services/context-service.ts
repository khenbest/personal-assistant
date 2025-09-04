/**
 * Context Management Service
 * Helps Claude maintain context across conversations and sessions
 * Stores conversation history, project state, and working memory
 */

import { supabase } from '../lib/supabase-client';
import { ollamaService } from './ollama-service';

export interface ConversationContext {
  id?: string;
  sessionId: string;
  userId?: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    intent?: string;
    entities?: Record<string, any>;
    tokens?: number;
    model?: string;
  };
}

export interface WorkingMemory {
  currentTask?: string;
  projectContext?: string;
  recentTopics: string[];
  importantFacts: string[];
  pendingActions: string[];
  lastUpdated: Date;
}

export interface ContextSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  timestamp: Date;
}

export class ContextService {
  private workingMemory: WorkingMemory;
  private conversationBuffer: ConversationContext[] = [];
  private readonly MAX_BUFFER_SIZE = 50;
  private readonly MAX_CONTEXT_LENGTH = 4000; // tokens
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.workingMemory = {
      recentTopics: [],
      importantFacts: [],
      pendingActions: [],
      lastUpdated: new Date()
    };
    this.loadPersistedContext();
  }

  /**
   * Add a message to conversation history
   */
  async addToContext(role: 'user' | 'assistant' | 'system', content: string, metadata?: any): Promise<void> {
    const context: ConversationContext = {
      sessionId: this.sessionId,
      timestamp: new Date(),
      role,
      content,
      metadata
    };

    // Add to buffer
    this.conversationBuffer.push(context);
    
    // Trim buffer if needed
    if (this.conversationBuffer.length > this.MAX_BUFFER_SIZE) {
      // Summarize older messages before removing
      await this.summarizeAndArchive();
      this.conversationBuffer = this.conversationBuffer.slice(-30);
    }

    // Persist to database
    await this.persistContext(context);
    
    // Update working memory
    await this.updateWorkingMemory(content, role);
  }

  /**
   * Get relevant context for Claude
   */
  async getRelevantContext(query: string): Promise<string> {
    // Build context from multiple sources
    const contexts: string[] = [];

    // 1. Working memory
    if (this.workingMemory.currentTask) {
      contexts.push(`Current Task: ${this.workingMemory.currentTask}`);
    }
    
    if (this.workingMemory.projectContext) {
      contexts.push(`Project Context: ${this.workingMemory.projectContext}`);
    }

    if (this.workingMemory.importantFacts.length > 0) {
      contexts.push(`Key Information:\n${this.workingMemory.importantFacts.join('\n- ')}`);
    }

    // 2. Recent conversation
    const recentMessages = this.conversationBuffer.slice(-10);
    if (recentMessages.length > 0) {
      const conversation = recentMessages
        .map(m => `${m.role}: ${m.content.substring(0, 200)}`)
        .join('\n');
      contexts.push(`Recent Conversation:\n${conversation}`);
    }

    // 3. Retrieved similar contexts from history
    const similar = await this.retrieveSimilarContexts(query);
    if (similar.length > 0) {
      contexts.push(`Related Past Context:\n${similar.join('\n')}`);
    }

    // 4. Pending actions
    if (this.workingMemory.pendingActions.length > 0) {
      contexts.push(`Pending Actions:\n- ${this.workingMemory.pendingActions.join('\n- ')}`);
    }

    return contexts.join('\n\n');
  }

  /**
   * Update working memory based on conversation
   */
  private async updateWorkingMemory(content: string, role: 'user' | 'assistant' | 'system'): Promise<void> {
    // Extract important information
    if (role === 'user') {
      // Check for task indicators
      if (content.match(/working on|trying to|need to|help me/i)) {
        this.workingMemory.currentTask = content.substring(0, 200);
      }
      
      // Extract topics
      const topics = this.extractTopics(content);
      this.workingMemory.recentTopics = [
        ...topics,
        ...this.workingMemory.recentTopics
      ].slice(0, 10);
    }

    // Extract action items
    if (content.match(/todo|will|need to|should|must/i)) {
      const actions = this.extractActionItems(content);
      this.workingMemory.pendingActions = [
        ...actions,
        ...this.workingMemory.pendingActions
      ].slice(0, 10);
    }

    // Extract facts
    if (content.match(/is|are|was|were|called|named/i)) {
      const facts = this.extractFacts(content);
      this.workingMemory.importantFacts = [
        ...facts,
        ...this.workingMemory.importantFacts
      ].slice(0, 20);
    }

    this.workingMemory.lastUpdated = new Date();
  }

  /**
   * Summarize and archive old conversations
   */
  private async summarizeAndArchive(): Promise<void> {
    const toSummarize = this.conversationBuffer.slice(0, 20);
    
    if (toSummarize.length === 0) return;

    try {
      const conversation = toSummarize
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const summaryPrompt = `Summarize this conversation, extracting:
1. Main topics discussed
2. Key decisions made
3. Action items identified
4. Important facts mentioned

Conversation:
${conversation}

Provide a concise summary.`;

      const response = await ollamaService.generateOllamaCompletion({
        prompt: summaryPrompt,
        temperature: 0.3,
        maxTokens: 500
      });

      // Store summary
      const summary: ContextSummary = {
        summary: response.content,
        keyPoints: this.extractKeyPoints(response.content),
        actionItems: this.extractActionItems(response.content),
        decisions: this.extractDecisions(response.content),
        timestamp: new Date()
      };

      await this.persistSummary(summary);
    } catch (error) {
      console.error('Failed to summarize context:', error);
    }
  }

  /**
   * Retrieve similar contexts from history
   */
  private async retrieveSimilarContexts(query: string): Promise<string[]> {
    try {
      // Search in recent summaries
      const { data: summaries } = await supabase
        .from('context_summaries')
        .select('summary, key_points')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!summaries || summaries.length === 0) {
        return [];
      }

      // Simple keyword matching for now
      const keywords = this.extractKeywords(query);
      const relevant = summaries
        .filter(s => {
          const text = `${s.summary} ${s.key_points?.join(' ')}`.toLowerCase();
          return keywords.some(k => text.includes(k.toLowerCase()));
        })
        .map(s => s.summary.substring(0, 200))
        .slice(0, 3);

      return relevant;
    } catch (error) {
      console.error('Failed to retrieve similar contexts:', error);
      return [];
    }
  }

  /**
   * Persist context to database
   */
  private async persistContext(context: ConversationContext): Promise<void> {
    try {
      await supabase
        .from('conversation_history')
        .insert({
          session_id: context.sessionId,
          role: context.role,
          content: context.content,
          metadata: context.metadata,
          created_at: context.timestamp
        });
    } catch (error) {
      console.error('Failed to persist context:', error);
    }
  }

  /**
   * Persist summary to database
   */
  private async persistSummary(summary: ContextSummary): Promise<void> {
    try {
      await supabase
        .from('context_summaries')
        .insert({
          session_id: this.sessionId,
          summary: summary.summary,
          key_points: summary.keyPoints,
          action_items: summary.actionItems,
          decisions: summary.decisions,
          created_at: summary.timestamp
        });
    } catch (error) {
      console.error('Failed to persist summary:', error);
    }
  }

  /**
   * Load persisted context on startup
   */
  private async loadPersistedContext(): Promise<void> {
    try {
      // Load recent conversation history
      const { data: history } = await supabase
        .from('conversation_history')
        .select('*')
        .eq('session_id', this.sessionId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (history && history.length > 0) {
        this.conversationBuffer = history.map(h => ({
          sessionId: h.session_id,
          timestamp: new Date(h.created_at),
          role: h.role as 'user' | 'assistant' | 'system',
          content: h.content,
          metadata: h.metadata
        })).reverse();
      }

      // Load working memory from last session
      const { data: memory } = await supabase
        .from('working_memory')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (memory) {
        this.workingMemory = {
          currentTask: memory.current_task,
          projectContext: memory.project_context,
          recentTopics: memory.recent_topics || [],
          importantFacts: memory.important_facts || [],
          pendingActions: memory.pending_actions || [],
          lastUpdated: new Date(memory.updated_at)
        };
      }
    } catch (error) {
      console.error('Failed to load persisted context:', error);
    }
  }

  /**
   * Save working memory to database
   */
  async saveWorkingMemory(): Promise<void> {
    try {
      await supabase
        .from('working_memory')
        .insert({
          session_id: this.sessionId,
          current_task: this.workingMemory.currentTask,
          project_context: this.workingMemory.projectContext,
          recent_topics: this.workingMemory.recentTopics,
          important_facts: this.workingMemory.importantFacts,
          pending_actions: this.workingMemory.pendingActions,
          updated_at: this.workingMemory.lastUpdated
        });
    } catch (error) {
      console.error('Failed to save working memory:', error);
    }
  }

  /**
   * Clear context and start fresh
   */
  async clearContext(): Promise<void> {
    this.conversationBuffer = [];
    this.workingMemory = {
      recentTopics: [],
      importantFacts: [],
      pendingActions: [],
      lastUpdated: new Date()
    };
    this.sessionId = this.generateSessionId();
  }

  /**
   * Set project context explicitly
   */
  setProjectContext(context: string): void {
    this.workingMemory.projectContext = context;
    this.workingMemory.lastUpdated = new Date();
  }

  /**
   * Helper methods
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    return text
      .split(/\W+/)
      .filter(word => word.length > 3)
      .slice(0, 10);
  }

  private extractTopics(text: string): string[] {
    // Extract main topics (simplified)
    const topics: string[] = [];
    
    // Look for nouns and technical terms
    const words = text.split(/\W+/);
    for (let i = 0; i < words.length; i++) {
      if (words[i].length > 4 && /^[A-Z]/.test(words[i])) {
        topics.push(words[i]);
      }
    }
    
    return topics.slice(0, 5);
  }

  private extractFacts(text: string): string[] {
    // Extract factual statements
    const facts: string[] = [];
    const sentences = text.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      if (sentence.match(/\b(is|are|was|were|called|named)\b/i)) {
        facts.push(sentence.trim().substring(0, 100));
      }
    }
    
    return facts.slice(0, 5);
  }

  private extractActionItems(text: string): string[] {
    // Extract action items
    const actions: string[] = [];
    const patterns = [
      /need to (.+?)(?:\.|,|$)/gi,
      /should (.+?)(?:\.|,|$)/gi,
      /will (.+?)(?:\.|,|$)/gi,
      /must (.+?)(?:\.|,|$)/gi,
      /todo:? (.+?)(?:\.|,|$)/gi
    ];
    
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          actions.push(match[1].trim().substring(0, 100));
        }
      }
    }
    
    return actions.slice(0, 5);
  }

  private extractKeyPoints(text: string): string[] {
    // Extract key points from summary
    return text
      .split(/[.!?]+/)
      .filter(s => s.length > 20)
      .slice(0, 5)
      .map(s => s.trim());
  }

  private extractDecisions(text: string): string[] {
    // Extract decisions made
    const decisions: string[] = [];
    const patterns = [
      /decided to (.+?)(?:\.|,|$)/gi,
      /agreed to (.+?)(?:\.|,|$)/gi,
      /chose to (.+?)(?:\.|,|$)/gi,
      /will be (.+?)(?:\.|,|$)/gi
    ];
    
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          decisions.push(match[1].trim().substring(0, 100));
        }
      }
    }
    
    return decisions.slice(0, 3);
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get working memory state
   */
  getWorkingMemory(): WorkingMemory {
    return { ...this.workingMemory };
  }
}

// Export singleton instance
export const contextService = new ContextService();