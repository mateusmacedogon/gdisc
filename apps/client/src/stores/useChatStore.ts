import { create } from 'zustand';
import { api } from '../services/api.js';
import { wsClient } from '../services/ws.js';
import { WSEvents, type MessageSummary, type UserSummary } from '@gdisc/shared';

interface ChatState {
  messages: Record<string, MessageSummary[]>; // channelId -> array of messages
  typingUsers: Record<string, Record<string, { username: string; displayName: string; expiresAt: number }>>;
  isLoading: boolean;
  replyingTo: MessageSummary | null;

  setReplyingTo: (message: MessageSummary | null) => void;
  fetchMessages: (channelId: string, cursor?: string) => Promise<void>;
  sendMessage: (channelId: string, content: string, replyToId?: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  sendTyping: (channelId: string) => void;

  // Realtime Actions
  addRealtimeMessage: (message: MessageSummary) => void;
  updateRealtimeMessage: (message: MessageSummary) => void;
  removeRealtimeMessage: (messageId: string, channelId: string) => void;
  handleUserTyping: (channelId: string, user: UserSummary) => void;
  cleanExpiredTyping: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  typingUsers: {},
  isLoading: false,
  replyingTo: null,

  setReplyingTo: (message: MessageSummary | null) => {
    set({ replyingTo: message });
  },

  fetchMessages: async (channelId: string, cursor?: string) => {
    try {
      set({ isLoading: true });
      const query = cursor ? `?cursor=${cursor}` : '';
      const { messages } = await api.get<{ messages: MessageSummary[] }>(`/channels/${channelId}/messages${query}`);

      set((state) => {
        const existing = state.messages[channelId] || [];
        // If cursor was provided, prepend older messages
        const updated = cursor ? [...messages, ...existing] : messages;
        return {
          messages: {
            ...state.messages,
            [channelId]: updated,
          },
          isLoading: false,
        };
      });
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      set({ isLoading: false });
    }
  },

  sendMessage: async (channelId: string, content: string, replyToId?: string) => {
    try {
      const { message } = await api.post<{ message: MessageSummary }>(`/channels/${channelId}/messages`, {
        content,
        replyToId: replyToId || undefined,
      });

      get().addRealtimeMessage(message);
      set({ replyingTo: null });
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  },

  editMessage: async (messageId: string, content: string) => {
    try {
      const { message } = await api.patch<{ message: MessageSummary }>(`/messages/${messageId}`, {
        content,
      });
      get().updateRealtimeMessage(message);
    } catch (err) {
      console.error('Failed to edit message:', err);
      throw err;
    }
  },

  deleteMessage: async (messageId: string) => {
    try {
      const { channelId } = await api.delete<{ channelId: string }>(`/messages/${messageId}`);
      get().removeRealtimeMessage(messageId, channelId);
    } catch (err) {
      console.error('Failed to delete message:', err);
      throw err;
    }
  },

  sendTyping: (channelId: string) => {
    wsClient.send(WSEvents.CHAT_TYPING_START, { channelId });
  },

  addRealtimeMessage: (message: MessageSummary) => {
    set((state) => {
      const channelMsgs = state.messages[message.channelId] || [];
      // Prevent duplicates
      if (channelMsgs.some((m) => m.id === message.id)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [message.channelId]: [...channelMsgs, message],
        },
      };
    });
  },

  updateRealtimeMessage: (message: MessageSummary) => {
    set((state) => {
      const channelMsgs = state.messages[message.channelId] || [];
      return {
        messages: {
          ...state.messages,
          [message.channelId]: channelMsgs.map((m) => (m.id === message.id ? message : m)),
        },
      };
    });
  },

  removeRealtimeMessage: (messageId: string, channelId: string) => {
    set((state) => {
      const channelMsgs = state.messages[channelId] || [];
      return {
        messages: {
          ...state.messages,
          [channelId]: channelMsgs.filter((m) => m.id !== messageId),
        },
      };
    });
  },

  handleUserTyping: (channelId: string, user: UserSummary) => {
    set((state) => {
      const channelTyping = state.typingUsers[channelId] || {};
      return {
        typingUsers: {
          ...state.typingUsers,
          [channelId]: {
            ...channelTyping,
            [user.id]: {
              username: user.username,
              displayName: user.displayName,
              expiresAt: Date.now() + 4000,
            },
          },
        },
      };
    });
  },

  cleanExpiredTyping: () => {
    const now = Date.now();
    set((state) => {
      const updated: typeof state.typingUsers = {};
      let changed = false;

      for (const [channelId, userMap] of Object.entries(state.typingUsers)) {
        const nextMap: typeof userMap = {};
        for (const [userId, val] of Object.entries(userMap)) {
          if (val.expiresAt > now) {
            nextMap[userId] = val;
          } else {
            changed = true;
          }
        }
        if (Object.keys(nextMap).length > 0) {
          updated[channelId] = nextMap;
        }
      }

      return changed ? { typingUsers: updated } : state;
    });
  },
}));
