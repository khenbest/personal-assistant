/**
 * Transcription Service
 * Handles speech-to-text conversion using multiple providers
 */

import { LLMService } from './llm-service';

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
}

export class TranscriptionService {
  // private llmService: LLMService; // Currently unused

  constructor(_llmService: LLMService) {
    // this.llmService = llmService; // Store when needed
  }

  /**
   * Transcribe audio to text
   * @param audioData Base64 encoded audio or audio buffer
   * @param format Audio format (wav, mp3, m4a, etc.)
   */
  async transcribe(audioData: string | Buffer, format: string = 'wav'): Promise<TranscriptionResult> {
    // Option 1: Use OpenAI Whisper API (if available)
    if (process.env.OPENAI_API_KEY) {
      return this.transcribeWithWhisper(audioData, format);
    }

    // Option 2: Use Google Speech-to-Text (if available)
    if (process.env.GOOGLE_SPEECH_API_KEY) {
      return this.transcribeWithGoogle(audioData, format);
    }

    // Option 3: Use AssemblyAI (if available)
    if (process.env.ASSEMBLYAI_API_KEY) {
      return this.transcribeWithAssemblyAI(audioData, format);
    }

    // Option 4: For development/testing, use mock transcription
    return this.mockTranscription();
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  private async transcribeWithWhisper(audioData: string | Buffer, format: string): Promise<TranscriptionResult> {
    try {
      const formData = new FormData();
      
      // Convert base64 to buffer if needed
      const buffer = typeof audioData === 'string' 
        ? Buffer.from(audioData, 'base64')
        : audioData;
      
      // Create a blob from buffer
      const blob = new Blob([buffer], { type: `audio/${format}` });
      formData.append('file', blob, `audio.${format}`);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData as any,
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.status}`);
      }

      const result = await response.json() as any;
      
      return {
        text: result.text,
        confidence: 0.95, // Whisper doesn't provide confidence scores
        language: result.language || 'en',
      };
    } catch (error) {
      console.error('Whisper transcription failed:', error);
      throw error;
    }
  }

  /**
   * Transcribe using Google Speech-to-Text
   */
  private async transcribeWithGoogle(_audioData: string | Buffer, _format: string): Promise<TranscriptionResult> {
    // Implementation for Google Speech-to-Text API
    // This would require @google-cloud/speech package
    try {
      // const audioBytes = typeof audioData === 'string' ? audioData : audioData.toString('base64');
      
      // Unused variable for now - would be used with Google client
      // const _request = {
      //   audio: {
      //     content: audioBytes,
      //   },
      //   config: {
      //     encoding: format === 'wav' ? 'LINEAR16' : 'MP3',
      //     sampleRateHertz: 16000,
      //     languageCode: 'en-US',
      //   },
      // };

      // Would use Google client here
      // const [response] = await speechClient.recognize(request);
      
      // For now, throw to fall back to mock
      throw new Error('Google Speech-to-Text not configured');
    } catch (error) {
      console.error('Google transcription failed:', error);
      throw error;
    }
  }

  /**
   * Transcribe using AssemblyAI
   */
  private async transcribeWithAssemblyAI(audioData: string | Buffer, _format: string): Promise<TranscriptionResult> {
    try {
      // Upload audio
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'authorization': process.env.ASSEMBLYAI_API_KEY!,
          'content-type': 'application/octet-stream',
        },
        body: typeof audioData === 'string' ? Buffer.from(audioData, 'base64') : audioData,
      });

      const uploadResult = await uploadResponse.json() as any;
      const upload_url = uploadResult.upload_url;

      // Request transcription
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'authorization': process.env.ASSEMBLYAI_API_KEY!,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: upload_url,
          language_code: 'en',
        }),
      });

      const transcript = await transcriptResponse.json() as any;

      // Poll for completion
      let result: any;
      while (true) {
        const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcript.id}`, {
          headers: {
            'authorization': process.env.ASSEMBLYAI_API_KEY!,
          },
        });
        
        result = await pollingResponse.json();
        
        if ((result as any).status === 'completed') {
          break;
        } else if ((result as any).status === 'error') {
          throw new Error('Transcription failed');
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return {
        text: (result as any).text,
        confidence: (result as any).confidence || 0.9,
        language: 'en',
        duration: (result as any).audio_duration,
      };
    } catch (error) {
      console.error('AssemblyAI transcription failed:', error);
      throw error;
    }
  }

  /**
   * Mock transcription for development
   */
  private async mockTranscription(): Promise<TranscriptionResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockCommands = [
      "Schedule team meeting tomorrow at 3pm",
      "Book conference room for Friday from 2 to 4pm",
      "Add dentist appointment next Monday at 10am",
      "Create lunch meeting tomorrow at noon with Sarah",
      "Set up weekly standup every Monday at 9am",
      "Schedule project review next Thursday at 2:30pm",
    ];
    
    const text = mockCommands[Math.floor(Math.random() * mockCommands.length)];
    
    return {
      text: text!,
      confidence: 0.95,
      language: 'en',
      duration: 2.5,
    };
  }

  /**
   * Get available transcription providers
   */
  getAvailableProviders(): string[] {
    const providers = [];
    
    if (process.env.OPENAI_API_KEY) {
      providers.push('whisper');
    }
    if (process.env.GOOGLE_SPEECH_API_KEY) {
      providers.push('google');
    }
    if (process.env.ASSEMBLYAI_API_KEY) {
      providers.push('assemblyai');
    }
    
    if (providers.length === 0) {
      providers.push('mock');
    }
    
    return providers;
  }
}

export default TranscriptionService;