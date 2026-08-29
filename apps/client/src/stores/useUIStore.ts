import { create } from 'zustand';

export type ModalType =
  | 'create_server'
  | 'server_settings'
  | 'invite'
  | 'user_settings'
  | 'channel_settings'
  | 'device_settings'
  | 'screen_share'
  | 'join_invite'
  | null;

export interface ToastInfo {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface UIState {
  activeModal: ModalType;
  modalData: any;
  toasts: ToastInfo[];
  isMobileSidebarOpen: boolean;
  isMobileMemberListOpen: boolean;
  isMemberListOpen: boolean;

  openModal: (type: ModalType, data?: any) => void;
  closeModal: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileMemberList: () => void;
  closeMobileMemberList: () => void;
  closeMobilePanels: () => void;
  toggleMemberList: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModal: null,
  modalData: null,
  toasts: [],
  isMobileSidebarOpen: false,
  isMobileMemberListOpen: false,
  isMemberListOpen: true,

  openModal: (type: ModalType, data: any = null) => {
    set({ activeModal: type, modalData: data });
  },

  closeModal: () => {
    set({ activeModal: null, modalData: null });
  },

  addToast: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  toggleMobileSidebar: () => {
    set((state) => ({
      isMobileSidebarOpen: !state.isMobileSidebarOpen,
      isMobileMemberListOpen: false,
    }));
  },

  closeMobileSidebar: () => {
    set({ isMobileSidebarOpen: false });
  },

  toggleMobileMemberList: () => {
    set((state) => ({
      isMobileMemberListOpen: !state.isMobileMemberListOpen,
      isMobileSidebarOpen: false,
    }));
  },

  closeMobileMemberList: () => {
    set({ isMobileMemberListOpen: false });
  },

  closeMobilePanels: () => {
    set({ isMobileSidebarOpen: false, isMobileMemberListOpen: false });
  },

  toggleMemberList: () => {
    set((state) => ({ isMemberListOpen: !state.isMemberListOpen }));
  },
}));
