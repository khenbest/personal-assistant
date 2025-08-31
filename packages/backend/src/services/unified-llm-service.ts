/**
 * Unified LLM Service
 * Copied from claude-code-trial with all configurations
 * Provides intelligent routing between multiple LLM providers
 */

import { RetryService, llmRetryCondition } from '@kenny-assistant/shared';

export interface LLMProvider {
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
  priority: number;
  maxTokens: number;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  costPerToken: number;
  healthy: boolean;
  currentRequests: number;
  lastRequestTime: number;
}

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

export interface ModelSelection {
  provider: string;
  reason: string;
  fallbacks: string[];
}

export class UnifiedLLMService {
  private providers: Map<string, LLMProvider> = new Map();
  private responseCache: Map<string, LLMResponse> = new Map();
  private usageTracker: Map<string, { requests: number; tokens: number; lastReset: Date }> = new Map();
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Priority Order (lower number = higher priority):
    // 1. DeepSeek-R1 (Together AI) - FREE 70B model, best quality
    // 2. Gemini Pro - FREE with rate limits
    // 3. OpenRouter Mistral - FREE but only 7B
    // 4. Anthropic Claude - COSTS MONEY, only use if others fail
    // Anthropic Claude
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
      this.providers.set('anthropic', {
        name: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-haiku-20240307',
        priority: 4, // Last resort - costs money!
        maxTokens: 4096,
        rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 100000 },
        costPerToken: 0.00025,
        healthy: true,
        currentRequests: 0,
        lastRequestTime: 0
      });
    }


    // Google Gemini
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      this.providers.set('gemini', {
        name: 'gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-pro',
        priority: 2, // Second choice - also free
        maxTokens: 8192,
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 60000 },
        costPerToken: 0,
        healthy: true,
        currentRequests: 0,
        lastRequestTime: 0
      });
    }

    // OpenRouter
    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here') {
      this.providers.set('openrouter', {
        name: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: process.env.OPENROUTER_API_KEY,
        model: 'mistralai/mistral-7b-instruct:free',
        priority: 3, // Third choice - free but smaller model
        maxTokens: 4096,
        rateLimit: { requestsPerMinute: 20, tokensPerMinute: 20000 },
        costPerToken: 0,
        healthy: true,
        currentRequests: 0,
        lastRequestTime: 0
      });
    }

    // Together AI - DeepSeek-R1 (FREE 70B model!)
    if (process.env.TOGETHER_API_KEY && process.env.TOGETHER_API_KEY !== '') {
      this.providers.set('together', {
        name: 'together',
        endpoint: 'https://api.together.xyz/v1/chat/completions',
        apiKey: process.env.TOGETHER_API_KEY,
        model: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
        priority: 1, // DEFAULT - Free and most powerful!
        maxTokens: 8192,
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 100000 },
        costPerToken: 0, // Completely FREE!
        healthy: true,
        currentRequests: 0,
        lastRequestTime: 0
      });
    }

    // Initialize usage tracking
    for (const [name] of this.providers) {
      this.usageTracker.set(name, { 
        requests: 0, 
        tokens: 0, 
        lastReset: new Date() 
      });
    }

    console.log(`🤖 Unified LLM Service initialized with ${this.providers.size} providers:`, 
      Array.from(this.providers.keys()).join(', '));
  }

  /**
   * Main entry point for LLM requests with intelligent routing
   */
  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      console.log('📦 Returning cached response');
      return { ...cached, cached: true };
    }

    // Select provider based on complexity and availability
    const selection = await this.selectProvider(request.complexity || 'medium');
    
    // Try primary provider and fallbacks
    let lastError: Error | null = null;
    const providers = [selection.provider, ...selection.fallbacks];

    for (const providerName of providers) {
      const provider = this.providers.get(providerName);
      if (!provider || !provider.healthy) continue;

      try {
        const response = await this.callProvider(provider, request);
        
        // Cache successful response
        this.cacheResponse(cacheKey, response);
        
        // Track usage
        this.trackUsage(providerName, response.tokensUsed);
        
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`❌ Provider ${providerName} failed:`, lastError.message);
        provider.healthy = false;
        
        // Reset health after 1 minute
        setTimeout(() => {
          provider.healthy = true;
        }, 60000);
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Select optimal provider based on complexity and availability
   */
  private async selectProvider(complexity: 'low' | 'medium' | 'high'): Promise<ModelSelection> {
    this.resetRateLimits();
    
    const available = Array.from(this.providers.entries())
      .filter(([_, provider]) => {
        const usage = this.usageTracker.get(provider.name)!;
        return provider.healthy && 
               usage.requests < provider.rateLimit.requestsPerMinute &&
               provider.apiKey;
      })
      .sort((a, b) => a[1].priority - b[1].priority);

    if (available.length === 0) {
      throw new Error('No LLM providers available');
    }

    // Complexity-based routing
    let selected: string;
    let reason: string;

    if (complexity === 'high' && available.some(([name]) => name === 'anthropic')) {
      selected = 'anthropic';
      reason = 'High complexity request - using most capable model';
    } else if (complexity === 'low' && available.some(([name]) => name === 'openrouter' || name === 'together')) {
      selected = available.find(([name]) => name === 'openrouter' || name === 'together')![0];
      reason = 'Low complexity request - using efficient model';
    } else {
      selected = available[0][0];
      reason = 'Using highest priority available provider';
    }

    const fallbacks = available
      .filter(([name]) => name !== selected)
      .map(([name]) => name);

    return { provider: selected, reason, fallbacks };
  }

  /**
   * Call a specific provider with the request
   */
  private async callProvider(provider: LLMProvider, request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    // Wrap provider calls with retry logic
    const operation = async () => {
      if (provider.name === 'anthropic') {
        return this.callAnthropic(provider, request, startTime);
      } else if (provider.name === 'gemini') {
        return this.callGemini(provider, request, startTime);
      } else if (provider.name === 'openrouter') {
        return this.callOpenRouter(provider, request, startTime);
      } else if (provider.name === 'together') {
        return this.callTogether(provider, request, startTime);
      } else {
        throw new Error(`Unknown provider: ${provider.name}`);
      }
    };

    // Use retry service with LLM-specific configuration
    return RetryService.executeWithRetry(operation, {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 2,
      jitter: true,
      retryCondition: (error, attempt) => {
        // Don't retry if provider is marked unhealthy
        if (!provider.healthy) {
          return false;
        }
        
        // Check for rate limit with Retry-After header
        const retryAfter = RetryService.extractRetryAfter(error);
        if (retryAfter && retryAfter > 30000) {
          // If retry delay is more than 30 seconds, don't retry here
          // Let the main loop try a different provider
          return false;
        }
        
        // Use LLM-specific retry condition
        return llmRetryCondition(error, attempt);
      },
      onRetry: (error, attempt, nextDelay) => {
        console.log(`🔄 Retrying ${provider.name} after error: ${error.message}. Attempt ${attempt}, waiting ${nextDelay}ms`);
        
        // Update rate limit tracking if needed
        if (error.status === 429 || error.message?.includes('429')) {
          const usage = this.usageTracker.get(provider.name);
          if (usage) {
            // Temporarily reduce the rate limit
            usage.requests = Math.floor(provider.rateLimit.requestsPerMinute * 0.8);
          }
        }
      }
    });
  }

  private async callAnthropic(provider: LLMProvider, request: LLMRequest, startTime: number): Promise<LLMResponse> {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: request.maxTokens || 2000,
        messages: [{
          role: 'user',
          content: request.prompt
        }],
        ...(request.systemPrompt && { system: request.systemPrompt }),
        temperature: request.temperature || 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      content: data.content[0].text,
      provider: provider.name,
      model: provider.model,
      tokensUsed: data.usage?.total_tokens || 0,
      responseTime: Date.now() - startTime
    };
  }

  private async callGemini(provider: LLMProvider, request: LLMRequest, startTime: number): Promise<LLMResponse> {
    const response = await fetch(`${provider.endpoint}?key=${provider.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: request.systemPrompt ? `${request.systemPrompt}\n\n${request.prompt}` : request.prompt
          }]
        }],
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      content: data.candidates[0].content.parts[0].text,
      provider: provider.name,
      model: provider.model,
      tokensUsed: data.usageMetadata?.totalTokenCount || 0,
      responseTime: Date.now() - startTime
    };
  }

  private async callOpenRouter(provider: LLMProvider, request: LLMRequest, startTime: number): Promise<LLMResponse> {
    const messages = request.systemPrompt 
      ? [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.prompt }
        ]
      : [{ role: 'user', content: request.prompt }];

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'HTTP-Referer': 'https://github.com/kennyhenbest/personal-assistant',
        'X-Title': 'Kenny Personal Assistant'
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: request.maxTokens || 2000,
        temperature: request.temperature || 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      provider: provider.name,
      model: provider.model,
      tokensUsed: data.usage?.total_tokens || 0,
      responseTime: Date.now() - startTime
    };
  }

  private async callTogether(provider: LLMProvider, request: LLMRequest, startTime: number): Promise<LLMResponse> {
    const messages = request.systemPrompt 
      ? [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.prompt }
        ]
      : [{ role: 'user', content: request.prompt }];

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: request.maxTokens || 2000,
        temperature: request.temperature || 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Together API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Clean up DeepSeek-R1 responses that include <think> tags
    let content = data.choices[0].message.content;
    if (provider.model.includes('DeepSeek')) {
      // Remove <think>...</think> blocks from the response
      content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    }
    
    return {
      content,
      provider: provider.name,
      model: provider.model,
      tokensUsed: data.usage?.total_tokens || 0,
      responseTime: Date.now() - startTime
    };
  }

  /**
   * Cache management
   */
  private generateCacheKey(request: LLMRequest): string {
    return `${request.complexity || 'medium'}:${request.prompt.substring(0, 100)}`;
  }

  private getCachedResponse(key: string): LLMResponse | null {
    return this.responseCache.get(key) || null;
  }

  private cacheResponse(key: string, response: LLMResponse): void {
    // Implement LRU cache
    if (this.responseCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    this.responseCache.set(key, response);
    
    // TTL cleanup
    setTimeout(() => {
      this.responseCache.delete(key);
    }, this.CACHE_TTL);
  }

  /**
   * Usage tracking and rate limiting
   */
  private trackUsage(providerName: string, tokens: number): void {
    const usage = this.usageTracker.get(providerName);
    if (usage) {
      usage.requests++;
      usage.tokens += tokens;
    }
  }

  private resetRateLimits(): void {
    const now = new Date();
    for (const [name, usage] of this.usageTracker) {
      if (now.getTime() - usage.lastReset.getTime() > 60000) {
        usage.requests = 0;
        usage.tokens = 0;
        usage.lastReset = now;
      }
    }
  }

  /**
   * Health and statistics
   */
  getProviderStats(): Array<{
    name: string;
    healthy: boolean;
    model: string;
    requestsServed: number;
    priority: number;
    available: boolean;
  }> {
    return Array.from(this.providers.entries()).map(([name, provider]) => {
      const usage = this.usageTracker.get(name)!;
      return {
        name,
        healthy: provider.healthy,
        model: provider.model,
        requestsServed: usage.requests,
        priority: provider.priority,
        available: provider.healthy && usage.requests < provider.rateLimit.requestsPerMinute
      };
    });
  }

  getHealthyProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => provider.healthy)
      .map(([name]) => name);
  }

  resetProviderHealth(): void {
    for (const provider of this.providers.values()) {
      provider.healthy = true;
      provider.currentRequests = 0;
    }
  }

  clearCache(): void {
    this.responseCache.clear();
  }
}

// Export singleton instance
export const unifiedLLMService = new UnifiedLLMService();