/**
 * Intent Classification Service
 * Leverages existing UnifiedLLMService for immediate accuracy
 * Progressive enhancement with TF.js and learning capabilities
 */

import { UnifiedLLMService } from './unified-llm-service';
import * as chrono from 'chrono-node';
import { createClient } from '@supabase/supabase-js';

export interface IntentResult {
  intent: string;
  confidence: number;
  slots: Record<string, any>;
  llmFallback?: boolean;
  needsConfirmation?: boolean;
}

export interface UserCorrection {
  originalText: string;
  predictedIntent: string;
  correctedIntent: string;
  predictedSlots: Record<string, any>;
  correctedSlots: Record<string, any>;
}

export class IntentService {
  private supabase;
  private intentRegistry: any;
  private knnIndex: Map<string, any[]> = new Map();
  private centroids: Map<string, number[]> = new Map();

  constructor(
    private llmService: UnifiedLLMService
  ) {
    // Initialize Supabase for learning storage
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing. Please check SUPABASE_URL and SUPABASE_ANON_KEY in .env');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // Load intent registry
    this.loadIntentRegistry();
    this.loadKNNIndex();
  }

  /**
   * Main classification method - uses LLM initially, can be enhanced with TF.js
   */
  async classifyIntent(text: string): Promise<IntentResult> {
    // Step 1: Try kNN lookup for high-confidence matches
    const knnResult = await this.knnClassify(text);
    if (knnResult && knnResult.confidence > 0.85) {
      return knnResult;
    }

    // Step 2: Use LLM for classification (immediate high accuracy)
    const llmResult = await this.llmClassify(text);
    
    // Step 3: Extract slots using multiple methods
    const slots = await this.extractSlots(text, llmResult.intent);
    
    // Step 4: Validate and adjust confidence
    const finalResult = {
      ...llmResult,
      slots,
      needsConfirmation: llmResult.confidence < 0.65
    };

    // Step 5: Store for learning (async, non-blocking)
    this.storeForLearning(text, finalResult);

    return finalResult;
  }

  /**
   * LLM-based classification with structured prompting
   */
  private async llmClassify(text: string): Promise<IntentResult> {
    const systemPrompt = `You are an intent classifier for a personal assistant.
    Classify the user's request into one of these intents:
    - create_event: scheduling calendar events, meetings, appointments
    - add_reminder: setting reminders, alerts, notifications
    - create_note: taking notes, saving thoughts, documenting
    - read_email: checking, reading, searching emails
    - send_email: composing, sending, replying to emails
    - none: anything else
    
    Also extract relevant slots:
    - title: event/reminder/note title
    - datetime_point: specific date/time (ISO-8601)
    - datetime_range: start and end times
    - duration_min: duration in minutes
    - email_to: recipient emails
    - email_subject: email subject
    - email_body: email content
    - note_body: note content
    - reminder_text: what to be reminded about
    
    Respond in JSON format:
    {
      "intent": "string",
      "confidence": 0.0-1.0,
      "slots": {}
    }`;

    try {
      const response = await this.llmService.generateCompletion({
        prompt: `Classify this request: "${text}"`,
        systemPrompt,
        responseFormat: 'json',
        complexity: 'low', // Use fast model for classification
        maxTokens: 200
      });

      // Clean response content of any thinking tags (from DeepSeek models)
      let cleanContent = response.content;
      if (cleanContent.includes('<think>')) {
        cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
      }
      
      const parsed = JSON.parse(cleanContent);
      return {
        ...parsed,
        llmFallback: true
      };
    } catch (error) {
      console.error('LLM classification failed:', error);
      // Fallback to simple rule-based classification
      return this.ruleBasedClassify(text);
    }
  }

  /**
   * kNN-based classification using stored embeddings
   */
  private async knnClassify(text: string): Promise<IntentResult | null> {
    // This will be implemented when embeddings are available
    // For now, check exact matches in correction history
    const { data } = await this.supabase
      .from('intent_corrections')
      .select('corrected_intent, corrected_slots')
      .eq('original_text', text)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return {
        intent: data[0].corrected_intent,
        confidence: 0.95, // High confidence for exact matches
        slots: data[0].corrected_slots || {}
      };
    }

