import type { FastifyInstance } from 'fastify';
import { messageController } from './message.controller.js';

export async function messageRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/channels/:channelId/messages',
    { preHandler: [fastify.authenticate] },
    messageController.getMessages.bind(messageController)
  );
  fastify.post(
    '/channels/:channelId/messages',
    { preHandler: [fastify.authenticate] },
    messageController.createMessage.bind(messageController)
  );
  fastify.patch(
    '/messages/:messageId',
    { preHandler: [fastify.authenticate] },
    messageController.updateMessage.bind(messageController)
  );
  fastify.delete(
    '/messages/:messageId',
    { preHandler: [fastify.authenticate] },
    messageController.deleteMessage.bind(messageController)
  );
}
