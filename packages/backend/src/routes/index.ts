import { FastifyInstance } from 'fastify';
import { commandRoutes } from './command';
import { calendarRoutes } from './calendar';
import { taskRoutes } from './tasks';
import { healthRoutes } from './health';
import { voiceRoutes } from './voice';
import chatRoutes from './chat';
import transcribeRoutes from './transcribe';
import intentRoutes from './intent';

export async function registerRoutes(fastify: FastifyInstance) {
  // Register all route modules
  await fastify.register(healthRoutes, { prefix: '/api' });
  await fastify.register(commandRoutes, { prefix: '/api' });
  await fastify.register(calendarRoutes, { prefix: '/api' });
  await fastify.register(taskRoutes, { prefix: '/api' });
  await fastify.register(voiceRoutes, { prefix: '/api' });
  await fastify.register(chatRoutes);
  await fastify.register(transcribeRoutes);
  await fastify.register(intentRoutes);
}