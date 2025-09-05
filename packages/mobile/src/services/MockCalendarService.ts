/**
 * Mock Calendar Service - Always Works™ Implementation
 * Simulates calendar functionality without native dependencies
 * Perfect for Expo Go development and UI testing
 */

import { CalendarEvent } from './calendarService';

interface MockCalendarEvent extends CalendarEvent {
  id: string;
}

class MockCalendarService {
  private mockEvents: MockCalendarEvent[] = [
    {
      id: 'mock-1',
      title: 'Team Standup',
      startDate: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
      endDate: new Date(Date.now() + 1.5 * 60 * 60 * 1000), // 1.5 hours from now
      location: 'Conference Room A',
      notes: 'Daily team sync - discuss progress and blockers',
      alarms: [15]
    },
    {
      id: 'mock-2',
      title: 'Lunch with Sarah',
      startDate: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
      endDate: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      location: 'Downtown Cafe',
      notes: 'Discuss the new project proposal',
      alarms: [30]
    },
    {
      id: 'mock-3',
      title: 'Project Review',
      startDate: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
      endDate: new Date(Date.now() + 7 * 60 * 60 * 1000), // 7 hours from now
      location: 'Meeting Room B',
      notes: 'Review Q4 project deliverables',
      alarms: [15, 5]
    }
  ];

  /**
   * Mock permission request - always grants
   */
  async requestPermissions(): Promise<boolean> {
    console.log('📅 [MOCK CALENDAR] Permissions granted (simulated)');
    return true;
  }

  /**
   * Mock permission check - always has permissions
   */
  async hasPermissions(): Promise<boolean> {
    return true;
  }

  /**
   * Mock calendar ID - always returns mock ID
   */
  async getDefaultCalendarId(): Promise<string> {
    console.log('📅 [MOCK CALENDAR] Using mock calendar ID');
    return 'mock-calendar-id';
  }

  /**
   * Mock create event - simulates successful creation
   */
  async createEvent(eventData: CalendarEvent): Promise<string> {
    console.log('📅 [MOCK CALENDAR] Creating event:', eventData.title);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const mockEvent: MockCalendarEvent = {
      ...eventData,
      id: `mock-${Date.now()}`
    };

    this.mockEvents.push(mockEvent);
    
    console.log('✅ [MOCK CALENDAR] Event created with ID:', mockEvent.id);
    return mockEvent.id;
  }

  /**
   * Mock update event
   */
  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
    console.log('📅 [MOCK CALENDAR] Updating event:', eventId, updates);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const eventIndex = this.mockEvents.findIndex(e => e.id === eventId);
    if (eventIndex >= 0) {
      this.mockEvents[eventIndex] = { ...this.mockEvents[eventIndex], ...updates };
      console.log('✅ [MOCK CALENDAR] Event updated');
    } else {
      console.log('⚠️ [MOCK CALENDAR] Event not found for update');
    }
  }

  /**
   * Mock delete event
   */
  async deleteEvent(eventId: string): Promise<void> {
    console.log('📅 [MOCK CALENDAR] Deleting event:', eventId);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));

    const eventIndex = this.mockEvents.findIndex(e => e.id === eventId);
    if (eventIndex >= 0) {
      this.mockEvents.splice(eventIndex, 1);
      console.log('✅ [MOCK CALENDAR] Event deleted');
    } else {
      console.log('⚠️ [MOCK CALENDAR] Event not found for deletion');
    }
  }

  /**
   * Mock get events - returns simulated events
   */
  async getEvents(startDate: Date, endDate: Date): Promise<MockCalendarEvent[]> {
    console.log('📅 [MOCK CALENDAR] Fetching events between:', startDate, 'and', endDate);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400));

    // Filter mock events by date range
    const filteredEvents = this.mockEvents.filter(event => 
      event.startDate >= startDate && event.startDate <= endDate
    );

    console.log(`✅ [MOCK CALENDAR] Found ${filteredEvents.length} events`);
    return filteredEvents;
  }

  /**
   * Mock create event from intent
   */
  async createEventFromIntent(intentResult: any): Promise<string> {
    console.log('📅 [MOCK CALENDAR] Creating event from intent:', intentResult);

    // Parse mock intent data
    const { slots = {} } = intentResult;
    
    // Create realistic mock event
    const startDate = new Date();
    startDate.setHours(startDate.getHours() + 24); // Default to tomorrow
    startDate.setMinutes(0, 0, 0); // Round to hour

    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1); // 1 hour duration

    const event: CalendarEvent = {
      title: slots.title || 'New Event (Mock)',
      startDate,
      endDate,
      location: slots.location || 'TBD',
      notes: slots.description || 'Event created via voice command (mock)',
      alarms: [15]
    };

    const eventId = await this.createEvent(event);
    return eventId;
  }

  /**
   * Mock format event for speech
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

    let response = `[MOCK] I've scheduled "${event.title}" for ${dateStr} at ${timeStr}`;
    
    if (event.location) {
      response += ` at ${event.location}`;
    }

    return response;
  }

  /**
   * Get today's events as a summary string
   */
  async getTodaysSummary(): Promise<string> {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const events = await this.getEvents(startOfDay, endOfDay);
    
    if (events.length === 0) {
      return "You have no events scheduled for today.";
    }

    const eventStrings = events.map(event => {
      const time = event.startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: event.startDate.getMinutes() === 0 ? undefined : '2-digit'
      });
      return `${event.title} at ${time}`;
    });

    return `You have ${events.length} events today: ${eventStrings.join(', ')}.`;
  }

  /**
   * Add a mock event for testing
   */
  addMockEvent(event: CalendarEvent): string {
    const mockEvent: MockCalendarEvent = {
      ...event,
      id: `mock-${Date.now()}-${Math.random()}`
    };
    this.mockEvents.push(mockEvent);
    return mockEvent.id;
  }

  /**
   * Get all mock events (for debugging)
   */
  getAllMockEvents(): MockCalendarEvent[] {
    return [...this.mockEvents];
  }

  /**
   * Clear all mock events
   */
  clearMockEvents(): void {
    this.mockEvents = [];
    console.log('📅 [MOCK CALENDAR] All mock events cleared');
  }

  // Helper methods
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

export default new MockCalendarService();