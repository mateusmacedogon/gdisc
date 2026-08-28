import type { FastifyRequest, FastifyReply } from 'fastify';
import { serverService } from './server.service.js';
import { createServerSchema, updateServerSchema } from './server.schema.js';
import { requirePermission } from '../../security/permissions.js';
import { PermissionFlags } from '@gdisc/shared';

export class ServerController {
  async createServer(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createServerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parseResult.error.errors[0]?.message || 'Dados inválidos',
      });
    }

    try {
      const server = await serverService.createServer(request.user.userId, parseResult.data);
      return reply.status(201).send({ server });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'Server Creation Error',
        message: error.message || 'Erro ao criar servidor',
      });
    }
  }

  async getMyServers(request: FastifyRequest, reply: FastifyReply) {
    const servers = await serverService.getUserServers(request.user.userId);
    return reply.send({ servers });
  }

  async getServer(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const server = await serverService.getServerById(id);
    if (!server) {
      return reply.status(404).send({ error: 'Servidor não encontrado' });
    }
    return reply.send({ server });
  }

  async updateServer(request: FastifyRequest, reply: FastifyReply) {
    const { id: serverId } = request.params as { id: string };
    const userId = request.user.userId;

    try {
      await requirePermission(serverId, userId, PermissionFlags.MANAGE_SERVER);

      const parseResult = updateServerSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos',
        });
      }

      const updated = await serverService.updateServer(serverId, parseResult.data);
      return reply.send({ server: updated });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Não autorizado',
      });
    }
  }

  async deleteServer(request: FastifyRequest, reply: FastifyReply) {
    const { id: serverId } = request.params as { id: string };
    const userId = request.user.userId;

    try {
      await serverService.deleteServer(serverId, userId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Erro ao deletar servidor',
      });
    }
  }

  async getMembers(request: FastifyRequest, reply: FastifyReply) {
    const { id: serverId } = request.params as { id: string };
    const members = await serverService.getServerMembers(serverId);
    return reply.send({ members });
  }

  async leaveServer(request: FastifyRequest, reply: FastifyReply) {
    const { id: serverId } = request.params as { id: string };
    const userId = request.user.userId;

    try {
      await serverService.leaveServer(serverId, userId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'Leave Server Error',
        message: error.message || 'Erro ao sair do servidor',
      });
    }
  }
}

export const serverController = new ServerController();
