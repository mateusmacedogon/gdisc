import { create } from 'zustand';
import { api } from '../services/api.js';
import { useChatStore } from './useChatStore.js';
import { wsClient } from '../services/ws.js';
import type { ChannelSummary, CreateChannelDTO, UpdateChannelDTO } from '@gdisc/shared';

interface ChannelState {
  channels: ChannelSummary[];
  activeChannelId: string | null;
  activeChannel: ChannelSummary | null;
  isLoading: boolean;

  setChannels: (channels: ChannelSummary[]) => void;
  selectChannel: (channelId: string | null) => void;
  fetchChannels: (serverId: string) => Promise<void>;
  createChannel: (serverId: string, dto: CreateChannelDTO) => Promise<ChannelSummary>;
  updateChannel: (serverId: string, channelId: string, dto: UpdateChannelDTO) => Promise<void>;
  deleteChannel: (serverId: string, channelId: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  activeChannel: null,
  isLoading: false,

  setChannels: (channels: ChannelSummary[]) => {
    const activeId = get().activeChannelId;
    const stillExists = channels.find((c) => c.id === activeId);

    let nextActive = stillExists || null;
    if (!nextActive && channels.length > 0) {
      // Default to first text channel if exists, else first channel
      nextActive = channels.find((c) => c.type === 'TEXT') || channels[0];
    }

    set({
      channels,
      activeChannelId: nextActive ? nextActive.id : null,
      activeChannel: nextActive,
    });

    if (nextActive && nextActive.type === 'TEXT') {
      useChatStore.getState().fetchMessages(nextActive.id);
    }
  },

  selectChannel: (channelId: string | null) => {
    if (!channelId) {
      set({ activeChannelId: null, activeChannel: null });
      return;
    }
    const channel = get().channels.find((c) => c.id === channelId) || null;
    set({ activeChannelId: channelId, activeChannel: channel });

    if (channel && channel.type === 'TEXT') {
      useChatStore.getState().fetchMessages(channel.id);
    }
  },

  fetchChannels: async (serverId: string) => {
    try {
      set({ isLoading: true });
      const { channels } = await api.get<{ channels: ChannelSummary[] }>(`/servers/${serverId}/channels`);
      get().setChannels(channels);
      set({ isLoading: false });
    } catch (err) {
      console.error('Failed to fetch channels:', err);
      set({ isLoading: false });
    }
  },

  createChannel: async (serverId: string, dto: CreateChannelDTO) => {
    const { channel } = await api.post<{ channel: ChannelSummary }>(`/servers/${serverId}/channels`, dto);
    set((state) => ({
      channels: [...state.channels, channel],
      activeChannelId: channel.type === 'TEXT' ? channel.id : state.activeChannelId,
      activeChannel: channel.type === 'TEXT' ? channel : state.activeChannel,
    }));

    if (channel.type === 'TEXT') {
      useChatStore.getState().fetchMessages(channel.id);
    }
    wsClient.registerChannel(channel.id, serverId);
    return channel;
  },

  updateChannel: async (serverId: string, channelId: string, dto: UpdateChannelDTO) => {
    const { channel } = await api.patch<{ channel: ChannelSummary }>(
      `/servers/${serverId}/channels/${channelId}`,
      dto
    );
    set((state) => ({
      channels: state.channels.map((c) => (c.id === channelId ? channel : c)),
      activeChannel: state.activeChannelId === channelId ? channel : state.activeChannel,
    }));
  },

  deleteChannel: async (serverId: string, channelId: string) => {
    await api.delete(`/servers/${serverId}/channels/${channelId}`);
    wsClient.unregisterChannel(channelId);
    set((state) => {
      const remaining = state.channels.filter((c) => c.id !== channelId);
      const nextActive = remaining.find((c) => c.type === 'TEXT') || remaining[0] || null;
      return {
        channels: remaining,
        activeChannelId: nextActive ? nextActive.id : null,
        activeChannel: nextActive,
      };
    });

    const current = get().activeChannel;
    if (current && current.type === 'TEXT') {
      useChatStore.getState().fetchMessages(current.id);
    }
  },
}));
