/**
 * LLM Orchestrator Service
 * Handles intelligent conversation flow and decision-making
 * No hard-coded thresholds - all intelligence is LLM-driven
 */

import { LLMService } from './llm-service';
import { IntentClassificationService } from './intent-classification-service';
import { CalendarService } from './calendar-service';
import { reminderService } from './reminder-service';
import { noteService } from './note-service';
import { createClient } from '@supabase/supabase-js';

export interface ConversationContext {
  sessionId: string;
  userId: string;
  history: Message[];
  userProfile?: UserProfile;
  learningPatterns: Pattern[];
  currentTurn: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    action?: string;
    confidence?: string;
  };
}

export interface UserProfile {
  userId: string;
  preferences: Record<string, any>;
  correctionHistory: CorrectionPattern[];
}

export interface Pattern {
  input: string;
  correctedOutput: string;
  frequency: number;
}

export interface CorrectionPattern {
  originalIntent: string;
  correctedIntent: string;
  context: string;
  applyAlways: boolean;
}

export type VoiceAction = 'execute' | 'confirm' | 'clarify' | 'error' | 'learn';

export interface VoiceResponse {
  action: VoiceAction;
  response: {
    speak: string;
    display?: string;
    options?: string[];
  };
  metadata: {
    intent: string;
    entities?: Record<string, any>;
    confidence: 'high' | 'medium' | 'low';
    requiresConfirmation: boolean;
    sessionId: string;
  };
  nextStep?: {
    type: string;
    data: any;
  };
}

export class LLMOrchestrator {
  private llmService: LLMService;
  private intentService: IntentClassificationService;
  private calendarService: CalendarService;
  private supabase: any;
  private conversationStore: Map<string, ConversationContext> = new Map();

