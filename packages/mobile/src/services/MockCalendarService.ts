// Mock Calendar Service for Fast Development
export class MockCalendarService {
  private mockEvents = [
    { id: '1', title: 'Team Meeting', startTime: new Date().toISOString() },
    { id: '2', title: 'Lunch with John', startTime: new Date(Date.now() + 3600000).toISOString() }
  ];

  async createEvent(event: any): Promise<any> {
    const newEvent = { id: Date.now().toString(), ...event };
    this.mockEvents.push(newEvent);
    console.log('Mock Calendar: Event created', newEvent);
    return newEvent;
  }

  async getEvents(): Promise<any[]> {
    console.log('Mock Calendar: Returning events', this.mockEvents);
    return this.mockEvents;
  }
}
