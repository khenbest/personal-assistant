/**
 * Local-Only LLM Service
 * Uses ONLY Ollama for all LLM operations
 * Based on Claude-Coherence approach - simple, direct, no cloud dependencies
 */

import { ollamaService } from './ollama-service';

export interface LLMRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  responseFormat?: 'json' | 'text';
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed: number;
  responseTime: number;
}

export class LocalLLMService {
  private responseCache: Map<string, LLMResponse> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const status = await ollamaService.checkHealth();
    if (!status) {
      console.error('❌ Ollama is not running! Please start Ollama:');
      console.error('   brew services start ollama');
      console.error('   OR');
      console.error('   ollama serve');
      process.exit(1); // Fail fast - we NEED local models
    }
    
    console.log('✅ Local LLM Service initialized with Ollama');
    
    // Warm up models for faster first inference
    await ollamaService.warmUp();
  }

  /**
   * Generate completion using local Ollama models
   * No fallback to cloud - local only!
   */
  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      console.log('📦 Returning cached response');
      return { ...cached };
    }

    try {
      // Use Ollama service (Qwen primary, Llama fallback)
      const response = await ollamaService.generateCompletion({
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature || 0.3, // Low temp for consistent classification
        maxTokens: request.maxTokens || 50, // Small for intent classification
        responseFormat: request.responseFormat
      });

      const result: LLMResponse = {
        content: response.content,
        model: response.model,
        tokensUsed: response.tokensUsed,
        responseTime: response.responseTime
      };

      // Cache successful response
      this.cacheResponse(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('❌ Local LLM failed:', error);
      throw new Error(`Local LLM failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Specialized method for intent classification
   * Optimized prompt and parameters for this specific use case
   */
  async classifyIntent(text: string): Promise<string> {
    const prompt = `Task: Classify the user's intent.

Intents: create_event, add_reminder, create_note, read_email, send_email

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
   * Specialized method for slot extraction
   */
  async extractSlots(text: string, intent: string): Promise<Record<string, any>> {
    const prompt = `Extract information from this text for a ${intent} action.

Text: "${text}"

Extract these slots if present:
- title/subject
- datetime (ISO-8601 format)
- duration_minutes
- recipients (email addresses)
- body/content

Respond in JSON format with only found slots.`;

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

  /**
   * Simple cache management
   */
  private generateCacheKey(request: LLMRequest): string {
    return `${request.prompt.substring(0, 100)}:${request.temperature}:${request.maxTokens}`;
  }

  private getCachedResponse(key: string): LLMResponse | null {
    return this.responseCache.get(key) || null;
  }

  private cacheResponse(key: string, response: LLMResponse): void {
    // Implement simple LRU cache
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
   * Get service health status
   */
  async getStatus(): Promise<{
    healthy: boolean;
    models: string[];
    cacheSize: number;
  }> {
    const ollamaStatus = ollamaService.getStatus();
    
    return {
      healthy: ollamaStatus.healthy,
      models: ollamaStatus.models.filter(m => m.available).map(m => m.name),
      cacheSize: this.responseCache.size
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.responseCache.clear();
    console.log('✅ Cache cleared');
  }
}

// Export singleton instance - one service for entire app
export const llmService = new LocalLLMService();