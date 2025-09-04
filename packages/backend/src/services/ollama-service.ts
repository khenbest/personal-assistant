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
  
  // Configuration from environment variables
  private readonly warmupTimeout: number;
  private readonly inferenceTimeout: number;
  private readonly enableWarmup: boolean;
  private readonly warmupModels: string[];
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    
    // Load configuration from environment variables
    this.warmupTimeout = parseInt(process.env.OLLAMA_WARMUP_TIMEOUT || '60000', 10); // 60s default
    this.inferenceTimeout = parseInt(process.env.OLLAMA_INFERENCE_TIMEOUT || '30000', 10); // 30s default
    this.enableWarmup = process.env.OLLAMA_ENABLE_WARMUP !== 'false'; // true by default
    this.warmupModels = process.env.OLLAMA_WARMUP_MODELS?.split(',').map(m => m.trim()) || [];
    this.maxRetries = parseInt(process.env.OLLAMA_MAX_RETRIES || '3', 10);
    this.retryDelayMs = parseInt(process.env.OLLAMA_RETRY_DELAY_MS || '1000', 10);
    
    this.checkHealth();
  }

  /**
   * Generate completion from local Ollama models with fallback
   */
  async generateOllamaCompletion(request: OllamaRequest): Promise<OllamaResponse> {
    // Try primary model first (Qwen) with retry
    if (this.modelAvailability.get(this.primaryModel)) {
      try {
        return await this.callWithRetry(this.primaryModel, request);
      } catch (error) {
        console.warn(`Primary model ${this.primaryModel} failed after retries:`, error);
      }
    }

    // Fallback to Llama with retry
    if (this.modelAvailability.get(this.fallbackModel)) {
      try {
        console.log('Falling back to Llama3.2:3b');
        return await this.callWithRetry(this.fallbackModel, request);
      } catch (error) {
        console.error(`Fallback model ${this.fallbackModel} failed after retries:`, error);
        throw new Error('All Ollama models failed. Is Ollama running?');
      }
    }

    throw new Error('No Ollama models available');
  }
  
  /**
   * Call Ollama with retry logic for production requests
   */
  private async callWithRetry(model: string, request: OllamaRequest): Promise<OllamaResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.callOllama(model, request, false);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry for certain errors
        if (lastError.message.includes('not found') || 
            lastError.message.includes('No Ollama models')) {
          throw lastError;
        }
        
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.warn(`⚠️  Request attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError || new Error('Failed after retries');
  }

  /**
   * Call Ollama API with specific model
   */
  private async callOllama(model: string, request: OllamaRequest, isWarmup: boolean = false): Promise<OllamaResponse> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutMs = isWarmup ? this.warmupTimeout : this.inferenceTimeout;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
        throw new Error(`Ollama timeout after ${timeoutMs / 1000} seconds`);
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
   * Warm up models with retry logic and selective loading
   */
  async warmUp(): Promise<void> {
    if (!this.enableWarmup) {
      console.log('🔧 Model warm-up disabled via OLLAMA_ENABLE_WARMUP=false');
      return;
    }

    const testPrompt = 'Respond with: OK';
    const modelsToWarmup = this.getModelsToWarmup();
    
    if (modelsToWarmup.length === 0) {
      console.log('⚠️  No models available for warm-up');
      return;
    }
    
    console.log(`🔥 Warming up models: ${modelsToWarmup.join(', ')}`);
    
    for (const model of modelsToWarmup) {
      await this.warmUpWithRetry(model, testPrompt);
    }
  }
  
  /**
   * Determine which models should be warmed up
   */
  private getModelsToWarmup(): string[] {
    const models: string[] = [];
    
    // If specific models are configured, use only those
    if (this.warmupModels.length > 0) {
      for (const model of this.warmupModels) {
        if (this.modelAvailability.get(model)) {
          models.push(model);
        } else {
          console.warn(`⚠️  Configured warm-up model ${model} not available`);
        }
      }
      return models;
    }
    
    // Otherwise, warm up all available models
    for (const [model, available] of this.modelAvailability.entries()) {
      if (available) {
        models.push(model);
      }
    }
    
    return models;
  }
  
  /**
   * Warm up a single model with exponential backoff retry
   */
  private async warmUpWithRetry(model: string, testPrompt: string): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`Warming up ${model} (attempt ${attempt + 1}/${this.maxRetries})...`);
        await this.callOllama(model, { prompt: testPrompt, maxTokens: 5 }, true);
        console.log(`✅ ${model} ready`);
        return; // Success!
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt); // Exponential backoff
          console.warn(`⚠️  Warm-up attempt ${attempt + 1} failed for ${model}, retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    
    console.error(`❌ Failed to warm up ${model} after ${this.maxRetries} attempts:`, lastError);
  }
  
  /**
   * Helper function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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