/**
 * Advanced Slot Extraction Service
 * Combines chrono-node, winkNLP, and LLM for comprehensive extraction
 */

import * as chrono from 'chrono-node';
import wink from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import { UnifiedLLMService } from './unified-llm-service';

const nlp = wink(model);

export interface ExtractedSlots {
  // Calendar/Reminder slots
  title?: string;
  datetime_point?: string;
  datetime_range?: { start: string; end: string };
  duration_min?: number;
  location?: string;
  attendees?: string[];
  recurring?: string;
  
  // Email slots
  email_to?: string[];
  email_from?: string;
  email_cc?: string[];
  email_subject?: string;
  email_body?: string;
  
  // Note slots
  note_title?: string;
  note_body?: string;
  tags?: string[];
  
  // Meta slots
  confidence?: number;
  ambiguous_fields?: string[];
}

export class SlotExtractionService {
  private llmService: UnifiedLLMService;
  private slotOverrides: Map<string, any> = new Map();
  
  constructor(llmService: UnifiedLLMService) {
    this.llmService = llmService;
    this.loadSlotOverrides();
  }

  /**
   * Main extraction method combining multiple techniques
   */
  async extractSlots(text: string, intent: string): Promise<ExtractedSlots> {
    const slots: ExtractedSlots = {};
    
    // Step 1: Temporal extraction with chrono-node
    const temporalSlots = this.extractTemporal(text);
    Object.assign(slots, temporalSlots);
    
    // Step 2: Entity extraction with winkNLP
    const entitySlots = this.extractEntities(text, intent);
    Object.assign(slots, entitySlots);
    
    // Step 3: Intent-specific extraction
    const specificSlots = await this.extractIntentSpecific(text, intent);
    Object.assign(slots, specificSlots);
    
    // Step 4: Apply user overrides and learned patterns
    this.applyOverrides(slots, text);
    
    // Step 5: LLM validation for ambiguous cases
    if (this.hasAmbiguity(slots, intent)) {
      const llmSlots = await this.llmExtraction(text, intent, slots);
      Object.assign(slots, llmSlots);
    }
    
    return slots;
  }

