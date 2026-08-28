import { prisma } from '../../plugins/prisma.js';
import type { CreateMessageInput, UpdateMessageInput, GetMessagesQuery } from './message.schema.js';
import type { MessageSummary } from '@gdisc/shared';

export class MessageService {
  async createMessage(
    channelId: string,
    authorId: string,
    input: CreateMessageInput
  ): Promise<MessageSummary> {
    const message = await prisma.message.create({
      data: {
        channelId,
        authorId,
        content: input.content.trim(),
        replyToId: input.replyToId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            customStatus: true,
          },
        },
        replyTo: {
          include: {
            author: {
              select: {
                id: true,
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    return this.mapMessageSummary(message);
  }

  async getChannelMessages(
    channelId: string,
    query: GetMessagesQuery
  ): Promise<MessageSummary[]> {
    const limit = query.limit;

    const messages = await prisma.message.findMany({
      where: { channelId },
      take: limit,
      ...(query.cursor
        ? {
            skip: 1,
            cursor: {
              id: query.cursor,
            },
          }
        : {}),
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            customStatus: true,
          },
        },
        replyTo: {
          include: {
            author: {
              select: {
                id: true,
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    // Return in chronological ascending order
    return messages.reverse().map((m) => this.mapMessageSummary(m));
  }

  async updateMessage(
    messageId: string,
    userId: string,
    input: UpdateMessageInput
  ): Promise<MessageSummary> {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new Error('Mensagem não encontrada.');
    if (message.authorId !== userId) {
      throw new Error('Apenas o autor pode editar esta mensagem.');
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: input.content.trim(),
        isEdited: true,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            customStatus: true,
          },
        },
        replyTo: {
          include: {
            author: {
              select: {
                id: true,
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    return this.mapMessageSummary(updated);
  }

  async deleteMessage(messageId: string): Promise<void> {
    await prisma.message.delete({
      where: { id: messageId },
    });
  }

  async getMessageById(messageId: string) {
    return prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: true,
      },
    });
  }

  private mapMessageSummary(message: any): MessageSummary {
    return {
      id: message.id,
      channelId: message.channelId,
      authorId: message.authorId,
      content: message.content,
      replyToId: message.replyToId,
      replyTo: message.replyTo
        ? {
            id: message.replyTo.id,
            content: message.replyTo.content,
            author: {
              id: message.replyTo.author.id,
              displayName: message.replyTo.author.displayName,
              username: message.replyTo.author.username,
            },
          }
        : null,
      isEdited: message.isEdited,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      author: {
        id: message.author.id,
        username: message.author.username,
        displayName: message.author.displayName,
        avatarUrl: message.author.avatarUrl,
        status: message.author.status as any,
        customStatus: message.author.customStatus,
      },
    };
  }
}

export const messageService = new MessageService();
