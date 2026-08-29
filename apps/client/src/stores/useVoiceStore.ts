import { create } from 'zustand';
import { wsClient } from '../services/ws.js';
import { rtcManager } from '../services/rtc.js';
import { AudioActivityDetector } from '../services/audioMeter.js';
import { useAuthStore } from './useAuthStore.js';
import { WSEvents, type VoiceState, type UserSummary, type RTCSignalPayload } from '@gdisc/shared';

const vad = new AudioActivityDetector();

interface VoiceStoreState {
  activeVoiceChannelId: string | null;
  activeServerId: string | null;
  voiceStates: Record<string, VoiceState[]>; // channelId -> VoiceState[]
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;

  // Device selectors
  selectedAudioInputId?: string;
  selectedAudioOutputId?: string;
  selectedVideoInputId?: string;

  joinVoice: (channelId: string, serverId: string) => Promise<void>;
  leaveVoice: () => Promise<void>;
  toggleMute: () => void;
  toggleDeaf: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setAudioInput: (deviceId: string) => Promise<void>;
  setVideoInput: (deviceId: string) => Promise<void>;

  // Realtime handlers
  setVoiceRoomUsers: (channelId: string, serverId: string, peers: VoiceState[]) => void;
  handleUserJoinedVoice: (voiceState: VoiceState) => void;
  handleUserLeftVoice: (channelId: string, userId: string) => void;
  handleVoiceStateUpdate: (voiceState: VoiceState) => void;
  handleRtcSignal: (payload: RTCSignalPayload) => void;
}

