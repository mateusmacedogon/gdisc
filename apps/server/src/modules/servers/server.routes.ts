import type { FastifyInstance } from 'fastify';
import { serverController } from './server.controller.js';

export async function serverRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: [fastify.authenticate] }, serverController.createServer.bind(serverController));
  fastify.get('/', { preHandler: [fastify.authenticate] }, serverController.getMyServers.bind(serverController));
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, serverController.getServer.bind(serverController));
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, serverController.updateServer.bind(serverController));
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, serverController.deleteServer.bind(serverController));
  fastify.get('/:id/members', { preHandler: [fastify.authenticate] }, serverController.getMembers.bind(serverController));
  fastify.delete('/:id/members/:memberId', { preHandler: [fastify.authenticate] }, serverController.kickMember.bind(serverController));
  fastify.post('/:id/leave', { preHandler: [fastify.authenticate] }, serverController.leaveServer.bind(serverController));
}
