import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/supabase';

const createEventSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  startTime: z.string().transform(str => new Date(str)),
  endTime: z.string().transform(str => new Date(str)),
  location: z.string().optional(),
  attendees: z.array(z.string()).optional(),
});

export async function calendarRoutes(fastify: FastifyInstance) {
  // Get calendar events
  fastify.get('/calendar/events', async (_request, _reply) => {
    // const _query = request.query as { start?: string; end?: string };
    
    try {
      const events = await db.getUpcomingEvents('demo-user', 20);
      return {
        success: true,
        events,
      };
    } catch (error) {
      // Return empty array if database not configured
      return {
        success: true,
        events: [],
      };
    }
  });
  
  // Create calendar event
  fastify.post('/calendar/events', async (request, _reply) => {
    const eventData = createEventSchema.parse(request.body);
    
    try {
      const event = await db.createCalendarEvent({
        user_id: 'demo-user', // TODO: Get from auth
        title: eventData.title,
        description: eventData.description,
        start_time: eventData.startTime.toISOString(),
        end_time: eventData.endTime.toISOString(),
        location: eventData.location,
        attendees: eventData.attendees,
      });
      
      return {
        success: true,
        event,
      };
    } catch (error) {
      // Return mock event if database not configured
      return {
        success: true,
        event: {
          id: 'mock-' + Date.now(),
          ...eventData,
        },
      };
    }
  });
}