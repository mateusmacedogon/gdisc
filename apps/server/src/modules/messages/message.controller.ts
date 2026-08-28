import type { FastifyRequest, FastifyReply } from 'fastify';
import { messageService } from './message.service.js';
import {
  createMessageSchema,
  updateMessageSchema,
  getMessagesQuerySchema,
} from './message.schema.js';
import { requirePermission, getMemberPermissions } from '../../security/permissions.js';
import { PermissionFlags, hasPermission } from '@gdisc/shared';
import { prisma } from '../../plugins/prisma.js';
import { connectionManager } from '../../realtime/connectionManager.js';
import { WSEvents } from '@gdisc/shared';

export class MessageController {
  async getMessages(request: FastifyRequest, reply: FastifyReply) {
    const { channelId } = request.params as { channelId: string };
    const userId = request.user.userId;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return reply.status(404).send({ error: 'Canal não encontrado' });
    }

    try {
      await requirePermission(channel.serverId, userId, PermissionFlags.VIEW_CHANNEL);

      const parseResult = getMessagesQuerySchema.safeParse(request.query);
      const query = parseResult.success ? parseResult.data : { limit: 50 };

      const messages = await messageService.getChannelMessages(channelId, query);
      return reply.send({ messages });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para visualizar mensagens',
      });
    }
  }

  async createMessage(request: FastifyRequest, reply: FastifyReply) {
    const { channelId } = request.params as { channelId: string };
    const userId = request.user.userId;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return reply.status(404).send({ error: 'Canal não encontrado' });
    }

    try {
      await requirePermission(channel.serverId, userId, PermissionFlags.SEND_MESSAGES);

      const parseResult = createMessageSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos',
        });
      }

      const message = await messageService.createMessage(
        channelId,
        userId,
        parseResult.data
      );

      // Broadcast message created event to all connected users in the server
      connectionManager.broadcastToServer(channel.serverId, {
        event: WSEvents.CHAT_MESSAGE_CREATED,
        data: { message },
      });

      return reply.status(201).send({ message });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para enviar mensagens',
      });
    }
  }

  async updateMessage(request: FastifyRequest, reply: FastifyReply) {
    const { messageId } = request.params as { messageId: string };
    const userId = request.user.userId;

    try {
      const parseResult = updateMessageSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos',
        });
      }

      const message = await messageService.updateMessage(
        messageId,
        userId,
        parseResult.data
      );

      const channel = await prisma.channel.findUnique({
        where: { id: message.channelId },
      });

      if (channel) {
        connectionManager.broadcastToServer(channel.serverId, {
          event: WSEvents.CHAT_MESSAGE_UPDATED,
          data: { message },
        });
      }

      return reply.send({ message });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'Update Error',
        message: error.message || 'Erro ao editar mensagem',
      });
    }
  }

  async deleteMessage(request: FastifyRequest, reply: FastifyReply) {
    const { messageId } = request.params as { messageId: string };
    const userId = request.user.userId;

    const message = await messageService.getMessageById(messageId);
    if (!message) {
      return reply.status(404).send({ error: 'Mensagem não encontrada' });
    }

    const isAuthor = message.authorId === userId;

    if (!isAuthor) {
      const perms = await getMemberPermissions(message.channel.serverId, userId);
      const canManage = perms && hasPermission(perms.permissions, PermissionFlags.MANAGE_MESSAGES);
      if (!canManage) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Você não tem permissão para deletar esta mensagem.',
        });
      }
    }

    await messageService.deleteMessage(messageId);

    connectionManager.broadcastToServer(message.channel.serverId, {
      event: WSEvents.CHAT_MESSAGE_DELETED,
      data: {
        messageId,
        channelId: message.channelId,
      },
    });

    return reply.send({ success: true });
  }
}

export const messageController = new MessageController();