  constructor() {
    this.llmService = new LLMService();
    this.intentService = new IntentClassificationService(this.llmService);
    this.calendarService = new CalendarService(this.intentService);
    
    // Initialize Supabase for conversation storage
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Route voice intent to appropriate service with conversation context
   */
  async routeVoiceIntent(
    text: string,
    sessionId: string,
    userId: string
  ): Promise<VoiceResponse> {
    // Get or create conversation context
    const context = await this.getOrCreateContext(sessionId, userId);
    
    // Add user message to history
    this.addToHistory(context, 'user', text);
    
    // Step 1: Understand the request in context
    const understanding = await this.understandInContext(text, context);
    
    // Step 2: Decide action based on understanding
    const decision = await this.makeDecision(understanding, context);
    
    // Step 3: Generate appropriate response
    const response = await this.generateResponse(decision, understanding, context);
    
    // Step 4: Update conversation context
    this.addToHistory(context, 'assistant', response.response.speak, {
      intent: understanding.intent,
      action: decision.action,
      confidence: decision.confidence
    });
    
    // Save context for next turn
    await this.saveContext(context);
    
    return response;
  }

  /**
   * Understand the request in the context of the conversation
   */
  private async understandInContext(
    text: string,
    context: ConversationContext
  ): Promise<any> {
    const systemPrompt = `You are an intelligent assistant analyzing a voice command.
    
    Conversation history:
    ${this.formatHistory(context.history)}
    
    User patterns from previous corrections:
    ${this.formatPatterns(context.learningPatterns)}
    
    Analyze the current request and determine:
    1. The user's intent (create_event, add_reminder, create_note, send_email, read_email, or none)
    2. Whether this references previous context
    3. Any ambiguities that need clarification
    4. Relevant entities/slots
    
    Consider the conversation history and user patterns when interpreting the request.
    
    Output JSON only:
    {
      "intent": "string",
      "entities": {},
      "referencesContext": boolean,
      "ambiguities": [],
      "interpretation": "natural language explanation",
      "contextualClues": []
    }`;

    try {
      const response = await this.llmService.generateCompletion({
        prompt: `Analyze this request: "${text}"`,
        systemPrompt,
        responseFormat: 'json',
        complexity: 'medium'
      });

      console.log('LLM Understanding Response:', response.content);
      
      const result = JSON.parse(this.cleanJsonResponse(response.content));
      return {
        ...result,
        originalText: text,
        context
      };
    } catch (error) {
      console.error('Understanding failed:', error);
      return {
        intent: 'none',
        entities: {},
        referencesContext: false,
        ambiguities: ['Failed to understand request'],
        interpretation: 'I had trouble understanding that request',
        originalText: text
      };
    }
  }

  /**
   * Make a decision about how to handle the request
   */
  private async makeDecision(
    understanding: any,
    context: ConversationContext
  ): Promise<any> {
    const systemPrompt = `You are making a decision about how to handle a user's request.
    
    Understanding: ${JSON.stringify(understanding, null, 2)}
    Previous corrections for this user: ${JSON.stringify(context.userProfile?.correctionHistory || [], null, 2)}
    
    Decide:
    1. What action to take (execute, confirm, clarify, learn)
    2. Confidence level (high, medium, low) - be semantic, not numeric
    3. Whether confirmation is needed
    
    Decision criteria:
    - HIGH confidence + clear intent = execute immediately
    - MEDIUM confidence OR potential ambiguity = confirm first
    - LOW confidence OR unclear request = clarify
    - If this matches a previous correction pattern = apply learned behavior
    
    IMPORTANT: Do not use numeric thresholds. Make intelligent, context-aware decisions.
    
    Output JSON only:
    {
      "action": "execute|confirm|clarify|learn",
      "confidence": "high|medium|low",
      "requiresConfirmation": boolean,
      "reasoning": "explanation of decision",
      "suggestedConfirmation": "optional confirmation message",
      "clarificationNeeded": []
    }`;

    try {
      const response = await this.llmService.generateCompletion({
        prompt: 'Make a decision about this request',
        systemPrompt,
        responseFormat: 'json',
        complexity: 'medium'
      });

      console.log('LLM Decision Response:', response.content);
      
      try {
        return JSON.parse(this.cleanJsonResponse(response.content));
      } catch (parseError) {
        console.error('Failed to parse decision response:', response.content);
        throw parseError;
      }
    } catch (error) {
      console.error('Decision making failed:', error);
      return {
        action: 'clarify',
        confidence: 'low',
        requiresConfirmation: true,
        reasoning: 'Unable to make confident decision',
        clarificationNeeded: ['Please rephrase your request']
      };
    }
  }

  /**
   * Generate the appropriate response based on the decision
   */
  private async generateResponse(
    decision: any,
    understanding: any,
    context: ConversationContext
  ): Promise<VoiceResponse> {
    let response: VoiceResponse = {
      action: decision.action as VoiceAction,
      response: {
        speak: '',
        display: undefined,
        options: undefined
      },
      metadata: {
        intent: understanding.intent,
        entities: understanding.entities,
        confidence: decision.confidence,
        requiresConfirmation: decision.requiresConfirmation,
        sessionId: context.sessionId
      }
    };

    switch (decision.action) {
      case 'execute':
        // Execute the command immediately
        const result = await this.executeCommand(understanding);
        response.response.speak = result.spokenResponse || 'Command executed successfully.';
        response.response.display = result.displayText;
        break;

      case 'confirm':
        // Ask for confirmation
        response.response.speak = decision.suggestedConfirmation || 
          `I think you want to ${understanding.interpretation}. Is that correct?`;
        response.response.options = ['Yes', 'No', 'Correct this'];
        response.nextStep = {
          type: 'await_confirmation',
          data: understanding
        };
        break;

      case 'clarify':
        // Ask for clarification
        const clarificationPrompt = await this.generateClarificationPrompt(
          understanding,
          decision.clarificationNeeded
        );
        response.response.speak = clarificationPrompt;
        response.nextStep = {
          type: 'await_clarification',
          data: {
            originalUnderstanding: understanding,
            clarificationNeeded: decision.clarificationNeeded
          }
        };
        break;

      case 'learn':
        // Apply learned pattern
        response.response.speak = 'I remember your preference. ' + 
          await this.applyLearnedPattern(understanding, context);
        break;

      default:
        response.action = 'error';
        response.response.speak = 'I encountered an error processing your request.';
    }

    return response;
  }

  /**
   * Execute the actual command
   */
  private async executeCommand(understanding: any): Promise<any> {
    const { intent, /* entities, */ originalText } = understanding;
    const userId = understanding.context?.userId || 'demo-user';

    switch (intent) {
      case 'create_event':
        return await this.calendarService.createEventFromText(originalText, userId);
      
      case 'add_reminder':
        return await reminderService.processReminderCommand(originalText, userId);
      
      case 'create_note':
        return await noteService.processNoteCommand(originalText, userId);
      
      case 'send_email':
      case 'read_email':
        return {
          success: false,
          spokenResponse: "I'll be able to handle emails for you soon.",
          displayText: 'Email functionality coming soon'
        };
      
      default:
        return {
          success: false,
          spokenResponse: "I couldn't process that command. Please try again.",
          displayText: 'Unknown command'
        };
    }
  }

  /**
   * Generate a natural clarification prompt
   */
  private async generateClarificationPrompt(
    understanding: any,
    clarificationNeeded: string[]
  ): Promise<string> {
    if (clarificationNeeded.length === 0) {
      return "I didn't quite catch that. Could you please repeat?";
    }

    const systemPrompt = `Generate a natural, conversational clarification request.
    
    User said: "${understanding.originalText}"
    Clarification needed: ${clarificationNeeded.join(', ')}
    
    Be friendly and helpful. Keep it brief and natural.`;

    try {
      const response = await this.llmService.generateCompletion({
        prompt: 'Generate clarification prompt',
        systemPrompt,
        complexity: 'low'
      });
      
      return response.content.trim();
    } catch {
      return `I need to clarify: ${clarificationNeeded[0]}`;
    }
  }

  /**
   * Apply a learned pattern from previous corrections
   */
  private async applyLearnedPattern(
    understanding: any,
    context: ConversationContext
  ): Promise<string> {
    // Find matching pattern
    const pattern = context.learningPatterns.find(p => 
      p.input.toLowerCase() === understanding.originalText.toLowerCase()
    );

    if (pattern) {
      return pattern.correctedOutput;
    }

    return 'Processing your request based on previous preferences.';
  }

  /**
   * Handle user corrections and learn from them
   */
  async handleCorrection(
    sessionId: string,
    correction: {
      originalIntent: string;
      correctedIntent: string;
      originalSlots: Record<string, any>;
      correctedSlots: Record<string, any>;
      alwaysApply: boolean;
    }
  ): Promise<VoiceResponse> {
    const context = this.conversationStore.get(sessionId);
    if (!context) {
      return {
        action: 'error',
        response: {
          speak: 'Session not found. Please try again.'
        },
        metadata: {
          intent: 'none',
          confidence: 'low',
          requiresConfirmation: false,
          sessionId
        }
      };
    }

    // Learn from the correction
    if (correction.alwaysApply && context.userProfile) {
      context.userProfile.correctionHistory.push({
        originalIntent: correction.originalIntent,
        correctedIntent: correction.correctedIntent,
        context: this.getRecentContext(context),
        applyAlways: true
      });

      // Save to database
      await this.saveUserProfile(context.userProfile);
    }

    // Apply the correction and execute
    const understanding = {
      intent: correction.correctedIntent,
      entities: correction.correctedSlots,
      originalText: this.getLastUserMessage(context)
    };

    const result = await this.executeCommand(understanding);

    return {
      action: 'execute',
      response: {
        speak: `Got it. I've applied your correction and will remember this for next time. ${result.spokenResponse}`
      },
      metadata: {
        intent: correction.correctedIntent,
        entities: correction.correctedSlots,
        confidence: 'high',
        requiresConfirmation: false,
        sessionId
      }
    };
  }

  // Helper methods

  private async getOrCreateContext(
    sessionId: string,
    userId: string
  ): Promise<ConversationContext> {
    let context = this.conversationStore.get(sessionId);
    
    if (!context) {
      const userProfile = await this.loadUserProfile(userId);
      const patterns = await this.loadUserPatterns(userId);
      
      context = {
        sessionId,
        userId,
        history: [],
        userProfile,
        learningPatterns: patterns,
        currentTurn: 0
      };
      
      this.conversationStore.set(sessionId, context);
    }
    
    context.currentTurn++;
    return context;
  }

  private addToHistory(
    context: ConversationContext,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ) {
    context.history.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });

