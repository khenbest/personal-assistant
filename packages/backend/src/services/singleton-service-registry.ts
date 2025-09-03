/**
 * Singleton Service Registry - Manages singleton service instances
 * Prevents multiple initializations of expensive services
 */

import { LLMService } from './llm-service';
import { IntentClassificationService } from './intent-classification-service';
import { CalendarService } from './calendar-service';
import { VoiceService } from './voice-service';
import { TranscriptionService } from './transcription-service';
import { IntentClassificationLoggerService } from './intent-classification-logger-service';

class SingletonServiceRegistry {
  private static instance: SingletonServiceRegistry;
  private llmService?: LLMService;
  private intentService?: IntentClassificationService;
  private calendarService?: CalendarService;
  private voiceProcessor?: VoiceService;
  private transcriptionService?: TranscriptionService;
  private classificationLogger?: IntentClassificationLoggerService;

  private constructor() {}

  public static getInstance(): SingletonServiceRegistry {
    if (!SingletonServiceRegistry.instance) {
      SingletonServiceRegistry.instance = new SingletonServiceRegistry();
    }
    return SingletonServiceRegistry.instance;
  }

  public getLLMService(): LLMService {
    if (!this.llmService) {
      console.log('🏭 Creating singleton LLMService instance');
      this.llmService = new LLMService();
    }
    return this.llmService;
  }

  public getIntentService(): IntentClassificationService {
    if (!this.intentService) {
      console.log('🏭 Creating singleton IntentClassificationService instance');
      this.intentService = new IntentClassificationService(this.getLLMService(), this.getClassificationLogger());
    }
    return this.intentService;
  }

  public getCalendarService(): CalendarService {
    if (!this.calendarService) {
      console.log('🏭 Creating singleton CalendarService instance');
      this.calendarService = new CalendarService(this.getIntentService());
    }
    return this.calendarService;
  }

  public getVoiceService(): VoiceService {
    if (!this.voiceProcessor) {
      console.log('🏭 Creating singleton VoiceService instance');
      this.voiceProcessor = new VoiceService(this.getIntentService());
    }
    return this.voiceProcessor;
  }

  public getTranscriptionService(): TranscriptionService {
    if (!this.transcriptionService) {
      console.log('🏭 Creating singleton TranscriptionService instance');
      this.transcriptionService = new TranscriptionService(this.getLLMService());
    }
    return this.transcriptionService;
  }

  public getClassificationLogger(): IntentClassificationLoggerService {
    if (!this.classificationLogger) {
      console.log('🏭 Creating singleton IntentClassificationLoggerService instance');
      this.classificationLogger = new IntentClassificationLoggerService('v1.0.0');
    }
    return this.classificationLogger;
  }
}

// Export singleton registry
export const serviceRegistry = SingletonServiceRegistry.getInstance();

// Export convenience functions for common services
export const getLLMService = () => serviceRegistry.getLLMService();
export const getIntentService = () => serviceRegistry.getIntentService();
export const getCalendarService = () => serviceRegistry.getCalendarService();
export const getVoiceService = () => serviceRegistry.getVoiceService();
export const getTranscriptionService = () => serviceRegistry.getTranscriptionService();