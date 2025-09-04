/**
 * Voice Processor - Aligned with OVERVIEW.md Phase 1
 * Uses rules + TF-IDF + kNN memory with immediate learning
 * Confidence gates: <0.81 confirm, ≥0.91 auto-execute
 */

import { IntentClassificationService, IntentResult } from './intent-classification-service';
import { CalendarService } from './calendar-service';
import { reminderService } from './reminder-service';
import { noteService } from './note-service';
import { createClient } from '@supabase/supabase-js';

// Keep these interfaces - they're good!
export interface VoiceResponse {
  action: 'execute' | 'confirm' | 'clarify' | 'error';
  response: {
    speak: string;
    display?: string;
    options?: string[];
  };
  metadata: {
    intent: string;
    entities?: Record<string, any>;
    confidence: number;  // Keep numeric for MVP
    confidenceLevel: 'high' | 'medium' | 'low';  // Add semantic
    requiresConfirmation: boolean;
    sessionId: string;
    predictionId?: string;
  };
}

interface ConversationSession {
  sessionId: string;
  userId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    metadata?: any;
  }>;
}

export class VoiceService {
  private intentService: IntentClassificationService;
  private calendarService: CalendarService;
  private supabase: any;
  private sessions: Map<string, ConversationSession> = new Map();
  
  // MVP thresholds from OVERVIEW.md
  private readonly CONFIRM_THRESHOLD = 0.81;
  private readonly AUTO_EXECUTE_THRESHOLD = 0.91;

