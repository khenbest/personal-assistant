/**
 * Unified Routes - Single entry point for all assistant requests
 * Consolidates assistant, voice, and enhanced endpoints
 */

import { FastifyPluginCallback } from 'fastify';
import { ServiceManager } from '../services/service-manager';

interface UnifiedRequest {
  text: string;
  sessionId?: string;
  userId?: string;
  context?: {
    isVoice?: boolean;
    deviceInfo?: {
      platform: 'ios' | 'android' | 'web';
      version: string;
    };
    preferences?: {
      language: string;
      timezone: string;
    };
  };
}

const unifiedRoute: FastifyPluginCallback = (fastify, _, next) => {
  // Get singleton service manager
  const serviceManager = ServiceManager.getInstance(fastify.log as any);
  const orchestrator = serviceManager.getOrchestrator();
  
  /**
   * Main unified endpoint - handles all request types
   */
  fastify.post<{ Body: UnifiedRequest }>('/api/unified/process', async (request, reply) => {
    try {
      const { 
        text, 
        sessionId = generateSessionId(), 
        userId = 'default',
        context = {}
      } = request.body;

      if (!text) {
        return reply.code(400).send({ 
          error: 'Text is required' 
        });
      }

      fastify.log.info({ 
        text, 
        sessionId, 
        isVoice: context.isVoice,
        platform: context.deviceInfo?.platform 
      }, 'Processing unified request');

      // Process through unified orchestrator
      const result = await orchestrator.processUnifiedRequest(
        text,
        sessionId,
        userId,
        context
      );

      // Format response based on request type
      if (context.isVoice) {
        // Voice response format
        return reply.send({
          action: result.action || 'execute',
          response: {
            speak: result.naturalResponse || result.spokenResponse,
            display: result.displayText || result.naturalResponse
          },
          metadata: {
            intent: result.intent,
            confidence: result.confidence,
            sessionId,
            actionId: result.actionId,
            domain: result.domain
          },
          data: result.data,
          suggestedActions: result.suggestedActions
        });
      } else {
        // Standard text response format
        return reply.send({
          success: result.success,
          intent: result.intent || result.metadata?.intent,
          confidence: result.confidence || result.metadata?.confidence,
          response: result.naturalResponse,
          actionId: result.actionId,
          actionName: result.actionName,
          domain: result.domain,
          data: result.result?.data || result.data,
          sessionId,
          suggestedActions: result.suggestedActions
        });
      }

    } catch (error) {
      fastify.log.error({ error }, 'Unified processing failed');
      return reply.code(500).send({ 
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Legacy endpoint mappings for backward compatibility
   */
  
  // Map old assistant endpoint
  fastify.post('/api/assistant/process', async (request, reply) => {
    const body = request.body as any;
    return fastify.inject({
      method: 'POST',
      url: '/api/unified/process',
      payload: {
        ...body,
        context: { ...body.context, isVoice: false }
      }
    }).then(res => reply.code(res.statusCode).send(res.json()));
  });

  // Map enhanced assistant endpoint
  fastify.post('/api/assistant/enhanced', async (request, reply) => {
    const body = request.body as any;
    return fastify.inject({
      method: 'POST',
      url: '/api/unified/process',
      payload: {
        ...body,
        context: { ...body.context, isVoice: false }
      }
    }).then(res => reply.code(res.statusCode).send(res.json()));
  });

  // Map voice endpoint
  fastify.post('/api/voice', async (request, reply) => {
    const body = request.body as any;
    return fastify.inject({
      method: 'POST',
      url: '/api/unified/process',
      payload: {
        text: body.text || body.transcript,
        sessionId: body.sessionId,
        userId: body.userId,
        context: { 
          ...body.context, 
          isVoice: true 
        }
      }
    }).then(res => reply.code(res.statusCode).send(res.json()));
  });

  /**
   * Actions endpoint - get available actions
   */
  fastify.get('/api/unified/actions', async (_, reply) => {
    const executor = serviceManager.getActionExecutor();
    const actions = await executor.getAvailableActions();
    return reply.send(actions);
  });

  /**
   * Actions search endpoint
   */
  fastify.get<{ Querystring: { q: string } }>('/api/unified/actions/search', async (request, reply) => {
    const { q } = request.query;
    if (!q) {
      return reply.code(400).send({ error: 'Query parameter q is required' });
    }
    
    const executor = serviceManager.getActionExecutor();
    const suggestions = executor.getActionSuggestions(q);
    return reply.send(suggestions);
  });

  /**
   * Health check endpoint
   */
  fastify.get('/api/unified/health', async (_, reply) => {
    return reply.send({ 
      status: 'healthy',
      version: '2.0.0',
      architecture: 'unified',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Session management endpoint
   */
  fastify.post('/api/unified/session/new', async (_, reply) => {
    const sessionId = generateSessionId();
    return reply.send({ 
      sessionId,
      created: new Date().toISOString()
    });
  });

  next();
};

// Helper function to generate session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export default unifiedRoute;