import { unifiedLLMService } from './unified-llm-service';

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  complexity?: 'low' | 'medium' | 'high';
  responseFormat?: 'json' | 'text';
}

export interface LLMResponse {
  content: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  cached?: boolean;
}

export interface CommandParseResult {
  intent: 'schedule' | 'query' | 'task' | 'reminder' | 'email' | 'unknown';
  entities: {
    title?: string;
    date?: Date;
    time?: string;
    attendees?: string[];
    location?: string;
    description?: string;
    priority?: string;
  };
  confidence: number;
  originalText: string;
}

export class LLMService {
  /**
   * Send a request to the LLM service using the unified service
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Use the unified LLM service directly
      const response = await unifiedLLMService.generateCompletion({
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        maxTokens: request.maxTokens || 1024,
        temperature: request.temperature || 0.7,
        complexity: request.complexity || 'medium',
        responseFormat: request.responseFormat || 'text',
      });

      return {
        content: response.content,
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
        cached: response.cached,
      };
    } catch (error) {
      console.error('LLM service error:', error);
      // If all providers fail, return a helpful error message
      if (error instanceof Error && error.message.includes('All LLM providers failed')) {
        console.warn('⚠️ All LLM providers failed, returning error response');
        return {
          content: 'I apologize, but I am temporarily unable to process your request. Please try again in a moment.',
          provider: 'error',
          model: 'none',
          tokensUsed: 0,
          cached: false,
        };
      }
      throw error;
    }
  }

  /**
   * Parse a natural language command into structured data
   */
  async parseCommand(text: string): Promise<CommandParseResult> {
    const systemPrompt = `You are a command parser for a personal assistant. 
    Extract the intent and entities from the user's command.
    
    Intents: schedule, query, task, reminder, email, unknown
    
    Return ONLY a valid JSON object with:
    - intent: the detected intent
    - entities: extracted entities (title, date, time, attendees, location, description, priority)
    - confidence: confidence score 0-1
    - originalText: the input text
    
    IMPORTANT: Return ONLY the JSON object, no markdown, no explanations, no code blocks.
    
    Example:
    Input: "Schedule meeting with John tomorrow at 3pm"
    Output: {"intent":"schedule","entities":{"title":"meeting with John","date":"tomorrow","time":"3pm","attendees":["John"]},"confidence":0.95,"originalText":"Schedule meeting with John tomorrow at 3pm"}`;

    const response = await this.chat({
      prompt: text,
      systemPrompt,
      responseFormat: 'json',
      complexity: 'low',
      maxTokens: 512,
      temperature: 0.3,
    });

    try {
      // Clean up response if it contains markdown code blocks
      let content = response.content.trim();
      if (content.startsWith('```')) {
        content = content.replace(/```json?\n?/g, '').replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(content);
      
      // Parse date if present
      if (parsed.entities?.date) {
        parsed.entities.date = this.parseDate(parsed.entities.date);
      }
      
      return parsed as CommandParseResult;
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      console.error('Raw response:', response.content);
      
      // Try to extract intent from the text at least
      const textLower = text.toLowerCase();
      let fallbackIntent: CommandParseResult['intent'] = 'unknown';
      
      if (textLower.includes('schedule') || textLower.includes('meeting') || textLower.includes('appointment')) {
        fallbackIntent = 'schedule';
      } else if (textLower.includes('task') || textLower.includes('todo')) {
        fallbackIntent = 'task';
      } else if (textLower.includes('remind')) {
        fallbackIntent = 'reminder';
      } else if (textLower.includes('what') || textLower.includes('when') || textLower.includes('show')) {
        fallbackIntent = 'query';
      }
      
      return {
        intent: fallbackIntent,
        entities: { title: text },
        confidence: 0.3,
        originalText: text,
      };
    }
  }

  /**
   * Generate a response for the user
   */
  async generateResponse(
    context: string,
    userMessage: string,
    tone: 'professional' | 'friendly' | 'casual' = 'friendly'
  ): Promise<string> {
    const systemPrompt = `You are Kenny's personal AI assistant. 
    You help with scheduling, tasks, reminders, and general queries.
    Your tone should be ${tone}.
    Keep responses concise and helpful.
    
    Context: ${context}`;

    const response = await this.chat({
      prompt: userMessage,
      systemPrompt,
      complexity: 'medium',
      maxTokens: 512,
      temperature: 0.7,
    });

    return response.content;
  }

  /**
   * Parse natural language date strings
   */
  private parseDate(dateStr: string): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateMap: Record<string, Date> = {
      today: now,
      tomorrow: tomorrow,
      'next week': new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    };

    // Check if it's a relative date
    const lowerDateStr = dateStr.toLowerCase();
    if (dateMap[lowerDateStr]) {
      return dateMap[lowerDateStr];
    }

    // Try to parse as a date
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Default to tomorrow if we can't parse
    return tomorrow;
  }

  /**
   * Mock response for testing when LLM service is unavailable
   */
  private mockResponse(request: LLMRequest): LLMResponse {
    // Simple pattern matching for testing
    const text = request.prompt.toLowerCase();
    
    if (text.includes('schedule') || text.includes('meeting')) {
      return {
        content: JSON.stringify({
          intent: 'schedule',
          entities: {
            title: 'Mock meeting',
            date: new Date(),
            time: '3:00 PM',
          },
          confidence: 0.8,
          originalText: request.prompt,
        }),
        provider: 'mock',
        model: 'mock-v1',
        cached: false,
      };
    }

    return {
      content: request.responseFormat === 'json' 
        ? JSON.stringify({ message: 'Mock response', intent: 'unknown' })
        : 'This is a mock response. Please connect the LLM service for real responses.',
      provider: 'mock',
      model: 'mock-v1',
      cached: false,
    };
  }
}

export const llmService = new LLMService();