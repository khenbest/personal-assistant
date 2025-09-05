/**
 * Reminder Service
 * Handles creation and management of reminders
 */

import { SlotExtractionService } from './slot-extraction-service';
import { createClient } from '@supabase/supabase-js';
import { LLMService } from './llm-service';

export interface Reminder {
  id?: string;
  user_id: string;
  text: string;
  reminder_time: Date;
  is_completed: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface ReminderResult {
  success: boolean;
  reminder?: Reminder;
  message: string;
  spokenResponse: string;
}

export class ReminderService {
  private supabase;
  private slotExtractor: SlotExtractionService;

  constructor() {
    const llmService = new LLMService();
    this.slotExtractor = new SlotExtractionService(llmService);
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Create a reminder (simple interface for action-executor)
   */
  async create(reminderData: any): Promise<Reminder> {
    const result = await this.processReminderCommand(
      reminderData.text || reminderData.title,
      reminderData.userId || 'demo-user'
    );
    
    if (!result.success || !result.reminder) {
      throw new Error(result.message);
    }
    
    return result.reminder;
  }

  /**
   * Process reminder command from voice input
   */
  async processReminderCommand(command: string, userId: string = 'demo-user'): Promise<ReminderResult> {
    try {
      // Extract slots from the command
      const slots = await this.slotExtractor.extractSlots(command, 'add_reminder');
      
      // Extract reminder details
      const reminderText = this.extractReminderText(command, slots);
      const reminderTime = this.extractReminderTime(slots);
      
      if (!reminderText) {
        return {
          success: false,
          message: 'Could not understand what to remind you about',
          spokenResponse: "I couldn't understand what you want me to remind you about. Please try again."
        };
      }
      
      if (!reminderTime) {
        return {
          success: false,
          message: 'Could not understand when to remind you',
          spokenResponse: "I couldn't understand when you want to be reminded. Please include a time or date."
        };
      }
      
      // Create reminder object
      const reminder: Reminder = {
        user_id: userId,
        text: reminderText,
        reminder_time: reminderTime,
        is_completed: false,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Save to database
      const savedReminder = await this.saveReminder(reminder);
      
      // Generate response
      const message = `✅ Reminder set: "${reminderText}" for ${this.formatDateTime(reminderTime)}`;
      const spokenResponse = `I'll remind you to ${reminderText} ${this.getRelativeTime(reminderTime)}.`;
      
      return {
        success: true,
        reminder: savedReminder,
        message,
        spokenResponse
      };
      
    } catch (error: any) {
      console.error('Reminder service error:', error);
      return {
        success: false,
        message: 'Failed to create reminder',
        spokenResponse: "I'm sorry, I couldn't create the reminder. Please try again."
      };
    }
  }
  
  /**
   * Extract reminder text from command
   */
  private extractReminderText(command: string, slots: any): string {
    // Try to get from slots first
    if (slots.reminder_text) {
      return slots.reminder_text;
    }
    
    // Extract from command patterns
    const patterns = [
      /remind\s+me\s+to\s+(.+?)(?:\s+at|\s+on|\s+tomorrow|\s+today|$)/i,
      /reminder\s+to\s+(.+?)(?:\s+at|\s+on|\s+tomorrow|\s+today|$)/i,
      /don't\s+forget\s+to\s+(.+?)(?:\s+at|\s+on|\s+tomorrow|\s+today|$)/i,
      /remember\s+to\s+(.+?)(?:\s+at|\s+on|\s+tomorrow|\s+today|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Fallback: use the whole command minus time references
    return command
      .replace(/remind\s+me\s+to\s+/i, '')
      .replace(/\s+(at|on|tomorrow|today|tonight)\s+.*/i, '')
      .trim();
  }
  
  /**
   * Extract reminder time from slots
   */
  private extractReminderTime(slots: any): Date | null {
    if (slots.datetime_point) {
      return new Date(slots.datetime_point);
    }
    
    if (slots.datetime_range?.start) {
      return new Date(slots.datetime_range.start);
    }
    
    // Default to 1 hour from now if no time specified
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    return defaultTime;
  }
  
  /**
   * Save reminder to database
   */
  private async saveReminder(reminder: Reminder): Promise<Reminder> {
    if (!this.supabase) {
      // Return mock if database not configured
      return {
        ...reminder,
        id: `mock-${Date.now()}`
      };
    }
    
    try {
      const { data, error } = await this.supabase
        .from('reminders')
        .insert([reminder])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Database save failed, using mock:', error);
      return {
        ...reminder,
        id: `mock-${Date.now()}`
      };
    }
  }
  
  /**
   * Get reminders for a user
   */
  async getReminders(userId: string, includeCompleted: boolean = false): Promise<Reminder[]> {
    if (!this.supabase) {
      return [];
    }
    
    try {
      let query = this.supabase
        .from('reminders')
        .select('*')
        .eq('user_id', userId)
        .order('reminder_time', { ascending: true });
      
      if (!includeCompleted) {
        query = query.eq('is_completed', false);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
      return [];
    }
  }
  
  /**
   * Mark reminder as completed
   */
  async completeReminder(reminderId: string): Promise<boolean> {
    if (!this.supabase) {
      return true;
    }
    
    try {
      const { error } = await this.supabase
        .from('reminders')
        .update({ is_completed: true, updated_at: new Date() })
        .eq('id', reminderId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to complete reminder:', error);
      return false;
    }
  }
  
  /**
   * Format date/time for display
   */
  private formatDateTime(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
  
  /**
   * Get relative time description
   */
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) {
      return 'in a few minutes';
    } else if (diffHours === 1) {
      return 'in an hour';
    } else if (diffHours < 24) {
      return `in ${diffHours} hours`;
    } else if (diffDays === 1) {
      return 'tomorrow';
    } else if (diffDays < 7) {
      return `in ${diffDays} days`;
    } else {
      return `on ${this.formatDateTime(date)}`;
    }
  }
}

export const reminderService = new ReminderService();