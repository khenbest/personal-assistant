/**
 * Intent Classification Service
 * Leverages existing UnifiedLLMService for immediate accuracy
 * Progressive enhancement with TF.js and learning capabilities
 */

import { UnifiedLLMService } from './unified-llm-service';
import * as chrono from 'chrono-node';
import { createClient } from '@supabase/supabase-js';
import { ClassificationLogger } from './classification-logger';
import { intentCache } from './cache-service';
import { accuracyTracker } from './accuracy-tracking-service';

export interface IntentResult {
  intent: string;
  confidence: number;
  slots: Record<string, any>;
  llmFallback?: boolean;
  needsConfirmation?: boolean;
  metadata?: {
    provider?: string;
    responseTime?: number;
  };
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
  private logger: ClassificationLogger;
  // private centroids: Map<string, number[]> = new Map();

  constructor(
    private llmService: UnifiedLLMService,
    logger?: ClassificationLogger
  ) {
    // Initialize logger for tracking classifications
    this.logger = logger || new ClassificationLogger('v1.0.0');
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
  async classifyIntent(text: string, expectedIntent?: string): Promise<IntentResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = `intent:${text.toLowerCase().trim()}`;
    const cached = intentCache.get(cacheKey);
    if (cached && !expectedIntent) { // Don't use cache during testing
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cached: true,
          responseTime: Date.now() - startTime
        }
      };
    }
    
    try {
      // Step 1: Try kNN lookup for high-confidence matches
      const knnResult = await this.knnClassify(text);
      if (knnResult && knnResult.confidence > 0.6) { // Lowered from 0.85
        // Extract slots for kNN results
        const slots = await this.extractSlots(text, knnResult.intent);
        knnResult.slots = slots;
        
        const responseTime = Date.now() - startTime;
        knnResult.metadata = { responseTime };
        
        // Log if expected intent provided
        if (expectedIntent) {
          await this.logger.logClassification({
            inputText: text,
            expectedIntent,
            actualIntent: knnResult.intent,
            confidenceScore: knnResult.confidence,
            actualSlots: knnResult.slots,
            responseTimeMs: responseTime,
            modelVersion: 'v1.0.0',
            metadata: { source: 'knn' }
          });
        }
        
        // Cache high confidence results
        if (knnResult.confidence > 0.8) {
          intentCache.set(cacheKey, knnResult);
        }
        
        return knnResult;
      }

      // Step 2: Use LLM for classification ONLY if kNN failed
      // Add timeout to prevent 30-60 second waits
      let llmResult: IntentResult | null = null;
      
      try {
        llmResult = await Promise.race([
          this.llmClassify(text),
          new Promise<IntentResult>((_, reject) => 
            setTimeout(() => reject(new Error('LLM timeout')), 1000)
          )
        ]);
      } catch (error: any) {
        console.warn('⚠️ LLM classification failed or timed out:', error.message);
        
        // Return the kNN result if available, even if low confidence
        if (knnResult) {
          const responseTime = Date.now() - startTime;
          return {
            ...knnResult,
            needsConfirmation: true,
            metadata: { responseTime, fallback: 'knn-low-confidence' }
          };
        }
        
        // Last resort: return unknown intent
        return {
          intent: 'none',
          confidence: 0.1,
          slots: {},
          needsConfirmation: true,
          metadata: {
            responseTime: Date.now() - startTime,
            error: 'LLM timeout, no kNN match'
          }
        };
      }
      
      // Step 3: Extract slots using multiple methods
      const slots = await this.extractSlots(text, llmResult.intent);
      
      // Step 4: Validate and adjust confidence
      const responseTime = Date.now() - startTime;
      const finalResult = {
        ...llmResult,
        slots,
        needsConfirmation: llmResult.confidence < 0.65,
        metadata: {
          ...llmResult.metadata,
          responseTime
        }
      };

      // Step 5: Log prediction for accuracy tracking
      const predictionId = await accuracyTracker.logPrediction({
        original_text: text,
        predicted_intent: finalResult.intent,
        predicted_confidence: finalResult.confidence,
        predicted_slots: finalResult.slots,
        model_version: 'v1.0.0',
        response_time_ms: responseTime
      });
      
      // Store predictionId in result for potential corrections
      if (predictionId) {
        finalResult.metadata = {
          ...finalResult.metadata,
          predictionId
        };
      }

      // Step 6: Log classification if expected intent provided (for testing)
      if (expectedIntent) {
        await this.logger.logClassification({
          inputText: text,
          expectedIntent,
          actualIntent: finalResult.intent,
          confidenceScore: finalResult.confidence,
          actualSlots: finalResult.slots,
          responseTimeMs: responseTime,
          modelVersion: 'v1.0.0',
          metadata: finalResult.metadata
        });
      }

      // Step 6: Store for learning (async, non-blocking)
      this.storeForLearning(text, finalResult);

      // Cache the result
      intentCache.set(cacheKey, finalResult);

      return finalResult;
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // Log error if expected intent provided
      if (expectedIntent) {
        await this.logger.logClassification({
          inputText: text,
          expectedIntent,
          actualIntent: null,
          confidenceScore: 0,
          responseTimeMs: responseTime,
          modelVersion: 'v1.0.0',
          errorMessage: error.message
        });
      }
      
      throw error;
    }
  }

  /**
   * LLM-based classification with structured prompting
   */
  private async llmClassify(text: string): Promise<IntentResult> {
    const systemPrompt = `You are an intent classifier for a personal assistant.
    
    IMPORTANT: Output ONLY valid JSON. Do not include any thinking, explanation, or other text.
    
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
    
    Output exactly this JSON structure with no additional text:
    {
      "intent": "string",
      "confidence": 0.0-1.0,
      "slots": {}
    }`;

    try {
      const response = await this.llmService.generateCompletion({
        prompt: `Classify this request: "${text}"\n\nRespond with JSON only:`,
        systemPrompt,
        responseFormat: 'json',
        complexity: 'low', // Use fast model for classification
        maxTokens: 1000 // Slightly increased to ensure full JSON output
      });

      // Clean response content of any thinking tags (from DeepSeek models)
      let cleanContent = response.content;
      
      // Remove <think> tags and their content
      cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/gi, '');
      
      // Try to find JSON in the response
      // First try to find a complete JSON object
      let jsonMatch = cleanContent.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      
      // If no match, try a more aggressive pattern
      if (!jsonMatch) {
        // Look for anything that starts with { and ends with }
        const startIdx = cleanContent.indexOf('{');
        const endIdx = cleanContent.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          const possibleJson = cleanContent.substring(startIdx, endIdx + 1);
          try {
            JSON.parse(possibleJson); // Test if it's valid
            jsonMatch = [possibleJson];
          } catch {
            // Not valid JSON
          }
        }
      }
      
      if (!jsonMatch) {
        console.error('No JSON found in LLM response:', cleanContent.substring(0, 200));
        throw new Error('Invalid JSON response from LLM');
      }
      
      cleanContent = jsonMatch[0];
      
      // Clean up any remaining whitespace
      cleanContent = cleanContent.trim();
      
      const parsed = JSON.parse(cleanContent);
      return {
        ...parsed,
        llmFallback: true,
        metadata: {
          provider: response.provider,
          responseTime: response.responseTime
        }
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
    // First check for exact match
    const normalizedText = text.toLowerCase().trim();
    
    // Check exact matches in kNN index
    for (const [intent, examples] of this.knnIndex) {
      for (const example of examples) {
        if (example.text.toLowerCase().trim() === normalizedText) {
          return {
            intent,
            confidence: 1.0, // Perfect match
            slots: example.slots || {}
          };
        }
      }
    }
    
    // If no exact match, find similar examples using simple string similarity
    const similarities: Array<{ intent: string; similarity: number; slots: any }> = [];
    
    for (const [intent, examples] of this.knnIndex) {
      for (const example of examples) {
        const similarity = this.calculateSimilarity(normalizedText, example.text.toLowerCase().trim());
        if (similarity > 0.5) { // Only consider reasonably similar examples
          similarities.push({
            intent,
            similarity,
            slots: example.slots || {}
          });
        }
      }
    }
    
    // Sort by similarity and get top matches
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    if (similarities.length === 0) {
      return null;
    }
    
    // Get the most common intent among top 5 matches
    const topK = similarities.slice(0, 5);
    const intentVotes = new Map<string, number>();
    
    for (const match of topK) {
      const votes = intentVotes.get(match.intent) || 0;
      intentVotes.set(match.intent, votes + match.similarity);
    }
    
    // Find intent with highest weighted votes
    let bestIntent = 'none';
    let bestScore = 0;
    
    for (const [intent, score] of intentVotes) {
      if (score > bestScore) {
        bestIntent = intent;
        bestScore = score;
      }
    }
    
    // Calculate confidence based on similarity and consensus
    const avgSimilarity = topK.reduce((sum, m) => sum + m.similarity, 0) / topK.length;
    const consensus = (intentVotes.get(bestIntent) || 0) / topK.reduce((sum, m) => sum + m.similarity, 0);
    const confidence = avgSimilarity * consensus;
    
    return {
      intent: bestIntent,
      confidence: Math.min(confidence, 0.95), // Cap at 0.95 for non-exact matches
      slots: topK[0]?.slots || {}
    };
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    // Normalize and tokenize
    const normalize = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')  // Remove punctuation
        .replace(/\s+/g, ' ')       // Normalize whitespace
        .trim();
    };
    
    const text1 = normalize(str1);
    const text2 = normalize(str2);
    
    // If strings are identical after normalization
    if (text1 === text2) return 1.0;
    
    // Get tokens
    const tokens1 = text1.split(' ').filter(t => t.length > 0);
    const tokens2 = text2.split(' ').filter(t => t.length > 0);
    
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    // Calculate token overlap with position weighting
    let score = 0;
    const maxScore = Math.max(tokens1.length, tokens2.length);
    
    // Exact token matches
    for (let i = 0; i < tokens1.length; i++) {
      for (let j = 0; j < tokens2.length; j++) {
        if (tokens1[i] === tokens2[j]) {
          // Higher score for matching positions
          const positionBonus = 1 - Math.abs(i - j) / Math.max(tokens1.length, tokens2.length);
          score += 1 + (positionBonus * 0.5);
        }
      }
    }
    
    // Check for important keywords (intent indicators)
    const intentKeywords = {
      'create_event': ['schedule', 'meeting', 'appointment', 'calendar', 'book', 'event'],
      'add_reminder': ['remind', 'reminder', 'ping', 'alert', 'nudge'],
      'create_note': ['note', 'jot', 'write', 'save', 'capture', 'document'],
      'read_email': ['check', 'read', 'show', 'list', 'email', 'mail', 'inbox'],
      'send_email': ['send', 'email', 'compose', 'draft', 'reply', 'forward']
    };
    
    // Boost score if both texts contain same intent keywords
    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      const hasKeyword1 = keywords.some(k => text1.includes(k));
      const hasKeyword2 = keywords.some(k => text2.includes(k));
      if (hasKeyword1 && hasKeyword2) {
        score += 2; // Significant boost for matching intent keywords
      }
    }
    
    // Normalize score to 0-1 range
    let similarity = score / (maxScore * 1.5); // 1.5 accounts for position and keyword bonuses
    
    // Apply length difference penalty (small penalty for different lengths)
    const lengthRatio = Math.min(tokens1.length, tokens2.length) / Math.max(tokens1.length, tokens2.length);
    similarity = similarity * (0.8 + 0.2 * lengthRatio);
    
    return Math.min(similarity, 1.0);
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
      if (first && first.start && first.end) {
        slots.datetime_range = {
          start: first.start.date().toISOString(),
          end: first.end.date().toISOString()
        };
      } else if (first && first.start) {
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
      const value = parseInt(durationMatch[1] || '60');
      const unit = (durationMatch[2] || 'minutes').toLowerCase();
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
        if (subjectMatch && subjectMatch[1]) slots.email_subject = subjectMatch[1].trim();
        
        const bodyMatch = text.match(/body[:\s]+(.+)$/i);
        if (bodyMatch && bodyMatch[1]) slots.email_body = bodyMatch[1].trim();
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
    // First, load training data from CSV files
    await this.loadTrainingData();
    
    // Then load any user corrections from database
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
    
    console.log(`✅ Loaded kNN index with ${this.getTotalExamples()} examples across ${this.knnIndex.size} intents`);
  }
  
  private getTotalExamples(): number {
    let total = 0;
    this.knnIndex.forEach(examples => {
      total += examples.length;
    });
    return total;
  }
  
  private async loadTrainingData() {
    try {
      // Load main training data
      const fs = require('fs').promises;
      const path = require('path');
      const { parse } = require('csv-parse/sync');
      
      // Try multiple paths to find the training data
      const possiblePaths = [
        path.join(__dirname, '../../../data/overview_data/intent_training.csv'),
        path.join(__dirname, '../../../../data/overview_data/intent_training.csv'),
        path.join(process.cwd(), 'data/overview_data/intent_training.csv'),
        '/Users/kenny/repos/personal-assistant/data/overview_data/intent_training.csv'
      ];
      
      let trainingData: any[] = [];
      for (const csvPath of possiblePaths) {
        try {
          const fileContent = await fs.readFile(csvPath, 'utf-8');
          trainingData = parse(fileContent, {
            columns: true,
            skip_empty_lines: true
          });
          console.log(`📚 Loading ${trainingData.length} training examples from ${csvPath}`);
          break;
        } catch (err) {
          // Try next path
          continue;
        }
      }
      
      if (trainingData.length === 0) {
        console.warn('⚠️ No training data found. kNN will only use corrections.');
        return;
      }
      
      // Add training examples to kNN index
      for (const example of trainingData) {
        const intent = example.intent;
        if (!this.knnIndex.has(intent)) {
          this.knnIndex.set(intent, []);
        }
        this.knnIndex.get(intent)!.push({
          text: example.text,
          slots: {} // Training data doesn't have slots, will be extracted
        });
      }
      
    } catch (error) {
      console.error('❌ Error loading training data:', error);
    }
  }

  /**
   * Apply user correction and update learning
   */
  async applyCorrection(
    predictionId: string,
    correction: UserCorrection,
    userId?: string
  ): Promise<boolean> {
    try {
      // Log the correction
      const success = await accuracyTracker.logCorrection({
        prediction_id: predictionId,
        user_id: userId,
        original_text: correction.originalText,
        predicted_intent: correction.predictedIntent,
        predicted_slots: correction.predictedSlots,
        corrected_intent: correction.correctedIntent,
        corrected_slots: correction.correctedSlots,
        correction_type: 'manual',
        applied_immediately: true
      });

      if (success) {
        // Update KNN index immediately
        this.updateKnnIndex(
          correction.originalText,
          correction.correctedIntent,
          correction.correctedSlots
        );

        console.log('✅ Applied correction:', {
          text: correction.originalText,
          from: correction.predictedIntent,
          to: correction.correctedIntent
        });
      }

      return success;
    } catch (error) {
      console.error('Failed to apply correction:', error);
      return false;
    }
  }

  /**
   * Get accuracy metrics
   */
  async getAccuracyMetrics(hours: number = 24) {
    return accuracyTracker.getAccuracyMetrics(hours);
  }

  /**
   * Get recent classification failures
   */
  async getRecentFailures(limit: number = 10) {
    return accuracyTracker.getRecentFailures(limit);
  }
}

export default IntentService;