  /**
   * Temporal extraction using chrono-node
   */
  private extractTemporal(text: string): Partial<ExtractedSlots> {
    const slots: Partial<ExtractedSlots> = {};
    const results = chrono.parse(text, new Date(), { forwardDate: true });
    
    if (results.length > 0) {
      const first = results[0];
      
      // Handle date ranges
      if (first && first.start && first.end) {
        slots.datetime_range = {
          start: first.start.date().toISOString(),
          end: first.end.date().toISOString()
        };
        
        // Calculate duration
        const durationMs = first.end.date().getTime() - first.start.date().getTime();
        slots.duration_min = Math.round(durationMs / 60000);
      } 
      // Handle single points
      else if (first && first.start) {
        slots.datetime_point = first.start.date().toISOString();
        
        // Check for implicit duration
        const durationMatch = text.match(/for\s+(\d+)\s*(hour|hr|minute|min)/i);
        if (durationMatch && durationMatch[1] && durationMatch[2]) {
          const value = parseInt(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          slots.duration_min = unit.includes('hour') ? value * 60 : value;
        }
      }
      
      // Handle recurring patterns
      const recurringPatterns = [
        { pattern: /every\s+(day|daily)/i, value: 'daily' },
        { pattern: /every\s+(week|weekly)/i, value: 'weekly' },
        { pattern: /every\s+(month|monthly)/i, value: 'monthly' },
        { pattern: /every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, value: 'weekly:$1' },
        { pattern: /every\s+weekday/i, value: 'weekdays' },
        { pattern: /every\s+weekend/i, value: 'weekends' }
      ];
      
      for (const { pattern, value } of recurringPatterns) {
        const match = text.match(pattern);
        if (match) {
          slots.recurring = value.replace('$1', match[1]?.toLowerCase() || '');
          break;
        }
      }
    }
    
    return slots;
  }

  /**
   * Entity extraction with winkNLP
   */
  private extractEntities(text: string, intent: string): Partial<ExtractedSlots> {
    const slots: Partial<ExtractedSlots> = {};
    const doc = nlp.readDoc(text);
    
    // Extract emails
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailPattern) || [];
    
    if (emails.length > 0) {
      if (intent === 'send_email') {
        // Parse TO, CC, BCC
        const toMatch = text.match(/to\s+([^,;]+(?:,\s*[^,;]+)*)/i);
        const ccMatch = text.match(/cc\s+([^,;]+(?:,\s*[^,;]+)*)/i);
        
        slots.email_to = toMatch && toMatch[1] ? this.parseEmailList(toMatch[1]) : emails;
        if (ccMatch && ccMatch[1]) {
          slots.email_cc = this.parseEmailList(ccMatch[1]);
        }
      } else if (intent === 'read_email') {
        slots.email_from = emails[0];
      }
    }
    
    // Extract entities (names, organizations)
    const entities = doc.entities().out();
    if (entities.length > 0 && intent === 'create_event') {
      // Try to identify attendees from person entities
      // In WinkNLP, entities are returned as strings when using .out()
      // We'll use the entities directly as potential attendees
      const potentialAttendees = entities.filter(entity => {
        // Check if the entity looks like a name (capitalized words)
        return entity && /^[A-Z][a-z]+ ?[A-Z]?[a-z]*/.test(entity);
      });
      if (potentialAttendees.length > 0) {
        slots.attendees = potentialAttendees;
      }
    }
    
    // Extract hashtags for notes
    if (intent === 'create_note') {
      const hashtags = text.match(/#\w+/g);
      if (hashtags) {
        slots.tags = hashtags.map(tag => tag.substring(1));
      }
    }
    
    return slots;
  }

  /**
   * Intent-specific extraction logic
   */
  private async extractIntentSpecific(text: string, intent: string): Promise<Partial<ExtractedSlots>> {
    const slots: Partial<ExtractedSlots> = {};
    
    switch (intent) {
      case 'create_event':
        // Extract title
        slots.title = this.extractEventTitle(text);
        
        // Extract location
        const locationMatch = text.match(/(?:at|in)\s+([A-Z][^,\s]+(?:\s+[A-Z][^,\s]+)*)/);
        if (locationMatch) {
          slots.location = locationMatch[1];
        }
        
        // Apply duration defaults
        if (!slots.duration_min) {
          slots.duration_min = this.getDefaultDuration(text);
        }
        break;
        
      case 'add_reminder':
        // Extract reminder text
        slots.title = text.replace(/^(remind|ping|alert|nudge)\s+(me\s+)?(to\s+|about\s+)?/i, '')
                          .replace(/\s+(at|on|in|tomorrow|today|next).*$/i, '')
                          .trim();
        break;
        
      case 'create_note':
        // Extract note content
        const noteContent = text.replace(/^(make a |create a |add a )?(note|jot down|save|capture):?\s*/i, '');
        
        // First line as title, rest as body
        const lines = noteContent.split(/[.!?\n]/);
        if (lines.length > 1 && lines[0]) {
          slots.note_title = lines[0].trim();
          slots.note_body = lines.slice(1).join('. ').trim();
        } else {
          slots.note_body = noteContent;
          // Generate title from first few words
          slots.note_title = noteContent.split(' ').slice(0, 5).join(' ');
        }
        break;
        
      case 'send_email':
        // Extract subject
        const subjectMatch = text.match(/(?:subject|re|regarding)[:\s]+([^,.]+)/i);
        if (subjectMatch && subjectMatch[1]) {
          slots.email_subject = subjectMatch[1].trim();
        }
        
        // Extract body
        const bodyMatch = text.match(/(?:body|saying|write|message)[:\s]+(.+)$/i);
        if (bodyMatch && bodyMatch[1]) {
          slots.email_body = bodyMatch[1].trim();
        }
        break;
        
      case 'read_email':
        // Extract search criteria
        const labelMatch = text.match(/(?:in|from|label|folder)\s+([^\s]+)/i);
        if (labelMatch) {
          // Store as custom slot for email filtering
          (slots as any).email_label = labelMatch[1];
        }
        
        // Extract time range
        const timeRanges = {
          'today': 'today',
          'yesterday': 'yesterday',
          'this week': 'this_week',
          'last week': 'last_week',
          'this month': 'this_month'
        };
        
        for (const [phrase, value] of Object.entries(timeRanges)) {
          if (text.toLowerCase().includes(phrase)) {
            (slots as any).time_range = value;
            break;
          }
        }
        break;
    }
    
    return slots;
  }

  /**
   * Extract event title intelligently
   */
  private extractEventTitle(text: string): string {
    // Remove temporal expressions
    const chronoResults = chrono.parse(text);
    let title = text.replace(chronoResults[0]?.text || '', '');
    
    // Remove common prefixes
    title = title.replace(/^(schedule|book|add|create|set up|plan)\s+(a\s+)?/i, '');
    
    // Remove location if present
    title = title.replace(/\s+(at|in)\s+[A-Z][^,\s]+(?:\s+[A-Z][^,\s]+)*/g, '');
    
    // Remove duration
    title = title.replace(/\s+for\s+\d+\s*(hour|minute|min|hr)s?/i, '');
    
    // Clean up
    title = title.replace(/\s+/g, ' ').trim();
    
    // If too short, try alternative extraction
    if (title.length < 3) {
      // Look for quoted text
      const quotedMatch = text.match(/["']([^"']+)["']/);
      if (quotedMatch && quotedMatch[1]) {
        title = quotedMatch[1];
      } else {
        // Use the most important words
        const doc = nlp.readDoc(text);
        const tokens = doc.tokens();
        const nouns = tokens.filter((t: any) => {
          try {
            return t.out() && t.pos() === 'NOUN';
          } catch {
            return false;
          }
        }).out();
        title = Array.isArray(nouns) ? nouns.slice(0, 3).join(' ') : '';
      }
    }
    
    return title || 'Untitled Event';
  }

  /**
   * Get default duration based on event type
   */
  private getDefaultDuration(text: string): number {
    const durationPatterns = [
      { pattern: /\blunch\b/i, duration: 60 },
      { pattern: /\bmeeting\b/i, duration: 60 },
      { pattern: /\bstandup\b/i, duration: 15 },
      { pattern: /\b(1-on-1|one-on-one|1:1)\b/i, duration: 30 },
      { pattern: /\binterview\b/i, duration: 45 },
      { pattern: /\bcoffee\b/i, duration: 30 },
      { pattern: /\b(all-hands|all hands)\b/i, duration: 60 },
      { pattern: /\bworkshop\b/i, duration: 120 },
      { pattern: /\btraining\b/i, duration: 90 },
      { pattern: /\bconference\b/i, duration: 480 } // All day
    ];
    
    for (const { pattern, duration } of durationPatterns) {
      if (pattern.test(text)) {
        return duration;
      }
    }
    
    return 60; // Default 1 hour
  }

  /**
   * Parse email list from text
   */
  private parseEmailList(text: string): string[] {
    const emails: string[] = [];
    
    // Extract actual email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const foundEmails = text.match(emailPattern) || [];
    emails.push(...foundEmails);
    
    // Extract names that might be contacts
    const names = text.split(/[,;]/).map(s => s.trim()).filter(s => s && !s.includes('@'));
    
    // Look up contacts (would connect to contact service)
    for (const name of names) {
      const email = this.resolveContactEmail(name);
      if (email) {
        emails.push(email);
      }
    }
    
    return [...new Set(emails)]; // Remove duplicates
  }

  /**
   * Resolve contact name to email
   */
  private resolveContactEmail(name: string): string | null {
    // This would connect to a contact service
    // For now, use learned mappings
    const contactMap = this.slotOverrides.get('contacts') || {};
    return contactMap[name.toLowerCase()] || null;
  }

  /**
   * Check if extraction has ambiguity
   */
  private hasAmbiguity(slots: ExtractedSlots, intent: string): boolean {
    // Check for required fields
    const requiredFields: Record<string, string[]> = {
      'create_event': ['title', 'datetime_point'],
      'add_reminder': ['title'],
      'create_note': ['note_body'],
      'send_email': ['email_to'],
      'read_email': []
    };
    
    const required = requiredFields[intent] || [];
    const missing = required.filter(field => !slots[field as keyof ExtractedSlots]);
    
    return missing.length > 0 || (slots.confidence !== undefined && slots.confidence < 0.7);
  }

  /**
   * LLM-based extraction for complex cases
   */
  private async llmExtraction(text: string, intent: string, currentSlots: ExtractedSlots): Promise<Partial<ExtractedSlots>> {
    const systemPrompt = `IMPORTANT: Output ONLY valid JSON. Do not include any thinking, explanation, or other text.`;
    
    const prompt = `Extract slots from this ${intent} request: "${text}"
    
    Current extracted slots: ${JSON.stringify(currentSlots, null, 2)}
    
    Please identify and extract any missing or ambiguous fields:
    - title/subject
    - datetime (ISO-8601)
    - duration (minutes)
    - recipients (email addresses)
    - location
    - body/content
    
    Output only the additional or corrected slots as valid JSON:`;
    
    try {
      const response = await this.llmService.generateCompletion({
        prompt,
        systemPrompt,
        responseFormat: 'json',
        complexity: 'low',
        maxTokens: 300
      });
      
      // Clean response content of any thinking tags
      let cleanContent = response.content;
      
      // Remove <think> tags and their content
      cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/gi, '');
      
      // Try to find JSON in the response
      let jsonMatch = cleanContent.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      
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
        console.error('No JSON found in LLM response for slot extraction');
        return {};
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('LLM extraction failed:', error);
      return {};
    }
  }

