import type { FastifyInstance } from 'fastify';
import { inviteController } from './invite.controller.js';

export async function inviteRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/servers/:serverId/invites',
    { preHandler: [fastify.authenticate] },
    inviteController.createInvite.bind(inviteController)
  );
  fastify.get('/invites/:code', inviteController.getInvite.bind(inviteController));
  fastify.post(
    '/invites/:code/join',
    { preHandler: [fastify.authenticate] },
    inviteController.joinInvite.bind(inviteController)
  );
}