export const useVoiceStore = create<VoiceStoreState>((set, get) => ({
  activeVoiceChannelId: null,
  activeServerId: null,
  voiceStates: {},
  isMuted: false,
  isDeafened: false,
  isVideoOn: false,
  isScreenSharing: false,
  isSpeaking: false,
  localStream: null,
  screenStream: null,
  remoteStreams: new Map(),

  joinVoice: async (channelId: string, serverId: string) => {
    // If currently in a channel, leave it
    if (get().activeVoiceChannelId) {
      await get().leaveVoice();
    }

    const currentUserId = useAuthStore.getState().user?.id;
    if (!currentUserId) throw new Error('É necessário estar autenticado para entrar na call.');

    set({ activeVoiceChannelId: channelId, activeServerId: serverId });
    rtcManager.setChannel(channelId, currentUserId);

    // Setup listener for remote stream updates
    rtcManager.setRemoteStreamCallback((streams) => {
      set({ remoteStreams: new Map(streams) });
    });

    try {
      const stream = await rtcManager.initLocalMedia(
        !get().isMuted,
        get().isVideoOn,
        get().selectedAudioInputId,
        get().selectedVideoInputId
      );

      set({ localStream: stream });

      // Wait for the private Realtime channel and Presence tracking before any
      // WebRTC offer, answer or ICE candidate is sent.
      await wsClient.joinVoice({
        channelId,
        serverId,
        selfMute: get().isMuted,
        selfDeaf: get().isDeafened,
        selfVideo: get().isVideoOn,
        selfScreen: get().isScreenSharing,
      });

      // Start Voice Activity Detection for speaking ring
      vad.start(stream, (speaking) => {
        set({ isSpeaking: speaking });
        wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
          channelId,
          isSpeaking: speaking,
        });
      });
    } catch (err) {
      console.error('Error joining voice:', err);
      vad.stop();
      rtcManager.leaveAll();
      await wsClient.leaveVoice();
      set({
        activeVoiceChannelId: null,
        activeServerId: null,
        localStream: null,
        screenStream: null,
        remoteStreams: new Map(),
        isSpeaking: false,
        isVideoOn: false,
        isScreenSharing: false,
      });
      throw err;
    }
  },

  leaveVoice: async () => {
    vad.stop();
    rtcManager.leaveAll();

    set({
      activeVoiceChannelId: null,
      activeServerId: null,
      localStream: null,
      screenStream: null,
      remoteStreams: new Map(),
      isSpeaking: false,
      isVideoOn: false,
      isScreenSharing: false,
    });
    await wsClient.leaveVoice();
  },

  toggleMute: () => {
    const nextMuted = !get().isMuted;
    rtcManager.toggleMute(nextMuted);
    set({ isMuted: nextMuted });

    const channelId = get().activeVoiceChannelId;
    if (channelId) {
      wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
        channelId,
        selfMute: nextMuted,
      });
    }
  },

  toggleDeaf: () => {
    const nextDeaf = !get().isDeafened;
    // When deafened, also mute
    const nextMute = nextDeaf ? true : get().isMuted;
    rtcManager.toggleMute(nextMute);

    set({ isDeafened: nextDeaf, isMuted: nextMute });

    const channelId = get().activeVoiceChannelId;
    if (channelId) {
      wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
        channelId,
        selfDeaf: nextDeaf,
        selfMute: nextMute,
      });
    }
  },

  toggleVideo: async () => {
    const nextVideo = !get().isVideoOn;
    const stream = await rtcManager.toggleCamera(nextVideo, get().selectedVideoInputId);
    const videoEnabled = nextVideo && Boolean(
      stream?.getVideoTracks().some((track) => track.readyState === 'live'),
    );
    set({ isVideoOn: videoEnabled, localStream: stream });

    const channelId = get().activeVoiceChannelId;
    if (channelId) {
      wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
        channelId,
        selfVideo: videoEnabled,
      });
    }
  },

  toggleScreenShare: async () => {
    const isSharing = get().isScreenSharing;
    if (isSharing) {
      await rtcManager.stopScreenShare();
      set({ isScreenSharing: false, screenStream: null });
      const channelId = get().activeVoiceChannelId;
      if (channelId) {
        wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
          channelId,
          selfScreen: false,
        });
      }
    } else {
      const stream = await rtcManager.startScreenShare();
      if (stream) {
        set({ isScreenSharing: true, screenStream: stream });
        const channelId = get().activeVoiceChannelId;
        if (channelId) {
          wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
            channelId,
            selfScreen: true,
          });
        }
      }
    }
  },

  setAudioInput: async (deviceId: string) => {
    set({ selectedAudioInputId: deviceId });
    if (get().activeVoiceChannelId) {
      const stream = await rtcManager.initLocalMedia(
        !get().isMuted,
        get().isVideoOn,
        deviceId,
        get().selectedVideoInputId
      );
      set({ localStream: stream });
    }
  },

  setVideoInput: async (deviceId: string) => {
    set({ selectedVideoInputId: deviceId });
    if (get().activeVoiceChannelId && get().isVideoOn) {
      const stream = await rtcManager.toggleCamera(true, deviceId);
      set({ localStream: stream });
    }
  },

  setVoiceRoomUsers: (channelId: string, serverId: string, peers: VoiceState[]) => {
    set((state) => ({
      voiceStates: {
        ...state.voiceStates,
        [channelId]: peers,
      },
    }));

    // Initiate WebRTC peer connections with existing members in room
    const currentUserId = useAuthStore.getState().user?.id ?? null;

    const otherPeerIds = peers
      .filter((p) => p.userId !== currentUserId)
      .map((p) => p.userId);

    if (channelId === get().activeVoiceChannelId) {
      void rtcManager.syncPeers(otherPeerIds);
    }
  },

  handleUserJoinedVoice: (voiceState: VoiceState) => {
    set((state) => {
      const channelUsers = state.voiceStates[voiceState.channelId] || [];
      const updated = [...channelUsers.filter((u) => u.userId !== voiceState.userId), voiceState];
      return {
        voiceStates: {
          ...state.voiceStates,
          [voiceState.channelId]: updated,
        },
      };
    });

    if (voiceState.channelId === get().activeVoiceChannelId) {
      void rtcManager.connectToPeers([voiceState.userId]);
    }
  },

  handleUserLeftVoice: (channelId: string, userId: string) => {
    rtcManager.removePeer(userId);
    set((state) => {
      const channelUsers = state.voiceStates[channelId] || [];
      return {
        voiceStates: {
          ...state.voiceStates,
          [channelId]: channelUsers.filter((u) => u.userId !== userId),
        },
      };
    });
  },

  handleVoiceStateUpdate: (voiceState: VoiceState) => {
    set((state) => {
      const channelUsers = state.voiceStates[voiceState.channelId] || [];
      const exists = channelUsers.some((user) => user.userId === voiceState.userId);
      return {
        voiceStates: {
          ...state.voiceStates,
          [voiceState.channelId]: exists
            ? channelUsers.map((u) => u.userId === voiceState.userId ? voiceState : u)
            : [...channelUsers, voiceState],
        },
      };
    });
  },

  handleRtcSignal: (payload: RTCSignalPayload) => {
    void rtcManager.handleSignal(payload);
  },
}));
