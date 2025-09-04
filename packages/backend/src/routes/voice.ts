/**
 * Voice Command Routes
 * Handles voice input processing and TTS responses
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { reminderService } from '../services/reminder-service';
import { noteService } from '../services/note-service';
import { 
  getIntentService, 
  getCalendarService, 
  getVoiceService, 
  getTranscriptionService 
} from '../services/singleton-service-registry';

const voiceCommandSchema = z.object({
  text: z.string(),
  audio: z.any().optional(), // Base64 audio or buffer
  userId: z.string().optional(),
  conversationId: z.string().optional(),
});

const correctionSchema = z.object({
  predictionId: z.string(),
  correctedIntent: z.string(),
  correctedSlots: z.record(z.any()),
});

// Get singleton service instances
const intentService = getIntentService();
const calendarService = getCalendarService();
const voiceProcessor = getVoiceService();
const transcriptionService = getTranscriptionService();

// Phase 2/3: Advanced orchestrator with conversation context and multi-step planning
// import { LLMOrchestrator } from '../services/llm-orchestrator';
// const orchestrator = new LLMOrchestrator();

export async function voiceRoutes(fastify: FastifyInstance) {
  // NEW: Intelligent voice processing endpoint
  fastify.post('/voice/process', async (request, reply) => {
    const { text, sessionId, userId } = request.body as {
      text: string;
      sessionId: string;
      userId?: string;
    };

    try {
      // Validate input
      if (!text || !sessionId) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: text and sessionId'
        });
      }

      // Process through MVP processor with designed thresholds (0.81/0.91)
      const result = await voiceProcessor.processVoiceIntent(
        text,
        sessionId,
        userId || 'demo-user'
      );

      return {
        success: true,
        ...result
      };

    } catch (error: any) {
      fastify.log.error({ error }, 'Voice processing error');
      return reply.status(500).send({
        success: false,
        action: 'error',
        response: {
          speak: "I'm sorry, I encountered an error. Please try again."
        },
        metadata: {
          intent: 'none',
          confidence: 'low',
          requiresConfirmation: false,
          sessionId
        },
        error: error.message
      });
    }
  });

  // Handle corrections from the frontend
  fastify.post('/voice/correct', async (request, reply) => {
    const { sessionId, correction } = request.body as {
      sessionId: string;
      correction: {
        originalIntent: string;
        correctedIntent: string;
        originalSlots: Record<string, any>;
        correctedSlots: Record<string, any>;
        alwaysApply: boolean;
      };
    };

    try {
      // MVP: Use the voiceProcessor instead of orchestrator
      const result = await voiceProcessor.handleCorrection(sessionId, correction);
      
      return {
        success: true,
        ...result
      };
      
    } catch (error: any) {
      fastify.log.error({ error }, 'Correction handling error');
      return reply.status(500).send({
        success: false,
        error: 'Failed to apply correction',
        message: error.message
      });
    }
  });

  // DEPRECATED: Old command endpoint (keeping for backward compatibility)
  fastify.post('/voice/command', async (request, reply) => {
    const { text, userId, conversationId } = voiceCommandSchema.parse(request.body);
    
    try {
      // For now, we process text directly (audio transcription would happen here)
      // In production, you'd use WhisperKit or another STT service
      
      // Classify intent
      const intentResult = await intentService.classifyIntent(text);
      
      // Process based on intent
      let result: any;
      switch (intentResult.intent) {
        case 'create_event':
          result = await calendarService.createEventFromText(text, userId || 'demo-user');
          break;
          
        case 'add_reminder':
          result = await reminderService.processReminderCommand(text, userId || 'demo-user');
          break;
          
        case 'create_note':
          result = await noteService.processNoteCommand(text, userId || 'demo-user');
          break;
          
        case 'send_email':
        case 'read_email':
          // TODO: Implement email service
          result = {
            success: false,
            message: 'Email functionality coming soon',
            spokenResponse: "I'll be able to handle emails for you soon.",
            intent: intentResult.intent
          };
          break;
          
        default:
          result = {
            success: false,
            message: 'I couldn\'t understand that command',
            spokenResponse: "I'm sorry, I didn't understand that. Please try a command like 'Schedule a meeting tomorrow at 3pm'",
            intent: intentResult.intent
          };
      }
      
      // Add intent classification details
      result.intent = intentResult.intent;
      result.confidence = intentResult.confidence;
      
      // Generate audio URL for TTS (mock for now)
      if (result.spokenResponse) {
        result.audioUrl = `/api/tts?text=${encodeURIComponent(result.spokenResponse)}`;
      }
      
      // Store conversation if ID provided
      if (conversationId) {
        // TODO: Store in conversation history
      }
      
      return result;
      
    } catch (error: any) {
      fastify.log.error({ error }, 'Voice command processing error');
      return reply.status(500).send({
        success: false,
        message: 'Failed to process voice command',
        spokenResponse: "I'm sorry, something went wrong. Please try again.",
        error: error.message
      });
    }
  });
  
  // Handle intent corrections for learning
  fastify.post('/intent/correct', async (request, reply) => {
    const correction = correctionSchema.parse(request.body);
    
    try {
      // Get original prediction (would be from database in production)
      // For now, we'll create a mock correction
      await intentService.learnFromCorrection({
        originalText: 'original command', // Would fetch from DB
        predictedIntent: 'create_event',
        correctedIntent: correction.correctedIntent,
        predictedSlots: {},
        correctedSlots: correction.correctedSlots
      });
      
      return {
        success: true,
        message: 'Thank you for the correction. I\'ll remember this for next time.'
      };
      
    } catch (error: any) {
      fastify.log.error({ error }, 'Correction processing error');
      return reply.status(500).send({
        success: false,
        message: 'Failed to process correction',
        error: error.message
      });
    }
  });
  
  // Mock TTS endpoint (would use real TTS in production)
  fastify.get('/tts', async (request, reply) => {
    const { text } = request.query as { text: string };
    
    // In production, this would generate actual audio
    // For now, return a mock audio file URL
    return reply.type('audio/mpeg').send('Mock audio data for: ' + text);
  });
  
  // Transcribe audio to text
  fastify.post('/voice/transcribe', async (request, reply) => {
    const { audio, format } = request.body as { audio: string; format?: string };
    
    try {
      if (!audio) {
        return reply.status(400).send({
          success: false,
          error: 'No audio data provided'
        });
      }
      
      // Transcribe the audio
      const result = await transcriptionService.transcribe(audio, format || 'wav');
      
      return {
        success: true,
        text: result.text,
        confidence: result.confidence,
        language: result.language,
        duration: result.duration,
        providers: transcriptionService.getAvailableProviders()
      };
      
    } catch (error: any) {
      fastify.log.error({ error }, 'Transcription error');
      return reply.status(500).send({
        success: false,
        error: 'Failed to transcribe audio',
        message: error.message
      });
    }
  });
}