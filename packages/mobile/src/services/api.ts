import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = process.env.API_URL || 'http://localhost:3000';

class ApiService {
  private api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async sendCommand(command: string) {
    const response = await this.api.post('/api/command', {
      command,
      type: 'auto', // Let the backend determine the type
    });
    return response.data;
  }

  async query(question: string, context?: string) {
    const response = await this.api.post('/api/query', {
      question,
      context,
    });
    return response.data;
  }

  async getCalendarEvents(startDate?: Date, endDate?: Date) {
    const response = await this.api.get('/api/calendar/events', {
      params: {
        start: startDate?.toISOString(),
        end: endDate?.toISOString(),
      },
    });
    return response.data;
  }

  async createCalendarEvent(event: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    attendees?: string[];
  }) {
    const response = await this.api.post('/api/calendar/events', event);
    return response.data;
  }

  async getTasks(status?: string) {
    const response = await this.api.get('/api/tasks', {
      params: { status },
    });
    return response.data;
  }

  async createTask(task: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    dueDate?: Date;
  }) {
    const response = await this.api.post('/api/tasks', task);
    return response.data;
  }

  async updateTask(taskId: string, updates: any) {
    const response = await this.api.patch(`/api/tasks/${taskId}`, updates);
    return response.data;
  }

  async healthCheck() {
    const response = await this.api.get('/health');
    return response.data;
  }
}

export const apiService = new ApiService();