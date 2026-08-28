import { create } from 'zustand';
import { api } from '../services/api.js';
import { wsClient } from '../services/ws.js';
import type { UserProfile, UserStatus, RegisterDTO, LoginDTO, UpdateProfileDTO } from '@gdisc/shared';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  initAuth: () => Promise<void>;
  login: (dto: LoginDTO) => Promise<void>;
  register: (dto: RegisterDTO) => Promise<void>;
  logout: () => void;
  updateProfile: (dto: UpdateProfileDTO) => Promise<void>;
  setStatus: (status: UserStatus, customStatus?: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('gdisc_token'),
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initAuth: async () => {
    const token = localStorage.getItem('gdisc_token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      const { user } = await api.get<{ user: UserProfile }>('/auth/me');
      set({ user, token, isAuthenticated: true, isLoading: false });

      // Connect and authenticate WebSocket
      wsClient.connect();
    } catch (err: any) {
      console.warn('Session expired or invalid token:', err);
      localStorage.removeItem('gdisc_token');
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (dto: LoginDTO) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.post<{ user: UserProfile; token: string }>('/auth/login', dto);
      localStorage.setItem('gdisc_token', res.token);

      set({
        user: res.user,
        token: res.token,
        isAuthenticated: true,
        isLoading: false,
      });

      wsClient.connect();
      wsClient.authenticate(res.token);
    } catch (err: any) {
      set({ error: err.message || 'Falha ao efetuar login', isLoading: false });
      throw err;
    }
  },

  register: async (dto: RegisterDTO) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.post<{ user: UserProfile; token: string }>('/auth/register', dto);
      localStorage.setItem('gdisc_token', res.token);

      set({
        user: res.user,
        token: res.token,
        isAuthenticated: true,
        isLoading: false,
      });

      wsClient.connect();
      wsClient.authenticate(res.token);
    } catch (err: any) {
      set({ error: err.message || 'Falha ao criar conta', isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('gdisc_token');
    wsClient.disconnect();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  updateProfile: async (dto: UpdateProfileDTO) => {
    try {
      const res = await api.patch<{ user: UserProfile }>('/users/me', dto);
      set({ user: res.user });
    } catch (err: any) {
      set({ error: err.message || 'Falha ao atualizar perfil' });
      throw err;
    }
  },

  setStatus: async (status: UserStatus, customStatus?: string) => {
    try {
      const res = await api.patch<{ user: UserProfile }>('/users/me', { status, customStatus });
      set({ user: res.user });
      wsClient.send('presence:status_update', { status, customStatus });
    } catch (err) {
      console.error('Failed to set status:', err);
    }
  },

  clearError: () => set({ error: null }),
}));
