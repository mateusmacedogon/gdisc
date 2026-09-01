/**
 * GDisC WebRTC Realtime Mesh Engine
 * Production-ready P2P WebRTC engine with Immutable MediaStream Architecture,
 * Perfect Negotiation, resilient window/tab capture, and stable video pipeline.
 */

import { wsClient } from './ws.js';
import { supabase } from './supabase.js';
import {
  getRtcNegotiationRetryDelay,
  matchesRtcConnection,
  shouldInitiateRtcConnection,
  shouldInitiateRtcConnectionForJoin,
  type RTCSignalPayload,
} from '@gdisc/shared';
import type { VoiceState } from '@gdisc/shared';
import { platformCapabilities } from '../utils/platform.js';

type ViteRuntimeEnv = Record<string, string | boolean | undefined>;
const runtimeEnv = (import.meta as ImportMeta & { readonly env?: ViteRuntimeEnv }).env;
const optionalStringEnv = (name: string): string | undefined => {
  const value = runtimeEnv?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const turnUrls = optionalStringEnv('VITE_TURN_URLS')
  ?.split(',')
  .map((url: string) => url.trim())
  .filter(Boolean) ?? [];
const turnUsername = optionalStringEnv('VITE_TURN_USERNAME');
const turnCredential = optionalStringEnv('VITE_TURN_CREDENTIAL');
const turnCredentialsUrl = optionalStringEnv('VITE_TURN_CREDENTIALS_URL');

const configuredTurnServer: RTCIceServer[] = turnUrls.length > 0 && turnUsername && turnCredential
  ? [{ urls: turnUrls, username: turnUsername, credential: turnCredential }]
  : [];

const BASE_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  ...configuredTurnServer,
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: BASE_ICE_SERVERS,
  iceCandidatePoolSize: 4,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export interface ScreenShareOptions {
  sourceId?: string;
  resolution?: '720p' | '1080p' | 'original';
  fps?: 15 | 30 | 60;
  withAudio?: boolean;
}

type RemoteStreamCallback = (peerStreams: Map<string, MediaStream>) => void;

export type CallConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'poor' | 'failed';
export type CallConnectionQuality = 'unknown' | 'excellent' | 'good' | 'poor';

export interface CallConnectionSnapshot {
  status: CallConnectionStatus;
  quality: CallConnectionQuality;
  peerCount: number;
  connectedPeers: number;
  usingTurn: boolean;
  roundTripTimeMs?: number;
  packetLossPercent?: number;
}

interface PeerMediaExpectation {
  expectsVideo: boolean;
  expectsScreen: boolean;
  speakingUntil: number;
}

interface PeerStatsSnapshot {
  audioBytes: number;
  videoBytes: number;
  audioProgressAt: number;
  videoProgressAt: number;
  stalledChecks: number;
  lastRecoveryAt: number;
  recoveryAttempts: number;
}

interface PendingIceCandidate {
  connectionId?: string;
  candidate: RTCIceCandidateInit;
}

type ConnectionSnapshotCallback = (snapshot: CallConnectionSnapshot) => void;

let cachedDynamicIceServers: RTCIceServer[] | null = null;
let dynamicIceServersExpiresAt = 0;
let dynamicIceServersRequest: Promise<RTCIceServer[]> | null = null;

const normalizeIceServers = (value: unknown): RTCIceServer[] => {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? ((value as { iceServers?: unknown; ice_servers?: unknown }).iceServers
        ?? (value as { ice_servers?: unknown }).ice_servers)
      : undefined;
  if (!Array.isArray(source)) return [];

  return source.flatMap((entry): RTCIceServer[] => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as { urls?: unknown; url?: unknown; username?: unknown; credential?: unknown };
    const rawUrls = candidate.urls ?? candidate.url;
    const urls = (Array.isArray(rawUrls) ? rawUrls : [rawUrls])
      .filter((url): url is string => typeof url === 'string')
      .map((url) => url.trim())
      .filter((url) => /^(stun|stuns|turn|turns):/i.test(url));
    if (urls.length === 0) return [];
    return [{
      urls,
      ...(typeof candidate.username === 'string' ? { username: candidate.username } : {}),
      ...(typeof candidate.credential === 'string' ? { credential: candidate.credential } : {}),
    }];
  });
};

const loadDynamicIceServers = async (): Promise<RTCIceServer[]> => {
  if (!turnCredentialsUrl) return [];
  if (cachedDynamicIceServers && Date.now() < dynamicIceServersExpiresAt) {
    return cachedDynamicIceServers;
  }
  if (dynamicIceServersRequest) return dynamicIceServersRequest;

  dynamicIceServersRequest = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(turnCredentialsUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as unknown;
      const servers = normalizeIceServers(payload);
      if (servers.length === 0) throw new Error('resposta sem servidores ICE válidos');
      cachedDynamicIceServers = servers;
      dynamicIceServersExpiresAt = Date.now() + 5 * 60_000;
      return servers;
    } catch (error) {
      console.warn('[WebRTC] Dynamic TURN credentials unavailable; using static ICE servers:', error);
      return [];
    } finally {
      clearTimeout(timeout);
      dynamicIceServersRequest = null;
    }
  })();

  return dynamicIceServersRequest;
};

const createRtcConfiguration = async (): Promise<RTCConfiguration> => {
  const dynamicServers = await loadDynamicIceServers();
  return {
    ...RTC_CONFIG,
    iceServers: [...BASE_ICE_SERVERS, ...dynamicServers],
  };
};

class WebRTCManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remotePeerTracks: Map<string, Map<string, MediaStreamTrack>> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private pendingIceCandidates: Map<string, PendingIceCandidate[]> = new Map();
  private receivedIceCandidateKeys: Map<string, Set<string>> = new Map();
  private peerConnectionIds: Map<string, string> = new Map();
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private connectionTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private isMakingOffer: Map<string, boolean> = new Map();
  private signalQueues: Map<string, Promise<void>> = new Map();
  private ignoredOfferPeers = new Set<string>();
  private negotiationPending = new Set<string>();
  private iceRestartPending = new Set<string>();
  private negotiationRetryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private negotiationRetryAttempts: Map<string, number> = new Map();
  private expectedPeerIds = new Set<string>();
  private peerMediaExpectations: Map<string, PeerMediaExpectation> = new Map();
  private peerStats: Map<string, PeerStatsSnapshot> = new Map();
  private senderQualityTiers: Map<RTCRtpSender, string> = new Map();
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private statsCollectionRunning = false;
  private currentChannelId: string | null = null;
  private localUserId: string | null = null;
  private onRemoteStreamsChanged: RemoteStreamCallback | null = null;
  private onScreenShareEnded: (() => void) | null = null;
  private onConnectionSnapshotChanged: ConnectionSnapshotCallback | null = null;
  private lastConnectionSnapshot: CallConnectionSnapshot = {
    status: 'connecting',
    quality: 'unknown',
    peerCount: 0,
    connectedPeers: 0,
    usingTurn: false,
  };

  public setRemoteStreamCallback(cb: RemoteStreamCallback) {
    this.onRemoteStreamsChanged = cb;
  }

  public setScreenShareEndedCallback(cb: (() => void) | null) {
    this.onScreenShareEnded = cb;
  }

  public setConnectionSnapshotCallback(cb: ConnectionSnapshotCallback | null) {
    this.onConnectionSnapshotChanged = cb;
    if (cb) cb(this.lastConnectionSnapshot);
  }

  /**
   * Initializes local user media (Microphone and optional Camera)
   */
  public async initLocalMedia(
    audio = true,
    video = false,
    audioDeviceId?: string,
    videoDeviceId?: string,
    noiseSuppression = true,
  ): Promise<MediaStream> {
    if (!platformCapabilities.camera) {
      throw new Error('Este dispositivo não oferece acesso a microfone ou câmera neste aplicativo.');
    }

    const constraints: MediaStreamConstraints = {
      audio: audio
        ? {
            echoCancellation: true,
            noiseSuppression,
            autoGainControl: true,
            ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
          }
        : false,
      video: video
        ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
          }
        : false,
    };

    let nextStream: MediaStream;
    try {
      nextStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('[WebRTC] getUserMedia failed with requested constraints, falling back:', err);
      if (!audio) throw this.createMediaError(err, 'Não foi possível acessar a câmera.');
      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression, autoGainControl: true },
          video: false,
        });
      } catch (fallbackErr) {
        console.error('[WebRTC] Failed to get user media:', fallbackErr);
        throw this.createMediaError(fallbackErr, 'Não foi possível acessar o microfone.');
      }
    }

    const previousStream = this.localStream;
    this.localStream = nextStream;
    this.localStream.getAudioTracks().forEach((track) => { track.contentHint = 'speech'; });
    this.localStream.getVideoTracks().forEach((track) => { track.contentHint = 'motion'; });
    previousStream?.getTracks().forEach((track) => track.stop());
    await this.renegotiateAllPeers();
    return nextStream;
  }

  public async switchAudioInput(deviceId?: string, noiseSuppression = true): Promise<MediaStream> {
    if (!platformCapabilities.camera) {
      throw new Error('A seleção de microfone não é suportada neste dispositivo.');
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression,
          autoGainControl: true,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
        video: false,
      });
    } catch (error) {
      throw this.createMediaError(error, 'Não foi possível trocar o microfone.');
    }

    const nextAudioTrack = stream.getAudioTracks()[0];
    if (!nextAudioTrack) throw new Error('O microfone selecionado não forneceu áudio.');
    nextAudioTrack.contentHint = 'speech';
    const previousStream = this.localStream;
    previousStream?.getAudioTracks().forEach((track) => track.stop());
    const liveVideoTracks = previousStream?.getVideoTracks()
      .filter((track) => track.readyState === 'live') ?? [];
    this.localStream = new MediaStream([...liveVideoTracks, nextAudioTrack]);
    await this.renegotiateAllPeers();
    return this.localStream;
  }

  /**
   * Starts screen capture on Desktop (Electron) or Web browser (Window, Tab, Full Screen)
   */
  public async startScreenShare(options?: ScreenShareOptions): Promise<MediaStream | null> {
    if (!platformCapabilities.screenShare) {
      throw new Error('O compartilhamento de tela não é suportado neste dispositivo.');
    }
    try {
      const fps = options?.fps ?? 30;

      this.screenStream = null;

      // In Electron desktop environment with a specific selected window or screen
      if (options?.sourceId) {
        try {
          // Electron's main process grants the source selected in our picker
          // and provides Windows loopback audio through this standards API.
          this.screenStream = await navigator.mediaDevices.getDisplayMedia({
            audio: Boolean(options.withAudio),
            video: {
              width: { ideal: options?.resolution === '720p' ? 1280 : options?.resolution === '1080p' ? 1920 : 3840 },
              height: { ideal: options?.resolution === '720p' ? 720 : options?.resolution === '1080p' ? 1080 : 2160 },
              frameRate: { ideal: fps, max: fps },
            },
          } as DisplayMediaStreamOptions);
        } catch (displayMediaError) {
          console.warn('[WebRTC] Electron display capture failed, trying legacy source capture:', displayMediaError);
          try {
            this.screenStream = await (navigator.mediaDevices as any).getUserMedia({
              audio: options.withAudio
                ? { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: options.sourceId } }
                : false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: options.sourceId,
                  maxWidth: options?.resolution === '720p' ? 1280 : options?.resolution === '1080p' ? 1920 : 3840,
                  maxHeight: options?.resolution === '720p' ? 720 : options?.resolution === '1080p' ? 1080 : 2160,
                  maxFrameRate: fps,
                },
              },
            });
          } catch (legacyError) {
            console.warn('[WebRTC] Legacy desktop source capture also failed:', legacyError);
          }
        }
      }

      // Web Browser standard getDisplayMedia capture with resilient fallback
      if (!this.screenStream) {
        const tryGetDisplayMedia = async (withSysAudio: boolean): Promise<MediaStream> => {
          const videoConstraints: MediaTrackConstraints = {
            frameRate: { ideal: fps, max: fps },
            ...(options?.resolution === '720p'
              ? { width: { ideal: 1280 }, height: { ideal: 720 } }
              : options?.resolution === '1080p'
              ? { width: { ideal: 1920 }, height: { ideal: 1080 } }
              : {}),
          };

          return await navigator.mediaDevices.getDisplayMedia({
            video: videoConstraints,
            audio: withSysAudio
              ? {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
                }
              : false,
          } as DisplayMediaStreamOptions);
        };

        try {
          this.screenStream = await tryGetDisplayMedia(Boolean(options?.withAudio));
        } catch (displayErr: any) {
          // If browser rejects because system audio is unsupported on chosen window/tab, retry with video only
          if (options?.withAudio && displayErr?.name !== 'NotAllowedError') {
            console.warn('[WebRTC] getDisplayMedia with audio failed, retrying with video only:', displayErr);
            this.screenStream = await tryGetDisplayMedia(false);
          } else {
            throw displayErr;
          }
        }
      }

      const videoTrack = this.screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.contentHint = fps >= 45 ? 'motion' : 'detail';
        videoTrack.onended = () => {
          void this.stopScreenShare().finally(() => this.onScreenShareEnded?.());
        };
      }
      this.screenStream.getAudioTracks().forEach((track) => { track.contentHint = 'music'; });

      await this.renegotiateAllPeers();
      return this.screenStream;
    } catch (err) {
      console.error('[WebRTC] Error starting screen share:', err);
      throw this.createMediaError(err, 'Não foi possível iniciar o compartilhamento de tela.');
    }
  }

  public async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      this.screenStream = null;
    }
    await this.renegotiateAllPeers();
  }

  public toggleMute(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public async toggleCamera(enabled: boolean, videoDeviceId?: string): Promise<MediaStream | null> {
    if (!enabled) {
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach((track) => {
          track.stop();
          this.localStream!.removeTrack(track);
        });
      }
      await this.renegotiateAllPeers();
      return this.localStream;
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
          },
        });

        const newVideoTrack = videoStream.getVideoTracks()[0];
        if (newVideoTrack) {
          newVideoTrack.contentHint = 'motion';
          if (!this.localStream) {
            this.localStream = new MediaStream();
          }
          this.localStream.getVideoTracks().forEach((track) => {
            track.stop();
            this.localStream!.removeTrack(track);
          });
          this.localStream.addTrack(newVideoTrack);
          await this.renegotiateAllPeers();
        }
        return this.localStream;
      } catch (err) {
        console.error('[WebRTC] Failed to enable camera:', err);
        throw new Error('Não foi possível acessar a câmera. Verifique as permissões.');
      }
    }
  }

  public setChannel(channelId: string, localUserId: string) {
    this.currentChannelId = channelId;
    this.localUserId = localUserId;
    this.startStatsMonitor();
    this.emitConnectionSnapshot({ status: 'connecting', quality: 'unknown' });
  }

  public syncPeerMediaStates(peers: VoiceState[]): void {
    const activePeerIds = new Set<string>();
    for (const peer of peers) {
      if (!peer.userId || peer.userId === this.localUserId) continue;
      activePeerIds.add(peer.userId);
      this.updatePeerMediaState(peer);
    }
    for (const peerId of this.peerMediaExpectations.keys()) {
      if (!activePeerIds.has(peerId)) this.peerMediaExpectations.delete(peerId);
    }
  }

  public updatePeerMediaState(peer: VoiceState): void {
    if (!peer.userId || peer.userId === this.localUserId) return;
    const previous = this.peerMediaExpectations.get(peer.userId);
    this.peerMediaExpectations.set(peer.userId, {
      expectsVideo: Boolean(peer.selfVideo || peer.selfScreen),
      expectsScreen: Boolean(peer.selfScreen),
      speakingUntil: peer.isSpeaking ? Date.now() + 6_000 : previous?.speakingUntil ?? 0,
    });
  }

  /**
   * A pair must have one stable offerer. Keeping this decision deterministic
   * prevents both browsers from restarting ICE at once after a short network
   * interruption, which otherwise causes SDP glare and black remote media.
   */
  private shouldInitiateFor(peerId: string): boolean {
    return Boolean(this.localUserId && shouldInitiateRtcConnection(this.localUserId, peerId));
  }

  private createConnectionId(): string {
    return globalThis.crypto?.randomUUID?.()
      ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  public async retryAllConnections(): Promise<void> {
    this.emitConnectionSnapshot({ status: 'reconnecting', quality: 'unknown' });
    const tasks = [...this.expectedPeerIds].map(async (peerId) => {
      // The answering peer waits for the deterministic offerer. Starting an
      // ICE restart from both ends is a frequent source of unstable calls.
      if (!this.shouldInitiateFor(peerId)) return;
      const pc = this.peerConnections.get(peerId);
      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        this.removePeer(peerId, false);
        await this.createPeerConnection(peerId, true);
        return;
      }
      pc.restartIce();
      await this.requestNegotiation(peerId, true);
    });
    await Promise.allSettled(tasks);
  }

  public async connectToPeers(
    peerUserIds: string[],
    initialOffererPeerIds?: ReadonlySet<string>,
  ) {
    if (!this.localUserId) return;
    for (const peerId of [...new Set(peerUserIds)].sort()) {
      if (!peerId || peerId === this.localUserId) continue;
      this.expectedPeerIds.add(peerId);
      const existing = this.peerConnections.get(peerId);
      if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') continue;

      const shouldCreateOffer = initialOffererPeerIds
        ? initialOffererPeerIds.has(peerId)
        : this.shouldInitiateFor(peerId);
      if (shouldCreateOffer) {
        await this.createPeerConnection(peerId, true);
      }
    }
    this.emitConnectionSnapshot();
  }

  public async syncPeers(peers: VoiceState[]) {
    const localState = peers.find((peer) => peer.userId === this.localUserId);
    const remotePeers = peers.filter((peer) => Boolean(peer.userId) && peer.userId !== this.localUserId);
    const expected = new Set(remotePeers.map((peer) => peer.userId));
    const initialOffererPeerIds = new Set(
      remotePeers
        .filter((peer) => Boolean(
          this.localUserId
          && shouldInitiateRtcConnectionForJoin(
            this.localUserId,
            localState?.joinedAt,
            peer.userId,
            peer.joinedAt,
          )
        ))
        .map((peer) => peer.userId),
    );
    this.expectedPeerIds = expected;
    for (const peerId of this.peerConnections.keys()) {
      if (!expected.has(peerId)) this.removePeer(peerId, true);
    }
    await this.connectToPeers([...expected], initialOffererPeerIds);
    this.emitConnectionSnapshot();
  }

  /**
   * Handle incoming WebRTC signaling message with Perfect Negotiation
   */
  public async handleSignal(payload: RTCSignalPayload) {
    const peerId = payload.fromUserId;
    if (!peerId) return;

    const previous = this.signalQueues.get(peerId) ?? Promise.resolve();
    const queued = previous
      .catch(() => undefined)
      .then(() => this.processSignal(payload));
    this.signalQueues.set(peerId, queued);
    try {
      await queued;
    } finally {
      if (this.signalQueues.get(peerId) === queued) this.signalQueues.delete(peerId);
    }
  }

  private async processSignal(payload: RTCSignalPayload) {
    const { fromUserId, signal, channelId, connectionId } = payload;
    if (!fromUserId || (this.currentChannelId && channelId !== this.currentChannelId)) return;

    // A valid signal can arrive a few milliseconds before the Presence sync.
    // Remember the peer so a transient ICE failure is allowed to reconnect.
    this.expectedPeerIds.add(fromUserId);

    let pc = this.peerConnections.get(fromUserId);

    try {
      if (signal.type === 'ice-candidate') {
        if (!signal.candidate) return;
        if (this.ignoredOfferPeers.has(fromUserId)) return;
        const activeConnectionId = this.peerConnectionIds.get(fromUserId);
        const candidateKey = `${connectionId ?? 'legacy'}:${signal.candidate.usernameFragment ?? ''}:${signal.candidate.sdpMid ?? ''}:${signal.candidate.sdpMLineIndex ?? ''}:${signal.candidate.candidate}`;
        const receivedKeys = this.receivedIceCandidateKeys.get(fromUserId) ?? new Set<string>();
        if (receivedKeys.has(candidateKey)) return;
        receivedKeys.add(candidateKey);
        if (receivedKeys.size > 128) {
          const oldestKey = receivedKeys.values().next().value;
          if (oldestKey) receivedKeys.delete(oldestKey);
        }
        this.receivedIceCandidateKeys.set(fromUserId, receivedKeys);
        if (!pc || !pc.remoteDescription || Boolean(connectionId && activeConnectionId !== connectionId)) {
          const queued = this.pendingIceCandidates.get(fromUserId) ?? [];
          queued.push({ connectionId, candidate: signal.candidate });
          if (queued.length > 64) queued.splice(0, queued.length - 64);
          this.pendingIceCandidates.set(fromUserId, queued);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        return;
      }

      if (signal.type === 'offer' && signal.sdp) {
        const activeConnectionId = this.peerConnectionIds.get(fromUserId);
        if (pc && connectionId && activeConnectionId && activeConnectionId !== connectionId) {
          // A peer that rejoined owns a new signaling generation. Reusing the
          // previous DTLS/ICE transport can leave its existing media black or
          // silent, so replace it while preserving candidates for this offer.
          const incomingCandidates = (this.pendingIceCandidates.get(fromUserId) ?? [])
            .filter((candidate) => matchesRtcConnection(connectionId, candidate.connectionId));
          this.removePeer(fromUserId, false);
          if (incomingCandidates.length > 0) {
            this.pendingIceCandidates.set(fromUserId, incomingCandidates);
          }
          pc = undefined;
        }
        if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
          this.removePeer(fromUserId, false);
          pc = undefined;
        }
        if (!pc) {
          pc = await this.createPeerConnection(fromUserId, false);
        }

        if (connectionId) {
          const previousConnectionId = this.peerConnectionIds.get(fromUserId);
          if (previousConnectionId !== connectionId) {
            this.peerConnectionIds.set(fromUserId, connectionId);
            this.receivedIceCandidateKeys.delete(fromUserId);
          }
        }

        const isPolite = Boolean(this.localUserId && this.localUserId.localeCompare(fromUserId) > 0);
        const isMakingOffer = this.isMakingOffer.get(fromUserId) ?? false;
        const offerCollision = isMakingOffer || pc.signalingState !== 'stable';

        if (offerCollision && !isPolite) {
          console.log('[WebRTC] Impolite peer ignoring offer collision from:', fromUserId);
          this.ignoredOfferPeers.add(fromUserId);
          return;
        }

        this.ignoredOfferPeers.delete(fromUserId);

        if (offerCollision && isPolite) {
          console.log('[WebRTC] Polite peer yielding to offer collision from:', fromUserId);
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch {
            // Rollback fallback
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
        await this.flushPendingIceCandidates(fromUserId, pc);

        // Sync local tracks onto this connection
        await this.syncTracksToPC(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await wsClient.sendRtcSignal({
          targetUserId: fromUserId,
          channelId: this.currentChannelId ?? '',
          connectionId: this.peerConnectionIds.get(fromUserId),
          signal: {
            type: 'answer',
            sdp: answer.sdp,
          },
        });
        await this.drainNegotiation(fromUserId);
      } else if (signal.type === 'answer' && pc && signal.sdp) {
        const activeConnectionId = this.peerConnectionIds.get(fromUserId);
        if (!matchesRtcConnection(activeConnectionId, connectionId)) {
          console.warn('[WebRTC] Ignoring stale answer from previous connection:', fromUserId);
          return;
        }
        this.ignoredOfferPeers.delete(fromUserId);
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
          await this.flushPendingIceCandidates(fromUserId, pc);
          await this.drainNegotiation(fromUserId);
        }
      }
    } catch (error) {
      console.warn('[WebRTC] Error handling WebRTC signal:', signal.type, error);
    }
  }

  public removePeer(userId: string, forget = true) {
    if (forget) this.expectedPeerIds.delete(userId);
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.getSenders().forEach((sender) => this.senderQualityTiers.delete(sender));
      pc.close();
      this.peerConnections.delete(userId);
    }
    const timer = this.disconnectTimers.get(userId);
    if (timer) clearTimeout(timer);
    this.disconnectTimers.delete(userId);
    const connectionTimeout = this.connectionTimeouts.get(userId);
    if (connectionTimeout) clearTimeout(connectionTimeout);
    this.connectionTimeouts.delete(userId);
    const reconnectTimer = this.reconnectTimers.get(userId);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    this.reconnectTimers.delete(userId);
    if (forget) this.reconnectAttempts.delete(userId);
    this.pendingIceCandidates.delete(userId);
    this.receivedIceCandidateKeys.delete(userId);
    this.peerConnectionIds.delete(userId);
    this.isMakingOffer.delete(userId);
    this.signalQueues.delete(userId);
    this.ignoredOfferPeers.delete(userId);
    this.negotiationPending.delete(userId);
    this.iceRestartPending.delete(userId);
    const negotiationRetryTimer = this.negotiationRetryTimers.get(userId);
    if (negotiationRetryTimer) clearTimeout(negotiationRetryTimer);
    this.negotiationRetryTimers.delete(userId);
    this.negotiationRetryAttempts.delete(userId);
    this.peerStats.delete(userId);
    if (forget) this.peerMediaExpectations.delete(userId);
    this.remotePeerTracks.delete(userId);
    this.remoteStreams.delete(userId);
    this.notifyRemoteStreamsChanged();
    this.emitConnectionSnapshot();
  }

  public leaveAll() {
    this.stopLocalMedia();
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      this.screenStream = null;
    }

    for (const [, pc] of this.peerConnections.entries()) {
      pc.close();
    }
    this.peerConnections.clear();

    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    for (const timer of this.connectionTimeouts.values()) clearTimeout(timer);
    this.connectionTimeouts.clear();
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    this.reconnectTimers.clear();
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
    this.statsCollectionRunning = false;

    this.remotePeerTracks.clear();
    this.remoteStreams.clear();
    this.pendingIceCandidates.clear();
    this.receivedIceCandidateKeys.clear();
    this.peerConnectionIds.clear();
    this.isMakingOffer.clear();
    this.signalQueues.clear();
    this.ignoredOfferPeers.clear();
    this.negotiationPending.clear();
    this.iceRestartPending.clear();
    for (const timer of this.negotiationRetryTimers.values()) clearTimeout(timer);
    this.negotiationRetryTimers.clear();
    this.negotiationRetryAttempts.clear();
    this.expectedPeerIds.clear();
    this.reconnectAttempts.clear();
    this.peerMediaExpectations.clear();
    this.peerStats.clear();
    this.senderQualityTiers.clear();
    this.currentChannelId = null;
    this.localUserId = null;
    this.notifyRemoteStreamsChanged();
    this.emitConnectionSnapshot({ status: 'connecting', quality: 'unknown' });
  }

  private ensureTransceivers(pc: RTCPeerConnection) {
    const current = pc.getTransceivers();
    if (current.length === 0) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }
  }

  private async createPeerConnection(targetUserId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    const existing = this.peerConnections.get(targetUserId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') return existing;
    if (existing) this.removePeer(targetUserId, false);

    const scheduledReconnect = this.reconnectTimers.get(targetUserId);
    if (scheduledReconnect) clearTimeout(scheduledReconnect);
    this.reconnectTimers.delete(targetUserId);

    const pc = new RTCPeerConnection(await createRtcConfiguration());
    this.peerConnections.set(targetUserId, pc);
    this.peerConnectionIds.set(targetUserId, this.createConnectionId());
    this.isMakingOffer.set(targetUserId, false);

    this.ensureTransceivers(pc);
    await this.syncTracksToPC(pc);

    // ICE Candidate event
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void wsClient.sendRtcSignal({
          targetUserId,
          channelId: this.currentChannelId ?? '',
          connectionId: this.peerConnectionIds.get(targetUserId),
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate.toJSON(),
          },
        }).catch((error) => {
          console.warn('[WebRTC] Failed to deliver ICE candidate:', targetUserId, error);
        });
      }
    };
    pc.onicecandidateerror = (event) => {
      // Host lookup failures on one STUN server are harmless when another ICE
      // server succeeds, but keeping the event visible helps diagnose TURN.
      console.warn('[WebRTC] ICE candidate error:', event.url, event.errorCode, event.errorText);
    };

    // Remote Track event with Immutable MediaStream generation
    pc.ontrack = (event) => {
      let peerTracks = this.remotePeerTracks.get(targetUserId);
      if (!peerTracks) {
        peerTracks = new Map<string, MediaStreamTrack>();
        this.remotePeerTracks.set(targetUserId, peerTracks);
      }

      peerTracks.set(event.track.id, event.track);

      const rebuildFreshStream = () => {
        const currentTracks = this.remotePeerTracks.get(targetUserId);
        if (!currentTracks) return;

        const liveTracks = [...currentTracks.values()].filter((t) => t.readyState === 'live');
        const freshStream = new MediaStream(liveTracks);
        this.remoteStreams.set(targetUserId, freshStream);
        this.notifyRemoteStreamsChanged();
      };

      event.track.onended = () => {
        const tracks = this.remotePeerTracks.get(targetUserId);
        if (tracks) {
          tracks.delete(event.track.id);
          rebuildFreshStream();
        }
      };

      event.track.onmute = () => rebuildFreshStream();
      event.track.onunmute = () => rebuildFreshStream();

      rebuildFreshStream();
    };

    // Offers requested while another offer/answer exchange is underway are
    // drained as soon as signaling becomes stable instead of being discarded.
    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable') {
        this.ignoredOfferPeers.delete(targetUserId);
        void this.drainNegotiation(targetUserId);
      }
    };

    // Connection state handler
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        const timer = this.disconnectTimers.get(targetUserId);
        if (timer) clearTimeout(timer);
        this.disconnectTimers.delete(targetUserId);
        const timeout = this.connectionTimeouts.get(targetUserId);
        if (timeout) clearTimeout(timeout);
        this.connectionTimeouts.delete(targetUserId);
        this.reconnectAttempts.delete(targetUserId);
        this.peerStats.set(targetUserId, {
          audioBytes: 0,
          videoBytes: 0,
          audioProgressAt: Date.now(),
          videoProgressAt: Date.now(),
          stalledChecks: 0,
          lastRecoveryAt: 0,
          recoveryAttempts: 0,
        });
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.schedulePeerRecovery(targetUserId, pc, pc.connectionState === 'failed' ? 0 : 4_000);
      }
      this.emitConnectionSnapshot();
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        this.schedulePeerRecovery(targetUserId, pc, 0);
      }
      this.emitConnectionSnapshot();
    };

    const connectionTimeout = setTimeout(() => {
      if (this.peerConnections.get(targetUserId) === pc && pc.connectionState !== 'connected') {
        this.schedulePeerRecovery(targetUserId, pc, 0);
      }
    }, 20_000);
    this.connectionTimeouts.set(targetUserId, connectionTimeout);

    if (isInitiator) {
      await this.requestNegotiation(targetUserId);
    }

    return pc;
  }

  /**
   * Attaches or replaces active local audio/video/screen tracks on a PeerConnection
   */
  private async syncTracksToPC(pc: RTCPeerConnection) {
    if (pc.connectionState === 'closed') return;

    this.ensureTransceivers(pc);

    const micTrack = this.localStream?.getAudioTracks()[0] ?? null;
    const screenAudioTrack = this.screenStream?.getAudioTracks()[0] ?? null;
    const activeVideoTrack = this.screenStream?.getVideoTracks()[0] ?? this.localStream?.getVideoTracks()[0] ?? null;
    const isScreen = Boolean(this.screenStream?.getVideoTracks()[0]);

    const transceivers = pc.getTransceivers();
    const audioTransceivers = transceivers.filter((t) => t.receiver.track.kind === 'audio');
    const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video');

    if (audioTransceivers[0]) {
      if (audioTransceivers[0].sender.track !== micTrack) {
        await audioTransceivers[0].sender.replaceTrack(micTrack);
      }
      audioTransceivers[0].direction = 'sendrecv';
    }

    if (audioTransceivers[1]) {
      if (audioTransceivers[1].sender.track !== screenAudioTrack) {
        await audioTransceivers[1].sender.replaceTrack(screenAudioTrack);
      }
      audioTransceivers[1].direction = 'sendrecv';
    }

    if (videoTransceiver) {
      if (videoTransceiver.sender.track !== activeVideoTrack) {
        await videoTransceiver.sender.replaceTrack(activeVideoTrack);
        this.senderQualityTiers.delete(videoTransceiver.sender);
      }
      videoTransceiver.direction = 'sendrecv';
      if (activeVideoTrack) {
        await this.tuneVideoSender(videoTransceiver.sender, isScreen, 'good');
      }
    }
  }

  private async tuneVideoSender(
    sender: RTCRtpSender,
    isScreen: boolean,
    quality: CallConnectionQuality,
  ): Promise<void> {
    const tierKey = `${isScreen ? 'screen' : 'camera'}:${quality}`;
    if (this.senderQualityTiers.get(sender) === tierKey) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      const constrained = quality === 'poor';
      const sourceFps = Math.max(15, Math.round(sender.track?.getSettings().frameRate ?? 30));
      if (isScreen) {
        params.encodings[0].maxBitrate = constrained ? 1_200_000 : 3_000_000;
        params.encodings[0].maxFramerate = constrained ? Math.min(20, sourceFps) : Math.min(60, sourceFps);
        params.encodings[0].scaleResolutionDownBy = constrained ? 1.5 : 1;
        params.encodings[0].networkPriority = 'high';
        params.degradationPreference = 'maintain-resolution';
      } else {
        params.encodings[0].maxBitrate = constrained ? 550_000 : 1_500_000;
        params.encodings[0].maxFramerate = constrained ? Math.min(20, sourceFps) : Math.min(30, sourceFps);
        params.encodings[0].scaleResolutionDownBy = constrained ? 2 : 1;
        params.encodings[0].networkPriority = 'medium';
        params.degradationPreference = 'balanced';
      }
      await sender.setParameters(params);
      this.senderQualityTiers.set(sender, tierKey);
    } catch (error) {
      console.warn('[WebRTC] Could not apply adaptive video parameters:', error);
    }
  }

  /**
   * Renegotiates with all connected peers so new media tracks are transmitted immediately
   */
  private async renegotiateAllPeers() {
    for (const [targetUserId, pc] of this.peerConnections) {
      if (pc.connectionState === 'closed') continue;
      await this.syncTracksToPC(pc);
      await this.requestNegotiation(targetUserId);
    }
  }

  private async requestNegotiation(targetUserId: string, iceRestart = false): Promise<void> {
    this.negotiationPending.add(targetUserId);
    if (iceRestart) this.iceRestartPending.add(targetUserId);
    await this.drainNegotiation(targetUserId);
  }

  private async drainNegotiation(targetUserId: string): Promise<void> {
    const pc = this.peerConnections.get(targetUserId);
    if (!pc || pc.connectionState === 'closed' || !this.negotiationPending.has(targetUserId)) return;
    if ((this.isMakingOffer.get(targetUserId) ?? false) || pc.signalingState !== 'stable') return;

    const restartIce = this.iceRestartPending.has(targetUserId);
    this.negotiationPending.delete(targetUserId);
    if (restartIce) this.iceRestartPending.delete(targetUserId);
    this.isMakingOffer.set(targetUserId, true);

    try {
      const offer = await pc.createOffer(restartIce ? { iceRestart: true } : undefined);
      if (this.peerConnections.get(targetUserId) !== pc || pc.signalingState !== 'stable') {
        this.negotiationPending.add(targetUserId);
        if (restartIce) this.iceRestartPending.add(targetUserId);
        this.scheduleNegotiationRetry(targetUserId);
        return;
      }
      await pc.setLocalDescription(offer);

      await wsClient.sendRtcSignal({
        targetUserId,
        channelId: this.currentChannelId ?? '',
        connectionId: this.peerConnectionIds.get(targetUserId),
        signal: {
          type: 'offer',
          sdp: pc.localDescription?.sdp ?? offer.sdp,
        },
      });
      this.negotiationRetryAttempts.delete(targetUserId);
      const retryTimer = this.negotiationRetryTimers.get(targetUserId);
      if (retryTimer) clearTimeout(retryTimer);
      this.negotiationRetryTimers.delete(targetUserId);
    } catch (error) {
      if (this.peerConnections.get(targetUserId) === pc) {
        this.negotiationPending.add(targetUserId);
        if (restartIce) this.iceRestartPending.add(targetUserId);
        console.warn('[WebRTC] Failed to negotiate with peer:', targetUserId, error);
        this.scheduleNegotiationRetry(targetUserId);
      }
    } finally {
      this.isMakingOffer.set(targetUserId, false);
    }
  }

  private scheduleNegotiationRetry(targetUserId: string): void {
    if (this.negotiationRetryTimers.has(targetUserId) || !this.expectedPeerIds.has(targetUserId)) return;
    const attempt = Math.min((this.negotiationRetryAttempts.get(targetUserId) ?? 0) + 1, 6);
    this.negotiationRetryAttempts.set(targetUserId, attempt);
    const delay = getRtcNegotiationRetryDelay(attempt);
    this.negotiationRetryTimers.set(targetUserId, setTimeout(() => {
      this.negotiationRetryTimers.delete(targetUserId);
      void this.drainNegotiation(targetUserId);
    }, delay));
  }

  private schedulePeerRecovery(
    targetUserId: string,
    pc: RTCPeerConnection,
    delayMs: number,
  ): void {
    if (!this.expectedPeerIds.has(targetUserId) || this.peerConnections.get(targetUserId) !== pc) return;

    const previous = this.disconnectTimers.get(targetUserId);
    if (previous) clearTimeout(previous);

    this.disconnectTimers.set(targetUserId, setTimeout(() => {
      this.disconnectTimers.delete(targetUserId);
      if (!this.expectedPeerIds.has(targetUserId) || this.peerConnections.get(targetUserId) !== pc) return;
      if (pc.connectionState === 'connected' || pc.connectionState === 'closed') return;

      const attempt = (this.reconnectAttempts.get(targetUserId) ?? 0) + 1;
      this.reconnectAttempts.set(targetUserId, attempt);
      this.emitConnectionSnapshot({ status: attempt >= 4 ? 'failed' : 'reconnecting' });

      // Only the elected offerer is allowed to start recovery negotiation.
      // The other peer keeps its transceivers and waits for that offer, which
      // avoids simultaneous ICE restarts on every transient disconnect.
      if (!this.shouldInitiateFor(targetUserId)) return;

      // First try the inexpensive path, retaining existing media/transceivers.
      if (attempt === 1 && pc.signalingState === 'stable') {
        pc.restartIce();
        void this.requestNegotiation(targetUserId, true);
        this.schedulePeerRecovery(targetUserId, pc, 6_000);
        return;
      }

      // If an ICE restart did not recover media, rebuild the whole peer. Both
      // sides use slightly different delays; Perfect Negotiation resolves glare.
      this.removePeer(targetUserId, false);
      this.scheduleReconnect(targetUserId);
    }, delayMs));
  }

  private scheduleReconnect(targetUserId: string): void {
    if (
      !this.expectedPeerIds.has(targetUserId)
      || !this.localUserId
      || !this.shouldInitiateFor(targetUserId)
    ) return;

    const previous = this.reconnectTimers.get(targetUserId);
    if (previous) clearTimeout(previous);
    const attempt = this.reconnectAttempts.get(targetUserId) ?? 1;
    const preferredDelay = this.localUserId.localeCompare(targetUserId) < 0 ? 500 : 1_500;
    const delay = Math.min(preferredDelay * Math.max(1, attempt), 10_000);

    this.reconnectTimers.set(targetUserId, setTimeout(() => {
      this.reconnectTimers.delete(targetUserId);
      if (!this.expectedPeerIds.has(targetUserId) || this.peerConnections.has(targetUserId)) return;
      void this.createPeerConnection(targetUserId, true).catch((error) => {
        console.warn('[WebRTC] Failed to recreate peer connection:', targetUserId, error);
        this.reconnectAttempts.set(targetUserId, (this.reconnectAttempts.get(targetUserId) ?? 0) + 1);
        this.scheduleReconnect(targetUserId);
      });
    }, delay));
  }

  private startStatsMonitor(): void {
    if (this.statsTimer) return;
    this.statsTimer = setInterval(() => void this.collectConnectionStats(), 3_000);
    void this.collectConnectionStats();
  }

  private async collectConnectionStats(): Promise<void> {
    if (this.statsCollectionRunning) return;
    this.statsCollectionRunning = true;

    try {
      const now = Date.now();
      const roundTripTimes: number[] = [];
      let totalPacketsReceived = 0;
      let totalPacketsLost = 0;
      let usingTurn = false;

      for (const [peerId, pc] of this.peerConnections) {
        if (pc.connectionState !== 'connected') continue;

        try {
          const report = await pc.getStats();
          let audioBytes = 0;
          let videoBytes = 0;
          let peerPacketsReceived = 0;
          let peerPacketsLost = 0;
          let selectedPair: any = null;

          report.forEach((stat: any) => {
            if (stat.type === 'inbound-rtp' && !stat.isRemote) {
              const kind = stat.kind ?? stat.mediaType;
              if (kind === 'audio') audioBytes += Number(stat.bytesReceived ?? 0);
              if (kind === 'video') videoBytes += Number(stat.bytesReceived ?? 0);
              peerPacketsReceived += Number(stat.packetsReceived ?? 0);
              peerPacketsLost += Math.max(0, Number(stat.packetsLost ?? 0));
            }
            if (
              stat.type === 'candidate-pair' &&
              stat.state === 'succeeded' &&
              (stat.selected || stat.nominated)
            ) {
              selectedPair = stat;
            }
          });

          if (selectedPair) {
            const rttSeconds = Number(selectedPair.currentRoundTripTime ?? 0);
            if (rttSeconds > 0) roundTripTimes.push(rttSeconds * 1_000);
            const remoteCandidate = report.get(selectedPair.remoteCandidateId) as any;
            if (remoteCandidate?.candidateType === 'relay') usingTurn = true;
          }

          totalPacketsReceived += peerPacketsReceived;
          totalPacketsLost += peerPacketsLost;
          const peerLoss = peerPacketsLost / Math.max(1, peerPacketsReceived + peerPacketsLost);
          const peerRtt = selectedPair ? Number(selectedPair.currentRoundTripTime ?? 0) * 1_000 : 0;
          const peerQuality: CallConnectionQuality = peerLoss > 0.1 || peerRtt > 700
            ? 'poor'
            : peerLoss > 0.04 || peerRtt > 300
              ? 'good'
              : 'excellent';
          const isScreen = Boolean(this.screenStream?.getVideoTracks()[0]);
          for (const sender of pc.getSenders()) {
            if (sender.track?.kind === 'video') {
              await this.tuneVideoSender(sender, isScreen, peerQuality === 'poor' ? 'poor' : 'good');
            }
          }

          const previous = this.peerStats.get(peerId) ?? {
            audioBytes,
            videoBytes,
            audioProgressAt: now,
            videoProgressAt: now,
            stalledChecks: 0,
            lastRecoveryAt: 0,
            recoveryAttempts: 0,
          };
          const audioProgressed = audioBytes > previous.audioBytes;
          const videoProgressed = videoBytes > previous.videoBytes;
          if (audioProgressed) previous.audioProgressAt = now;
          if (videoProgressed) previous.videoProgressAt = now;
          previous.audioBytes = audioBytes;
          previous.videoBytes = videoBytes;

          const expectation = this.peerMediaExpectations.get(peerId);
          const stalledAudio = Boolean(
            expectation && expectation.speakingUntil > now && now - previous.audioProgressAt > 6_000,
          );
          const stalledVideo = Boolean(
            expectation?.expectsVideo && now - previous.videoProgressAt > (expectation.expectsScreen ? 8_000 : 12_000),
          );
          if (stalledAudio || stalledVideo) {
            previous.stalledChecks += 1;
          } else {
            previous.stalledChecks = 0;
            if (audioProgressed || videoProgressed) previous.recoveryAttempts = 0;
          }
          this.peerStats.set(peerId, previous);

          if (
            previous.stalledChecks >= 2 &&
            now - previous.lastRecoveryAt > 12_000
          ) {
            previous.lastRecoveryAt = now;
            previous.stalledChecks = 0;
            previous.recoveryAttempts += 1;
            void this.recoverStalledMedia(peerId, pc, previous.recoveryAttempts);
          }
        } catch (error) {
          console.warn('[WebRTC] Could not collect peer statistics:', peerId, error);
        }
      }

      const averageRtt = roundTripTimes.length
        ? roundTripTimes.reduce((sum, value) => sum + value, 0) / roundTripTimes.length
        : undefined;
      const packetLoss = totalPacketsLost / Math.max(1, totalPacketsReceived + totalPacketsLost);
      const quality: CallConnectionQuality = totalPacketsReceived === 0
        ? 'unknown'
        : packetLoss > 0.1 || (averageRtt ?? 0) > 700
          ? 'poor'
          : packetLoss > 0.04 || (averageRtt ?? 0) > 300
            ? 'good'
            : 'excellent';

      this.emitConnectionSnapshot({
        quality,
        usingTurn,
        roundTripTimeMs: averageRtt ? Math.round(averageRtt) : undefined,
        packetLossPercent: totalPacketsReceived > 0 ? Math.round(packetLoss * 1_000) / 10 : undefined,
      });
    } finally {
      this.statsCollectionRunning = false;
    }
  }

  private async recoverStalledMedia(
    peerId: string,
    pc: RTCPeerConnection,
    recoveryAttempt: number,
  ): Promise<void> {
    if (this.peerConnections.get(peerId) !== pc || !this.expectedPeerIds.has(peerId)) return;
    this.emitConnectionSnapshot({ status: 'reconnecting', quality: 'poor' });

    // Media watchdogs run on both browsers. Let a single side repair the
    // peer connection so two simultaneous recovery offers cannot collide.
    if (!this.shouldInitiateFor(peerId)) return;

    if (recoveryAttempt === 1 && pc.connectionState === 'connected') {
      pc.restartIce();
      await this.requestNegotiation(peerId, true);
      return;
    }

    this.removePeer(peerId, false);
    this.scheduleReconnect(peerId);
  }

  private emitConnectionSnapshot(overrides: Partial<CallConnectionSnapshot> = {}): void {
    const peerCount = this.expectedPeerIds.size;
    const connectedPeers = [...this.expectedPeerIds]
      .filter((peerId) => this.peerConnections.get(peerId)?.connectionState === 'connected')
      .length;
    const maximumAttempts = Math.max(0, ...this.reconnectAttempts.values());
    const quality = overrides.quality ?? this.lastConnectionSnapshot.quality;
    const derivedStatus: CallConnectionStatus = peerCount === 0 || connectedPeers === peerCount
      ? (quality === 'poor' ? 'poor' : 'connected')
      : maximumAttempts >= 4
        ? 'failed'
        : connectedPeers > 0 || maximumAttempts > 0
          ? 'reconnecting'
          : 'connecting';
    const status = overrides.status ?? (quality === 'poor' && derivedStatus === 'connected' ? 'poor' : derivedStatus);

    const next: CallConnectionSnapshot = {
      ...this.lastConnectionSnapshot,
      ...overrides,
      status,
      quality,
      peerCount,
      connectedPeers,
    };
    if (JSON.stringify(next) === JSON.stringify(this.lastConnectionSnapshot)) return;
    this.lastConnectionSnapshot = next;
    this.onConnectionSnapshotChanged?.(next);
  }

  private async flushPendingIceCandidates(userId: string, pc: RTCPeerConnection) {
    const queued = this.pendingIceCandidates.get(userId) ?? [];
    this.pendingIceCandidates.delete(userId);
    const activeConnectionId = this.peerConnectionIds.get(userId);
    for (const pending of queued) {
      if (!matchesRtcConnection(activeConnectionId, pending.connectionId)) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(pending.candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to add ICE candidate:', e);
      }
    }
  }

  private stopLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
  }

  private notifyRemoteStreamsChanged() {
    if (this.onRemoteStreamsChanged) {
      this.onRemoteStreamsChanged(new Map(this.remoteStreams));
    }
  }

  private createMediaError(error: unknown, fallback: string): Error {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        return new Error(`${fallback} Autorize a permissão nas configurações do navegador ou aplicativo.`);
      }
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return new Error(`${fallback} Nenhum dispositivo compatível foi encontrado.`);
      }
      if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        return new Error(`${fallback} O dispositivo pode estar sendo usado por outro aplicativo.`);
      }
      if (error.name === 'OverconstrainedError') {
        return new Error(`${fallback} A resolução ou taxa de quadros solicitada não é suportada.`);
      }
    }
    return new Error(fallback);
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getScreenStream(): MediaStream | null {
    return this.screenStream;
  }
}

export const rtcManager = new WebRTCManager();
