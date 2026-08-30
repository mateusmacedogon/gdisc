/**
 * GDisC WebRTC Realtime Mesh Engine
 * Ultra-stable Peer-to-Peer engine with Perfect Negotiation, automatic ICE restart,
 * optimized screen sharing bitrate, and dynamic stream synchronization.
 */

import { wsClient } from './ws.js';
import { WSEvents, type RTCSignalPayload } from '@gdisc/shared';
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

const configuredTurnServer: RTCIceServer[] = turnUrls.length > 0 && turnUsername && turnCredential
  ? [{ urls: turnUrls, username: turnUsername, credential: turnCredential }]
  : [];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    ...configuredTurnServer,
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export interface ScreenShareOptions {
  sourceId?: string;
  resolution?: '720p' | '1080p' | 'original';
  fps?: 15 | 30 | 60;
  withAudio?: boolean;
}

export interface RemotePeerStream {
  userId: string;
  stream: MediaStream;
  hasAudio: boolean;
  hasVideo: boolean;
}

type RemoteStreamCallback = (peerStreams: Map<string, MediaStream>) => void;

class WebRTCManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private isMakingOffer: Map<string, boolean> = new Map();
  private currentChannelId: string | null = null;
  private localUserId: string | null = null;
  private onRemoteStreamsChanged: RemoteStreamCallback | null = null;
  private onScreenShareEnded: (() => void) | null = null;

  public setRemoteStreamCallback(cb: RemoteStreamCallback) {
    this.onRemoteStreamsChanged = cb;
  }

  public setScreenShareEndedCallback(cb: (() => void) | null) {
    this.onScreenShareEnded = cb;
  }

  /**
   * Initializes local user media (Microphone and optional Camera)
   */
  public async initLocalMedia(
    audio = true,
    video = false,
    audioDeviceId?: string,
    videoDeviceId?: string
  ): Promise<MediaStream> {
    if (!platformCapabilities.camera) {
      throw new Error('Este dispositivo não oferece acesso a microfone ou câmera neste aplicativo.');
    }

    const constraints: MediaStreamConstraints = {
      audio: audio
        ? {
            echoCancellation: true,
            noiseSuppression: true,
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
      console.warn('getUserMedia failed with requested constraints, falling back to default:', err);
      if (!audio) throw this.createMediaError(err, 'Não foi possível acessar a câmera.');
      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch (fallbackErr) {
        console.error('Failed to get user media:', fallbackErr);
        throw this.createMediaError(fallbackErr, 'Não foi possível acessar o microfone.');
      }
    }

    const previousStream = this.localStream;
    this.localStream = nextStream;
    previousStream?.getTracks().forEach((track) => track.stop());
    await this.updatePeerTracks(video);
    return nextStream;
  }

  public async switchAudioInput(deviceId?: string): Promise<MediaStream> {
    if (!platformCapabilities.camera) {
      throw new Error('A seleção de microfone não é suportada neste dispositivo.');
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
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
    if (!this.localStream) this.localStream = new MediaStream();
    this.localStream.getAudioTracks().forEach((track) => {
      track.stop();
      this.localStream?.removeTrack(track);
    });
    this.localStream.addTrack(nextAudioTrack);
    await this.updatePeerTracks(false);
    return this.localStream;
  }

  /**
   * Starts screen capture via desktop source or getDisplayMedia
   */
  public async startScreenShare(options?: ScreenShareOptions): Promise<MediaStream | null> {
    if (!platformCapabilities.screenShare) {
      throw new Error('O compartilhamento de tela não é suportado neste dispositivo. Use o site ou o aplicativo para Windows.');
    }
    try {
      const fps = options?.fps ?? 30;
      let width = 1920;
      let height = 1080;

      if (options?.resolution === '720p') {
        width = 1280;
        height = 720;
      } else if (options?.resolution === 'original') {
        width = 3840;
        height = 2160;
      }

      this.screenStream = null;

      // In Electron desktop environment with a specific selected window or screen
      if (options?.sourceId) {
        try {
          const stream = await (navigator.mediaDevices as any).getUserMedia({
            audio: options.withAudio
              ? {
                  mandatory: {
                    chromeMediaSource: 'desktop',
                  },
                }
              : false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: options.sourceId,
                maxWidth: width,
                maxHeight: height,
                maxFrameRate: fps,
              },
            },
          });
          this.screenStream = stream;
        } catch (desktopErr) {
          console.warn('getUserMedia desktop source failed, falling back to getDisplayMedia:', desktopErr);
        }
      }

      if (!this.screenStream) {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: fps, max: fps },
          } as any,
          audio: Boolean(options?.withAudio),
        });
      }

      const videoTrack = this.screenStream.getVideoTracks()[0];
      if (videoTrack) {
        // Optimize text sharpness vs motion
        videoTrack.contentHint = fps >= 60 ? 'motion' : 'detail';
        videoTrack.onended = () => {
          void this.stopScreenShare().finally(() => this.onScreenShareEnded?.());
        };
      }

      await this.updatePeerTracks(true);
      return this.screenStream;
    } catch (err) {
      console.error('Error starting screen share:', err);
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
    await this.updatePeerTracks(true);
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
      await this.updatePeerTracks(true);
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
          if (!this.localStream) {
            this.localStream = new MediaStream();
          }
          this.localStream.getVideoTracks().forEach((track) => {
            track.stop();
            this.localStream!.removeTrack(track);
          });
          this.localStream.addTrack(newVideoTrack);
          await this.updatePeerTracks(true);
        }
        return this.localStream;
      } catch (err) {
        console.error('Failed to enable camera:', err);
        throw new Error('Não foi possível acessar a câmera. Verifique a permissão e o dispositivo selecionado.');
      }
    }
  }

  public setChannel(channelId: string, localUserId: string) {
    this.currentChannelId = channelId;
    this.localUserId = localUserId;
  }

  /**
   * Connect to existing peers in the voice room
   */
  public async connectToPeers(peerUserIds: string[]) {
    if (!this.localUserId) return;
    for (const peerId of [...new Set(peerUserIds)].sort()) {
      if (!peerId || peerId === this.localUserId || this.peerConnections.has(peerId)) continue;

      // Both clients receive presence sync. The polite/initiator peer starts negotiation.
      if (this.localUserId.localeCompare(peerId) < 0) {
        await this.createPeerConnection(peerId, true);
      }
    }
  }

  public async syncPeers(peerUserIds: string[]) {
    const expected = new Set(peerUserIds.filter(Boolean));
    for (const peerId of this.peerConnections.keys()) {
      if (!expected.has(peerId)) this.removePeer(peerId);
    }
    await this.connectToPeers([...expected]);
  }

  /**
   * Handle incoming WebRTC signaling message with Perfect Negotiation pattern
   */
  public async handleSignal(payload: RTCSignalPayload) {
    const { fromUserId, signal, channelId } = payload;
    if (!fromUserId || (this.currentChannelId && channelId !== this.currentChannelId)) return;

    let pc = this.peerConnections.get(fromUserId);

    try {
      if (signal.type === 'ice-candidate') {
        if (!signal.candidate) return;
        if (!pc || !pc.remoteDescription) {
          const queued = this.pendingIceCandidates.get(fromUserId) ?? [];
          queued.push(signal.candidate);
          this.pendingIceCandidates.set(fromUserId, queued);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        return;
      }

      if (signal.type === 'offer' && signal.sdp) {
        if (!pc) {
          pc = await this.createPeerConnection(fromUserId, false);
        }

        const isPolite = Boolean(this.localUserId && this.localUserId.localeCompare(fromUserId) > 0);
        const isMakingOffer = this.isMakingOffer.get(fromUserId) ?? false;
        const offerCollision = isMakingOffer || pc.signalingState !== 'stable';

        if (offerCollision && !isPolite) {
          console.log('[WebRTC] Impolite peer ignoring offer collision from:', fromUserId);
          return;
        }

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

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        wsClient.send(WSEvents.RTC_SIGNAL, {
          targetUserId: fromUserId,
          channelId: this.currentChannelId,
          signal: {
            type: 'answer',
            sdp: answer.sdp,
          },
        });
      } else if (signal.type === 'answer' && pc && signal.sdp) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
          await this.flushPendingIceCandidates(fromUserId, pc);
        }
      }
    } catch (error) {
      console.warn('[WebRTC] Falha ao processar sinal WebRTC:', signal.type, error);
    }
  }

  public removePeer(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
    const timer = this.disconnectTimers.get(userId);
    if (timer) clearTimeout(timer);
    this.disconnectTimers.delete(userId);
    this.pendingIceCandidates.delete(userId);
    this.isMakingOffer.delete(userId);
    this.remoteStreams.delete(userId);
    this.notifyRemoteStreamsChanged();
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
    this.remoteStreams.clear();
    this.pendingIceCandidates.clear();
    this.isMakingOffer.clear();
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    this.currentChannelId = null;
    this.localUserId = null;
    this.notifyRemoteStreamsChanged();
  }

  private async createPeerConnection(targetUserId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    const existing = this.peerConnections.get(targetUserId);
    if (existing && existing.connectionState !== 'closed') return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(targetUserId, pc);
    this.isMakingOffer.set(targetUserId, false);

    // Add all current tracks (microphone, screen audio, screen/camera video)
    await this.addTracksToPC(pc);

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsClient.send(WSEvents.RTC_SIGNAL, {
          targetUserId,
          channelId: this.currentChannelId,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    // Remote Track handler with automatic refresh
    pc.ontrack = (event) => {
      let remoteStream = this.remoteStreams.get(targetUserId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        this.remoteStreams.set(targetUserId, remoteStream);
      }

      if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }

      const refreshRemoteStream = () => {
        const current = this.remoteStreams.get(targetUserId);
        if (current) {
          // Re-instantiate MediaStream reference so React components trigger immediate re-render
          const updated = new MediaStream(current.getTracks().filter((t) => t.readyState === 'live'));
          this.remoteStreams.set(targetUserId, updated);
          this.notifyRemoteStreamsChanged();
        }
      };

      event.track.onended = () => {
        if (remoteStream) {
          remoteStream.removeTrack(event.track);
          refreshRemoteStream();
        }
      };
      event.track.onunmute = () => refreshRemoteStream();
      event.track.onmute = () => refreshRemoteStream();

      refreshRemoteStream();
    };

    // Resilient Connection State & Automatic ICE Recovery
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        const timer = this.disconnectTimers.get(targetUserId);
        if (timer) clearTimeout(timer);
        this.disconnectTimers.delete(targetUserId);
      } else if (pc.connectionState === 'disconnected') {
        console.warn(`[WebRTC] Peer ${targetUserId} disconnected, attempting ICE restart...`);
        void this.restartIce(targetUserId, pc);
        const previous = this.disconnectTimers.get(targetUserId);
        if (previous) clearTimeout(previous);
        this.disconnectTimers.set(targetUserId, setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            this.removePeer(targetUserId);
          }
        }, 12_000));
      } else if (pc.connectionState === 'failed') {
        console.warn(`[WebRTC] Peer ${targetUserId} failed, attempting final ICE restart...`);
        void this.restartIce(targetUserId, pc);
      }
    };

    if (isInitiator) {
      try {
        this.isMakingOffer.set(targetUserId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        wsClient.send(WSEvents.RTC_SIGNAL, {
          targetUserId,
          channelId: this.currentChannelId,
          signal: {
            type: 'offer',
            sdp: offer.sdp,
          },
        });
      } catch (err) {
        console.error('[WebRTC] Failed to create offer for peer:', targetUserId, err);
      } finally {
        this.isMakingOffer.set(targetUserId, false);
      }
    }

    return pc;
  }

  private async restartIce(targetUserId: string, pc: RTCPeerConnection) {
    if (pc.connectionState === 'closed') return;
    try {
      this.isMakingOffer.set(targetUserId, true);
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      wsClient.send(WSEvents.RTC_SIGNAL, {
        targetUserId,
        channelId: this.currentChannelId,
        signal: {
          type: 'offer',
          sdp: offer.sdp,
        },
      });
    } catch (err) {
      console.warn(`[WebRTC] ICE restart failed for ${targetUserId}:`, err);
    } finally {
      this.isMakingOffer.set(targetUserId, false);
    }
  }

  private async addTracksToPC(pc: RTCPeerConnection) {
    const micTrack = this.localStream?.getAudioTracks()[0] ?? null;
    const screenAudioTrack = this.screenStream?.getAudioTracks()[0] ?? null;
    const videoTrack = this.screenStream?.getVideoTracks()[0] ?? this.localStream?.getVideoTracks()[0] ?? null;

    const micTransceiver = pc.addTransceiver(micTrack ? micTrack : 'audio', {
      direction: 'sendrecv',
      streams: this.localStream ? [this.localStream] : [],
    });
    const sharedAudioTransceiver = pc.addTransceiver(screenAudioTrack ? screenAudioTrack : 'audio', {
      direction: 'sendrecv',
      streams: this.screenStream ? [this.screenStream] : [],
    });
    const videoTransceiver = pc.addTransceiver(videoTrack ? videoTrack : 'video', {
      direction: 'sendrecv',
      streams: this.screenStream ? [this.screenStream] : (this.localStream ? [this.localStream] : []),
    });

    if (micTrack && micTransceiver.sender.track !== micTrack) {
      await micTransceiver.sender.replaceTrack(micTrack);
    }
    if (screenAudioTrack && sharedAudioTransceiver.sender.track !== screenAudioTrack) {
      await sharedAudioTransceiver.sender.replaceTrack(screenAudioTrack);
    }
    if (videoTrack && videoTransceiver.sender.track !== videoTrack) {
      await videoTransceiver.sender.replaceTrack(videoTrack);
      await this.applyVideoSenderParameters(videoTransceiver.sender, Boolean(this.screenStream?.getVideoTracks()[0]));
    }
  }

  private async applyVideoSenderParameters(sender: RTCRtpSender, isScreen: boolean) {
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      if (isScreen) {
        // High quality screen sharing: 4 Mbps cap, maintain resolution for crisp text/code
        params.encodings[0].maxBitrate = 4_000_000;
        params.encodings[0].networkPriority = 'high';
        params.degradationPreference = 'maintain-resolution';
      } else {
        // Camera streaming
        params.encodings[0].maxBitrate = 1_500_000;
        params.encodings[0].networkPriority = 'medium';
        params.degradationPreference = 'balanced';
      }
      await sender.setParameters(params);
    } catch {
      // Browser might ignore specific parameter changes safely
    }
  }

  private async updatePeerTracks(renegotiateVideo = false) {
    const microphoneTrack = this.localStream?.getAudioTracks()[0] ?? null;
    const sharedAudioTrack = this.screenStream?.getAudioTracks()[0] ?? null;
    const videoTrack = this.screenStream?.getVideoTracks()[0] ?? this.localStream?.getVideoTracks()[0] ?? null;
    const isScreen = Boolean(this.screenStream?.getVideoTracks()[0]);

    for (const pc of this.peerConnections.values()) {
      if (pc.connectionState === 'closed') continue;

      const audioSenders = pc.getTransceivers()
        .filter((item) => item.receiver.track.kind === 'audio')
        .map((item) => item.sender);
      const videoTransceiver = pc.getTransceivers().find((item) => item.receiver.track.kind === 'video');

      if (audioSenders[0]) await audioSenders[0].replaceTrack(microphoneTrack);
      if (audioSenders[1]) await audioSenders[1].replaceTrack(sharedAudioTrack);

      if (videoTransceiver) {
        await videoTransceiver.sender.replaceTrack(videoTrack);
        if (videoTrack) {
          await this.applyVideoSenderParameters(videoTransceiver.sender, isScreen);
        }
      }
    }

    if (renegotiateVideo) {
      await this.renegotiatePeers();
    }
  }

  /**
   * Re-offer to renegotiate media tracks with connected peers
   */
  private async renegotiatePeers(): Promise<void> {
    for (const [targetUserId, pc] of this.peerConnections) {
      if (pc.connectionState === 'closed' || pc.signalingState !== 'stable') continue;
      try {
        this.isMakingOffer.set(targetUserId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsClient.send(WSEvents.RTC_SIGNAL, {
          targetUserId,
          channelId: this.currentChannelId,
          signal: {
            type: 'offer',
            sdp: offer.sdp,
          },
        });
      } catch (error) {
        console.warn('[WebRTC] Falha ao renegociar a faixa de vídeo:', targetUserId, error);
      } finally {
        this.isMakingOffer.set(targetUserId, false);
      }
    }
  }

  private async flushPendingIceCandidates(userId: string, pc: RTCPeerConnection) {
    const queued = this.pendingIceCandidates.get(userId) ?? [];
    this.pendingIceCandidates.delete(userId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to add pending ICE candidate:', e);
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
