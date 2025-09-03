/**
 * API Service
 * Handles communication with backend API
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear token and redirect to login
      await AsyncStorage.removeItem('auth_token');
      // TODO: Navigate to login screen
    }
    return Promise.reject(error);
  }
);

/**
 * Send voice command to backend
 */
export async function sendVoiceCommand(text: string, audioUri?: string | null) {
  try {
    const response = await api.post('/voice/command', {
      text,
      audio: audioUri ? await convertAudioToBase64(audioUri) : undefined,
      userId: await getUserId(),
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Voice command error:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Network error',
      spokenResponse: "I'm having trouble connecting. Please check your internet connection.",
    };
  }
}

/**
 * Send text command to backend
 */
export async function sendTextCommand(text: string) {
  try {
    const response = await api.post('/command', {
      command: text,
      type: 'auto',
      userId: await getUserId(),
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Text command error:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Network error',
    };
  }
}

/**
 * Get calendar events
 */
export async function getCalendarEvents(start?: Date, end?: Date) {
  try {
    const params: any = {};
    if (start) params.start = start.toISOString();
    if (end) params.end = end.toISOString();
    
    const response = await api.get('/calendar/events', { params });
    return response.data;
  } catch (error: any) {
    console.error('Get calendar events error:', error);
    return {
      success: false,
      events: [],
      error: error.response?.data?.error || error.message,
    };
  }
}

/**
 * Create calendar event
 */
export async function createCalendarEvent(event: {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
}) {
  try {
    const response = await api.post('/calendar/events', {
      ...event,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Create calendar event error:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}

/**
 * Get tasks
 */
export async function getTasks() {
  try {
    const response = await api.get('/tasks');
    return response.data;
  } catch (error: any) {
    console.error('Get tasks error:', error);
    return {
      success: false,
      tasks: [],
      error: error.response?.data?.error || error.message,
    };
  }
}

/**
 * Send chat message
 */
export async function sendChatMessage(message: string, conversationId?: string) {
  try {
    const response = await api.post('/chat/message', {
      conversationId,
      message: {
        text: message,
        isVoice: false,
        userId: await getUserId(),
      },
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Chat message error:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}

/**
 * Get intent classification stats
 */
export async function getIntentStats() {
  try {
    const response = await api.get('/intent/stats');
    return response.data;
  } catch (error: any) {
    console.error('Get intent stats error:', error);
    return {
      success: false,
      stats: {},
      error: error.response?.data?.error || error.message,
    };
  }
}

/**
 * Submit intent correction
 */
export async function submitIntentCorrection(
  predictionId: string,
  correctedIntent: string,
  correctedSlots: Record<string, any>
) {
  try {
    const response = await api.post('/intent/correct', {
      predictionId,
      correctedIntent,
      correctedSlots,
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Intent correction error:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}

/**
 * Helper: Convert audio file to base64
 */
async function convertAudioToBase64(uri: string): Promise<string | undefined> {
  // In production, implement actual audio to base64 conversion
  // For now, return undefined
  return undefined;
}

/**
 * Helper: Get user ID
 */
async function getUserId(): Promise<string> {
  const userId = await AsyncStorage.getItem('user_id');
  return userId || 'demo-user';
}

/**
 * Set API base URL (for development)
 */
export function setApiBaseUrl(url: string) {
  api.defaults.baseURL = url;
}

/**
 * Check API health
 */
export async function checkApiHealth() {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    return {
      status: 'error',
      message: 'API is not reachable',
    };
  }
}