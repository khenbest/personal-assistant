/**
 * Ollama Service for Local LLM Intent Classification
 * Uses Qwen2.5:1.5b (primary) and Llama3.2:3b (fallback)
 * Optimized for fast, local inference on resource-constrained environments
 */

export interface OllamaRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: 'json' | 'text';
}

export interface OllamaResponse {
  content: string;
  model: string;
  tokensUsed: number;
  responseTime: number;
  provider: string;
}

export class OllamaService {
  private baseUrl: string;
  private primaryModel: string = 'qwen2.5:1.5b';  // 0.9GB, super fast
  private fallbackModel: string = 'llama3.2:3b';  // 2GB, more capable
  private isHealthy: boolean = false;
  private modelAvailability: Map<string, boolean> = new Map();

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.checkHealth();
  }

  /**
   * Generate completion with automatic fallback
   */
  async generateCompletion(request: OllamaRequest): Promise<OllamaResponse> {
    // Try primary model first (Qwen)
    try {
      if (this.modelAvailability.get(this.primaryModel)) {
        return await this.callOllama(this.primaryModel, request);
      }
    } catch (error) {
      console.warn(`Primary model ${this.primaryModel} failed:`, error);
    }

    // Fallback to Llama
    try {
      if (this.modelAvailability.get(this.fallbackModel)) {
        console.log('Falling back to Llama3.2:3b');
        return await this.callOllama(this.fallbackModel, request);
      }
    } catch (error) {
      console.error(`Fallback model ${this.fallbackModel} failed:`, error);
      throw new Error('All Ollama models failed. Is Ollama running?');
    }

    throw new Error('No Ollama models available');
  }

  /**
   * Call Ollama API with specific model
   */
  private async callOllama(model: string, request: OllamaRequest): Promise<OllamaResponse> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout for first inference (model loading)

    try {
      // Build the prompt with optional system message
      const fullPrompt = request.systemPrompt 
        ? `${request.systemPrompt}\n\n${request.prompt}`
        : request.prompt;

      const body: any = {
        model,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: request.temperature || 0.3, // Lower temp for consistent classification
          num_predict: request.maxTokens || 100,   // Small for intent classification
        }
      };

      // Add JSON format for structured responses
      if (request.responseFormat === 'json') {
        body.format = 'json';
      }

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { response: string; eval_count?: number };
      
      return {
        content: data.response,
        model,
        tokensUsed: data.eval_count || 0,
        responseTime: Date.now() - startTime,
        provider: 'ollama'
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Ollama timeout after 15 seconds`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Check if Ollama is running and models are available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        this.isHealthy = false;
        return false;
      }

      const data = await response.json() as { models?: Array<{ name: string; model?: string }> };
      const models = data.models || [];
      
      // Check for our specific models (model name in API response includes the model name)
      this.modelAvailability.set(this.primaryModel, 
        models.some((m: any) => m.name === this.primaryModel || m.model === this.primaryModel));
      this.modelAvailability.set(this.fallbackModel, 
        models.some((m: any) => m.name === this.fallbackModel || m.model === this.fallbackModel));

      // Print helpful message if models are missing
      if (!this.modelAvailability.get(this.primaryModel)) {
        console.warn(`⚠️  Primary model ${this.primaryModel} not found. Install with:`);
        console.warn(`   ollama pull ${this.primaryModel}`);
      }
      if (!this.modelAvailability.get(this.fallbackModel)) {
        console.warn(`⚠️  Fallback model ${this.fallbackModel} not found. Install with:`);
        console.warn(`   ollama pull ${this.fallbackModel}`);
      }

      this.isHealthy = (this.modelAvailability.get(this.primaryModel) || 
                       this.modelAvailability.get(this.fallbackModel)) ?? false;
      
      if (this.isHealthy) {
        console.log('✅ Ollama service healthy with models:', 
          Array.from(this.modelAvailability.entries())
            .filter(([_, available]) => available)
            .map(([model]) => model)
            .join(', '));
      }

      return this.isHealthy;
    } catch (error) {
      console.error('❌ Ollama health check failed:', error);
      this.isHealthy = false;
      return false;
    }
  }

  /**
   * Warm up models by sending a test request
   */
  async warmUp(): Promise<void> {
    const testPrompt = 'Respond with: OK';
    
    for (const [model, available] of this.modelAvailability.entries()) {
      if (available) {
        try {
          console.log(`Warming up ${model}...`);
          await this.callOllama(model, { prompt: testPrompt, maxTokens: 5 });
          console.log(`✅ ${model} ready`);
        } catch (error) {
          console.warn(`⚠️  Failed to warm up ${model}:`, error);
        }
      }
    }
  }

  /**
   * Get service status
   */
  getStatus(): { 
    healthy: boolean; 
    models: { name: string; available: boolean }[] 
  } {
    return {
      healthy: this.isHealthy,
      models: [
        { name: this.primaryModel, available: this.modelAvailability.get(this.primaryModel) || false },
        { name: this.fallbackModel, available: this.modelAvailability.get(this.fallbackModel) || false }
      ]
    };
  }
}

// Export singleton instance
export const ollamaService = new OllamaService();