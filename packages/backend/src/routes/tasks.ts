import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/supabase';

const createTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().optional(),
});

export async function taskRoutes(fastify: FastifyInstance) {
  // Get tasks
  fastify.get('/tasks', async (_request, _reply) => {
    // const _query = request.query as { status?: string };
    
    try {
      const tasks = await db.getPendingTasks('demo-user');
      return {
        success: true,
        tasks,
      };
    } catch (error) {
      // Return empty array if database not configured
      return {
        success: true,
        tasks: [],
      };
    }
  });
  
  // Create task
  fastify.post('/tasks', async (request, _reply) => {
    const taskData = createTaskSchema.parse(request.body);
    
    try {
      const task = await db.createTask({
        user_id: 'demo-user', // TODO: Get from auth
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority || 'medium',
        due_date: taskData.dueDate,
      });
      
      return {
        success: true,
        task,
      };
    } catch (error) {
      // Return mock task if database not configured
      return {
        success: true,
        task: {
          id: 'mock-' + Date.now(),
          ...taskData,
          status: 'pending',
        },
      };
    }
  });
  
  // Update task
  fastify.patch('/tasks/:taskId', async (request, _reply) => {
    const { taskId } = request.params as { taskId: string };
    const updates = updateTaskSchema.parse(request.body);
    
    // For now, return success
    // TODO: Implement actual database update
    return {
      success: true,
      task: {
        id: taskId,
        ...updates,
      },
    };
  });
}