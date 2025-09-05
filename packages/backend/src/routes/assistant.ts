import { FastifyPluginCallback } from 'fastify';
import { IntentClassificationService } from '../services/intent-classification-service';
import { ActionExecutor } from '../services/action-executor';
import { EnhancedActionExecutor } from '../services/enhanced-action-executor';
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
  const enhancedExecutor = new EnhancedActionExecutor(fastify.log as any);

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
      const classificationResult = await intentService.classifyIntent(text);
      
      // Convert to expected format
      const classification = {
        ...classificationResult,
        text
      };

      // Step 2: Execute the action based on the intent
      const actionResult = await actionExecutor.execute(classification);

      // Step 3: Generate natural language response
      const response = actionExecutor.generateResponse(actionResult);

      // Step 4: Return the complete response
      const assistantResponse: AssistantResponse = {
        intent: classificationResult.intent,
        confidence: classificationResult.confidence,
        response,
        data: actionResult.data,
        sessionId,
        followUp: actionResult.followUp
      };

      fastify.log.info(
        { 
          intent: classificationResult.intent,
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

  // Enhanced assistant endpoint with iOS actions support
  fastify.post<{ Body: AssistantRequest }>('/api/assistant/enhanced', async (request, reply) => {
    try {
      const { text, sessionId = generateSessionId(), context } = request.body;

      if (!text) {
        return reply.code(400).send({ 
          error: 'Text is required' 
        });
      }

      // Step 1: Classify the intent
      fastify.log.info({ text }, 'Processing enhanced assistant request');
      const classification = await intentService.classifyIntent(text);

      // Step 2: Execute using enhanced executor with iOS actions
      const enhancedResult = await enhancedExecutor.executeFromIntent(
        classification,
        text,
        {
          sessionId,
          deviceInfo: context?.deviceInfo,
          preferences: context?.preferences
        }
      );

      // Step 3: Return the enhanced response
      const assistantResponse = {
        intent: classification.intent,
        confidence: classification.confidence,
        response: enhancedResult.naturalResponse,
        success: enhancedResult.success,
        actionId: enhancedResult.actionId,
        actionName: enhancedResult.actionName,
        domain: enhancedResult.domain,
        data: enhancedResult.result?.data,
        sessionId,
        suggestedActions: enhancedResult.suggestedActions?.map(action => ({
          id: action.id,
          name: action.name,
          description: action.description,
          examples: action.examples
        })),
        requiresUserInteraction: enhancedResult.result?.requiresUserInteraction
      };

      fastify.log.info(
        { 
          intent: classification.intent,
          actionId: enhancedResult.actionId,
          success: enhancedResult.success 
        }, 
        'Enhanced assistant request processed'
      );

      return reply.send(assistantResponse);

    } catch (error) {
      fastify.log.error({ error }, 'Enhanced assistant processing failed');
      return reply.code(500).send({ 
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get available iOS actions endpoint
  fastify.get('/api/assistant/actions', async (_request, reply) => {
    try {
      const availableActions = await enhancedExecutor.getAvailableActions();
      
      const groupedActions = availableActions.reduce((acc, action) => {
        const domain = action.domain || 'other';
        if (!acc[domain]) {
          acc[domain] = [];
        }
        acc[domain].push({
          id: action.id,
          name: action.name,
          description: action.description,
          examples: action.examples,
          requiredPermissions: action.requiredPermissions
        });
        return acc;
      }, {} as Record<string, any[]>);

      return reply.send({
        totalActions: availableActions.length,
        domains: Object.keys(groupedActions),
        actions: groupedActions
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get available actions');
      return reply.code(500).send({ 
        error: 'Failed to retrieve actions' 
      });
    }
  });

  // Search actions endpoint
  fastify.get<{ Querystring: { q: string } }>('/api/assistant/actions/search', async (request, reply) => {
    try {
      const { q } = request.query;
      
      if (!q) {
        return reply.code(400).send({ 
          error: 'Query parameter q is required' 
        });
      }

      const suggestions = enhancedExecutor.getActionSuggestions(q);
      
      return reply.send({
        query: q,
        count: suggestions.length,
        suggestions: suggestions.map(action => ({
          id: action.id,
          name: action.name,
          description: action.description,
          domain: action.domain,
          examples: action.examples
        }))
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to search actions');
      return reply.code(500).send({ 
        error: 'Failed to search actions' 
      });
    }
  });

  next();
};

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default assistantRoute;