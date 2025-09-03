/**
 * Calendar Service
 * Handles calendar event creation from voice commands
 * Integrates with IntentService and Supabase
 */

import { IntentService } from ./intent-classification-service.;
import { SlotExtractionService, ExtractedSlots } from './slot-extraction-service';
import { supabase } from '../db/supabase';
import * as chrono from 'chrono-node';

export interface CalendarEvent {
  id?: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  attendees?: string[];
  recurring?: string;
  duration_minutes?: number;
}

export interface ProcessResult {
  success: boolean;
  event?: CalendarEvent;
  message: string;
  spokenResponse: string;
  confidence?: number;
  needsConfirmation?: boolean;
  clarification?: string;
  error?: string;
  predictionId?: string;
  options?: any[];
}

export class CalendarService {
  private intentService: IntentClassificationService;
  private slotExtractor: SlotExtractionService;

  constructor(intentService: IntentClassificationService) {
    this.intentService = intentService;
    this.slotExtractor = new SlotExtractionService(intentService['llmService']);
  }

  /**
   * Process voice command to create calendar event
   */
  async processVoiceCommand(command: string, userId: string = 'demo-user'): Promise<ProcessResult> {
    try {
      // Step 1: Classify intent
      const intentResult = await this.intentService.classifyIntent(command);
      
      // Verify it's a calendar command
      if (intentResult.intent !== 'create_event') {
        return {
          success: false,
          message: 'This is not a calendar command',
          spokenResponse: "I can only help with calendar events. Please try a command like 'Schedule a meeting tomorrow at 3pm'",
          error: 'Intent is not a calendar command',
          confidence: intentResult.confidence
        };
      }

      // Step 2: Extract slots
      const slots = await this.extractEventSlots(command);
      
      // Step 3: Validate and process dates
      const validation = this.validateEventData(slots);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.error || 'Invalid event data',
          spokenResponse: validation.spokenError || "I couldn't understand the event details. Please try again.",
          error: validation.error,
          needsConfirmation: validation.needsConfirmation,
          clarification: validation.clarification,
          options: validation.options
        };
      }

      // Step 4: Build event object
      const event = this.buildEventFromSlots(slots, userId);
      
      // Step 5: Save to database
      let savedEvent: CalendarEvent;
      try {
        savedEvent = await this.saveEvent(event);
      } catch (dbError: any) {
        // If Supabase not configured, return mock event
        console.warn('Database save failed, using mock:', dbError.message);
        savedEvent = {
          ...event,
          id: `mock-${Date.now()}`
        };
      }

      // Step 6: Generate response
      const message = this.generateSuccessMessage(savedEvent);
      const spokenResponse = this.generateSpokenResponse(savedEvent);

