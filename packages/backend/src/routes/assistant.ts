import { FastifyPluginCallback } from 'fastify';
import { IntentClassificationService } from '../services/intent-classification-service';
import { ActionExecutor } from '../services/action-executor';
import { LLMService } from '../services/llm-service';

interface AssistantRequest {
  text: string;
  sessionId?: string;
  context?: Record<string, any>;
}

interface AssistantResponse {
  intent: string;
  confidence: number;
  response: string;
  data?: any;
  sessionId: string;
  followUp?: string;
}

const assistantRoute: FastifyPluginCallback = (fastify, _, next) => {
  const intentService = new IntentClassificationService(
    new LLMService()
  );
  const actionExecutor = new ActionExecutor(fastify.log as any);

  // Main assistant endpoint - classify intent and execute action
  fastify.post<{ Body: AssistantRequest }>('/api/assistant/process', async (request, reply) => {
    try {
      const { text, sessionId = generateSessionId() } = request.body;

      if (!text) {
        return reply.code(400).send({ 
          error: 'Text is required' 
        });
      }

      // Step 1: Classify the intent
      fastify.log.info({ text }, 'Processing assistant request');
      const classification = await intentService.classifyIntent(text);

      // Step 2: Execute the action based on the intent
      const actionResult = await actionExecutor.execute(classification);

      // Step 3: Generate natural language response
      const response = actionExecutor.generateResponse(actionResult);

      // Step 4: Return the complete response
      const assistantResponse: AssistantResponse = {
        intent: classification.intent,
        confidence: classification.confidence,
        response,
        data: actionResult.data,
        sessionId,
        followUp: actionResult.followUp
      };

      fastify.log.info(
        { 
          intent: classification.intent,
          success: actionResult.success 
        }, 
        'Assistant request processed'
      );

      return reply.send(assistantResponse);

    } catch (error) {
      fastify.log.error({ error }, 'Assistant processing failed');
      return reply.code(500).send({ 
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Health check endpoint
  fastify.get('/api/assistant/health', async (_, reply) => {
    return reply.send({ 
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  // Session management endpoint
  fastify.post('/api/assistant/session/new', async (_, reply) => {
    const sessionId = generateSessionId();
    return reply.send({ 
      sessionId,
      created: new Date().toISOString()
    });
  });

  next();
};

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default assistantRoute;