  constructor(intentService: IntentClassificationService) {
    this.intentService = intentService;
    this.calendarService = new CalendarService(intentService);
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Process voice intent with confidence-based execution
   */
  async processVoiceIntent(
    text: string,
    sessionId: string,
    userId: string
  ): Promise<VoiceResponse> {
    try {
      // 1. Get or create session (keep for future)
      const session = this.getOrCreateSession(sessionId, userId);
      this.addToSession(session, 'user', text);
      
      // 2. Use existing IntentClassificationService (rules + kNN + TF-IDF)
      const intentResult = await this.intentService.classifyIntent(text);
      
      // 3. Apply MVP confidence gates from OVERVIEW.md
      let action: VoiceResponse['action'];
      
      if (intentResult.confidence < this.CONFIRM_THRESHOLD) {
        action = 'confirm';
      } else if (intentResult.confidence >= this.AUTO_EXECUTE_THRESHOLD) {
        action = 'execute';
      } else {
        // Between 0.81 and 0.91 - still confirm to be safe
        action = 'confirm';
      }
      
      // 4. Generate appropriate response
      const response = await this.generateResponse(action, intentResult, text, userId);
      
      // 5. Log for learning (Phase 1 requirement: store everything)
      this.addToSession(session, 'assistant', response.response.speak, {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        action
      });
      
      // Store session for future learning
      await this.saveSession(session);
      
      return response;
      
    } catch (error) {
      console.error('Voice processing error:', error);
      return {
        action: 'error',
        response: {
          speak: "I'm sorry, I couldn't process that command. Please try again.",
        },
        metadata: {
          intent: 'none',
          entities: {},
          confidence: 0,
          confidenceLevel: 'low',
          requiresConfirmation: false,
          sessionId
        }
      };
    }
  }

  /**
   * Generate response based on action and intent
   */
  private async generateResponse(
    action: VoiceResponse['action'],
    intentResult: IntentResult,
    originalText: string,
    userId: string
  ): Promise<VoiceResponse> {
    const confidenceLevel = this.getConfidenceLevel(intentResult.confidence);
    
    const baseMetadata = {
      intent: intentResult.intent,
      entities: intentResult.slots,
      confidence: intentResult.confidence,
      confidenceLevel,
      requiresConfirmation: action === 'confirm',
      sessionId: '',
      predictionId: intentResult.metadata?.predictionId
    };

    switch (action) {
      case 'execute':
        const result = await this.executeCommand(intentResult, originalText, userId);
        return {
          action: 'execute',
          response: {
            speak: result.spokenResponse || 'Command executed successfully.',
            display: result.displayText
          },
          metadata: baseMetadata
        };

      case 'confirm':
        return {
          action: 'confirm',
          response: {
            speak: this.generateConfirmationMessage(intentResult, originalText),
            options: ['Yes', 'No', 'Correct this']
          },
          metadata: baseMetadata
        };

      case 'clarify':
        return {
          action: 'clarify',
          response: {
            speak: "I didn't quite understand that. Could you please rephrase?",
            options: ['Try again', 'Type instead']
          },
          metadata: baseMetadata
        };

      default:
        return {
          action: 'error',
          response: {
            speak: 'Something went wrong. Please try again.'
          },
          metadata: baseMetadata
        };
    }
  }

  /**
   * Execute the actual command
   */
  private async executeCommand(
    intentResult: IntentResult,
    originalText: string,
    userId: string
  ): Promise<any> {
    const { intent /*, slots*/ } = intentResult; // slots unused - may be used in future enhancements

    switch (intent) {
      case 'create_event':
        return await this.calendarService.createEventFromText(originalText, userId);
      
      case 'add_reminder':
        return await reminderService.processReminderCommand(originalText, userId);
      
      case 'create_note':
        return await noteService.processNoteCommand(originalText, userId);
      
      case 'send_email':
      case 'read_email':
        // Phase 2 feature
        return {
          success: false,
          spokenResponse: "Email functionality will be available soon.",
          displayText: 'Email coming in Phase 2'
        };
      
      default:
        return {
          success: false,
          spokenResponse: "I couldn't process that command.",
          displayText: 'Unknown command'
        };
    }
  }

  /**
   * Generate natural confirmation message
   */
  private generateConfirmationMessage(
    intentResult: IntentResult,
    originalText: string
  ): string {
    const { intent, slots, confidence } = intentResult;
    
    // Use confidence level to adjust message
    const prefix = confidence < 0.7 
      ? "I think you want to " 
      : "Should I ";
    
    switch (intent) {
      case 'create_event':
        const time = slots.datetime_point ? 
          new Date(slots.datetime_point).toLocaleString() : 'the specified time';
        return `${prefix}schedule "${slots.title || 'an event'}" for ${time}?`;
      
      case 'add_reminder':
        return `${prefix}set a reminder: "${slots.reminder_text || originalText}"?`;
      
      case 'create_note':
        return `${prefix}create a note with this text?`;
      
      default:
        return `${prefix}${originalText}. Is that correct?`;
    }
  }

  /**
   * Handle user corrections - immediate learning per OVERVIEW.md
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
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        action: 'error',
        response: {
          speak: 'Session not found. Please try again.'
        },
        metadata: {
          intent: 'none',
          entities: {},
          confidence: 0,
          confidenceLevel: 'low',
          requiresConfirmation: false,
          sessionId
        }
      };
    }

    // Apply immediate learning (updates kNN index)
    await this.intentService.learnFromCorrection({
      originalText: this.getLastUserMessage(session),
      predictedIntent: correction.originalIntent,
      correctedIntent: correction.correctedIntent,
      predictedSlots: correction.originalSlots,
      correctedSlots: correction.correctedSlots
    });

    // Execute with corrected intent
    const correctedResult: IntentResult = {
      intent: correction.correctedIntent,
      confidence: 0.95, // High confidence after correction
      slots: correction.correctedSlots
    };

    const result = await this.executeCommand(
      correctedResult,
      this.getLastUserMessage(session),
      session.userId
    );

    return {
      action: 'execute',
      response: {
        speak: `Got it! I'll remember that. ${result.spokenResponse}`,
        display: result.displayText
      },
      metadata: {
        intent: correction.correctedIntent,
        entities: correction.correctedSlots,
        confidence: 0.95,
        confidenceLevel: 'high',
        requiresConfirmation: false,
        sessionId
      }
    };
  }

  // Helper methods
  private getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= this.AUTO_EXECUTE_THRESHOLD) return 'high';
    if (confidence >= this.CONFIRM_THRESHOLD) return 'medium';
    return 'low';
  }

  private getOrCreateSession(sessionId: string, userId: string): ConversationSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        userId,
        messages: []
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  private addToSession(session: ConversationSession, role: 'user' | 'assistant', content: string, metadata?: any) {
    session.messages.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });
    
    // Keep only last 10 messages for memory efficiency
    if (session.messages.length > 10) {
      session.messages = session.messages.slice(-10);
    }
  }

  private getLastUserMessage(session: ConversationSession): string {
    const userMessages = session.messages.filter(m => m.role === 'user');
    return userMessages[userMessages.length - 1]?.content || '';
  }

  private async saveSession(session: ConversationSession) {
    if (!this.supabase) return;
    
    try {
      // Store everything for learning (Phase 1 requirement)
      await this.supabase
        .from('conversation_sessions')
        .upsert({
          session_id: session.sessionId,
          user_id: session.userId,
          messages: session.messages,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }
}

export default VoiceService;