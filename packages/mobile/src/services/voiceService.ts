/**
 * Voice Service
 * Handles Text-to-Speech ONLY
 * Speech-to-Text is handled by expo-speech-recognition in components
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

class VoiceService {
  private apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

  /**
   * Text to Speech - Speak text aloud
   */
  async speak(text: string, options?: Speech.SpeechOptions) {
    try {
      const defaultOptions: Speech.SpeechOptions = {
        language: 'en-US',
        pitch: 1.0,
        rate: Platform.OS === 'ios' ? 0.95 : 1.0,
        ...options,
      };
      
      Speech.speak(text, defaultOptions);
    } catch (error) {
      console.error('Speech error:', error);
      throw error;
    }
  }

  /**
   * Stop speaking
   */
  async stopSpeaking() {
    try {
      await Speech.stop();
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  }

  /**
   * Check if currently speaking
   */
  async isSpeaking(): Promise<boolean> {
    try {
      return await Speech.isSpeakingAsync();
    } catch (error) {
      console.error('Error checking speech status:', error);
      return false;
    }
  }

  /**
   * Get available voices
   */
  async getAvailableVoices() {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch (error) {
      console.error('Error getting voices:', error);
      return [];
    }
  }

  /**
   * Speak with specific voice
   */
  async speakWithVoice(text: string, voiceId?: string) {
    const options: Speech.SpeechOptions = {
      language: 'en-US',
      pitch: 1.0,
      rate: Platform.OS === 'ios' ? 0.95 : 1.0,
    };

    if (voiceId) {
      options.voice = voiceId;
    }

    await this.speak(text, options);
  }

  /**
   * Process message with backend LLM (text only, no audio)
   */
  async processMessage(text: string, sessionId: string, userId?: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/voice/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          sessionId,
          userId: userId || 'demo-user',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error processing message:', error);
      // Return error response in expected format
      return {
        success: false,
        action: 'error',
        response: {
          speak: "I couldn't process that request. Please try again.",
        },
        metadata: {
          intent: 'none',
          confidence: 'low',
          requiresConfirmation: false,
          sessionId,
        },
      };
    }
  }

  /**
   * Simple offline response fallback
   */
  getOfflineResponse(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('calendar') || lowerText.includes('schedule')) {
      return "I'm offline right now, but I'll help you with your calendar when I'm back online.";
    } else if (lowerText.includes('weather')) {
      return "I need to be online to check the weather for you.";
    } else if (lowerText.includes('remind')) {
      return "I'll set that reminder as soon as I'm back online.";
    } else if (lowerText.includes('hello') || lowerText.includes('hi')) {
      return "Hello! I'm currently offline but I'll be able to help you soon.";
    } else {
      return "I understand you said: " + text + ". I'll help you with that once I'm online.";
    }
  }
}

export default new VoiceService();