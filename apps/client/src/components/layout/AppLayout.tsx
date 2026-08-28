import React, { useEffect } from 'react';
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

import { useServerStore } from '../../stores/useServerStore.js';
import { useChannelStore } from '../../stores/useChannelStore.js';
import { useChatStore } from '../../stores/useChatStore.js';
import { useVoiceStore } from '../../stores/useVoiceStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { wsClient } from '../../services/ws.js';
import { WSEvents } from '@gdisc/shared';

export const AppLayout: React.FC = () => {
  const { fetchServers, updateMemberPresence, addMember, removeMember } = useServerStore();
  const { activeChannel } = useChannelStore();
  const { isMemberListOpen } = useUIStore();
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
    fetchServers();

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
    });

    const unMemberLeave = wsClient.on(WSEvents.SERVER_MEMBER_LEFT, (data) => {
      if (data?.serverId && data?.userId) {
        removeMember(data.serverId, data.userId);
      }
    });

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
      unMsgCreate();
      unMsgUpdate();
      unMsgDelete();
      unTyping();
      unPresence();
      unMemberJoin();
      unMemberLeave();
      unVoicePeers();
      unVoiceJoin();
      unVoiceLeave();
      unVoiceState();
      unRtcSignal();
    };
  }, []);

  return (
    <div className="flex h-screen w-screen bg-gdisc-bg-primary overflow-hidden select-none">
      {/* Column 1: Server Sidebar */}
      <ServerSidebar />

      {/* Column 2: Channel Sidebar */}
      <ChannelSidebar />

      {/* Center Area: Chat or Voice Call Room */}
      <main className="flex-1 flex min-w-0 h-full overflow-hidden">
        {activeChannel?.type === 'VOICE' ? <VoiceRoom /> : <ChatArea />}
      </main>

      {/* Column 3: Member Sidebar (Toggleable) */}
      {isMemberListOpen && <MemberSidebar />}

      {/* Global Modals */}
      <CreateServerModal />
      <InviteModal />
      <ServerSettingsModal />
      <ChannelModal />
      <UserSettingsModal />
      <DeviceSettingsModal />

      {/* Toast Alerts */}
      <ToastContainer />
    </div>
  );
};
