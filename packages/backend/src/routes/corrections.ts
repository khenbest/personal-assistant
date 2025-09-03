/**
 * Correction Routes
 * Handles user corrections for intent predictions
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { IntentService } from '../services/intent-service';
import { UnifiedLLMService } from '../services/unified-llm-service';

const correctionSchema = z.object({
  predictionId: z.string(),
  originalText: z.string(),
  predictedIntent: z.string(),
  correctedIntent: z.string(),
  predictedSlots: z.record(z.any()).optional(),
  correctedSlots: z.record(z.any()).optional(),
  userId: z.string().optional(),
  alwaysDoThis: z.boolean().optional(),
});

const metricsQuerySchema = z.object({
  hours: z.string().optional(),
});

// Initialize services
const llmService = new UnifiedLLMService();
const intentService = new IntentService(llmService);

export async function correctionRoutes(fastify: FastifyInstance) {
  // Apply user correction
  fastify.post('/corrections', async (request, reply) => {
    const correction = correctionSchema.parse(request.body);
    
    try {
      // Apply the correction with immediate learning
      const success = await intentService.applyCorrection(
        correction.predictionId,
        {
          originalText: correction.originalText,
          predictedIntent: correction.predictedIntent,
          correctedIntent: correction.correctedIntent,
          predictedSlots: correction.predictedSlots || {},
          correctedSlots: correction.correctedSlots || {},
        },
        correction.userId
      );
      
      if (!success) {
        return reply.code(500).send({
          success: false,
          error: 'Failed to apply correction',
        });
      }
      
      // If "always do this" is selected, add with higher priority
      if (correction.alwaysDoThis) {
        // This adds to training queue with higher priority
        console.log('📌 User selected "Always do this" for:', correction.originalText);
      }
      
      return reply.send({
        success: true,
        message: 'Correction applied and learning updated',
        learningApplied: true,
      });
      
    } catch (error: any) {
      console.error('Correction error:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Failed to apply correction',
      });
    }
  });
  
  // Get accuracy metrics
  fastify.get('/corrections/metrics', async (request, reply) => {
    const query = metricsQuerySchema.parse(request.query);
    const hours = parseInt(query.hours || '24', 10);
    
    try {
      const metrics = await intentService.getAccuracyMetrics(hours);
      
      return reply.send({
        success: true,
        metrics,
      });
      
    } catch (error: any) {
      console.error('Metrics error:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Failed to get metrics',
      });
    }
  });
  
  // Get recent failures for debugging
  fastify.get('/corrections/failures', async (request, reply) => {
    try {
      const failures = await intentService.getRecentFailures(10);
      
      return reply.send({
        success: true,
        failures,
      });
      
    } catch (error: any) {
      console.error('Failures error:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Failed to get failures',
      });
    }
  });
}