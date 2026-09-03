import { create } from 'zustand';
import { wsClient } from '../services/ws.js';
import {
  rtcManager,
  type CallConnectionSnapshot,
  type ScreenShareOptions,
} from '../services/rtc.js';
import { AudioActivityDetector } from '../services/audioMeter.js';
import { sounds } from '../services/soundEffects.js';
import { useAuthStore } from './useAuthStore.js';
import { useUIStore } from './useUIStore.js';
import { WSEvents, type VoiceState, type UserSummary, type RTCSignalPayload } from '@gdisc/shared';
import { platformCapabilities } from '../utils/platform.js';
import { type NoiseSuppressionLevel } from '../services/noiseSuppression.js';

const vad = new AudioActivityDetector();
const DEVICE_PREFERENCES_KEY = 'gdisc:voice-device-preferences';

interface DevicePreferences {
  audioInputId?: string;
  audioOutputId?: string;
  videoInputId?: string;
  noiseSuppressionLevel?: NoiseSuppressionLevel;
  noiseSuppressionEnabled?: boolean;
  micGain?: number;
  echoCancellation?: boolean;
  participantVolumes?: Record<string, number>;
}

const loadDevicePreferences = (): DevicePreferences => {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_PREFERENCES_KEY) ?? '{}') as DevicePreferences;
  } catch {
    return {};
  }
};

const saveDevicePreferences = (preferences: DevicePreferences): void => {
  try {
    localStorage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be disabled in hardened browser profiles.
  }
};

