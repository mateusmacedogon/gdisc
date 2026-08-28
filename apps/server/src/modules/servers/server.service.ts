import { prisma } from '../../plugins/prisma.js';
import { DEFAULT_EVERYONE_PERMISSIONS, PermissionFlags } from '@gdisc/shared';
import type { CreateServerInput, UpdateServerInput } from './server.schema.js';
import type { ServerSummary, ServerMemberSummary, ChannelSummary, RoleSummary } from '@gdisc/shared';
import { nanoid } from 'nanoid';

export class ServerService {
  async createServer(ownerId: string, input: CreateServerInput): Promise<ServerSummary> {
    const server = await prisma.server.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        iconUrl: input.iconUrl || null,
        ownerId,
        // Create default @everyone role
        roles: {
          create: [
            {
              name: '@everyone',
              color: '#9AA4B2',
              position: 0,
              permissions: DEFAULT_EVERYONE_PERMISSIONS.toString(),
              isDefault: true,
            },
          ],
        },
        // Create default text and voice channels
        channels: {
          create: [
            {
              name: 'geral',
              type: 'TEXT',
              topic: 'Canal principal de texto',
              position: 0,
            },
            {
              name: 'Voz Geral',
              type: 'VOICE',
              topic: 'Canal principal de voz',
              position: 1,
            },
          ],
        },
        // Add owner as first member
        members: {
          create: [
            {
              userId: ownerId,
            },
          ],
        },
        // Create default invite
        invites: {
          create: [
            {
              code: nanoid(8),
              creatorId: ownerId,
              maxUses: 0,
            },
          ],
        },
      },
      include: {
        channels: {
          orderBy: { position: 'asc' },
        },
        roles: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return this.mapServerSummary(server, 1);
  }

  async getUserServers(userId: string): Promise<ServerSummary[]> {
    const memberships = await prisma.serverMember.findMany({
      where: { userId },
      include: {
        server: {
          include: {
            channels: {
              orderBy: { position: 'asc' },
            },
            roles: {
              orderBy: { position: 'asc' },
            },
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    return memberships.map((m) =>
      this.mapServerSummary(m.server, m.server._count.members)
    );
  }

  async getServerById(serverId: string): Promise<ServerSummary | null> {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        channels: {
          orderBy: { position: 'asc' },
        },
        roles: {
          orderBy: { position: 'asc' },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!server) return null;
    return this.mapServerSummary(server, server._count.members);
  }

  async updateServer(
    serverId: string,
    input: UpdateServerInput
  ): Promise<ServerSummary> {
    const server = await prisma.server.update({
      where: { id: serverId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.iconUrl !== undefined ? { iconUrl: input.iconUrl || null } : {}),
      },
      include: {
        channels: {
          orderBy: { position: 'asc' },
        },
        roles: {
          orderBy: { position: 'asc' },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return this.mapServerSummary(server, server._count.members);
  }

  async deleteServer(serverId: string, userId: string): Promise<void> {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) throw new Error('Servidor não encontrado.');
    if (server.ownerId !== userId) {
      throw new Error('Apenas o proprietário pode excluir o servidor.');
    }

    await prisma.server.delete({
      where: { id: serverId },
    });
  }

  async getServerMembers(serverId: string): Promise<ServerMemberSummary[]> {
    const members = await prisma.serverMember.findMany({
      where: { serverId },
      include: {
        user: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    return members.map((m) => ({
      id: m.id,
      serverId: m.serverId,
      userId: m.userId,
      nickname: m.nickname,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        id: m.user.id,
        username: m.user.username,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
        status: m.user.status as any,
        customStatus: m.user.customStatus,
      },
      roles: m.roles.map((r) => ({
        id: r.role.id,
        serverId: r.role.serverId,
        name: r.role.name,
        color: r.role.color,
        position: r.role.position,
        permissions: r.role.permissions,
        isDefault: r.role.isDefault,
        createdAt: r.role.createdAt.toISOString(),
      })),
    }));
  }

  async leaveServer(serverId: string, userId: string): Promise<void> {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) throw new Error('Servidor não encontrado.');
    if (server.ownerId === userId) {
      throw new Error('O proprietário não pode sair do próprio servidor sem transferir a posse ou excluí-lo.');
    }

    await prisma.serverMember.deleteMany({
      where: {
        serverId,
        userId,
      },
    });
  }

  private mapServerSummary(server: any, memberCount: number): ServerSummary {
    return {
      id: server.id,
      name: server.name,
      iconUrl: server.iconUrl,
      description: server.description,
      ownerId: server.ownerId,
      memberCount,
      createdAt: server.createdAt.toISOString(),
      channels: server.channels?.map((c: any) => ({
        id: c.id,
        serverId: c.serverId,
        name: c.name,
        type: c.type,
        topic: c.topic,
        position: c.position,
        isPrivate: c.isPrivate,
        createdAt: c.createdAt.toISOString(),
      })),
      roles: server.roles?.map((r: any) => ({
        id: r.id,
        serverId: r.serverId,
        name: r.name,
        color: r.color,
        position: r.position,
        permissions: r.permissions,
        isDefault: r.isDefault,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}

export const serverService = new ServerService();
