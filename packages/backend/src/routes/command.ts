import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getIntentService, getCalendarService } from '../services/singleton-service-registry';
import { db } from '../db/supabase';

const commandSchema = z.object({
  command: z.string(),
  type: z.enum(['schedule', 'query', 'task', 'reminder', 'auto', 'test']).optional(),
  options: z.any().optional(),
  userId: z.string().optional(),
});

const querySchema = z.object({
  question: z.string(),
  context: z.string().optional(),
});

// Get singleton service instances
const intentService = getIntentService();
const calendarService = getCalendarService();

export async function commandRoutes(fastify: FastifyInstance) {
  // Process natural language commands with intent classification
  fastify.post('/command', async (request, reply) => {
    const { command, userId } = commandSchema.parse(request.body);
    
    try {
      // Classify intent using IntentService
      const intentResult = await intentService.classifyIntent(command);
      
      // Handle different intents
      switch (intentResult.intent) {
        case 'create_event': {
          // Use CalendarService for event creation
          const result = await calendarService.processVoiceCommand(command, userId || 'demo-user');
          
          if (!result.success) {
            return reply.status(400).send(result);
          }
          
          return {
            success: true,
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            event: result.event,
            message: result.message,
            spokenResponse: result.spokenResponse,
            needsConfirmation: result.needsConfirmation,
            options: result.options,
            predictionId: result.predictionId
          };
        }
        
        case 'task': {
          // Create task
          const task = {
            user_id: 'demo-user', // TODO: Get from auth
            title: intentResult.slots?.title || 'New Task',
            description: intentResult.slots?.description,
            priority: (intentResult.slots?.priority as any) || 'medium',
            due_date: intentResult.slots?.date?.toISOString(),
          };
          
          let savedTask;
          try {
            savedTask = await db.createTask(task);
          } catch (dbError) {
            console.warn('Database not configured, returning mock task');
            savedTask = { ...task, id: 'mock-id', status: 'pending' };
          }
          
          const response = `Task created: ${task.title}`;
          
          return {
            success: true,
            intent: intentResult.intent,
            task: savedTask,
            message: response,
            confidence: intentResult.confidence,
          };
        }
        
        default: {
          // General query or unknown command
          const response = 'I can help you with scheduling events, creating tasks, and setting reminders. Please try a command like "Schedule a meeting tomorrow at 3pm".';
          
          return {
            success: true,
            intent: intentResult.intent,
            message: response,
            confidence: intentResult.confidence,
          };
        }
      }
    } catch (error) {
      fastify.log.error({ error }, 'Command processing error');
      return reply.status(500).send({
        success: false,
        message: 'Failed to process command',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
  
  // Handle queries
  fastify.post('/query', async (request, reply) => {
    const { question, context } = querySchema.parse(request.body);
    
    try {
      // Get relevant data based on the question
      let events = [];
      let tasks = [];
      
      // Try to fetch from database
      try {
        if (question.toLowerCase().includes('calendar') || question.toLowerCase().includes('event')) {
          events = await db.getUpcomingEvents('demo-user', 5);
        }
        if (question.toLowerCase().includes('task') || question.toLowerCase().includes('todo')) {
          tasks = await db.getPendingTasks('demo-user');
        }
      } catch (dbError) {
        console.warn('Database not configured');
      }
      
      // Generate response with context
      const contextStr = `
        User has ${events.length} upcoming events and ${tasks.length} pending tasks.
        ${context || ''}
      `;
      
      const answer = `Based on your data: ${contextStr}\n\nAnswer: I can see you have ${events.length} upcoming events and ${tasks.length} pending tasks. ${question.toLowerCase().includes('next') ? 'Your next event is coming up soon.' : 'How can I help you manage them?'}`;
      
      return {
        success: true,
        answer,
        events,
        tasks,
      };
    } catch (error) {
      fastify.log.error({ error }, 'Query processing error');
      return reply.status(500).send({
        success: false,
        message: 'Failed to process query',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}