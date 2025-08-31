import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

class VoiceService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private apiUrl = 'http://localhost:3000';

  constructor() {
    this.setupAudioMode();
  }

  private async setupAudioMode() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Failed to setup audio mode:', error);
    }
  }

  // Text to Speech
  async speak(text: string, options?: Speech.SpeechOptions) {
    try {
      const defaultOptions: Speech.SpeechOptions = {
        language: 'en-US',
        pitch: 1.0,
        rate: Platform.OS === 'ios' ? 0.95 : 1.0,
        ...options,
      };
      
      await Speech.speak(text, defaultOptions);
    } catch (error) {
      console.error('Speech error:', error);
      throw error;
    }
  }

  async stopSpeaking() {
    try {
      await Speech.stop();
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  }

  // Speech to Text (Recording)
  async startRecording(): Promise<void> {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission not granted');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<string> {
    if (!this.recording) {
      throw new Error('No recording in progress');
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;

      if (!uri) {
        throw new Error('No recording URI available');
      }

      // For now, we'll send a mock transcription
      // In production, this would send the audio to a transcription service
      return await this.mockTranscription(uri);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  private async mockTranscription(audioUri: string): Promise<string> {
    // Simulate transcription delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return a mock transcription for testing
    const mockPhrases = [
      "What's on my calendar today?",
      "Schedule a meeting for tomorrow at 3pm",
      "Remind me to call John at 5pm",
      "What's the weather like today?",
      "Create a new task for the project",
    ];
    
    return mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
  }

  // Send message to backend and get LLM response
  async processMessage(text: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          userId: 'user_1', // In production, use actual user ID
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.response || "I couldn't process that request.";
    } catch (error) {
      console.error('Error processing message:', error);
      // Fallback to a simple response if backend is unavailable
      return this.getSimpleResponse(text);
    }
  }

  private getSimpleResponse(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('calendar') || lowerText.includes('schedule')) {
      return "You have 3 meetings today. Your next meeting is at 2 PM with the team.";
    } else if (lowerText.includes('weather')) {
      return "It's currently 72 degrees and sunny. Perfect day for outdoor activities!";
    } else if (lowerText.includes('task') || lowerText.includes('todo')) {
      return "You have 5 pending tasks. The highest priority is finishing the project proposal.";
    } else if (lowerText.includes('remind')) {
      return "I've set a reminder for you. You'll be notified at the specified time.";
    } else if (lowerText.includes('hello') || lowerText.includes('hi')) {
      return "Hello! How can I assist you today?";
    } else {
      return "I understand you said: " + text + ". How can I help you with that?";
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  isSpeaking(): boolean {
    return Speech.isSpeakingAsync() as unknown as boolean;
  }
}

export default new VoiceService();