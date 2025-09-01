import { FastifyInstance } from 'fastify';
import { supabase } from '../db/supabase';

export async function healthRoutes(fastify: FastifyInstance) {
  // Database health check
  fastify.get('/health/db', async (_request, _reply) => {
    try {
      const { error } = await supabase.from('conversations').select('count').limit(1);
      
      if (error) {
        return {
          status: 'error',
          message: 'Database not configured or accessible',
          details: error.message,
        };
      }
      
      return {
        status: 'ok',
        message: 'Database connection healthy',
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Database health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}