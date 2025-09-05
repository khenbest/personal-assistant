/**
 * Service Factory - Always Works™ Service Selection
 * Automatically chooses between Mock and Real services based on environment
 * Follows VoiceCore's proven "mock first, integrate later" approach
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Import real services
import VoiceService from './voiceService';
import CalendarService from './calendarService';

// Import mock services  
import MockVoiceService from './MockVoiceService';
import MockCalendarService from './MockCalendarService';

/**
 * Determine if we should use mock services
 * Priority order:
 * 1. Explicit environment variable (USE_MOCK_SERVICES)
 * 2. Development mode AND running in Expo Go
 * 3. Web platform (always use mocks)
 */
function shouldUseMockServices(): boolean {
  // Check explicit override
  const useMockEnv = process.env.USE_MOCK_SERVICES || process.env.EXPO_PUBLIC_USE_MOCK_SERVICES;
  if (useMockEnv !== undefined) {
    return useMockEnv === 'true' || useMockEnv === '1';
  }

  // In development AND running in Expo Go
  if (__DEV__) {
    // Check if running in Expo Go (no native builds)
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      return true;
    }
  }

  // Web platform always uses mocks (no native modules available)
  if (Platform.OS === 'web') {
    return true;
  }

  // Default to real services for native builds
  return false;
}

const USE_MOCKS = shouldUseMockServices();

// Log which services we're using
console.log(`🔧 [SERVICE FACTORY] Using ${USE_MOCKS ? 'MOCK' : 'REAL'} services`);
console.log(`🔧 Environment: __DEV__=${__DEV__}, Platform=${Platform.OS}`);
if (Constants.executionEnvironment) {
  console.log(`🔧 Execution: ${Constants.executionEnvironment}`);
}

/**
 * Voice Service - Auto-selected based on environment
 */
export const voiceService = USE_MOCKS ? MockVoiceService : VoiceService;

/**
 * Calendar Service - Auto-selected based on environment  
 */
export const calendarService = USE_MOCKS ? MockCalendarService : CalendarService;

/**
 * Service status for debugging
 */
export const serviceStatus = {
  usingMocks: USE_MOCKS,
  platform: Platform.OS,
  isDev: __DEV__,
  executionEnvironment: Constants.executionEnvironment,
  services: {
    voice: USE_MOCKS ? 'MockVoiceService' : 'VoiceService',
    calendar: USE_MOCKS ? 'MockCalendarService' : 'CalendarService'
  }
};

/**
 * Force switch to mock services (for testing)
 */
export function forceMockServices(): void {
  console.warn('🔧 [SERVICE FACTORY] Forcing mock services - restart app to use real services');
  // Note: This would require app restart to take effect due to module imports
}

/**
 * Get service configuration info
 */
export function getServiceInfo(): string {
  return `Services: ${USE_MOCKS ? 'MOCK' : 'REAL'} | Platform: ${Platform.OS} | Dev: ${__DEV__}`;
}

export default {
  voiceService,
  calendarService,
  serviceStatus,
  getServiceInfo
};