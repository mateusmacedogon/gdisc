import { prisma } from '../../plugins/prisma.js';
import { nanoid } from 'nanoid';
import type { CreateInviteInput } from './invite.schema.js';
import type { InviteSummary, ServerSummary } from '@gdisc/shared';

export class InviteService {
  async createInvite(
    serverId: string,
    creatorId: string,
    input: CreateInviteInput
  ): Promise<InviteSummary> {
    const code = nanoid(8);

    let expiresAt: Date | null = null;
    if (input.expiresInHours > 0) {
      expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
    }

    const invite = await prisma.invite.create({
      data: {
        code,
        serverId,
        creatorId,
        maxUses: input.maxUses,
        expiresAt,
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    return {
      id: invite.id,
      code: invite.code,
      serverId: invite.serverId,
      creatorId: invite.creatorId,
      maxUses: invite.maxUses,
      uses: invite.uses,
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      createdAt: invite.createdAt.toISOString(),
      server: {
        id: invite.server.id,
        name: invite.server.name,
        iconUrl: invite.server.iconUrl,
        memberCount: invite.server._count.members,
      },
    };
  }

  async getInviteByCode(code: string): Promise<InviteSummary | null> {
    const invite = await prisma.invite.findUnique({
      where: { code },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    if (!invite) return null;

    // Check expiration
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return null;
    }

    // Check max uses
    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      return null;
    }

    return {
      id: invite.id,
      code: invite.code,
      serverId: invite.serverId,
      creatorId: invite.creatorId,
      maxUses: invite.maxUses,
      uses: invite.uses,
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      createdAt: invite.createdAt.toISOString(),
      server: {
        id: invite.server.id,
        name: invite.server.name,
        iconUrl: invite.server.iconUrl,
        memberCount: invite.server._count.members,
      },
    };
  }

  async joinServerByCode(code: string, userId: string): Promise<{ serverId: string }> {
    const invite = await prisma.invite.findUnique({
      where: { code },
      include: { server: true },
    });

    if (!invite) {
      throw new Error('Convite inválido ou expirado.');
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new Error('Este convite expirou.');
    }

    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      throw new Error('Este convite atingiu o limite máximo de usos.');
    }

    // Check if already a member
    const existing = await prisma.serverMember.findUnique({
      where: {
        serverId_userId: {
          serverId: invite.serverId,
          userId,
        },
      },
    });

    if (existing) {
      return { serverId: invite.serverId };
    }

    // Add member and increment uses
    await prisma.$transaction([
      prisma.serverMember.create({
        data: {
          serverId: invite.serverId,
          userId,
        },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: {
          uses: {
            increment: 1,
          },
        },
      }),
    ]);

    return { serverId: invite.serverId };
  }
}

export const inviteService = new InviteService();
