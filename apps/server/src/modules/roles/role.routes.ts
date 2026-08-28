import type { FastifyInstance } from 'fastify';
import { roleController } from './role.controller.js';

export async function roleRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/servers/:serverId/roles',
    { preHandler: [fastify.authenticate] },
    roleController.getRoles.bind(roleController)
  );
  fastify.post(
    '/servers/:serverId/roles',
    { preHandler: [fastify.authenticate] },
    roleController.createRole.bind(roleController)
  );
  fastify.patch(
    '/servers/:serverId/roles/:roleId',
    { preHandler: [fastify.authenticate] },
    roleController.updateRole.bind(roleController)
  );
  fastify.delete(
    '/servers/:serverId/roles/:roleId',
    { preHandler: [fastify.authenticate] },
    roleController.deleteRole.bind(roleController)
  );
  fastify.post(
    '/servers/:serverId/members/:memberId/roles',
    { preHandler: [fastify.authenticate] },
    roleController.assignRole.bind(roleController)
  );
  fastify.delete(
    '/servers/:serverId/members/:memberId/roles/:roleId',
    { preHandler: [fastify.authenticate] },
    roleController.removeRole.bind(roleController)
  );
}
