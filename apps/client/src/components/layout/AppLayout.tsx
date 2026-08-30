import React, { useEffect, useState } from 'react';
import { ServerSidebar } from './ServerSidebar.js';
import { ChannelSidebar } from './ChannelSidebar.js';
import { MemberSidebar } from './MemberSidebar.js';
import { ChatArea } from '../chat/ChatArea.js';
import { VoiceRoom } from '../voice/VoiceRoom.js';
import { ToastContainer } from '../common/ToastContainer.js';

// Modals
import { CreateServerModal } from '../server/CreateServerModal.js';
import { InviteModal } from '../server/InviteModal.js';
import { ServerSettingsModal } from '../server/ServerSettingsModal.js';
import { ChannelModal } from '../server/ChannelModal.js';
import { UserSettingsModal } from '../user/UserSettingsModal.js';
import { DeviceSettingsModal } from '../voice/DeviceSettingsModal.js';
import { ScreenShareModal } from '../voice/ScreenShareModal.js';
import { Menu, X } from 'lucide-react';

import { useServerStore } from '../../stores/useServerStore.js';
import { useChannelStore } from '../../stores/useChannelStore.js';
import { useChatStore } from '../../stores/useChatStore.js';
import { useVoiceStore } from '../../stores/useVoiceStore.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts.js';
import { useAndroidBackHandler } from '../../hooks/useAndroidBackHandler.js';
import { wsClient } from '../../services/ws.js';
import { WSEvents } from '@gdisc/shared';

