import type { FastifyInstance } from 'fastify';
import { userController } from './user.controller.js';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/me', { preHandler: [fastify.authenticate] }, userController.getMe.bind(userController));
  fastify.patch('/me', { preHandler: [fastify.authenticate] }, userController.updateMe.bind(userController));
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, userController.getUser.bind(userController));
}