  /**
   * Apply user overrides and learned patterns
   */
  private applyOverrides(slots: ExtractedSlots, text: string): void {
    // Apply duration overrides
    const durationOverrides = this.slotOverrides.get('durations') || {};
    for (const [pattern, duration] of Object.entries(durationOverrides)) {
      if (text.toLowerCase().includes(pattern)) {
        slots.duration_min = duration as number;
      }
    }
    
    // Apply contact overrides
    const contactOverrides = this.slotOverrides.get('contacts') || {};
    if (slots.attendees) {
      slots.attendees = slots.attendees.map(name => {
        const email = contactOverrides[name.toLowerCase()];
        return email || name;
      });
    }
  }

  /**
   * Load user overrides from storage
   */
  private async loadSlotOverrides(): Promise<void> {
    // Load from Supabase or local storage
    // For now, use defaults from intents_registry.json
    try {
      const registry = require('@kenny-assistant/shared/config/intents_registry.json');
      const overrides = registry.slotOverrides || {};
      
      if (overrides.duration_patterns) {
        this.slotOverrides.set('durations', overrides.duration_patterns);
      }
      
      if (overrides.contact_aliases) {
        this.slotOverrides.set('contacts', overrides.contact_aliases);
      }
    } catch (error) {
      console.error('Failed to load slot overrides:', error);
    }
  }

