import type { WebSocket } from 'ws';
import { prisma } from '../plugins/prisma.js';
import { WSEvents, type UserStatus, type WSMessage } from '@gdisc/shared';

export interface AuthenticatedClient {
  socketId: string;
  userId: string;
  username: string;
  socket: WebSocket;
  lastPing: number;
}

export class ConnectionManager {
  // Map of socketId -> AuthenticatedClient
  private sockets: Map<string, AuthenticatedClient> = new Map();
  // Map of userId -> Set of socketIds (support multi-tab/device)
  private userSockets: Map<string, Set<string>> = new Map();
  // Map of userId -> current Presence Status
  private userStatus: Map<string, UserStatus> = new Map();

  register(socketId: string, userId: string, username: string, socket: WebSocket) {
    const client: AuthenticatedClient = {
      socketId,
      userId,
      username,
      socket,
      lastPing: Date.now(),
    };

    this.sockets.set(socketId, client);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
    this.userStatus.set(userId, 'ONLINE');

    // Update database status
    prisma.user
      .update({
        where: { id: userId },
        data: { status: 'ONLINE' },
      })
      .catch((err) => console.error('Error updating user online status:', err));

    // Broadcast presence update
    this.broadcastPresenceUpdate(userId, 'ONLINE');
  }

  unregister(socketId: string): string | null {
    const client = this.sockets.get(socketId);
    if (!client) return null;

    const { userId } = client;
    this.sockets.delete(socketId);

    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        this.userStatus.set(userId, 'OFFLINE');

        // Update database status
        prisma.user
          .update({
            where: { id: userId },
            data: { status: 'OFFLINE' },
          })
          .catch((err) => console.error('Error updating user offline status:', err));

        // Broadcast presence update
        this.broadcastPresenceUpdate(userId, 'OFFLINE');
      }
    }

    return userId;
  }

  getClient(socketId: string): AuthenticatedClient | undefined {
    return this.sockets.get(socketId);
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  getUserStatus(userId: string): UserStatus {
    return this.userStatus.get(userId) || 'OFFLINE';
  }

  setUserStatus(userId: string, status: UserStatus, customStatus?: string | null) {
    this.userStatus.set(userId, status);

    prisma.user
      .update({
        where: { id: userId },
        data: {
          status,
          ...(customStatus !== undefined ? { customStatus } : {}),
        },
      })
      .catch((err) => console.error('Error updating user status:', err));

    this.broadcastPresenceUpdate(userId, status, customStatus);
  }

  sendToUser(userId: string, message: WSMessage) {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds) return;

    const payload = JSON.stringify(message);
    for (const socketId of socketIds) {
      const client = this.sockets.get(socketId);
      if (client && client.socket.readyState === client.socket.OPEN) {
        client.socket.send(payload);
      }
    }
  }

  async broadcastToServer(serverId: string, message: WSMessage, excludeUserId?: string) {
    try {
      const members = await prisma.serverMember.findMany({
        where: { serverId },
        select: { userId: true },
      });

      const payload = JSON.stringify(message);

      for (const member of members) {
        if (excludeUserId && member.userId === excludeUserId) continue;

        const socketIds = this.userSockets.get(member.userId);
        if (socketIds) {
          for (const socketId of socketIds) {
            const client = this.sockets.get(socketId);
            if (client && client.socket.readyState === client.socket.OPEN) {
              client.socket.send(payload);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error broadcasting to server:', err);
    }
  }

  async broadcastPresenceUpdate(userId: string, status: UserStatus, customStatus?: string | null) {
    try {
      // Find all servers the user is member of
      const memberships = await prisma.serverMember.findMany({
        where: { userId },
        select: { serverId: true },
      });

      for (const m of memberships) {
        this.broadcastToServer(m.serverId, {
          event: WSEvents.PRESENCE_STATUS_UPDATE,
          data: {
            userId,
            status,
            customStatus,
          },
        });
      }
    } catch (err) {
      console.error('Error broadcasting presence update:', err);
    }
  }
}

export const connectionManager = new ConnectionManager();
