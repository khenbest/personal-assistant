import { FastifyPluginAsync } from 'fastify';
import { llmService } from '../services/llm-service';
import { db } from '../db/supabase';

interface ChatRequest {
  message: string;
  userId?: string;
  conversationId?: string;
}

interface ChatResponse {
  response: string;
  intent?: string;
  entities?: any;
  event?: any;
  task?: any;
}

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // Health check for chat service
  fastify.get('/api/chat/health', async () => {
    return { status: 'ok', service: 'chat' };
  });

  // Main chat endpoint
  fastify.post<{ Body: ChatRequest }>('/api/chat', async (request, reply) => {
    const { message, userId = 'user_1', conversationId } = request.body;

    if (!message) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    try {
      // Parse the command to understand intent
      const commandResult = await llmService.parseCommand(message);
      
      // Generate appropriate response based on intent
      let context = `User intent: ${commandResult.intent}`;
      if (commandResult.entities) {
        context += `, Entities: ${JSON.stringify(commandResult.entities)}`;
      }

      const response = await llmService.generateResponse(
        context,
        message,
        'friendly'
      );

      // Handle specific intents
      let event = null;
      let task = null;

      if (commandResult.intent === 'schedule' && commandResult.entities.title) {
        // Create calendar event
        event = {
          user_id: userId,
          title: commandResult.entities.title,
          start_time: commandResult.entities.date || new Date(),
          end_time: new Date((commandResult.entities.date || new Date()).getTime() + 3600000), // 1 hour default
          description: commandResult.entities.description,
          attendees: commandResult.entities.attendees,
        };

        try {
          const createdEvent = await db.createCalendarEvent(event);
          event = createdEvent;
        } catch (err) {
          console.error('Failed to create event:', err);
        }
      } else if (commandResult.intent === 'task' && commandResult.entities.title) {
        // Create task
        task = {
          user_id: userId,
          title: commandResult.entities.title,
          description: commandResult.entities.description,
          priority: commandResult.entities.priority || 'medium',
          status: 'pending',
          due_date: commandResult.entities.date,
        };

        try {
          const createdTask = await db.createTask(task);
          task = createdTask;
        } catch (err) {
          console.error('Failed to create task:', err);
        }
      }

      // Store conversation if we have a conversation ID
      if (conversationId) {
        try {
          await db.addMessage(conversationId, 'user', message);
          await db.addMessage(conversationId, 'assistant', response);
        } catch (err) {
          console.error('Failed to store conversation:', err);
        }
      }

      return {
        response,
        intent: commandResult.intent,
        entities: commandResult.entities,
        event,
        task,
      } as ChatResponse;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Failed to process message',
        response: 'I apologize, but I encountered an error processing your request. Please try again.'
      });
    }
  });

  // Create a new conversation
  fastify.post<{ Body: { userId: string; title?: string } }>('/api/chat/conversation', async (request, reply) => {
    const { userId, title } = request.body;

    if (!userId) {
      return reply.code(400).send({ error: 'User ID is required' });
    }

    try {
      const conversation = await db.createConversation(userId, title);
      return conversation;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to create conversation' });
    }
  });
};

export default chatRoutes;