  /**
   * Learn from correction
   */
  async learnFromCorrection(originalSlots: ExtractedSlots, correctedSlots: ExtractedSlots, text: string): Promise<void> {
    // Identify what was corrected
    const corrections: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(correctedSlots)) {
      if (JSON.stringify(value) !== JSON.stringify(originalSlots[key as keyof ExtractedSlots])) {
        corrections[key] = value;
      }
    }
    
    // Store patterns for future use
    if (corrections.duration_min && text) {
      // Learn duration patterns
      const words = text.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3 && !word.includes('@')) {
          const durations = this.slotOverrides.get('durations') || {};
          durations[word] = corrections.duration_min;
          this.slotOverrides.set('durations', durations);
        }
      }
    }
    
    // Learn contact mappings
    if (corrections.email_to || corrections.attendees) {
      // const contacts = this.slotOverrides.get('contacts') || {};
      // TODO: Store name-to-email mappings
      // Implementation depends on how names are provided
    }
    
    // Persist overrides
    await this.saveSlotOverrides();
  }

  /**
   * Save overrides to storage
   */
  private async saveSlotOverrides(): Promise<void> {
    // Save to Supabase or local storage
    console.log('Slot overrides updated:', Object.fromEntries(this.slotOverrides));
  }
}

export default SlotExtractionService;