export const AppLayout: React.FC = () => {
  useGlobalShortcuts();
  useAndroidBackHandler();

  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const {
    activeServer,
    fetchServers,
    fetchMembers,
    fetchRoles,
    updateMemberPresence,
    addMember,
    removeMember,
  } = useServerStore();
  const { activeChannel, fetchChannels } = useChannelStore();
  const {
    isMemberListOpen,
    isMobileSidebarOpen,
    isMobileMemberListOpen,
    toggleMobileSidebar,
    closeMobileSidebar,
    closeMobileMemberList,
    closeMobilePanels,
    openModal,
  } = useUIStore();
  const {
    addRealtimeMessage,
    updateRealtimeMessage,
    removeRealtimeMessage,
    handleUserTyping,
  } = useChatStore();
  const {
    setVoiceRoomUsers,
    handleUserJoinedVoice,
    handleUserLeftVoice,
    handleVoiceStateUpdate,
    handleRtcSignal,
  } = useVoiceStore();

  // Initialize data and register real-time event listeners
  useEffect(() => {
    const reconcileVisibleData = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      void fetchServers();
    };

    void fetchServers();

    // Reconcile the local stores whenever Realtime reconnects. Postgres Changes
    // remains the fast path; this closes any gap created while a browser tab,
    // mobile WebView or desktop window was suspended.
    const unConnectionOpen = wsClient.on('connection:open', reconcileVisibleData);
    const resumeRealtime = () => {
      setIsOnline(true);
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      void wsClient.ensureConnected()
        .catch((error) => console.warn('Falha ao restaurar o Realtime:', error))
        .finally(reconcileVisibleData);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resumeRealtime();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', resumeRealtime);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', resumeRealtime);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // A lightweight reconciliation is a safety net for restrictive networks
    // that interrupt long-lived WebSockets without delivering a close event.
    const reconciliationInterval = window.setInterval(reconcileVisibleData, 30_000);

    // 1. Chat Events
    const unMsgCreate = wsClient.on(WSEvents.CHAT_MESSAGE_CREATED, (data) => {
      if (data?.message) addRealtimeMessage(data.message);
    });

    const unMsgUpdate = wsClient.on(WSEvents.CHAT_MESSAGE_UPDATED, (data) => {
      if (data?.message) updateRealtimeMessage(data.message);
    });

    const unMsgDelete = wsClient.on(WSEvents.CHAT_MESSAGE_DELETED, (data) => {
      if (data?.messageId && data?.channelId) {
        removeRealtimeMessage(data.messageId, data.channelId);
      }
    });

    const unTyping = wsClient.on(WSEvents.CHAT_USER_TYPING, (data) => {
      if (data?.channelId && data?.user) {
        handleUserTyping(data.channelId, data.user);
      }
    });

    // 2. Presence & Member Events
    const unPresence = wsClient.on(WSEvents.PRESENCE_STATUS_UPDATE, (data) => {
      if (data?.userId && data?.status) {
        updateMemberPresence(data.userId, data.status, data.customStatus);
      }
    });

    const unMemberJoin = wsClient.on(WSEvents.SERVER_MEMBER_JOINED, (data) => {
      if (data?.member) addMember(data.member);
      if (data?.refresh && data?.serverId) {
        void fetchServers();
        void fetchMembers(data.serverId);
      }
    });

    const unMemberLeave = wsClient.on(WSEvents.SERVER_MEMBER_LEFT, (data) => {
      if (data?.serverId && data?.userId) {
        removeMember(data.serverId, data.userId);
      }
      if (
        data?.kicked &&
        data?.userId === useAuthStore.getState().user?.id &&
        useVoiceStore.getState().activeServerId === data.serverId
      ) {
        void useVoiceStore.getState().leaveVoice();
      }
      if (data?.kicked && data?.userId === useAuthStore.getState().user?.id) {
        useUIStore.getState().addToast('Você foi expulso deste servidor.', 'info');
      }
      if (data?.refresh && data?.serverId) {
        void fetchServers();
        void fetchMembers(data.serverId);
      }
    });

    const unMemberUpdate = wsClient.on(WSEvents.SERVER_MEMBER_UPDATED, (data) => {
      if (data?.serverId) void fetchMembers(data.serverId);
    });

    const refreshChannels = (data: any) => {
      if (data?.serverId) {
        void fetchServers();
        if (useServerStore.getState().activeServerId === data.serverId) {
          void fetchChannels(data.serverId);
        }
      }
    };
    const unChannelCreate = wsClient.on(WSEvents.CHANNEL_CREATED, refreshChannels);
    const unChannelUpdate = wsClient.on(WSEvents.CHANNEL_UPDATED, refreshChannels);
    const unChannelDelete = wsClient.on(WSEvents.CHANNEL_DELETED, refreshChannels);

    const refreshRoles = (data: any) => {
      if (data?.serverId) void fetchRoles(data.serverId);
    };
    const unRoleCreate = wsClient.on(WSEvents.ROLE_CREATED, refreshRoles);
    const unRoleUpdate = wsClient.on(WSEvents.ROLE_UPDATED, refreshRoles);
    const unRoleDelete = wsClient.on(WSEvents.ROLE_DELETED, refreshRoles);
    const unServerChange = wsClient.on('server:changed', () => void fetchServers());

    // 3. WebRTC & Voice Events
    const unVoicePeers = wsClient.on(WSEvents.VOICE_ROOM_USERS, (data) => {
      if (data?.channelId && data?.serverId && data?.peers) {
        setVoiceRoomUsers(data.channelId, data.serverId, data.peers);
      }
    });

    const unVoiceJoin = wsClient.on(WSEvents.VOICE_USER_JOINED, (data) => {
      if (data?.voiceState) handleUserJoinedVoice(data.voiceState);
    });

    const unVoiceLeave = wsClient.on(WSEvents.VOICE_USER_LEFT, (data) => {
      if (data?.channelId && data?.userId) {
        handleUserLeftVoice(data.channelId, data.userId);
      }
    });

    const unVoiceState = wsClient.on(WSEvents.VOICE_STATE_UPDATE, (data) => {
      if (data?.voiceState) handleVoiceStateUpdate(data.voiceState);
    });

    const unRtcSignal = wsClient.on(WSEvents.RTC_SIGNAL, (data) => {
      if (data?.signal && data?.targetUserId) {
        handleRtcSignal(data);
      }
    });

    return () => {
      unConnectionOpen();
      window.removeEventListener('online', resumeRealtime);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', resumeRealtime);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(reconciliationInterval);
      unMsgCreate();
      unMsgUpdate();
      unMsgDelete();
      unTyping();
      unPresence();
      unMemberJoin();
      unMemberLeave();
      unMemberUpdate();
      unChannelCreate();
      unChannelUpdate();
      unChannelDelete();
      unRoleCreate();
      unRoleUpdate();
      unRoleDelete();
      unServerChange();
      unVoicePeers();
      unVoiceJoin();
      unVoiceLeave();
      unVoiceState();
      unRtcSignal();
    };
  }, []);

  useEffect(() => {
    const encodedInvite = window.location.hash.match(/^#invite=(.+)$/)?.[1];
    if (!encodedInvite) return;
    openModal('join_invite', { inviteCode: decodeURIComponent(encodedInvite) });
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, [openModal]);

  // Mobile drawers can always be dismissed from a hardware or desktop keyboard.
  useEffect(() => {
    if (!isMobileSidebarOpen && !isMobileMemberListOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobilePanels();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeMobilePanels, isMobileMemberListOpen, isMobileSidebarOpen]);

  return (
    <div className="gdisc-app-shell relative flex w-full max-w-full min-w-0 bg-gdisc-bg-primary overflow-hidden select-none">
      {!isOnline && (
        <div
          role="status"
          className="fixed left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] mx-auto max-w-md rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-2 text-center text-sm font-semibold text-amber-200 shadow-xl backdrop-blur-md"
        >
          Sem internet — suas conversas serão atualizadas ao reconectar.
        </div>
      )}
      {/* Desktop navigation keeps the familiar Discord column layout. */}
      <nav
        aria-label="Navegação principal"
        className="hidden h-full min-h-0 shrink-0 md:flex"
      >
        <ServerSidebar />
        <ChannelSidebar />
      </nav>

      {/* Always available on phones, including empty and voice-channel views. */}
      <button
        type="button"
        onClick={toggleMobileSidebar}
        aria-label={isMobileSidebarOpen ? 'Fechar navegação' : 'Abrir navegação'}
        aria-controls="mobile-navigation-drawer"
        aria-expanded={isMobileSidebarOpen}
        className={`gdisc-mobile-navigation-trigger absolute z-30 flex min-h-11 min-w-11 items-center justify-center rounded-xl border shadow-lg transition-colors md:hidden ${
          isMobileSidebarOpen
            ? 'border-gdisc-brand-primary/60 bg-gdisc-brand-primary text-white'
            : 'border-gdisc-bg-hover bg-gdisc-bg-card/95 text-gdisc-text-primary hover:bg-gdisc-bg-hover'
        }`}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Center Area: Chat or Voice Call Room */}
      <main className="flex-1 flex min-w-0 min-h-0 h-full overflow-hidden">
        {activeChannel?.type === 'VOICE' ? (
          <div className="gdisc-voice-room-with-menu flex min-w-0 min-h-0 flex-1 overflow-hidden">
            <VoiceRoom />
          </div>
        ) : (
          <ChatArea />
        )}
      </main>

      {/* Desktop member column appears when there is an active server. */}
      {isMemberListOpen && activeServer && (
        <div id="desktop-members-sidebar" className="hidden h-full min-h-0 w-56 shrink-0 lg:flex">
          <MemberSidebar />
        </div>
      )}

      {/* Phone navigation drawer leaves a visible edge of chat for context. */}
      {isMobileSidebarOpen && (
        <div className="gdisc-mobile-overlay fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            onClick={closeMobileSidebar}
            aria-label="Fechar navegação"
            className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-[1px]"
          />
          <nav
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navegação de servidores e canais"
            className="gdisc-mobile-drawer gdisc-mobile-drawer-left absolute inset-y-0 left-0 z-10 flex min-w-0 overflow-hidden bg-gdisc-bg-secondary shadow-2xl"
          >
            <ServerSidebar />
            <ChannelSidebar />
          </nav>
        </div>
      )}

      {/* Members use an independent drawer below lg so desktop visibility stays unchanged. */}
      {isMobileMemberListOpen && activeServer && (
        <div className="gdisc-mobile-overlay fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            onClick={closeMobileMemberList}
            aria-label="Fechar lista de membros"
            className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-[1px]"
          />
          <section
            id="mobile-members-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Membros do servidor"
            className="gdisc-mobile-drawer gdisc-mobile-drawer-right absolute inset-y-0 right-0 z-10 min-w-0 overflow-hidden bg-gdisc-bg-secondary shadow-2xl"
          >
            <button
              type="button"
              onClick={closeMobileMemberList}
              aria-label="Fechar lista de membros"
              title="Fechar lista de membros"
              className="gdisc-mobile-member-close absolute z-10 flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gdisc-text-muted hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary"
            >
              <X className="h-5 w-5" />
            </button>
            <MemberSidebar />
          </section>
        </div>
      )}

      {/* Global Modals */}
      <CreateServerModal />
      <InviteModal />
      <ServerSettingsModal />
      <ChannelModal />
      <UserSettingsModal />
      <DeviceSettingsModal />
      <ScreenShareModal />

      {/* Toast Alerts */}
      <ToastContainer />
    </div>
  );
};
