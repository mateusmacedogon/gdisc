import { create } from 'zustand';
import { api } from '../services/api.js';
import { useChannelStore } from './useChannelStore.js';
import type {
  ServerSummary,
  ServerMemberSummary,
  RoleSummary,
  CreateServerDTO,
  UpdateServerDTO,
  UserStatus,
} from '@gdisc/shared';

interface ServerState {
  servers: ServerSummary[];
  activeServerId: string | null;
  activeServer: ServerSummary | null;
  members: ServerMemberSummary[];
  roles: RoleSummary[];
  isLoading: boolean;
  error: string | null;

  fetchServers: () => Promise<void>;
  selectServer: (serverId: string | null) => Promise<void>;
  createServer: (dto: CreateServerDTO) => Promise<ServerSummary>;
  updateServer: (serverId: string, dto: UpdateServerDTO) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  leaveServer: (serverId: string) => Promise<void>;
  fetchMembers: (serverId: string) => Promise<void>;
  fetchRoles: (serverId: string) => Promise<void>;

  // Realtime member/presence updates
  updateMemberPresence: (userId: string, status: UserStatus, customStatus?: string | null) => void;
  addMember: (member: ServerMemberSummary) => void;
  removeMember: (serverId: string, userId: string) => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  activeServerId: null,
  activeServer: null,
  members: [],
  roles: [],
  isLoading: false,
  error: null,

  fetchServers: async () => {
    try {
      set({ isLoading: true, error: null });
      const { servers } = await api.get<{ servers: ServerSummary[] }>('/servers');
      const activeId = get().activeServerId;

      let currentActive: ServerSummary | null = null;
      if (activeId) {
        currentActive = servers.find((s) => s.id === activeId) || null;
      }
      if (!currentActive && servers.length > 0) {
        currentActive = servers[0];
      }

      set({
        servers,
        activeServerId: currentActive ? currentActive.id : null,
        activeServer: currentActive,
        isLoading: false,
      });

      if (currentActive) {
        // Sync channels for the active server
        if (currentActive.channels && currentActive.channels.length > 0) {
          useChannelStore.getState().setChannels(currentActive.channels);
        } else {
          useChannelStore.getState().fetchChannels(currentActive.id);
        }
        get().fetchMembers(currentActive.id);
        get().fetchRoles(currentActive.id);
      } else {
        useChannelStore.getState().setChannels([]);
      }
    } catch (err: any) {
      set({ error: err.message || 'Falha ao buscar servidores', isLoading: false });
    }
  },

  selectServer: async (serverId: string | null) => {
    if (!serverId) {
      set({ activeServerId: null, activeServer: null, members: [], roles: [] });
      useChannelStore.getState().setChannels([]);
      return;
    }

    const cached = get().servers.find((s) => s.id === serverId);
    set({ activeServerId: serverId, activeServer: cached || null });

    if (cached?.channels && cached.channels.length > 0) {
      useChannelStore.getState().setChannels(cached.channels);
    } else {
      useChannelStore.getState().fetchChannels(serverId);
    }

    try {
      const { server } = await api.get<{ server: ServerSummary }>(`/servers/${serverId}`);
      set({ activeServer: server });
      if (server.channels) {
        useChannelStore.getState().setChannels(server.channels);
      }
      get().fetchMembers(serverId);
      get().fetchRoles(serverId);
    } catch (err) {
      console.error('Failed to fetch full server details:', err);
    }
  },

  createServer: async (dto: CreateServerDTO) => {
    try {
      const { server } = await api.post<{ server: ServerSummary }>('/servers', dto);
      set((state) => ({
        servers: [...state.servers, server],
        activeServerId: server.id,
        activeServer: server,
      }));
      if (server.channels) {
        useChannelStore.getState().setChannels(server.channels);
      }
      get().fetchMembers(server.id);
      get().fetchRoles(server.id);
      return server;
    } catch (err: any) {
      set({ error: err.message || 'Falha ao criar servidor' });
      throw err;
    }
  },

  updateServer: async (serverId: string, dto: UpdateServerDTO) => {
    try {
      const { server } = await api.patch<{ server: ServerSummary }>(`/servers/${serverId}`, dto);
      set((state) => ({
        servers: state.servers.map((s) => (s.id === serverId ? server : s)),
        activeServer: state.activeServerId === serverId ? server : state.activeServer,
      }));
    } catch (err: any) {
      set({ error: err.message || 'Falha ao atualizar servidor' });
      throw err;
    }
  },

  deleteServer: async (serverId: string) => {
    try {
      await api.delete(`/servers/${serverId}`);
      set((state) => {
        const remaining = state.servers.filter((s) => s.id !== serverId);
        const nextActive = remaining.length > 0 ? remaining[0] : null;
        return {
          servers: remaining,
          activeServerId: nextActive ? nextActive.id : null,
          activeServer: nextActive,
        };
      });

      const next = get().activeServer;
      if (next) {
        get().selectServer(next.id);
      } else {
        useChannelStore.getState().setChannels([]);
      }
    } catch (err: any) {
      set({ error: err.message || 'Falha ao deletar servidor' });
      throw err;
    }
  },

  leaveServer: async (serverId: string) => {
    try {
      await api.post(`/servers/${serverId}/leave`);
      set((state) => {
        const remaining = state.servers.filter((s) => s.id !== serverId);
        const nextActive = remaining.length > 0 ? remaining[0] : null;
        return {
          servers: remaining,
          activeServerId: nextActive ? nextActive.id : null,
          activeServer: nextActive,
        };
      });

      const next = get().activeServer;
      if (next) {
        get().selectServer(next.id);
      } else {
        useChannelStore.getState().setChannels([]);
      }
    } catch (err: any) {
      set({ error: err.message || 'Falha ao sair do servidor' });
      throw err;
    }
  },

  fetchMembers: async (serverId: string) => {
    try {
      const { members } = await api.get<{ members: ServerMemberSummary[] }>(`/servers/${serverId}/members`);
      if (get().activeServerId === serverId) {
        set({ members });
      }
    } catch (err) {
      console.error('Failed to fetch server members:', err);
    }
  },

  fetchRoles: async (serverId: string) => {
    try {
      const { roles } = await api.get<{ roles: RoleSummary[] }>(`/servers/${serverId}/roles`);
      if (get().activeServerId === serverId) {
        set({ roles });
      }
    } catch (err) {
      console.error('Failed to fetch server roles:', err);
    }
  },

  updateMemberPresence: (userId: string, status: UserStatus, customStatus?: string | null) => {
    set((state) => ({
      members: state.members.map((m) =>
        m.userId === userId
          ? {
              ...m,
              user: {
                ...m.user,
                status,
                ...(customStatus !== undefined ? { customStatus } : {}),
              },
            }
          : m
      ),
    }));
  },

  addMember: (member: ServerMemberSummary) => {
    set((state) => ({
      members: [...state.members.filter((m) => m.userId !== member.userId), member],
    }));
  },

  removeMember: (serverId: string, userId: string) => {
    set((state) => ({
      members: state.members.filter((m) => !(m.serverId === serverId && m.userId === userId)),
    }));
  },
}));
