/**
 * Intent Classification API Routes
 * Provides endpoints for intent classification and learning
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getIntentService, getLLMService } from '../services/singleton-service-registry';

interface ClassifyBody {
  text: string;
  context?: Record<string, any>;
}

interface CorrectionBody {
  originalText: string;
  predictedIntent: string;
  correctedIntent: string;
  predictedSlots?: Record<string, any>;
  correctedSlots?: Record<string, any>;
  userId?: string;
}

export default async function intentRoutes(fastify: FastifyInstance) {
  // Get singleton intent service instance
  const intentService = getIntentService();

  // Intent classification endpoint
  fastify.post<{ Body: ClassifyBody }>(
    '/api/intent/classify',
    {
      schema: {
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 1 },
            context: { type: 'object', additionalProperties: true }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              intent: { type: 'string' },
              confidence: { type: 'number' },
              slots: { type: 'object' },
              llmFallback: { type: 'boolean' },
              needsConfirmation: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: ClassifyBody }>, reply: FastifyReply) => {
      const { text } = request.body;

      try {
        const result = await intentService.classifyIntent(text);
        
        // Log for monitoring
        fastify.log.info({
          text,
          intent: result.intent,
          confidence: result.confidence,
          slots: result.slots
        }, 'Intent classified');

        return {
          success: true,
          ...result
        };
      } catch (error) {
        // As per requirement: If LLM fails, error out completely
        fastify.log.error(error, 'Intent classification failed - LLM unavailable');
        
        return reply.code(500).send({
          success: false,
          error: 'Intent classification service unavailable. Please try again later.',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // User correction endpoint for learning
  fastify.post<{ Body: CorrectionBody }>(
    '/api/intent/correction',
    {
      schema: {
        body: {
          type: 'object',
          required: ['originalText', 'predictedIntent', 'correctedIntent'],
          properties: {
            originalText: { type: 'string' },
            predictedIntent: { type: 'string' },
            correctedIntent: { type: 'string' },
            predictedSlots: { type: 'object' },
            correctedSlots: { type: 'object' },
            userId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: CorrectionBody }>, reply: FastifyReply) => {
      const correction = request.body;

      try {
        await intentService.learnFromCorrection({
          originalText: correction.originalText,
          predictedIntent: correction.predictedIntent,
          correctedIntent: correction.correctedIntent,
          predictedSlots: correction.predictedSlots || {},
          correctedSlots: correction.correctedSlots || {}
        });

        fastify.log.info(correction, 'Intent correction recorded');

        return {
          success: true,
          message: 'Correction recorded and applied to learning system'
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to record correction');
        
        // Corrections are not critical - we can continue without them
        return reply.code(500).send({
          success: false,
          error: 'Failed to record correction',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Stats endpoint for monitoring accuracy
  fastify.get('/api/intent/stats', async (_request, reply) => {
    try {
      const stats = await intentService.getClassificationStats();
      return {
        success: true,
        ...stats
      };
    } catch (error) {
      fastify.log.error(error, 'Failed to get stats');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }
  });

  // Health check endpoint
  fastify.get('/api/intent/health', async (_request, reply) => {
    try {
      // Check if LLM service is healthy
      const llmService = getLLMService();
      const isHealthy = await llmService.checkHealth();
      
      return {
        success: true,
        healthy: isHealthy,
        availableProviders: isHealthy ? ['ollama'] : [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return reply.code(500).send({
        success: false,
        healthy: false,
        error: 'Health check failed'
      });
    }
  });
}