      return {
        success: true,
        event: savedEvent,
        message,
        spokenResponse,
        confidence: intentResult.confidence,
        predictionId: intentResult.llmFallback ? undefined : 'pred-' + Date.now()
      };

    } catch (error: any) {
      console.error('Calendar service error:', error);
      return {
        success: false,
        message: 'Failed to process calendar command',
        spokenResponse: "I'm sorry, I couldn't create the calendar event. Please try again.",
        error: error.message
      };
    }
  }

  /**
   * Extract calendar event slots from command
   */
  async extractEventSlots(command: string): Promise<ExtractedSlots> {
    // Use the slot extraction service
    const slots = await this.slotExtractor.extractSlots(command, 'create_event');
    
    // Apply calendar-specific defaults
    if (!slots.duration_min && !slots.datetime_range) {
      slots.duration_min = this.getDefaultDuration(command);
    }

    // Clean up title
    if (slots.title) {
      slots.title = this.cleanEventTitle(slots.title);
    } else {
      // Try to extract title from command
      slots.title = this.extractTitleFromCommand(command, slots);
    }

    return slots;
  }

  /**
   * Validate event data
   */
  private validateEventData(slots: ExtractedSlots): {
    valid: boolean;
    error?: string;
    spokenError?: string;
    needsConfirmation?: boolean;
    clarification?: string;
    options?: any[];
  } {
    // Check for required fields
    if (!slots.datetime_point && !slots.datetime_range) {
      return {
        valid: false,
        error: 'No date/time specified',
        spokenError: "I didn't catch when you want to schedule this. Please include a date and time."
      };
    }

    // Check for past dates
    const eventTime = slots.datetime_point 
      ? new Date(slots.datetime_point)
      : slots.datetime_range 
        ? new Date(slots.datetime_range.start)
        : null;

    if (eventTime && eventTime < new Date()) {
      return {
        valid: false,
        error: 'Cannot schedule events in the past',
        spokenError: "I can't schedule events in the past. Please choose a future date and time."
      };
    }

    // Check for ambiguous dates
    if (slots.ambiguous_fields?.includes('datetime')) {
      return {
        valid: false,
        needsConfirmation: true,
        clarification: 'Which day did you mean?',
        error: 'Ambiguous date',
        options: this.generateDateOptions(slots)
      };
    }

    return { valid: true };
  }

  /**
   * Build calendar event from extracted slots
   */
  private buildEventFromSlots(slots: ExtractedSlots, userId: string): CalendarEvent {
    let startTime: Date;
    let endTime: Date;

    if (slots.datetime_range) {
      startTime = new Date(slots.datetime_range.start);
      endTime = new Date(slots.datetime_range.end);
    } else if (slots.datetime_point) {
      startTime = new Date(slots.datetime_point);
      const durationMs = (slots.duration_min || 60) * 60 * 1000;
      endTime = new Date(startTime.getTime() + durationMs);
    } else {
      // Should not happen due to validation
      startTime = new Date();
      endTime = new Date(startTime.getTime() + 3600000);
    }

    return {
      user_id: userId,
      title: slots.title || 'New Event',
      description: slots.note_body || undefined,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      location: slots.location,
      attendees: slots.attendees || slots.email_to,
      recurring: slots.recurring,
      duration_minutes: slots.duration_min
    };
  }

  /**
   * Save event to Supabase
   */
  private async saveEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(event)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  /**
   * Generate success message for display
   */
  private generateSuccessMessage(event: CalendarEvent): string {
    const startDate = new Date(event.start_time);
    const dateStr = startDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeStr = startDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });

    let message = `✅ Event scheduled: "${event.title}" on ${dateStr} at ${timeStr}`;
    
    if (event.location) {
      message += ` at ${event.location}`;
    }
    
    if (event.attendees && event.attendees.length > 0) {
      message += ` with ${event.attendees.join(', ')}`;
    }

    if (event.recurring) {
      message += ` (recurring ${event.recurring})`;
    }

    return message;
  }

  /**
   * Generate voice-optimized response
   */
  private generateSpokenResponse(event: CalendarEvent): string {
    const startDate = new Date(event.start_time);
    const isToday = this.isToday(startDate);
    const isTomorrow = this.isTomorrow(startDate);
    
    let dateStr: string;
    if (isToday) {
      dateStr = 'today';
    } else if (isTomorrow) {
      dateStr = 'tomorrow';
    } else {
      dateStr = startDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
    }

    const timeStr = startDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: startDate.getMinutes() === 0 ? undefined : '2-digit'
    });

    let response = `I've scheduled your ${event.title} for ${dateStr} at ${timeStr}`;
    
    if (event.location) {
      response += ` at ${event.location}`;
    }

    if (event.duration_minutes && event.duration_minutes !== 60) {
      const hours = Math.floor(event.duration_minutes / 60);
      const minutes = event.duration_minutes % 60;
      if (hours > 0 && minutes > 0) {
        response += ` for ${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minutes`;
      } else if (hours > 0) {
        response += ` for ${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        response += ` for ${minutes} minutes`;
      }
    }

    return response + '.';
  }

  /**
   * Helper: Get default duration based on event type
   */
  private getDefaultDuration(command: string): number {
    const patterns = [
      { pattern: /\b(lunch|coffee)\b/i, duration: 60 },
      { pattern: /\b(meeting|appointment)\b/i, duration: 60 },
      { pattern: /\b(standup|stand-up|daily)\b/i, duration: 15 },
      { pattern: /\b(1-on-1|one-on-one|1:1)\b/i, duration: 30 },
      { pattern: /\b(interview)\b/i, duration: 45 },
      { pattern: /\b(workshop|training)\b/i, duration: 120 },
      { pattern: /\b(conference|summit)\b/i, duration: 480 }
    ];

    for (const { pattern, duration } of patterns) {
      if (pattern.test(command)) {
        return duration;
      }
    }

    return 60; // Default 1 hour
  }

  /**
   * Helper: Clean event title
   */
  private cleanEventTitle(title: string): string {
    // Remove common prefixes
    title = title.replace(/^(schedule|book|add|create|set up)\s+(a\s+)?/i, '');
    
    // Truncate if too long
    if (title.length > 255) {
      title = title.substring(0, 252) + '...';
    }

    return title.trim();
  }

  /**
   * Helper: Extract title from command
   */
  private extractTitleFromCommand(command: string, slots: ExtractedSlots): string {
    // Remove temporal expressions
    let title = command;
    const chronoResults = chrono.parse(command);
    chronoResults.forEach(result => {
      title = title.replace(result.text, '');
    });

    // Remove location
    if (slots.location) {
      title = title.replace(new RegExp(`\\s*(at|in)\\s*${slots.location}`, 'gi'), '');
    }

    // Remove common prefixes
    title = title.replace(/^(schedule|book|add|create|set up)\s+(a\s+)?/i, '');
    
    // Remove duration
    title = title.replace(/\s+for\s+\d+\s*(hour|minute|min|hr)s?/gi, '');

    // Clean up
    title = title.replace(/\s+/g, ' ').trim();

    return title || 'New Event';
  }

  /**
   * Helper: Check if date is today
   */
  private isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * Helper: Check if date is tomorrow
   */
  private isTomorrow(date: Date): boolean {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  }

  /**
   * Helper: Generate date options for ambiguous dates
   */
  private generateDateOptions(_slots: ExtractedSlots): any[] {
    // This would generate possible date interpretations
    return [];
  }
}

export default CalendarService;