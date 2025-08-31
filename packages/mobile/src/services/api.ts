import axios from 'axios';
import { Platform } from 'react-native';

// Use localhost for iOS simulator, 10.0.2.2 for Android emulator
const API_BASE_URL = Platform.select({
  ios: 'http://localhost:3000',
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000',
});

class ApiService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async sendCommand(command: string) {
    try {
      const response = await this.api.post('/api/command', {
        command,
        type: 'auto',
      });
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async query(question: string) {
    try {
      const response = await this.api.post('/api/query', {
        question,
      });
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async getTasks() {
    try {
      const response = await this.api.get('/api/tasks');
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async getEvents() {
    try {
      const response = await this.api.get('/api/calendar/events');
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async checkHealth() {
    try {
      const response = await this.api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'error' };
    }
  }
}

export const apiService = new ApiService();