/**
 * GDisC Realtime WebSocket Protocol Events & Payloads
 */

import type { UserStatus, UserSummary, MessageSummary, VoiceState, ServerMemberSummary, ChannelSummary, RoleSummary } from './models.js';

export const WSEvents = {
  // Authentication & Connection
  CLIENT_AUTHENTICATE: 'client:authenticate',
  SERVER_AUTHENTICATED: 'server:authenticated',
  SERVER_ERROR: 'server:error',
  HEARTBEAT_PING: 'ping',
  HEARTBEAT_PONG: 'pong',

  // Presence
  PRESENCE_STATUS_UPDATE: 'presence:status_update',
  PRESENCE_SYNC: 'presence:sync',

  // Chat & Messaging
  CHAT_SEND_MESSAGE: 'chat:send_message',
  CHAT_MESSAGE_CREATED: 'chat:message_created',
  CHAT_MESSAGE_UPDATED: 'chat:message_updated',
  CHAT_MESSAGE_DELETED: 'chat:message_deleted',
  CHAT_TYPING_START: 'chat:typing_start',
  CHAT_USER_TYPING: 'chat:user_typing',

  // Voice & Video Channels
  VOICE_JOIN: 'voice:join',
  VOICE_LEAVE: 'voice:leave',
  VOICE_STATE_UPDATE: 'voice:state_update',
  VOICE_USER_JOINED: 'voice:user_joined',
  VOICE_USER_LEFT: 'voice:user_left',
  VOICE_ROOM_USERS: 'voice:room_users',
  VOICE_SPEAKING_UPDATE: 'voice:speaking_update',

  // WebRTC Mesh Signaling
  RTC_SIGNAL: 'rtc:signal',

  // Server & Channel Realtime Updates
  SERVER_MEMBER_JOINED: 'server:member_joined',
  SERVER_MEMBER_LEFT: 'server:member_left',
  SERVER_MEMBER_UPDATED: 'server:member_updated',
  CHANNEL_CREATED: 'channel:created',
  CHANNEL_UPDATED: 'channel:updated',
  CHANNEL_DELETED: 'channel:deleted',
  ROLE_CREATED: 'role:created',
  ROLE_UPDATED: 'role:updated',
  ROLE_DELETED: 'role:deleted',
} as const;

export type WSEventName = (typeof WSEvents)[keyof typeof WSEvents];

// WebRTC Signaling Payload Types
export type RTCSignalType = 'offer' | 'answer' | 'ice-candidate';

export interface RTCSignalPayload {
  targetUserId: string;
  fromUserId?: string;
  channelId: string;
  signal: {
    type: RTCSignalType;
    sdp?: string;
    candidate?: RTCIceCandidateInit;
  };
}

// Client to Server Event Payloads
export interface WSClientAuthPayload {
  token: string;
}

export interface WSPresenceStatusUpdatePayload {
  status: UserStatus;
  customStatus?: string | null;
}

export interface WSChatSendMessagePayload {
  channelId: string;
  content: string;
  replyToId?: string;
}

export interface WSChatTypingPayload {
  channelId: string;
}

export interface WSVoiceJoinPayload {
  channelId: string;
  serverId: string;
  selfMute?: boolean;
  selfDeaf?: boolean;
  selfVideo?: boolean;
  selfScreen?: boolean;
}

export interface WSVoiceStateUpdatePayload {
  channelId: string;
  selfMute?: boolean;
  selfDeaf?: boolean;
  selfVideo?: boolean;
  selfScreen?: boolean;
  isSpeaking?: boolean;
}

// Generic WebSocket Envelope
export interface WSMessage<T = unknown> {
  event: WSEventName;
  data: T;
}
