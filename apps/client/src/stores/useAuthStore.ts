import { create } from 'zustand';
import { api, type RegisterResult } from '../services/api.js';
import { wsClient } from '../services/ws.js';
import { readLegacyAuthToken, supabase, writeLegacyAuthToken } from '../services/supabase.js';
import type { UserProfile, UserStatus, RegisterDTO, LoginDTO, UpdateProfileDTO } from '@gdisc/shared';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  notice: string | null;

  initAuth: () => Promise<void>;
  login: (dto: LoginDTO) => Promise<void>;
  register: (dto: RegisterDTO) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (dto: UpdateProfileDTO) => Promise<void>;
  setStatus: (status: UserStatus, customStatus?: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: readLegacyAuthToken(),
  isAuthenticated: false,
  isLoading: true,
  error: null,
  notice: null,

  initAuth: async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) {
      writeLegacyAuthToken(null);
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }

    try {
      set({ isLoading: true, error: null, notice: null });
      const { user } = await api.get<{ user: UserProfile }>('/auth/me');
      writeLegacyAuthToken(token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      await wsClient.authenticate(token);
    } catch (err: any) {
      console.warn('Session expired or invalid token:', err);
      writeLegacyAuthToken(null);
      await supabase.auth.signOut({ scope: 'local' });
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (dto: LoginDTO) => {
    try {
      set({ isLoading: true, error: null, notice: null });
      const res = await api.post<{ user: UserProfile; token: string }>('/auth/login', dto);
      writeLegacyAuthToken(res.token);

      set({
        user: res.user,
        token: res.token,
        isAuthenticated: true,
        isLoading: false,
      });

      await wsClient.authenticate(res.token);
    } catch (err: any) {
      set({ error: err.message || 'Falha ao efetuar login', isLoading: false });
      throw err;
    }
  },

  register: async (dto: RegisterDTO) => {
    try {
      set({ isLoading: true, error: null, notice: null });
      const res = await api.post<RegisterResult>('/auth/register', dto);

      if (res.requiresEmailConfirmation || !res.user || !res.token) {
        writeLegacyAuthToken(null);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          notice: `Conta criada! Confirme o link enviado para ${res.email} e depois entre com seu e-mail.`,
        });
        return;
      }

      writeLegacyAuthToken(res.token);

      set({
        user: res.user,
        token: res.token,
        isAuthenticated: true,
        isLoading: false,
      });

      await wsClient.authenticate(res.token);
    } catch (err: any) {
      set({ error: err.message || 'Falha ao criar conta', isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    const currentUser = get().user;
    if (currentUser) {
      wsClient.send('presence:status_update', { status: 'OFFLINE' });
      await supabase.from('profiles').update({ status: 'OFFLINE' }).eq('id', currentUser.id);
    }
    wsClient.disconnect();
    await supabase.auth.signOut({ scope: 'local' });
    writeLegacyAuthToken(null);
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
      notice: null,
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

  clearError: () => set({ error: null, notice: null }),
}));
