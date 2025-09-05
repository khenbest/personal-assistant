/**
 * Mock Voice Service - Always Works™ Implementation
 * Simulates all voice functionality without native dependencies
 * Perfect for Expo Go development and UI testing
 */

interface MockVoiceResponse {
  success: boolean;
  action: string;
  response: {
    speak: string;
    display?: string;
  };
  metadata: {
    intent: string;
    confidence: string;
    requiresConfirmation: boolean;
    sessionId: string;
  };
}

class MockVoiceService {
  private mockResponses: Record<string, MockVoiceResponse> = {
    'schedule meeting': {
      success: true,
      action: 'calendar_create',
      response: {
        speak: "I've scheduled your meeting for tomorrow at 2 PM.",
        display: "✅ Meeting scheduled: Tomorrow 2:00 PM"
      },
      metadata: {
        intent: 'calendar_create',
        confidence: 'high',
        requiresConfirmation: false,
        sessionId: 'mock-session'
      }
    },
    'what\'s my schedule': {
      success: true,
      action: 'calendar_query',
      response: {
        speak: "You have 3 events today: Team standup at 10 AM, lunch with Sarah at noon, and project review at 3 PM.",
        display: "📅 Today's Schedule:\n• 10:00 AM - Team Standup\n• 12:00 PM - Lunch with Sarah\n• 3:00 PM - Project Review"
      },
      metadata: {
        intent: 'calendar_query',
        confidence: 'high',
        requiresConfirmation: false,
        sessionId: 'mock-session'
      }
    },
    'send email': {
      success: true,
      action: 'email_compose',
      response: {
        speak: "I've drafted an email for you. Would you like me to send it?",
        display: "📧 Email drafted - Ready to send"
      },
      metadata: {
        intent: 'email_compose',
        confidence: 'medium',
        requiresConfirmation: true,
        sessionId: 'mock-session'
      }
    },
    'check weather': {
      success: true,
      action: 'weather_query',
      response: {
        speak: "It's currently 72 degrees and sunny in San Francisco. Perfect day to go outside!",
        display: "☀️ 72°F - Sunny - San Francisco"
      },
      metadata: {
        intent: 'weather_query',
        confidence: 'high',
        requiresConfirmation: false,
        sessionId: 'mock-session'
      }
    }
  };

  /**
   * Mock speech synthesis - just logs to console
   */
  async speak(text: string, options?: any): Promise<void> {
    console.log('🗣️ [MOCK TTS]:', text);
    // Simulate speaking delay
    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Mock stop speaking
   */
  async stopSpeaking(): Promise<void> {
    console.log('🔇 [MOCK] Speech stopped');
  }

  /**
   * Mock speaking status
   */
  async isSpeaking(): Promise<boolean> {
    return false; // Always not speaking in mock
  }

  /**
   * Mock available voices
   */
  async getAvailableVoices(): Promise<any[]> {
    return [
      { identifier: 'com.apple.voice.compact.en-US.Samantha', name: 'Samantha (Mock)', language: 'en-US' },
      { identifier: 'com.apple.voice.compact.en-US.Alex', name: 'Alex (Mock)', language: 'en-US' }
    ];
  }

  /**
   * Mock voice-specific speaking
   */
  async speakWithVoice(text: string, voiceId?: string): Promise<void> {
    console.log(`🗣️ [MOCK TTS - ${voiceId || 'default'}]:`, text);
    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Mock message processing with realistic responses
   */
  async processMessage(text: string, sessionId: string, userId?: string): Promise<MockVoiceResponse> {
    console.log('🧠 [MOCK AI] Processing:', text);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Find best matching response
    const lowerText = text.toLowerCase();
    const matchKey = Object.keys(this.mockResponses).find(key => 
      lowerText.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerText)
    );

    if (matchKey) {
      const response = { ...this.mockResponses[matchKey] };
      response.metadata.sessionId = sessionId;
      return response;
    }

    // Default response for unmatched queries
    return {
      success: true,
      action: 'general_response',
      response: {
        speak: `I understand you said "${text}". This is a mock response - in the real app, I'd process this with AI.`,
        display: `🤖 Mock AI Response\nInput: "${text}"`
      },
      metadata: {
        intent: 'general',
        confidence: 'medium',
        requiresConfirmation: false,
        sessionId
      }
    };
  }

  /**
   * Mock offline response - same as real service
   */
  getOfflineResponse(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('calendar') || lowerText.includes('schedule')) {
      return "[MOCK] I'm simulating an offline calendar response.";
    } else if (lowerText.includes('weather')) {
      return "[MOCK] Weather simulation - 72°F and sunny!";
    } else if (lowerText.includes('remind')) {
      return "[MOCK] I'll simulate setting that reminder.";
    } else if (lowerText.includes('hello') || lowerText.includes('hi')) {
      return "[MOCK] Hello! I'm your mock assistant, ready to help with development!";
    } else {
      return "[MOCK] I heard: " + text + ". This is a simulated response for development.";
    }
  }

  /**
   * Add custom mock responses for testing
   */
  addMockResponse(trigger: string, response: MockVoiceResponse): void {
    this.mockResponses[trigger] = response;
  }

  /**
   * Get all available mock responses (for debugging)
   */
  getMockResponses(): Record<string, MockVoiceResponse> {
    return this.mockResponses;
  }
}

export default new MockVoiceService();