import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AppState {
  // App state
  isInitialized: boolean;
  user: User | null;
  
  // Settings
  settings: {
    voiceEnabled: boolean;
    notificationsEnabled: boolean;
    theme: 'light' | 'dark' | 'auto';
    llmProvider: string;
  };
  
  // Actions
  initialize: () => Promise<void>;
  setUser: (user: User | null) => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
  logout: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  isInitialized: false,
  user: null,
  settings: {
    voiceEnabled: true,
    notificationsEnabled: true,
    theme: 'auto',
    llmProvider: 'auto',
  },
  
  initialize: async () => {
    try {
      // Load saved settings
      const savedSettings = await AsyncStorage.getItem('settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        set({ settings });
      }
      
      // Load saved user
      const savedUser = await AsyncStorage.getItem('user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        set({ user });
      }
      
      set({ isInitialized: true });
    } catch (error) {
      console.error('Failed to initialize app:', error);
      set({ isInitialized: true });
    }
  },
  
  setUser: (user) => {
    set({ user });
    if (user) {
      AsyncStorage.setItem('user', JSON.stringify(user));
    } else {
      AsyncStorage.removeItem('user');
    }
  },
  
  updateSettings: (newSettings) => {
    const settings = { ...get().settings, ...newSettings };
    set({ settings });
    AsyncStorage.setItem('settings', JSON.stringify(settings));
  },
  
  logout: async () => {
    await AsyncStorage.multiRemove(['user', 'settings']);
    set({ user: null });
  },
}));