const initialDevicePreferences = loadDevicePreferences();
const initialNoiseLevel: NoiseSuppressionLevel =
  initialDevicePreferences.noiseSuppressionLevel ??
  (initialDevicePreferences.noiseSuppressionEnabled === false ? 'off' : 'high');

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
  remoteScreenStreams: Map<string, MediaStream>;
  connectionSnapshot: CallConnectionSnapshot;

  // Device selectors & DSP Audio Settings
  selectedAudioInputId?: string;
  selectedAudioOutputId?: string;
  selectedVideoInputId?: string;
  noiseSuppressionLevel: NoiseSuppressionLevel;
  isNoiseSuppressionEnabled: boolean;
  micGain: number;
  echoCancellation: boolean;
  participantVolumes: Record<string, number>; // userId -> volume 0 to 200 (100 is normal)

  joinVoice: (channelId: string, serverId: string) => Promise<void>;
  leaveVoice: () => Promise<void>;
  toggleMute: () => void;
  toggleDeaf: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: (options?: ScreenShareOptions) => Promise<void>;
  setAudioInput: (deviceId: string) => Promise<void>;
  setAudioOutput: (deviceId: string) => Promise<void>;
  setVideoInput: (deviceId: string) => Promise<void>;
  setNoiseSuppressionLevel: (level: NoiseSuppressionLevel) => Promise<void>;
  setNoiseSuppression: (enabled: boolean) => Promise<void>;
  setMicGain: (gain: number) => void;
  setEchoCancellation: (enabled: boolean) => Promise<void>;
  setParticipantVolume: (userId: string, volume: number) => void;
  retryConnections: () => Promise<void>;

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
  remoteScreenStreams: new Map(),
  connectionSnapshot: {
    status: 'connecting',
    quality: 'unknown',
    peerCount: 0,
    connectedPeers: 0,
    usingTurn: false,
  },
  selectedAudioInputId: initialDevicePreferences.audioInputId,
  selectedAudioOutputId: initialDevicePreferences.audioOutputId,
  selectedVideoInputId: initialDevicePreferences.videoInputId,
  noiseSuppressionLevel: initialNoiseLevel,
  isNoiseSuppressionEnabled: initialNoiseLevel !== 'off',
  micGain: initialDevicePreferences.micGain ?? 1.0,
  echoCancellation: initialDevicePreferences.echoCancellation !== false,
  participantVolumes: initialDevicePreferences.participantVolumes ?? {},

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
    rtcManager.setRemoteStreamCallback((streams, screenStreams) => {
      set({
        remoteStreams: new Map(streams),
        remoteScreenStreams: new Map(screenStreams),
      });
    });
    rtcManager.setConnectionSnapshotCallback((connectionSnapshot) => {
      const previousStatus = get().connectionSnapshot.status;
      set({ connectionSnapshot });
      if (connectionSnapshot.status === 'failed' && previousStatus !== 'failed') {
        useUIStore.getState().addToast(
          connectionSnapshot.usingTurn
            ? 'A conexão de mídia falhou e será tentada novamente automaticamente.'
            : 'A rede bloqueou a conexão direta. Tentando novamente; para redes restritas, configure um servidor TURN.',
          'error',
        );
      }
    });
    rtcManager.setScreenShareEndedCallback(() => {
      const channelId = get().activeVoiceChannelId;
      set({ isScreenSharing: false, screenStream: null });
      if (channelId) {
        wsClient.send(WSEvents.VOICE_STATE_UPDATE, { channelId, selfScreen: false });
      }
    });

    try {
      const requestedVideo = get().isVideoOn;
      const stream = await rtcManager.initLocalMedia(
        true,
        requestedVideo,
        get().selectedAudioInputId,
        get().selectedVideoInputId,
        get().noiseSuppressionLevel,
        get().echoCancellation,
      );
      rtcManager.toggleMute(get().isMuted);
      const videoEnabled = requestedVideo && stream.getVideoTracks().some(
        (track) => track.readyState === 'live',
      );

      set({ localStream: stream, isVideoOn: videoEnabled });

      // Wait for the private Realtime channel and Presence tracking before any
      // WebRTC offer, answer or ICE candidate is sent.
      await wsClient.joinVoice({
        channelId,
        serverId,
        selfMute: get().isMuted,
        selfDeaf: get().isDeafened,
        selfVideo: videoEnabled,
        selfScreen: get().isScreenSharing,
      });

      // Start Voice Activity Detection for speaking ring
      vad.start(stream, (speaking) => {
        if (get().isMuted) {
          if (get().isSpeaking) {
            set({ isSpeaking: false });
            wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
              channelId,
              isSpeaking: false,
            });
          }
          return;
        }
        set({ isSpeaking: speaking });
        wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
          channelId,
          isSpeaking: speaking,
        });
      });

      sounds.playJoin();
    } catch (err) {
      console.error('Error joining voice:', err);
      vad.stop();
      rtcManager.leaveAll();
      rtcManager.setScreenShareEndedCallback(null);
      rtcManager.setConnectionSnapshotCallback(null);
      await wsClient.leaveVoice();
      set({
        activeVoiceChannelId: null,
        activeServerId: null,
        localStream: null,
        screenStream: null,
        remoteStreams: new Map(),
        remoteScreenStreams: new Map(),
        isSpeaking: false,
        isVideoOn: false,
        isScreenSharing: false,
        connectionSnapshot: {
          status: 'connecting',
          quality: 'unknown',
          peerCount: 0,
          connectedPeers: 0,
          usingTurn: false,
        },
      });
      throw err;
    }
  },

  leaveVoice: async () => {
    sounds.playLeave();
    vad.stop();
    rtcManager.leaveAll();
    rtcManager.setScreenShareEndedCallback(null);
    rtcManager.setConnectionSnapshotCallback(null);

    set({
      activeVoiceChannelId: null,
      activeServerId: null,
      localStream: null,
      screenStream: null,
      remoteStreams: new Map(),
      remoteScreenStreams: new Map(),
      isSpeaking: false,
      isVideoOn: false,
      isScreenSharing: false,
      connectionSnapshot: {
        status: 'connecting',
        quality: 'unknown',
        peerCount: 0,
        connectedPeers: 0,
        usingTurn: false,
      },
    });
    await wsClient.leaveVoice();
  },

  toggleMute: () => {
    const nextMuted = !get().isMuted;
    sounds.playMute(nextMuted);
    rtcManager.toggleMute(nextMuted);
    set({ isMuted: nextMuted, ...(nextMuted ? { isSpeaking: false } : {}) });

    const channelId = get().activeVoiceChannelId;
    if (channelId) {
      wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
        channelId,
        selfMute: nextMuted,
        ...(nextMuted ? { isSpeaking: false } : {}),
      });
    }
  },

  toggleDeaf: () => {
    const nextDeaf = !get().isDeafened;
    sounds.playMute(nextDeaf);
    // When deafened, also mute
    const nextMute = nextDeaf ? true : get().isMuted;
    rtcManager.toggleMute(nextMute);

    set({ isDeafened: nextDeaf, isMuted: nextMute, ...(nextMute ? { isSpeaking: false } : {}) });

    const channelId = get().activeVoiceChannelId;
    if (channelId) {
      wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
        channelId,
        selfDeaf: nextDeaf,
        selfMute: nextMute,
        ...(nextMute ? { isSpeaking: false } : {}),
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

  toggleScreenShare: async (options?: ScreenShareOptions) => {
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
      const stream = await rtcManager.startScreenShare(options);
      if (stream) {
        if (options?.withAudio && stream.getAudioTracks().length === 0) {
          useUIStore.getState().addToast(
            'A tela foi compartilhada sem áudio. Para transmitir som, escolha uma guia ou janela compatível no seletor do sistema.',
            'info',
          );
        }
        set({ isScreenSharing: true, screenStream: stream });
        const channelId = get().activeVoiceChannelId;
        if (channelId) {
          wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
            channelId,
            selfScreen: true,
          });
        }
      } else {
        throw new Error('Compartilhamento de tela cancelado ou não autorizado.');
      }
    }
  },

  setAudioInput: async (deviceId: string) => {
    const activeChannelId = get().activeVoiceChannelId;
    if (activeChannelId) {
      const stream = await rtcManager.switchAudioInput(
        deviceId || undefined,
        get().noiseSuppressionLevel,
        get().echoCancellation,
      );
      rtcManager.toggleMute(get().isMuted);
      set({ localStream: stream, isSpeaking: false });
      wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
        channelId: activeChannelId,
        isSpeaking: false,
      });
      vad.start(stream, (speaking) => {
        if (get().isMuted) {
          if (get().isSpeaking) {
            set({ isSpeaking: false });
            wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
              channelId: activeChannelId,
              isSpeaking: false,
            });
          }
          return;
        }
        set({ isSpeaking: speaking });
        wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
          channelId: activeChannelId,
          isSpeaking: speaking,
        });
      });
    }
    const selectedAudioInputId = deviceId || undefined;
    set({ selectedAudioInputId });
    saveDevicePreferences({
      audioInputId: selectedAudioInputId,
      audioOutputId: get().selectedAudioOutputId,
      videoInputId: get().selectedVideoInputId,
      noiseSuppressionLevel: get().noiseSuppressionLevel,
      noiseSuppressionEnabled: get().isNoiseSuppressionEnabled,
      micGain: get().micGain,
      echoCancellation: get().echoCancellation,
      participantVolumes: get().participantVolumes,
    });
  },

  setAudioOutput: async (deviceId: string) => {
    if (!platformCapabilities.audioOutputSelection) {
      throw new Error('A saída de áudio é controlada pelo sistema neste dispositivo.');
    }
    const probe = document.createElement('audio') as HTMLAudioElement & {
      setSinkId: (id: string) => Promise<void>;
    };
    await probe.setSinkId(deviceId || 'default');
    const selectedAudioOutputId = deviceId || undefined;
    set({ selectedAudioOutputId });
    saveDevicePreferences({
      audioInputId: get().selectedAudioInputId,
      audioOutputId: selectedAudioOutputId,
      videoInputId: get().selectedVideoInputId,
      noiseSuppressionLevel: get().noiseSuppressionLevel,
      noiseSuppressionEnabled: get().isNoiseSuppressionEnabled,
      micGain: get().micGain,
      echoCancellation: get().echoCancellation,
      participantVolumes: get().participantVolumes,
    });
  },

  setVideoInput: async (deviceId: string) => {
    if (get().activeVoiceChannelId && get().isVideoOn) {
      const stream = await rtcManager.toggleCamera(true, deviceId || undefined);
      set({ localStream: stream });
    }
    const selectedVideoInputId = deviceId || undefined;
    set({ selectedVideoInputId });
    saveDevicePreferences({
      audioInputId: get().selectedAudioInputId,
      audioOutputId: get().selectedAudioOutputId,
      videoInputId: selectedVideoInputId,
      noiseSuppressionLevel: get().noiseSuppressionLevel,
      noiseSuppressionEnabled: get().isNoiseSuppressionEnabled,
      micGain: get().micGain,
      echoCancellation: get().echoCancellation,
      participantVolumes: get().participantVolumes,
    });
  },

  setNoiseSuppressionLevel: async (level: NoiseSuppressionLevel) => {
    rtcManager.setNoiseSuppressionLevel(level);
    set({
      noiseSuppressionLevel: level,
      isNoiseSuppressionEnabled: level !== 'off',
    });
    saveDevicePreferences({
      audioInputId: get().selectedAudioInputId,
      audioOutputId: get().selectedAudioOutputId,
      videoInputId: get().selectedVideoInputId,
      noiseSuppressionLevel: level,
      noiseSuppressionEnabled: level !== 'off',
      micGain: get().micGain,
      echoCancellation: get().echoCancellation,
      participantVolumes: get().participantVolumes,
    });
  },

  setNoiseSuppression: async (enabled: boolean) => {
    await get().setNoiseSuppressionLevel(enabled ? 'high' : 'off');
  },

  setMicGain: (gain: number) => {
    rtcManager.setMicGain(gain);
    set({ micGain: gain });
    saveDevicePreferences({
      audioInputId: get().selectedAudioInputId,
      audioOutputId: get().selectedAudioOutputId,
      videoInputId: get().selectedVideoInputId,
      noiseSuppressionLevel: get().noiseSuppressionLevel,
      noiseSuppressionEnabled: get().isNoiseSuppressionEnabled,
      micGain: gain,
      echoCancellation: get().echoCancellation,
      participantVolumes: get().participantVolumes,
    });
  },

  setEchoCancellation: async (enabled: boolean) => {
    set({ echoCancellation: enabled });
    const activeChannelId = get().activeVoiceChannelId;
    if (activeChannelId) {
      const stream = await rtcManager.switchAudioInput(
        get().selectedAudioInputId,
        get().noiseSuppressionLevel,
        enabled,
      );
      rtcManager.toggleMute(get().isMuted);
      set({ localStream: stream, isSpeaking: false });
      vad.start(stream, (speaking) => {
        if (get().isMuted) {
          if (get().isSpeaking) {
            set({ isSpeaking: false });
            wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
              channelId: activeChannelId,
              isSpeaking: false,
            });
          }
          return;
        }
        set({ isSpeaking: speaking });
        wsClient.send(WSEvents.VOICE_STATE_UPDATE, {
          channelId: activeChannelId,
          isSpeaking: speaking,
        });
      });
    }
    saveDevicePreferences({
      audioInputId: get().selectedAudioInputId,
      audioOutputId: get().selectedAudioOutputId,
      videoInputId: get().selectedVideoInputId,
      noiseSuppressionLevel: get().noiseSuppressionLevel,
      noiseSuppressionEnabled: get().isNoiseSuppressionEnabled,
      micGain: get().micGain,
      echoCancellation: enabled,
      participantVolumes: get().participantVolumes,
    });
  },

  setParticipantVolume: (userId: string, volume: number) => {
    const next = { ...get().participantVolumes, [userId]: volume };
    set({ participantVolumes: next });
    saveDevicePreferences({
      audioInputId: get().selectedAudioInputId,
      audioOutputId: get().selectedAudioOutputId,
      videoInputId: get().selectedVideoInputId,
      noiseSuppressionLevel: get().noiseSuppressionLevel,
      noiseSuppressionEnabled: get().isNoiseSuppressionEnabled,
      micGain: get().micGain,
      echoCancellation: get().echoCancellation,
      participantVolumes: next,
    });
  },

  retryConnections: async () => {
    await rtcManager.retryAllConnections();
  },

  setVoiceRoomUsers: (channelId: string, serverId: string, peers: VoiceState[]) => {
    set((state) => ({
      voiceStates: {
        ...state.voiceStates,
        [channelId]: peers,
      },
    }));

    if (channelId === get().activeVoiceChannelId) {
      rtcManager.syncPeerMediaStates(peers);
      void rtcManager.syncPeers(peers);
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
      rtcManager.updatePeerMediaState(voiceState);
      // The user that just joined creates the initial offer after Presence
      // sync, so existing users wait here and avoid simultaneous SDP offers.
      void rtcManager.connectToPeers([voiceState.userId], new Set());
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
    if (voiceState.channelId === get().activeVoiceChannelId) {
      rtcManager.updatePeerMediaState(voiceState);
    }
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
