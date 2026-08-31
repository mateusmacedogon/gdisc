/**
 * Cross-platform realtime transport backed by Supabase Realtime.
 * The public API intentionally matches the former WebSocket client so React,
 * Capacitor and Tauri can share the same stores.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  WSEvents,
  type ServerSummary,
  type UserStatus,
  type UserSummary,
  type VoiceState,
  type WSEventName,
  type RTCSignalPayload,
} from '@gdisc/shared';
import { getMessageById } from './api.js';
import { supabase } from './supabase.js';

type EventCallback = (data: any) => void;
type BroadcastPayload = { event?: string; payload?: any };

class RealtimeClient {
  private listeners = new Map<string, Set<EventCallback>>();
  private databaseChannel: RealtimeChannel | null = null;
  private serverChannels = new Map<string, RealtimeChannel>();
  private channelToServer = new Map<string, string>();
  private voiceChannel: RealtimeChannel | null = null;
  private voiceState: VoiceState | null = null;
  private channelReady = new WeakMap<RealtimeChannel, Promise<void>>();
  private identity: UserSummary | null = null;
  private connecting: Promise<void> | null = null;
  private databaseSubscribed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private voiceReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private voiceSubscribed = false;
  private presenceQueues = new WeakMap<RealtimeChannel, Promise<void>>();
  private lastPresenceTrackAt = new WeakMap<RealtimeChannel, number>();
  private disconnecting = false;

  public connect(): Promise<void> {
    if (this.databaseChannel) {
      supabase.realtime.connect();
      return Promise.resolve();
    }
    if (this.connecting) return this.connecting;
    this.disconnecting = false;
    this.connecting = this.open().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  /**
   * Restores the socket after sleep, a network change or a backgrounded WebView.
   * Supabase normally reconnects automatically; this also covers channels that
   * reached a terminal state while the app was suspended.
   */
  public async ensureConnected(): Promise<void> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await supabase.realtime.setAuth(token);
    if (!this.databaseChannel) await this.connect();
    else supabase.realtime.connect();
  }

  private async open(): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    await supabase.realtime.setAuth(token);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
    if (!profile) return;
    this.identity = {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url ?? null,
      status: (profile.status ?? 'ONLINE') as UserStatus,
      customStatus: profile.custom_status ?? null,
    };

    const channel = supabase.channel('gdisc:postgres-changes');
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        void this.handleMessageChange(payload as any);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, (payload) => {
        this.handleResourceChange('channel', payload as any);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roles' }, (payload) => {
        this.handleResourceChange('role', payload as any);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_roles' }, (payload) => {
        this.handleResourceChange('member_role', payload as any);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_members' }, (payload) => {
        this.handleResourceChange('member', payload as any);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, (payload) => {
        this.handleResourceChange('server', payload as any);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.databaseSubscribed = true;
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
          this.emit('connection:open', {});
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.databaseSubscribed = false;
          this.emit('connection:error', { status });
          this.scheduleDatabaseRecovery(channel);
        }
        if (status === 'CLOSED') {
          this.databaseSubscribed = false;
          this.emit('connection:close', {});
          this.scheduleDatabaseRecovery(channel);
        }
      });
    this.databaseChannel = channel;
  }

  private scheduleDatabaseRecovery(channel: RealtimeChannel): void {
    if (this.disconnecting || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.disconnecting || this.databaseChannel !== channel || this.databaseSubscribed) return;

      this.databaseChannel = null;
      void supabase.removeChannel(channel).finally(() => {
        void this.connect().catch((error) => this.emit('connection:error', { error }));
      });
    }, 2_000);
  }

  public disconnect(): void {
    this.disconnecting = true;
    this.databaseSubscribed = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.voiceReconnectTimer) clearTimeout(this.voiceReconnectTimer);
    this.voiceReconnectTimer = null;
    this.voiceSubscribed = false;
    for (const channel of this.serverChannels.values()) void supabase.removeChannel(channel);
    this.serverChannels.clear();
    this.channelToServer.clear();
    if (this.voiceChannel) void this.leaveVoice();
    if (this.databaseChannel) void supabase.removeChannel(this.databaseChannel);
    this.databaseChannel = null;
    this.identity = null;
    this.emit('connection:close', {});
  }

  public async authenticate(token: string): Promise<void> {
    this.disconnecting = false;
    await supabase.realtime.setAuth(token);
    await this.connect();
  }

  public syncServers(servers: ServerSummary[]): void {
    const nextIds = new Set(servers.map((server) => server.id));
    this.channelToServer.clear();
    for (const server of servers) {
      for (const channel of server.channels ?? []) this.channelToServer.set(channel.id, server.id);
      if (!this.serverChannels.has(server.id)) this.subscribeToServer(server.id);
    }
    for (const [serverId, channel] of this.serverChannels) {
      if (!nextIds.has(serverId)) {
        void supabase.removeChannel(channel);
        this.serverChannels.delete(serverId);
      }
    }
  }

  public registerChannel(channelId: string, serverId: string): void {
    this.channelToServer.set(channelId, serverId);
  }

  public unregisterChannel(channelId: string): void {
    this.channelToServer.delete(channelId);
  }

  private subscribeToServer(serverId: string): void {
    if (!this.identity) return;
    const topic = `gdisc:server:${serverId}`;
    const channel = supabase.channel(topic, {
      config: {
        private: true,
        broadcast: { self: false },
        presence: { key: this.identity.id },
      },
    });
    channel
      .on('broadcast', { event: '*' }, (message: BroadcastPayload) => {
        if (message.event) this.emit(message.event, message.payload);
      })
      .on('presence', { event: 'sync' }, () => this.emitServerPresence(channel));

    const ready = new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Tempo esgotado ao assinar o canal do servidor.'));
      }, 15_000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.channelReady.set(channel, Promise.resolve());
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
          void this.trackServerPresence(serverId);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.emit('connection:error', { serverId, status });
        }
        if (status === 'CLOSED' && this.serverChannels.get(serverId) === channel) {
          this.serverChannels.delete(serverId);
          if (!this.disconnecting) {
            setTimeout(() => {
              if (!this.disconnecting && !this.serverChannels.has(serverId)) {
                this.subscribeToServer(serverId);
              }
            }, 2_000);
          }
        }
      });
    });
    this.channelReady.set(channel, ready);
    void ready.catch((error) => this.emit('connection:error', { error }));
    this.serverChannels.set(serverId, channel);
  }

  private emitServerPresence(channel: RealtimeChannel): void {
    const entries = Object.values(channel.presenceState()).flat() as RowPresence[];
    const serverId = [...this.serverChannels.entries()]
      .find(([, subscribedChannel]) => subscribedChannel === channel)?.[0];
    const voiceStatesByChannel = new Map<string, Map<string, VoiceState>>();

    for (const entry of entries) {
      if (entry.userId && entry.status) {
        this.emit(WSEvents.PRESENCE_STATUS_UPDATE, {
          userId: entry.userId,
          status: entry.status,
          customStatus: entry.customStatus ?? null,
        });
      }
      if (entry.voiceState?.channelId) {
        const peers = voiceStatesByChannel.get(entry.voiceState.channelId) ?? new Map<string, VoiceState>();
        peers.set(entry.voiceState.userId, entry.voiceState);
        voiceStatesByChannel.set(entry.voiceState.channelId, peers);
      }
    }

    if (serverId) {
      for (const [channelId, mappedServerId] of this.channelToServer) {
        if (mappedServerId !== serverId) continue;
        this.emit(WSEvents.VOICE_ROOM_USERS, {
          channelId,
          serverId,
          peers: [...(voiceStatesByChannel.get(channelId)?.values() ?? [])],
        });
      }
    }
  }

  private async trackServerPresence(serverId: string): Promise<void> {
    const channel = this.serverChannels.get(serverId);
    if (!channel || !this.identity) return;
    await this.trackWhenReady(channel, {
      userId: this.identity.id,
      status: this.identity.status,
      customStatus: this.identity.customStatus ?? null,
      onlineAt: new Date().toISOString(),
      voiceState: this.voiceState?.serverId === serverId ? this.voiceState : null,
    });
  }

  private async handleMessageChange(payload: any): Promise<void> {
    const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    if (!row?.id) return;
    if (payload.eventType === 'DELETE') {
      this.emit(WSEvents.CHAT_MESSAGE_DELETED, {
        messageId: row.id,
        channelId: row.channel_id,
      });
      return;
    }
    const message = await getMessageById(row.id).catch(() => null);
    if (!message) return;
    this.emit(
      payload.eventType === 'INSERT' ? WSEvents.CHAT_MESSAGE_CREATED : WSEvents.CHAT_MESSAGE_UPDATED,
      { message },
    );
  }

  private handleResourceChange(resource: string, payload: any): void {
    const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    const serverId = resource === 'server' ? row?.id : row?.server_id;
    const data = { serverId, resourceId: row?.id, refresh: true };
    if (resource === 'channel') {
      const event = payload.eventType === 'INSERT'
        ? WSEvents.CHANNEL_CREATED
        : payload.eventType === 'UPDATE' ? WSEvents.CHANNEL_UPDATED : WSEvents.CHANNEL_DELETED;
      this.emit(event, data);
    } else if (resource === 'role') {
      const event = payload.eventType === 'INSERT'
        ? WSEvents.ROLE_CREATED
        : payload.eventType === 'UPDATE' ? WSEvents.ROLE_UPDATED : WSEvents.ROLE_DELETED;
      this.emit(event, data);
    } else if (resource === 'member') {
      const event = payload.eventType === 'DELETE'
        ? WSEvents.SERVER_MEMBER_LEFT
        : payload.eventType === 'INSERT' ? WSEvents.SERVER_MEMBER_JOINED : WSEvents.SERVER_MEMBER_UPDATED;
      this.emit(event, { ...data, userId: row?.user_id });
    } else {
      this.emit('server:changed', data);
    }
  }

  public send(event: WSEventName | string, data: any = {}): void {
    if (!this.identity) return;
    if (event === WSEvents.CLIENT_AUTHENTICATE || event === WSEvents.HEARTBEAT_PING) return;

    if (event === WSEvents.PRESENCE_STATUS_UPDATE) {
      this.identity = { ...this.identity, status: data.status, customStatus: data.customStatus ?? null };
      for (const [serverId, channel] of this.serverChannels) {
        void this.trackServerPresence(serverId);
        this.broadcast(channel, event, { ...data, userId: this.identity.id });
      }
      return;
    }

    if (event === WSEvents.CHAT_TYPING_START) {
      const serverId = this.channelToServer.get(data.channelId);
      const channel = serverId ? this.serverChannels.get(serverId) : undefined;
      if (channel) {
        this.broadcast(channel, WSEvents.CHAT_USER_TYPING, {
          channelId: data.channelId,
          user: this.identity,
        });
      }
      return;
    }

    if (event === WSEvents.VOICE_JOIN) {
      void this.joinVoice(data).catch((error) => {
        this.emit('connection:error', { event, error });
      });
      return;
    }
    if (event === WSEvents.VOICE_LEAVE) {
      void this.leaveVoice();
      return;
    }
    if (event === WSEvents.VOICE_STATE_UPDATE && this.voiceChannel && this.voiceState) {
      void this.updateVoiceState(data);
      return;
    }
    if (event === WSEvents.RTC_SIGNAL && this.voiceChannel) {
      this.broadcast(this.voiceChannel, event, { ...data, fromUserId: this.identity.id });
      return;
    }

    const serverId = data.serverId ?? this.channelToServer.get(data.channelId);
    const channel = serverId ? this.serverChannels.get(serverId) : undefined;
    if (channel) this.broadcast(channel, event, data);
  }

  public async sendRtcSignal(
    data: Omit<RTCSignalPayload, 'fromUserId'>,
  ): Promise<void> {
    const channel = this.voiceChannel;
    if (!channel || !this.identity) throw new Error('Canal de sinalização da chamada indisponível.');
    await this.channelReady.get(channel);

    let lastStatus = 'error';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        lastStatus = await channel.send({
          type: 'broadcast',
          event: WSEvents.RTC_SIGNAL,
          payload: { ...data, fromUserId: this.identity.id },
        });
        if (lastStatus === 'ok') return;
      } catch (error) {
        if (attempt === 2) {
          this.emit('connection:error', { event: WSEvents.RTC_SIGNAL, error });
          throw error;
        }
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }

    const error = new Error(`Falha ao enviar sinal WebRTC: ${lastStatus}`);
    this.emit('connection:error', { event: WSEvents.RTC_SIGNAL, status: lastStatus });
    throw error;
  }

  public async joinVoice(data: any): Promise<void> {
    if (!this.identity) return;
    await this.leaveVoice();
    this.voiceState = {
      userId: this.identity.id,
      channelId: data.channelId,
      serverId: data.serverId,
      user: this.identity,
      selfMute: Boolean(data.selfMute),
      selfDeaf: Boolean(data.selfDeaf),
      selfVideo: Boolean(data.selfVideo),
      selfScreen: Boolean(data.selfScreen),
      isSpeaking: false,
      joinedAt: Date.now(),
    };

    const channel = supabase.channel(`gdisc:voice:${data.channelId}`, {
      config: {
        private: true,
        broadcast: { self: false },
        presence: { key: this.identity.id },
      },
    });
    channel
      .on('broadcast', { event: '*' }, (message: BroadcastPayload) => {
        if (!message.event) return;
        if (message.event === WSEvents.RTC_SIGNAL && message.payload?.targetUserId !== this.identity?.id) return;
        this.emit(message.event, message.payload);
      })
      .on('presence', { event: 'sync' }, () => this.emitVoiceRoom(channel))
      .on('presence', { event: 'join' }, ({ newPresences }: any) => {
        for (const state of newPresences ?? []) {
          if (state.userId !== this.identity?.id) this.emit(WSEvents.VOICE_USER_JOINED, { voiceState: state });
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
        for (const state of leftPresences ?? []) {
          this.emit(WSEvents.VOICE_USER_LEFT, { channelId: data.channelId, userId: state.userId });
        }
      });
    this.voiceChannel = channel;

    const ready = new Promise<void>((resolve, reject) => {
      let settled = false;
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && this.voiceState) {
          this.voiceSubscribed = true;
          if (this.voiceReconnectTimer) clearTimeout(this.voiceReconnectTimer);
          this.voiceReconnectTimer = null;
          void channel.track(this.voiceState as any).then((trackStatus) => {
            if (settled) return;
            settled = true;
            if (trackStatus === 'ok') resolve();
            else reject(new Error(`Falha ao publicar presença na call: ${trackStatus}`));
          }).catch((error) => {
            if (settled) return;
            settled = true;
            reject(error);
          });
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.voiceSubscribed = false;
          if (!settled) {
            settled = true;
            reject(new Error(`Falha ao entrar na call: ${status}`));
          } else {
            this.scheduleVoiceRecovery(channel);
          }
        }
      });
    });
    this.channelReady.set(channel, ready);

    try {
      await ready;
      await this.trackServerPresence(data.serverId);
      const serverChannel = this.serverChannels.get(data.serverId);
      if (serverChannel && this.voiceState) {
        await this.broadcast(serverChannel, WSEvents.VOICE_USER_JOINED, {
          voiceState: this.voiceState,
        });
      }
    } catch (error) {
      if (this.voiceChannel === channel) {
        this.voiceChannel = null;
        this.voiceState = null;
      }
      await supabase.removeChannel(channel);
      this.emit('connection:error', { event: WSEvents.VOICE_JOIN, error });
      throw error;
    }
  }

  private emitVoiceRoom(channel: RealtimeChannel): void {
    if (!this.voiceState) return;
    const entries = Object.values(channel.presenceState()).flat() as unknown as VoiceState[];
    const byUser = new Map<string, VoiceState>();
    for (const state of entries) if (state.userId) byUser.set(state.userId, state);
    this.emit(WSEvents.VOICE_ROOM_USERS, {
      channelId: this.voiceState.channelId,
      serverId: this.voiceState.serverId,
      peers: [...byUser.values()],
    });
  }

  public async leaveVoice(): Promise<void> {
    if (this.voiceReconnectTimer) clearTimeout(this.voiceReconnectTimer);
    this.voiceReconnectTimer = null;
    this.voiceSubscribed = false;
    const channel = this.voiceChannel;
    const voiceState = this.voiceState;
    if (!channel) {
      this.voiceState = null;
      return;
    }

    try {
      await this.channelReady.get(channel)?.catch(() => undefined);
      if (voiceState) {
        await channel.send({
          type: 'broadcast',
          event: WSEvents.VOICE_USER_LEFT,
          payload: { channelId: voiceState.channelId, userId: voiceState.userId },
        }).catch(() => undefined);
        const serverChannel = this.serverChannels.get(voiceState.serverId);
        if (serverChannel) {
          await this.broadcast(serverChannel, WSEvents.VOICE_USER_LEFT, {
            channelId: voiceState.channelId,
            userId: voiceState.userId,
          });
        }
      }
      await channel.untrack().catch(() => undefined);
      await supabase.removeChannel(channel);
    } finally {
      if (this.voiceChannel === channel) {
        this.voiceChannel = null;
        this.voiceState = null;
      }
      if (voiceState) await this.trackServerPresence(voiceState.serverId);
    }
  }

  private async updateVoiceState(data: any): Promise<void> {
    const channel = this.voiceChannel;
    if (!channel || !this.voiceState || !this.identity) return;

    const nextVoiceState: VoiceState = { ...this.voiceState, ...data, user: this.identity };
    this.voiceState = nextVoiceState;

    // Speaking changes can happen several times per second. Presence is meant
    // for connection state, so publish high-frequency activity via Broadcast.
    const shouldRefreshPresence = ['selfMute', 'selfDeaf', 'selfVideo', 'selfScreen']
      .some((field) => Object.prototype.hasOwnProperty.call(data, field));
    if (shouldRefreshPresence) {
      await this.trackWhenReady(channel, nextVoiceState as any);
      await this.trackServerPresence(nextVoiceState.serverId);
    }
    await this.broadcast(channel, WSEvents.VOICE_STATE_UPDATE, { voiceState: nextVoiceState });
    const serverChannel = this.serverChannels.get(nextVoiceState.serverId);
    if (serverChannel) {
      await this.broadcast(serverChannel, WSEvents.VOICE_STATE_UPDATE, {
        voiceState: nextVoiceState,
      });
    }
  }

  private async trackWhenReady(channel: RealtimeChannel, payload: Record<string, unknown>): Promise<void> {
    const previous = this.presenceQueues.get(channel) ?? Promise.resolve();
    const queued = previous.catch(() => undefined).then(async () => {
      try {
        await this.channelReady.get(channel);
        const elapsed = Date.now() - (this.lastPresenceTrackAt.get(channel) ?? 0);
        // Supabase Presence has a deliberately low per-client rate limit.
        // State updates are serialized and capped at one per second; speaking
        // activity continues to use Broadcast and remains immediate.
        if (elapsed < 1_000) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1_000 - elapsed));
        }
        const status = await channel.track(payload);
        this.lastPresenceTrackAt.set(channel, Date.now());
        if (status !== 'ok') this.emit('connection:error', { event: 'presence:track', status });
      } catch (error) {
        this.emit('connection:error', { event: 'presence:track', error });
      }
    });
    this.presenceQueues.set(channel, queued);
    await queued;
  }

  private scheduleVoiceRecovery(channel: RealtimeChannel): void {
    if (this.disconnecting || this.voiceReconnectTimer || this.voiceChannel !== channel) return;
    this.voiceReconnectTimer = setTimeout(() => {
      this.voiceReconnectTimer = null;
      if (this.disconnecting || this.voiceSubscribed || this.voiceChannel !== channel || !this.voiceState) return;

      const state = { ...this.voiceState };
      this.voiceChannel = null;
      void supabase.removeChannel(channel).finally(() => {
        void this.joinVoice(state).catch((error) => {
          this.emit('connection:error', { event: 'voice:reconnect', error });
          this.voiceState = state;
          this.voiceChannel = channel;
          this.voiceSubscribed = false;
          this.scheduleVoiceRecovery(channel);
        });
      });
    }, 2_000);
  }

  private async broadcast(channel: RealtimeChannel, event: string, payload: any): Promise<void> {
    try {
      await this.channelReady.get(channel);
      const status = await channel.send({ type: 'broadcast', event, payload });
      if (status !== 'ok') this.emit('connection:error', { event, status });
    } catch (error) {
      this.emit('connection:error', { event, error });
    }
  }

  public on(event: WSEventName | string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off(event: WSEventName | string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    callbacks?.delete(callback);
    if (callbacks?.size === 0) this.listeners.delete(event);
  }

  private emit(event: string, data: any): void {
    for (const callback of this.listeners.get(event) ?? []) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Erro no listener realtime "${event}":`, error);
      }
    }
  }
}

interface RowPresence {
  userId?: string;
  status?: UserStatus;
  customStatus?: string | null;
  voiceState?: VoiceState | null;
}

export const wsClient = new RealtimeClient();
