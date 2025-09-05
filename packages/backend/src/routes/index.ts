import { FastifyInstance } from 'fastify';
import unifiedRoutes from './unified';
// Legacy routes - will be deprecated
import { commandRoutes } from './command';
import { calendarRoutes } from './calendar';
import { taskRoutes } from './tasks';
import { healthRoutes } from './health';
import { correctionRoutes } from './corrections';
import chatRoutes from './chat';
import transcribeRoutes from './transcribe';

export async function registerRoutes(fastify: FastifyInstance) {
  // Register unified route FIRST (includes legacy endpoint mappings)
  await fastify.register(unifiedRoutes);
  
  // Register other routes that aren't replaced by unified
  await fastify.register(healthRoutes, { prefix: '/api' });
  await fastify.register(commandRoutes, { prefix: '/api' });
  await fastify.register(calendarRoutes, { prefix: '/api' });
  await fastify.register(taskRoutes, { prefix: '/api' });
  await fastify.register(correctionRoutes, { prefix: '/api' });
  await fastify.register(chatRoutes);
  await fastify.register(transcribeRoutes);
  
  // Note: assistant, voice, and intent routes are now handled by unified
  // They are mapped for backward compatibility in unified.ts
}