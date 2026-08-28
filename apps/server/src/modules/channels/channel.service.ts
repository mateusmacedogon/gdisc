import { prisma } from '../../plugins/prisma.js';
import type { CreateChannelInput, UpdateChannelInput } from './channel.schema.js';
import type { ChannelSummary } from '@gdisc/shared';

export class ChannelService {
  async createChannel(serverId: string, input: CreateChannelInput): Promise<ChannelSummary> {
    const channelCount = await prisma.channel.count({
      where: { serverId },
    });

    const channel = await prisma.channel.create({
      data: {
        serverId,
        name: input.name,
        type: input.type,
        topic: input.topic || null,
        position: input.position ?? channelCount,
        isPrivate: input.isPrivate ?? false,
      },
    });

    return {
      id: channel.id,
      serverId: channel.serverId,
      name: channel.name,
      type: channel.type as any,
      topic: channel.topic,
      position: channel.position,
      isPrivate: channel.isPrivate,
      createdAt: channel.createdAt.toISOString(),
    };
  }

  async getChannelsByServer(serverId: string): Promise<ChannelSummary[]> {
    const channels = await prisma.channel.findMany({
      where: { serverId },
      orderBy: { position: 'asc' },
    });

    return channels.map((c) => ({
      id: c.id,
      serverId: c.serverId,
      name: c.name,
      type: c.type as any,
      topic: c.topic,
      position: c.position,
      isPrivate: c.isPrivate,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async updateChannel(channelId: string, input: UpdateChannelInput): Promise<ChannelSummary> {
    const channel = await prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.topic !== undefined ? { topic: input.topic } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.isPrivate !== undefined ? { isPrivate: input.isPrivate } : {}),
      },
    });

    return {
      id: channel.id,
      serverId: channel.serverId,
      name: channel.name,
      type: channel.type as any,
      topic: channel.topic,
      position: channel.position,
      isPrivate: channel.isPrivate,
      createdAt: channel.createdAt.toISOString(),
    };
  }

  async deleteChannel(channelId: string): Promise<void> {
    await prisma.channel.delete({
      where: { id: channelId },
    });
  }
}

export const channelService = new ChannelService();
