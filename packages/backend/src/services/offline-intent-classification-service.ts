/**
 * Offline Intent Classification Service
 * Uses ONLY local Ollama models for intent classification
 * Simple, fast, and completely offline
 */

import { llmService } from './llm-service-local';
import * as chrono from 'chrono-node';

export interface IntentResult {
  intent: string;
  confidence: number;
  slots: Record<string, any>;
  model: string;
  responseTime: number;
}

export class OfflineIntentClassificationService {
  // Simple rule-based patterns for fast, common cases
  private readonly patterns = {
    create_event: /\b(schedule|meeting|appointment|event|calendar)\b/i,
    add_reminder: /\b(remind|reminder|ping|nudge|alert)\b/i,
    create_note: /\b(note|notes|write down|capture|jot|memo)\b/i,
    send_email: /\b(send|email|mail|compose|write to)\b/i,
    read_email: /\b(read|check|show|list|view).*(email|mail|message|inbox)\b/i,
  };

  /**
   * Classify user intent using hybrid approach:
   * 1. Try rule-based patterns first (fastest)
   * 2. Fall back to local LLM if no clear match
   */
  async classifyIntent(text: string): Promise<IntentResult> {
    const startTime = Date.now();
    
    // Step 1: Try rule-based classification (instant)
    const ruleIntent = this.classifyWithRules(text);
    if (ruleIntent && ruleIntent.confidence > 0.8) {
      return {
        ...ruleIntent,
        model: 'rules',
        responseTime: Date.now() - startTime
      };
    }

    // Step 2: Use local LLM for classification
    try {
      const intent = await llmService.classifyIntent(text);
      
      // Extract slots based on intent
      const slots = await this.extractSlots(text, intent);
      
      return {
        intent,
        confidence: 0.9, // LLM classification is generally reliable
        slots,
        model: 'ollama',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('LLM classification failed:', error);
      
      // Return rule-based result if available, or unknown
      if (ruleIntent) {
        return {
          ...ruleIntent,
          model: 'rules-fallback',
          responseTime: Date.now() - startTime
        };
      }
      
      return {
        intent: 'unknown',
        confidence: 0,
        slots: {},
        model: 'failed',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Rule-based classification for common patterns
   */
  private classifyWithRules(text: string): { intent: string; confidence: number; slots: Record<string, any> } | null {
    const normalizedText = text.toLowerCase();
    
    // Check each pattern
    for (const [intent, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(normalizedText)) {
        // Extract basic slots with rules
        const slots = this.extractSlotsWithRules(text, intent);
        
        // Higher confidence for more specific patterns
        let confidence = 0.7;
        if (intent === 'add_reminder' && /\bremind me\b/i.test(text)) {
          confidence = 0.95;
        } else if (intent === 'create_event' && /\b(schedule|meeting)\b/i.test(text)) {
          confidence = 0.9;
        }
        
        return { intent, confidence, slots };
      }
    }
    
    return null;
  }

  /**
   * Extract slots using a combination of rules and LLM
   */
  private async extractSlots(text: string, intent: string): Promise<Record<string, any>> {
    const slots: Record<string, any> = {};
    
    // Always try to extract datetime with Chrono
    const chronoResult = chrono.parse(text);
    if (chronoResult.length > 0) {
      const date = chronoResult[0];
      if (date && date.start) {
        slots.datetime = date.start.date().toISOString();
        
        // If there's an end time, calculate duration
        if (date.end) {
          const duration = (date.end.date().getTime() - date.start.date().getTime()) / 60000;
          slots.duration_minutes = Math.round(duration);
        }
      }
    }
    
    // Extract other slots with simple rules
    const ruleSlots = this.extractSlotsWithRules(text, intent);
    Object.assign(slots, ruleSlots);
    
    // For complex cases, use LLM for slot extraction
    if (Object.keys(slots).length < 2) {
      try {
        const llmSlots = await llmService.extractSlots(text, intent);
        // Merge LLM slots (but prefer rule-based datetime)
        Object.assign(slots, llmSlots);
        if (chronoResult.length > 0 && slots.datetime) {
          // Keep Chrono's datetime parsing - it's more reliable
          const date = chronoResult[0];
          if (date && date.start) {
            slots.datetime = date.start.date().toISOString();
          }
        }
      } catch (error) {
        console.warn('LLM slot extraction failed, using rules only');
      }
    }
    
    return slots;
  }

  /**
   * Simple rule-based slot extraction
   */
  private extractSlotsWithRules(text: string, intent: string): Record<string, any> {
    const slots: Record<string, any> = {};
    
    // Extract quoted strings as titles
    const quotedMatch = text.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      slots.title = quotedMatch[1];
    }
    
    // Extract email addresses
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      slots.email_to = [emailMatch[0]];
    }
    
    // Extract after keywords for different intents
    if (intent === 'add_reminder' && !slots.title) {
      const reminderMatch = text.match(/remind (?:me )?(?:to |about )?(.*?)(?:at|on|tomorrow|next|\.|$)/i);
      if (reminderMatch && reminderMatch[1]) {
        slots.title = reminderMatch[1].trim();
      }
    }
    
    if (intent === 'create_note' && !slots.title) {
      const noteMatch = text.match(/note:?\s*(.*?)(?:\.|$)/i);
      if (noteMatch && noteMatch[1]) {
        slots.note_body = noteMatch[1].trim();
      }
    }
    
    // Default duration for events
    if (intent === 'create_event' && !slots.duration_minutes) {
      if (/\blunch\b/i.test(text)) {
        slots.duration_minutes = 60;
      } else if (/\bmeeting\b/i.test(text)) {
        slots.duration_minutes = 30;
      }
    }
    
    return slots;
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<any> {
    return await llmService.getStatus();
  }
}

// Export singleton instance
export const intentService = new OfflineIntentClassificationService();