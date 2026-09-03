import { connectionManager } from './connectionManager.js';
import {
  WSEvents,
  type VoiceState,
  type UserSummary,
  type RTCSignalPayload,
} from '@gdisc/shared';

export class VoiceManager {
  // Map of channelId -> Map<userId, VoiceState>
  private rooms: Map<string, Map<string, VoiceState>> = new Map();
  // Map of userId -> channelId
  private userToChannel: Map<string, string> = new Map();

  joinVoice(
    userId: string,
    channelId: string,
    serverId: string,
    user: UserSummary,
    initialState: Partial<VoiceState> = {}
  ): VoiceState[] {
    // If user was in another voice channel, leave it first
    const prevChannelId = this.userToChannel.get(userId);
    if (prevChannelId && prevChannelId !== channelId) {
      this.leaveVoice(userId);
    }

    if (!this.rooms.has(channelId)) {
      this.rooms.set(channelId, new Map());
    }

    const room = this.rooms.get(channelId)!;

    const voiceState: VoiceState = {
      userId,
      channelId,
      serverId,
      user,
      selfMute: initialState.selfMute ?? false,
      selfDeaf: initialState.selfDeaf ?? false,
      selfVideo: initialState.selfVideo ?? false,
      selfScreen: initialState.selfScreen ?? false,
      isSpeaking: false,
      joinedAt: Date.now(),
    };

    room.set(userId, voiceState);
    this.userToChannel.set(userId, channelId);

    // Broadcast user joined voice to everyone in this server
    connectionManager.broadcastToServer(serverId, {
      event: WSEvents.VOICE_USER_JOINED,
      data: { voiceState },
    });

    // Return the list of current peers in this room
    return Array.from(room.values());
  }

  leaveVoice(userId: string): { channelId: string; serverId: string } | null {
    const channelId = this.userToChannel.get(userId);
    if (!channelId) return null;

    const room = this.rooms.get(channelId);
    if (!room) {
      this.userToChannel.delete(userId);
      return null;
    }

    const voiceState = room.get(userId);
    const serverId = voiceState ? voiceState.serverId : '';

    room.delete(userId);
    this.userToChannel.delete(userId);

    if (room.size === 0) {
      this.rooms.delete(channelId);
    }

    if (serverId) {
      connectionManager.broadcastToServer(serverId, {
        event: WSEvents.VOICE_USER_LEFT,
        data: { channelId, userId },
      });
    }

    return { channelId, serverId };
  }

  updateVoiceState(
    userId: string,
    updates: Partial<VoiceState>
  ): VoiceState | null {
    const channelId = this.userToChannel.get(userId);
    if (!channelId) return null;

    const room = this.rooms.get(channelId);
    if (!room) return null;

    const currentState = room.get(userId);
    if (!currentState) return null;

    const updatedState: VoiceState = {
      ...currentState,
      ...updates,
    };

    room.set(userId, updatedState);

    // Broadcast state update to everyone in this server
    connectionManager.broadcastToServer(currentState.serverId, {
      event: WSEvents.VOICE_STATE_UPDATE,
      data: { voiceState: updatedState },
    });

    return updatedState;
  }

  getChannelVoiceStates(channelId: string): VoiceState[] {
    const room = this.rooms.get(channelId);
    if (!room) return [];
    return Array.from(room.values());
  }

  getUserVoiceState(userId: string): VoiceState | null {
    const channelId = this.userToChannel.get(userId);
    if (!channelId) return null;
    return this.rooms.get(channelId)?.get(userId) || null;
  }

  relayRtcSignal(
    fromUserId: string,
    targetUserId: string,
    channelId: string,
    signal: any,
    connectionId?: string
  ) {
    const targetVoiceState = this.getUserVoiceState(targetUserId);
    const senderVoiceState = this.getUserVoiceState(fromUserId);

    if (!targetVoiceState || !senderVoiceState) return;
    if (targetVoiceState.channelId !== channelId || senderVoiceState.channelId !== channelId) return;

    connectionManager.sendToUser(targetUserId, {
      event: WSEvents.RTC_SIGNAL,
      data: {
        fromUserId,
        targetUserId,
        channelId,
        connectionId,
        signal,
      },
    });
  }
}

export const voiceManager = new VoiceManager();
