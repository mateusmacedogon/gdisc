import type { FastifyInstance } from 'fastify';
import { channelController } from './channel.controller.js';

export async function channelRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/servers/:serverId/channels',
    { preHandler: [fastify.authenticate] },
    channelController.createChannel.bind(channelController)
  );
  fastify.get(
    '/servers/:serverId/channels',
    { preHandler: [fastify.authenticate] },
    channelController.getChannels.bind(channelController)
  );
  fastify.patch(
    '/servers/:serverId/channels/:channelId',
    { preHandler: [fastify.authenticate] },
    channelController.updateChannel.bind(channelController)
  );
  fastify.delete(
    '/servers/:serverId/channels/:channelId',
    { preHandler: [fastify.authenticate] },
    channelController.deleteChannel.bind(channelController)
  );
}
