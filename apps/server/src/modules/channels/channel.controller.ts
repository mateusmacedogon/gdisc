import type { FastifyRequest, FastifyReply } from 'fastify';
import { channelService } from './channel.service.js';
import { createChannelSchema, updateChannelSchema } from './channel.schema.js';
import { requirePermission } from '../../security/permissions.js';
import { PermissionFlags } from '@gdisc/shared';
import { prisma } from '../../plugins/prisma.js';

export class ChannelController {
  async createChannel(request: FastifyRequest, reply: FastifyReply) {
    const { serverId } = request.params as { serverId: string };
    const userId = request.user.userId;

    try {
      await requirePermission(serverId, userId, PermissionFlags.MANAGE_CHANNELS);

      const parseResult = createChannelSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos',
        });
      }

      const channel = await channelService.createChannel(serverId, parseResult.data);
      return reply.status(201).send({ channel });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para criar canal',
      });
    }
  }

  async getChannels(request: FastifyRequest, reply: FastifyReply) {
    const { serverId } = request.params as { serverId: string };
    const channels = await channelService.getChannelsByServer(serverId);
    return reply.send({ channels });
  }

  async updateChannel(request: FastifyRequest, reply: FastifyReply) {
    const { serverId, channelId } = request.params as { serverId: string; channelId: string };
    const userId = request.user.userId;

    try {
      await requirePermission(serverId, userId, PermissionFlags.MANAGE_CHANNELS);

      const parseResult = updateChannelSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos',
        });
      }

      const channel = await channelService.updateChannel(channelId, parseResult.data);
      return reply.send({ channel });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para editar canal',
      });
    }
  }

  async deleteChannel(request: FastifyRequest, reply: FastifyReply) {
    const { serverId, channelId } = request.params as { serverId: string; channelId: string };
    const userId = request.user.userId;

    try {
      await requirePermission(serverId, userId, PermissionFlags.MANAGE_CHANNELS);
      await channelService.deleteChannel(channelId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para excluir canal',
      });
    }
  }
}

export const channelController = new ChannelController();