    // Keep only last 10 messages for context window
    if (context.history.length > 10) {
      context.history = context.history.slice(-10);
    }
  }

  private formatHistory(history: Message[]): string {
    if (history.length === 0) return 'No previous conversation';
    
    return history
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  private formatPatterns(patterns: Pattern[]): string {
    if (patterns.length === 0) return 'No learned patterns';
    
    return patterns
      .map(p => `"${p.input}" → "${p.correctedOutput}" (${p.frequency} times)`)
      .join('\n');
  }

  private cleanJsonResponse(content: string): string {
    // Remove any thinking tags or extra text
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Find JSON object
    const jsonMatch = cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    
    throw new Error('No valid JSON found in response');
  }

  private getRecentContext(context: ConversationContext): string {
    return this.formatHistory(context.history.slice(-3));
  }

  private getLastUserMessage(context: ConversationContext): string {
    const userMessages = context.history.filter(m => m.role === 'user');
    return userMessages[userMessages.length - 1]?.content || '';
  }

  private async saveContext(context: ConversationContext) {
    if (!this.supabase) return;
    
    try {
      await this.supabase
        .from('conversation_sessions')
        .upsert({
          session_id: context.sessionId,
          user_id: context.userId,
          history: context.history,
          current_turn: context.currentTurn,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to save context:', error);
    }
  }

  private async loadUserProfile(userId: string): Promise<UserProfile | undefined> {
    if (!this.supabase) return undefined;
    
    try {
      const { data } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      return data;
    } catch {
      return undefined;
    }
  }

  private async loadUserPatterns(userId: string): Promise<Pattern[]> {
    if (!this.supabase) return [];
    
    try {
      const { data } = await this.supabase
        .from('learning_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('frequency', { ascending: false })
        .limit(20);
      
      return data || [];
    } catch {
      return [];
    }
  }

  private async saveUserProfile(profile: UserProfile) {
    if (!this.supabase) return;
    
    try {
      await this.supabase
        .from('user_profiles')
        .upsert({
          user_id: profile.userId,
          preferences: profile.preferences,
          correction_history: profile.correctionHistory,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  }
}

export default LLMOrchestrator;