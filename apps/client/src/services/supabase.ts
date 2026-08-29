import { createClient } from '@supabase/supabase-js';

type ViteRuntimeEnv = Record<string, string | boolean | undefined>;

const runtimeEnv = (import.meta as ImportMeta & { readonly env?: ViteRuntimeEnv }).env;

function requiredEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string {
  const value = runtimeEnv?.[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Configuração do Supabase ausente: defina ${name} nas variáveis de ambiente do Vercel e no arquivo .env local.`,
    );
  }
  return value.trim();
}

function validateSupabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('invalid protocol');
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(
      'VITE_SUPABASE_URL é inválida. Use a URL HTTPS exibida em Project Settings > API no Supabase.',
    );
  }
}

function decodeJwtRole(token: string): string | undefined {
  if (!token.includes('.') || typeof globalThis.atob !== 'function') return undefined;

  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(globalThis.atob(padded)) as { role?: unknown };
    return typeof parsed.role === 'string' ? parsed.role : undefined;
  } catch {
    return undefined;
  }
}

function validatePublishableKey(value: string): string {
  if (value.startsWith('sb_secret_') || decodeJwtRole(value) === 'service_role') {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY contém uma chave secreta. Use somente a chave publicável (sb_publishable_...) no cliente.',
    );
  }
  return value;
}

const memoryStorage = new Map<string, string>();

/**
 * localStorage is available in browsers, Capacitor WebViews and Tauri WebViews.
 * The in-memory fallback keeps imports safe in prerender/test environments and
 * on devices where persistent storage was disabled by the user.
 */
const authStorage = {
  getItem(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? memoryStorage.get(key) ?? null;
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  setItem(key: string, value: string): void {
    memoryStorage.set(key, value);
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // The in-memory copy still allows the current app session to work.
    }
  },
  removeItem(key: string): void {
    memoryStorage.delete(key);
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nothing else to remove.
    }
  },
};

const supabaseUrl = validateSupabaseUrl(requiredEnv('VITE_SUPABASE_URL'));
const supabasePublishableKey = validatePublishableKey(
  requiredEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
);

export const LEGACY_AUTH_TOKEN_KEY = 'gdisc_token';

export function readLegacyAuthToken(): string | null {
  return authStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
}

export function writeLegacyAuthToken(token: string | null): void {
  if (token) authStorage.setItem(LEGACY_AUTH_TOKEN_KEY, token);
  else authStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: authStorage,
    storageKey: 'gdisc_supabase_auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: typeof globalThis.location !== 'undefined',
    flowType: 'pkce',
  },
  realtime: {
    // Keep Presence heartbeats alive when the browser, Tauri window or mobile
    // WebView is running in the background.
    worker: true,
  },
});
