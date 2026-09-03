import type { WebSocket } from 'ws';
import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { connectionManager } from './connectionManager.js';
import { voiceManager } from './voiceManager.js';
import { prisma } from '../plugins/prisma.js';
import {
  WSEvents,
  type WSMessage,
  type WSClientAuthPayload,
  type WSPresenceStatusUpdatePayload,
  type WSVoiceJoinPayload,
  type WSVoiceStateUpdatePayload,
  type RTCSignalPayload,
} from '@gdisc/shared';

export function setupWebSocket(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (connection: any) => {
    const socket: WebSocket = connection.socket || connection;
    const socketId = nanoid(12);
    let authenticatedUserId: string | null = null;

    // Send initial greeting / ping
    socket.send(
      JSON.stringify({
        event: 'ready',
        data: { message: 'GDisC Realtime Gateway Connected' },
      })
    );

    socket.on('message', async (rawData) => {
      try {
        const message: WSMessage = JSON.parse(rawData.toString());

        // Handle Authentication
        if (message.event === WSEvents.CLIENT_AUTHENTICATE) {
          const { token } = message.data as WSClientAuthPayload;
          try {
            const decoded = fastify.jwt.verify<{ userId: string; username: string; email: string }>(
              token
            );
            authenticatedUserId = decoded.userId;

            connectionManager.register(
              socketId,
              decoded.userId,
              decoded.username,
              socket
            );

            socket.send(
              JSON.stringify({
                event: WSEvents.SERVER_AUTHENTICATED,
                data: {
                  userId: decoded.userId,
                  username: decoded.username,
                },
              })
            );
          } catch (err) {
            socket.send(
              JSON.stringify({
                event: WSEvents.SERVER_ERROR,
                data: { message: 'Token de autenticação inválido.' },
              })
            );
          }
          return;
        }

        // Handle Heartbeats
        if (message.event === WSEvents.HEARTBEAT_PING) {
          socket.send(JSON.stringify({ event: WSEvents.HEARTBEAT_PONG, data: {} }));
          return;
        }

        // All other events require authentication
        if (!authenticatedUserId) {
          socket.send(
            JSON.stringify({
              event: WSEvents.SERVER_ERROR,
              data: { message: 'Não autenticado no WebSocket.' },
            })
          );
          return;
        }

        // Handle Presence Status Update
        if (message.event === WSEvents.PRESENCE_STATUS_UPDATE) {
          const { status, customStatus } = message.data as WSPresenceStatusUpdatePayload;
          connectionManager.setUserStatus(authenticatedUserId, status, customStatus);
          return;
        }

        // Handle Typing indicator
        if (message.event === WSEvents.CHAT_TYPING_START) {
          const { channelId } = message.data as { channelId: string };
          const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { serverId: true },
          });

          if (channel) {
            const user = await prisma.user.findUnique({
              where: { id: authenticatedUserId },
              select: { id: true, username: true, displayName: true },
            });

            if (user) {
              connectionManager.broadcastToServer(
                channel.serverId,
                {
                  event: WSEvents.CHAT_USER_TYPING,
                  data: {
                    channelId,
                    user,
                  },
                },
                authenticatedUserId // exclude self
              );
            }
          }
          return;
        }

        // Handle Voice Join
        if (message.event === WSEvents.VOICE_JOIN) {
          const { channelId, serverId, selfMute, selfDeaf, selfVideo, selfScreen } =
            message.data as WSVoiceJoinPayload;

          const user = await prisma.user.findUnique({
            where: { id: authenticatedUserId },
          });

          if (user) {
            const peers = voiceManager.joinVoice(
              authenticatedUserId,
              channelId,
              serverId,
              {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                status: user.status as any,
                customStatus: user.customStatus,
              },
              { selfMute, selfDeaf, selfVideo, selfScreen }
            );

            // Send list of current peers in room back to joiner
            socket.send(
              JSON.stringify({
                event: WSEvents.VOICE_ROOM_USERS,
                data: {
                  channelId,
                  serverId,
                  peers,
                },
              })
            );
          }
          return;
        }

        // Handle Voice Leave
        if (message.event === WSEvents.VOICE_LEAVE) {
          voiceManager.leaveVoice(authenticatedUserId);
          return;
        }

        // Handle Voice State Update (Mute, Deaf, Video, Screen)
        if (message.event === WSEvents.VOICE_STATE_UPDATE) {
          const updates = message.data as WSVoiceStateUpdatePayload;
          voiceManager.updateVoiceState(authenticatedUserId, updates);
          return;
        }

        // Handle WebRTC Signaling Relay
        if (message.event === WSEvents.RTC_SIGNAL) {
          const { targetUserId, channelId, signal, connectionId } = message.data as RTCSignalPayload;
          voiceManager.relayRtcSignal(
            authenticatedUserId,
            targetUserId,
            channelId,
            signal,
            connectionId
          );
          return;
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    socket.on('close', () => {
      if (authenticatedUserId) {
        voiceManager.leaveVoice(authenticatedUserId);
      }
      connectionManager.unregister(socketId);
    });

    socket.on('error', (err) => {
      console.error(`WebSocket error for socket ${socketId}:`, err);
      if (authenticatedUserId) {
        voiceManager.leaveVoice(authenticatedUserId);
      }
      connectionManager.unregister(socketId);
    });
  });
}
