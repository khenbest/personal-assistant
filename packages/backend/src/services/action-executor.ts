export interface IntentClassification {
  intent: string;
  confidence: number;
  text: string;
  slots?: Record<string, any>;
}

import { CalendarService } from './calendar-service';
import { ReminderService } from './reminder-service';
import { NoteService } from './note-service';
import { Logger } from 'pino';

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  followUp?: string;
}

export class ActionExecutor {
  private calendarService: CalendarService;
  private reminderService: ReminderService;
  private noteService: NoteService;
  
  constructor(private logger: Logger) {
    this.calendarService = new CalendarService(logger);
    this.reminderService = new ReminderService();
    this.noteService = new NoteService();
  }

  async execute(classification: IntentClassification): Promise<ActionResult> {
    this.logger.info({ intent: classification.intent }, 'Executing action');

    try {
      switch (classification.intent) {
        case 'create_event':
          return await this.createEvent(classification);
        
        case 'query_events':
          return await this.queryEvents(classification);
        
        case 'create_reminder':
          return await this.createReminder(classification);
        
        case 'create_note':
          return await this.createNote(classification);
        
        case 'query_notes':
          return await this.queryNotes(classification);
        
        case 'send_message':
          return await this.sendMessage(classification);
        
        case 'general_question':
          return await this.handleGeneralQuestion(classification);
        
        default:
          return {
            success: false,
            message: `I'm not sure how to handle that request yet.`,
            error: `Unknown intent: ${classification.intent}`
          };
      }
    } catch (error) {
      this.logger.error({ error, intent: classification.intent }, 'Action execution failed');
      return {
        success: false,
        message: 'Sorry, something went wrong while processing your request.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async createEvent(classification: IntentClassification): Promise<ActionResult> {
    const { title, datetime_point, datetime_range, attendees, location } = classification.slots || {};
    
    if (!title && !classification.text) {
      return {
        success: false,
        message: 'What would you like to schedule?',
        followUp: 'Please provide a title for the event.'
      };
    }

    const eventTitle = title || classification.text;
    const startTime = datetime_point || datetime_range?.start || new Date().toISOString();
    const endTime = datetime_range?.end || 
      new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(); // 1 hour default

    const event = await this.calendarService.create({
      title: eventTitle,
      startTime,
      endTime,
      attendees: attendees || [],
      location: location || ''
    });

    const startDate = new Date(startTime);
    const timeStr = startDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    const dateStr = startDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });

    return {
      success: true,
      message: `I've scheduled "${eventTitle}" for ${dateStr} at ${timeStr}.`,
      data: event,
      followUp: 'Would you like me to set a reminder for this event?'
    };
  }

  private async queryEvents(classification: IntentClassification): Promise<ActionResult> {
    const { datetime_point, datetime_range } = classification.slots || {};
    
    const startDate = datetime_range?.start || datetime_point || new Date().toISOString();
    const endDate = datetime_range?.end || 
      new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000).toISOString(); // 1 day default

    // Mock implementation for now
    const events: any[] = [];

    if (events.length === 0) {
      return {
        success: true,
        message: 'You have no events scheduled for that time.',
        data: []
      };
    }

    const eventList = events.map((e: any) => {
      const time = new Date(e.startTime).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      return `• ${e.title} at ${time}`;
    }).join('\n');

    return {
      success: true,
      message: `Here are your scheduled events:\n${eventList}`,
      data: events
    };
  }

  private async createReminder(classification: IntentClassification): Promise<ActionResult> {
    const { title, datetime_point } = classification.slots || {};
    
    if (!title && !classification.text) {
      return {
        success: false,
        message: 'What would you like me to remind you about?',
        followUp: 'Please provide details for the reminder.'
      };
    }

    const reminderTitle = title || classification.text;
    const reminderTime = datetime_point || new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour default

    const reminder = await this.reminderService.create({
      title: reminderTitle,
      time: reminderTime
    });

    const time = new Date(reminderTime).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    return {
      success: true,
      message: `I'll remind you about "${reminderTitle}" at ${time}.`,
      data: reminder
    };
  }

  private async createNote(classification: IntentClassification): Promise<ActionResult> {
    const { content, category } = classification.slots || {};
    
    if (!content && !classification.text) {
      return {
        success: false,
        message: 'What would you like me to note down?',
        followUp: 'Please provide the content for the note.'
      };
    }

    const noteContent = content || classification.text;
    const noteCategory = category || 'general';

    const note = await this.noteService.create({
      content: noteContent,
      category: noteCategory
    });

    return {
      success: true,
      message: `I've saved your note in the "${noteCategory}" category.`,
      data: note
    };
  }

  private async queryNotes(classification: IntentClassification): Promise<ActionResult> {
    const { category, search_query } = classification.slots || {};
    
    // Mock implementation for now
    const notes: any[] = [];

    if (notes.length === 0) {
      return {
        success: true,
        message: 'No notes found matching your criteria.',
        data: []
      };
    }

    const noteList = notes.map(n => `• ${n.content.substring(0, 50)}...`).join('\n');

    return {
      success: true,
      message: `Found ${notes.length} note(s):\n${noteList}`,
      data: notes
    };
  }

  private async sendMessage(classification: IntentClassification): Promise<ActionResult> {
    const { recipient, message } = classification.slots || {};
    
    // For now, just simulate message sending
    return {
      success: true,
      message: `Message to ${recipient}: "${message}" (This is a simulation - actual messaging not implemented yet)`,
      data: { recipient, message }
    };
  }

  private async handleGeneralQuestion(classification: IntentClassification): Promise<ActionResult> {
    // For general questions, we'll need to integrate with an LLM
    return {
      success: true,
      message: `I understand you're asking: "${classification.text}". Let me help you with that.`,
      data: null,
      followUp: 'Is there anything specific I can help you with - like scheduling, reminders, or notes?'
    };
  }

  // Generate a natural response based on the action result
  generateResponse(result: ActionResult): string {
    if (!result.success) {
      return result.message || 'I encountered an issue processing your request.';
    }

    let response = result.message;
    
    if (result.followUp) {
      response += `\n\n${result.followUp}`;
    }

    return response;
  }
}