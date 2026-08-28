import type { FastifyRequest, FastifyReply } from 'fastify';
import { inviteService } from './invite.service.js';
import { createInviteSchema } from './invite.schema.js';
import { requirePermission } from '../../security/permissions.js';
import { PermissionFlags } from '@gdisc/shared';

export class InviteController {
  async createInvite(request: FastifyRequest, reply: FastifyReply) {
    const { serverId } = request.params as { serverId: string };
    const userId = request.user.userId;

    try {
      await requirePermission(serverId, userId, PermissionFlags.CREATE_INVITES);

      const parseResult = createInviteSchema.safeParse(request.body);
      const data = parseResult.success ? parseResult.data : { maxUses: 0, expiresInHours: 0 };

      const invite = await inviteService.createInvite(serverId, userId, data);
      return reply.status(201).send({ invite });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para criar convites',
      });
    }
  }

  async getInvite(request: FastifyRequest, reply: FastifyReply) {
    const { code } = request.params as { code: string };
    const invite = await inviteService.getInviteByCode(code);

    if (!invite) {
      return reply.status(404).send({ error: 'Convite não encontrado ou expirado' });
    }

    return reply.send({ invite });
  }

  async joinInvite(request: FastifyRequest, reply: FastifyReply) {
    const { code } = request.params as { code: string };
    const userId = request.user.userId;

    try {
      const result = await inviteService.joinServerByCode(code, userId);
      return reply.send({ success: true, serverId: result.serverId });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'Join Error',
        message: error.message || 'Erro ao entrar pelo convite',
      });
    }
  }
}

export const inviteController = new InviteController();
