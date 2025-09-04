/**
 * Calendar Service for Mobile
 * Handles actual device calendar integration via expo-calendar
 * Creates real calendar events on user's device
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export interface CalendarEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  alarms?: number[]; // minutes before event
  attendees?: string[];
  timeZone?: string;
  allDay?: boolean;
}

class CalendarServiceMobile {
  private defaultCalendarId: string | null = null;

  /**
   * Request calendar permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting calendar permissions:', error);
      return false;
    }
  }

  /**
   * Check if we have calendar permissions
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking calendar permissions:', error);
      return false;
    }
  }

  /**
   * Get or create default calendar for the app
   */
  async getDefaultCalendarId(): Promise<string> {
    // Return cached ID if available
    if (this.defaultCalendarId) {
      return this.defaultCalendarId;
    }

    const hasPermission = await this.hasPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Calendar permission denied');
      }
    }

    // Get calendars
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    
    // Try to find our app's calendar
    let appCalendar = calendars.find(cal => cal.title === 'Personal Assistant');
    
    if (!appCalendar) {
      // Find default calendar or create one
      if (Platform.OS === 'ios') {
        // On iOS, use the default calendar
        const defaultCalendar = calendars.find(cal => cal.allowsModifications && !cal.isLocalAccount);
        if (defaultCalendar) {
          this.defaultCalendarId = defaultCalendar.id;
          return defaultCalendar.id;
        }
      }
      
      // Create a new calendar if needed
      const newCalendarId = await this.createCalendar();
      this.defaultCalendarId = newCalendarId;
      return newCalendarId;
    }

    this.defaultCalendarId = appCalendar.id;
    return appCalendar.id;
  }

  /**
   * Create a new calendar for the app
   */
  private async createCalendar(): Promise<string> {
    const defaultCalendarSource = Platform.OS === 'ios'
      ? await this.getDefaultCalendarSource()
      : { isLocalAccount: true, name: 'Personal Assistant' };

    const newCalendarId = await Calendar.createCalendarAsync({
      title: 'Personal Assistant',
      color: '#4A90E2',
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultCalendarSource.id,
      source: defaultCalendarSource,
      name: 'Personal Assistant',
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });

    return newCalendarId;
  }

  /**
   * Get default calendar source (iOS specific)
   */
  private async getDefaultCalendarSource(): Promise<any> {
    const sources = await Calendar.getSourcesAsync();
    const defaultSource = sources.find(source => source.name === 'iCloud') ||
                          sources.find(source => source.type === Calendar.SourceType.CALDAV) ||
                          sources[0];
    return defaultSource;
  }

  /**
   * Create calendar event on device
   */
  async createEvent(eventData: CalendarEvent): Promise<string> {
    try {
      const calendarId = await this.getDefaultCalendarId();

      const eventDetails: Calendar.Event = {
        title: eventData.title,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        location: eventData.location,
        notes: eventData.notes,
        alarms: eventData.alarms?.map(minutes => ({ relativeOffset: -minutes })),
        timeZone: eventData.timeZone || 'America/Los_Angeles',
        allDay: eventData.allDay || false,
      };

      const eventId = await Calendar.createEventAsync(calendarId, eventDetails);
      console.log('Created event with ID:', eventId);
      return eventId;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
    try {
      const eventUpdates: Partial<Calendar.Event> = {};
      
      if (updates.title) eventUpdates.title = updates.title;
      if (updates.startDate) eventUpdates.startDate = updates.startDate;
      if (updates.endDate) eventUpdates.endDate = updates.endDate;
      if (updates.location) eventUpdates.location = updates.location;
      if (updates.notes) eventUpdates.notes = updates.notes;
      if (updates.alarms) {
        eventUpdates.alarms = updates.alarms.map(minutes => ({ relativeOffset: -minutes }));
      }

      await Calendar.updateEventAsync(eventId, eventUpdates);
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await Calendar.deleteEventAsync(eventId);
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw error;
    }
  }

  /**
   * Get events in a date range
   */
  async getEvents(startDate: Date, endDate: Date): Promise<Calendar.Event[]> {
    try {
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        throw new Error('Calendar permission required');
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const calendarIds = calendars
        .filter(cal => cal.allowsModifications)
        .map(cal => cal.id);

      const events = await Calendar.getEventsAsync(
        calendarIds,
        startDate,
        endDate
      );

      return events;
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }

  /**
   * Create event from voice intent result
   */
  async createEventFromIntent(intentResult: any): Promise<string> {
    try {
      // Parse the slots from intent result
      const { slots } = intentResult;
      
      // Parse dates
      let startDate: Date;
      let endDate: Date;
      
      if (slots.datetime_range) {
        startDate = new Date(slots.datetime_range.start);
        endDate = new Date(slots.datetime_range.end);
      } else if (slots.datetime_point) {
        startDate = new Date(slots.datetime_point);
        const durationMs = (slots.duration_min || 60) * 60 * 1000;
        endDate = new Date(startDate.getTime() + durationMs);
      } else {
        // Default to tomorrow at 9am for 1 hour if no time specified
        startDate = new Date();
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(9, 0, 0, 0);
        endDate = new Date(startDate.getTime() + 3600000);
      }

      // Create the event
      const event: CalendarEvent = {
        title: slots.title || 'New Event',
        startDate,
        endDate,
        location: slots.location,
        notes: slots.note_body || slots.description,
        alarms: [15], // Default 15 minute reminder
      };

      const eventId = await this.createEvent(event);
      
      return eventId;
    } catch (error) {
      console.error('Error creating event from intent:', error);
      throw error;
    }
  }

  /**
   * Format event for display
   */
  formatEventForSpeech(event: CalendarEvent): string {
    const startDate = event.startDate;
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

    let response = `I've scheduled "${event.title}" for ${dateStr} at ${timeStr}`;
    
    if (event.location) {
      response += ` at ${event.location}`;
    }

    return response;
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  private isTomorrow(date: Date): boolean {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  }
}

export default new CalendarServiceMobile();