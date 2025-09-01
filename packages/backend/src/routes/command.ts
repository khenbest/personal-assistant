import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { llmService } from '../services/llm-service';
import { db } from '../db/supabase';

const commandSchema = z.object({
  command: z.string(),
  type: z.enum(['schedule', 'query', 'task', 'reminder', 'auto', 'test']).optional(),
  options: z.any().optional(),
});

const querySchema = z.object({
  question: z.string(),
  context: z.string().optional(),
});

export async function commandRoutes(fastify: FastifyInstance) {
  // Process natural language commands
  fastify.post('/command', async (request, reply) => {
    const { command } = commandSchema.parse(request.body);
    
    try {
      // Parse the command using LLM
      const parsed = await llmService.parseCommand(command);
      
      // Handle different intents
      switch (parsed.intent) {
        case 'schedule': {
          // Create calendar event
          const event = {
            user_id: 'demo-user', // TODO: Get from auth
            title: parsed.entities.title || 'New Event',
            description: parsed.entities.description,
            start_time: parsed.entities.date?.toISOString() || new Date().toISOString(),
            end_time: new Date(parsed.entities.date?.getTime() || Date.now() + 3600000).toISOString(),
            location: parsed.entities.location,
            attendees: parsed.entities.attendees,
          };
          
          // Save to database if Supabase is configured
          let savedEvent;
          try {
            savedEvent = await db.createCalendarEvent(event);
          } catch (dbError) {
            console.warn('Database not configured, returning mock event');
            savedEvent = { ...event, id: 'mock-id' };
          }
          
          // Generate response
          const response = await llmService.generateResponse(
            `Event scheduled: ${event.title}`,
            command,
            'friendly'
          );
          
          return {
            success: true,
            intent: parsed.intent,
            event: savedEvent,
            message: response,
            confidence: parsed.confidence,
          };
        }
        
        case 'task': {
          // Create task
          const task = {
            user_id: 'demo-user', // TODO: Get from auth
            title: parsed.entities.title || 'New Task',
            description: parsed.entities.description,
            priority: (parsed.entities.priority as any) || 'medium',
            due_date: parsed.entities.date?.toISOString(),
          };
          
          let savedTask;
          try {
            savedTask = await db.createTask(task);
          } catch (dbError) {
            console.warn('Database not configured, returning mock task');
            savedTask = { ...task, id: 'mock-id', status: 'pending' };
          }
          
          const response = await llmService.generateResponse(
            `Task created: ${task.title}`,
            command,
            'friendly'
          );
          
          return {
            success: true,
            intent: parsed.intent,
            task: savedTask,
            message: response,
            confidence: parsed.confidence,
          };
        }
        
        default: {
          // General query or unknown command
          const response = await llmService.generateResponse(
            'General assistance',
            command,
            'friendly'
          );
          
          return {
            success: true,
            intent: parsed.intent,
            message: response,
            confidence: parsed.confidence,
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
      
      const answer = await llmService.generateResponse(contextStr, question, 'friendly');
      
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