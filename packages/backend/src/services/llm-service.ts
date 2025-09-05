/**
 * LLM Service
 * ONLY uses Ollama for all LLM operations - NO cloud providers
 * Based on Claude-Coherence approach: simple, direct, offline-first
 * 
 * CLAUDE: Check context first! Run:
 * cat /Users/kenny/repos/personal-assistant/packages/backend/.claude-context/CURRENT_SESSION.md
 */

import { ollamaService } from './ollama-service';

export interface LLMRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  responseFormat?: 'json' | 'text';
  complexity?: 'low' | 'medium' | 'high';
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed: number;
  responseTime: number;
  cached?: boolean;
}

export class LLMService {
  private responseCache: Map<string, LLMResponse> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_TTL = 300000; // 5 minutes for local models
  private isHealthy: boolean = false;

  constructor() {
    this.initializeOllama();
  }

  private async initializeOllama(): Promise<void> {
    try {
      this.isHealthy = await ollamaService.checkHealth();
      if (this.isHealthy) {
        console.log('✅ LLM Service initialized with Ollama');
        // Warm up models
        ollamaService.warmUp().catch(console.warn);
      } else {
        console.error('❌ Ollama is not running. Please start Ollama first.');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Ollama:', error);
      this.isHealthy = false;
    }
  }

  /**
   * Generate completion using ONLY local Ollama models
   */
  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    // Check if Ollama is healthy
    if (!this.isHealthy) {
      // Try to reconnect
      this.isHealthy = await ollamaService.checkHealth();
      if (!this.isHealthy) {
        throw new Error('Ollama is not running. Please start Ollama with: ollama serve');
      }
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      console.log('📦 Returning cached response');
      return { ...cached, cached: true };
    }

    try {
      // Call Ollama directly
      // const startTime = Date.now(); // Unused for now
      const response = await ollamaService.generateOllamaCompletion({
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature || 0.3, // Lower temperature for consistency
        maxTokens: request.maxTokens || 100, // Small for intent classification
        responseFormat: request.responseFormat
      });

      const llmResponse: LLMResponse = {
        content: response.content,
        provider: 'ollama',
        model: response.model,
        tokensUsed: response.tokensUsed,
        responseTime: response.responseTime
      };

      // Cache successful response
      this.cacheResponse(cacheKey, llmResponse);

      return llmResponse;
    } catch (error) {
      // Mark as unhealthy and try to recover
      this.isHealthy = false;
      
      // Check if it's a connection error
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error('Ollama is not running. Please start it with: ollama serve');
      }
      
      throw error;
    }
  }

  /**
   * Cache management
   */
  private generateCacheKey(request: LLMRequest): string {
    // Simple hash of the prompt for caching
    return `${request.prompt.substring(0, 100)}:${request.systemPrompt?.substring(0, 50) || ''}`;
  }

  private getCachedResponse(key: string): LLMResponse | null {
    return this.responseCache.get(key) || null;
  }

  private cacheResponse(key: string, response: LLMResponse): void {
    // Simple LRU cache
    if (this.responseCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.responseCache.keys().next().value;
      if (firstKey) {
        this.responseCache.delete(firstKey);
      }
    }
    this.responseCache.set(key, response);
    
    // TTL cleanup
    setTimeout(() => {
      this.responseCache.delete(key);
    }, this.CACHE_TTL);
  }

  /**
   * Health and statistics
   */
  async checkHealth(): Promise<boolean> {
    this.isHealthy = await ollamaService.checkHealth();
    return this.isHealthy;
  }

  getProviderStats(): Array<{
    name: string;
    healthy: boolean;
    model: string;
    available: boolean;
  }> {
    return [{
      name: 'ollama',
      healthy: this.isHealthy,
      model: 'qwen2.5:1.5b / llama3.2:3b',
      available: this.isHealthy
    }];
  }

  clearCache(): void {
    this.responseCache.clear();
  }

  /**
   * Optimized intent classification with minimal prompt
   * Uses focused prompt to reduce tokens and improve speed
   */
  async classifyIntentOptimized(text: string): Promise<string> {
    const prompt = `Task: Classify the user's intent.

Intents:
- create_event (schedule meetings, appointments, calendar events)
- query_events (check calendar, what's scheduled, am I free)
- cancel_event (cancel, remove, delete events)
- add_reminder (remind me, set reminder, ping me)
- query_reminders (what reminders, list reminders)
- create_note (take note, write down, jot down)
- query_notes (find notes, search notes, what did I write)
- send_email (send email, compose, write to)
- read_email (check email, read messages)

User text: "${text}"

Respond with ONLY the intent name, nothing else.`;

    const response = await this.generateCompletion({
      prompt,
      temperature: 0.1, // Very low for consistent classification
      maxTokens: 10, // Just the intent name
      responseFormat: 'text'
    });

    // Clean up response (remove whitespace, punctuation, etc.)
    return response.content.trim().toLowerCase().replace(/[^a-z_]/g, '');
  }

  /**
   * Optimized slot extraction with structured output
   * Focused prompt for extracting specific information
   */
  async extractSlotsOptimized(text: string, intent: string): Promise<Record<string, any>> {
    const prompt = `Extract key information from this text for a ${intent} action.

Text: "${text}"

Extract ALL relevant information as JSON:
- For events: title, datetime, duration, attendees, location
- For reminders: task, datetime
- For notes: title, content
- For emails: recipients, subject, body
- Extract people names, times (convert to ISO-8601), durations in minutes

Example output format:
{"title": "Meeting with John", "datetime": "2024-03-15T14:00:00", "attendees": ["John"], "duration_minutes": 60}

Respond with ONLY valid JSON containing the extracted slots.`;

    try {
      const response = await this.generateCompletion({
        prompt,
        temperature: 0.2,
        maxTokens: 100,
        responseFormat: 'json'
      });

      return JSON.parse(response.content);
    } catch {
      // If JSON parsing fails, return empty slots
      return {};
    }
  }
}

// Export singleton instance
export const llmService = new LLMService();