    return null;
  }

  /**
   * Rule-based fallback classifier
   */
  private ruleBasedClassify(text: string): IntentResult {
    const lower = text.toLowerCase();
    
    // Simple keyword matching
    if (lower.match(/\b(schedule|meeting|appointment|calendar|book)\b/)) {
      return { intent: 'create_event', confidence: 0.7, slots: {} };
    }
    if (lower.match(/\b(remind|reminder|ping|alert|nudge)\b/)) {
      return { intent: 'add_reminder', confidence: 0.7, slots: {} };
    }
    if (lower.match(/\b(note|jot|write down|save|capture|document)\b/)) {
      return { intent: 'create_note', confidence: 0.7, slots: {} };
    }
    if (lower.match(/\b(check|read|show|list|scan).*\b(email|mail|message|inbox)\b/)) {
      return { intent: 'read_email', confidence: 0.7, slots: {} };
    }
    if (lower.match(/\b(send|email|compose|draft|write|reply|forward)\b.*\b(email|message|mail)\b/)) {
      return { intent: 'send_email', confidence: 0.7, slots: {} };
    }

    return { intent: 'none', confidence: 0.5, slots: {} };
  }

  /**
   * Multi-method slot extraction
   */
  private async extractSlots(text: string, intent: string): Promise<Record<string, any>> {
    const slots: Record<string, any> = {};

    // Extract datetime using chrono-node
    const chronoResults = chrono.parse(text, new Date(), { forwardDate: true });
    if (chronoResults.length > 0) {
      const first = chronoResults[0];
      if (first.start && first.end) {
        slots.datetime_range = {
          start: first.start.date().toISOString(),
          end: first.end.date().toISOString()
        };
      } else if (first.start) {
        slots.datetime_point = first.start.date().toISOString();
      }
    }

    // Extract emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails) {
      if (intent === 'send_email') {
        slots.email_to = emails;
      } else if (intent === 'read_email') {
        slots.email_from = emails[0];
      }
    }

    // Extract duration
    const durationMatch = text.match(/(\d+)\s*(hour|hr|minute|min)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      slots.duration_min = unit.includes('hour') ? value * 60 : value;
    }

    // Intent-specific extraction
    switch (intent) {
      case 'create_event':
        // Extract title (text before/after time expressions)
        const eventTitle = this.extractTitle(text, chronoResults);
        if (eventTitle) slots.title = eventTitle;
        break;

      case 'add_reminder':
        // Extract what to be reminded about
        const reminderText = text.replace(/^(remind|ping|alert|nudge)\s+(me\s+)?(to\s+)?/i, '')
                                 .replace(/\s+(at|on|in|tomorrow|today|next).*$/i, '');
        if (reminderText) slots.reminder_text = reminderText;
        break;

      case 'create_note':
        // Extract note body
        const noteBody = text.replace(/^(make a |create a |add a )?(note|jot down|save|capture):?\s*/i, '');
        if (noteBody) slots.note_body = noteBody;
        break;

      case 'send_email':
        // Extract subject and body
        const subjectMatch = text.match(/subject[:\s]+([^,]+)/i);
        if (subjectMatch) slots.email_subject = subjectMatch[1].trim();
        
        const bodyMatch = text.match(/body[:\s]+(.+)$/i);
        if (bodyMatch) slots.email_body = bodyMatch[1].trim();
        break;
    }

    return slots;
  }

  /**
   * Extract event title from text
   */
  private extractTitle(text: string, chronoResults: any[]): string | null {
    let cleanText = text;
    
    // Remove time expressions
    chronoResults.forEach(result => {
      cleanText = cleanText.replace(result.text, '');
    });

    // Remove common prefixes
    cleanText = cleanText.replace(/^(schedule|book|add|create|set up)\s+(a\s+)?/i, '');
    
    // Remove filler words
    cleanText = cleanText.replace(/\s+(for|on|at|with|in)\s*$/i, '');
    
    cleanText = cleanText.trim();
    
    return cleanText || null;
  }

  /**
   * Store classification for future learning
   */
  private async storeForLearning(text: string, result: IntentResult) {
    try {
      // Store in a lightweight cache for batch processing
      await this.supabase
        .from('intent_predictions')
        .insert({
          original_text: text,
          predicted_intent: result.intent,
          predicted_confidence: result.confidence,
          predicted_slots: result.slots,
          model_version: 'v1.0',
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to store for learning:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Learn from user correction
   */
  async learnFromCorrection(correction: UserCorrection): Promise<void> {
    // Store correction
    await this.supabase
      .from('intent_corrections')
      .insert({
        ...correction,
        correction_type: 'both',
        model_version: 'v1.0',
        applied_immediately: true
      });

    // Update kNN index immediately (in-memory)
    if (!this.knnIndex.has(correction.correctedIntent)) {
      this.knnIndex.set(correction.correctedIntent, []);
    }
    this.knnIndex.get(correction.correctedIntent)!.push({
      text: correction.originalText,
      slots: correction.correctedSlots
    });

    // TODO: Update centroids when embeddings are available
    // TODO: Trigger background retraining if threshold met
  }

  /**
   * Load intent registry from config
   */
  private async loadIntentRegistry() {
    // In production, this would load from the JSON file
    // For now, using a simplified version
    this.intentRegistry = {
      intents: ['create_event', 'add_reminder', 'create_note', 'read_email', 'send_email'],
      confidenceThreshold: 0.65
    };
  }

  /**
   * Get classification statistics
   */
  async getClassificationStats(): Promise<any> {
    try {
      // Get recent predictions
      const { data: predictions } = await this.supabase
        .from('intent_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Get recent corrections
      const { data: corrections } = await this.supabase
        .from('intent_corrections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const totalPredictions = predictions?.length || 0;
      const totalCorrections = corrections?.length || 0;
      const accuracy = totalPredictions > 0 
        ? ((totalPredictions - totalCorrections) / totalPredictions) * 100
        : 0;

      return {
        totalPredictions,
        totalCorrections,
        accuracy: accuracy.toFixed(2),
        knnIndexSize: Array.from(this.knnIndex.values()).reduce((sum, arr) => sum + arr.length, 0),
        loadedIntents: this.intentRegistry?.intents || []
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalPredictions: 0,
        totalCorrections: 0,
        accuracy: 0,
        knnIndexSize: 0,
        loadedIntents: []
      };
    }
  }

  /**
   * Load kNN index from database
   */
  private async loadKNNIndex() {
    const { data } = await this.supabase
      .from('intent_corrections')
      .select('original_text, corrected_intent, corrected_slots')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) {
      data.forEach(item => {
        if (!this.knnIndex.has(item.corrected_intent)) {
          this.knnIndex.set(item.corrected_intent, []);
        }
        this.knnIndex.get(item.corrected_intent)!.push({
          text: item.original_text,
          slots: item.corrected_slots
        });
      });
    }
  }
}

export default IntentService;