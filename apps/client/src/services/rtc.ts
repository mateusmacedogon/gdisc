/**
 * GDisC WebRTC Mesh Realtime Engine
 * Handles audio, video, and screen sharing with peer-to-peer mesh connections.
 */

import { wsClient } from './ws.js';
import { WSEvents, type RTCSignalPayload } from '@gdisc/shared';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

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
  private currentChannelId: string | null = null;
  private onRemoteStreamsChanged: RemoteStreamCallback | null = null;

  public setRemoteStreamCallback(cb: RemoteStreamCallback) {
    this.onRemoteStreamsChanged = cb;
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
    this.stopLocalMedia();

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

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.updatePeerTracks();
      return this.localStream;
    } catch (err) {
      console.warn('getUserMedia failed with requested constraints, falling back to basic audio:', err);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.updatePeerTracks();
        return this.localStream;
      } catch (fallbackErr) {
        console.error('Failed to get any user media:', fallbackErr);
        this.localStream = new MediaStream();
        return this.localStream;
      }
    }
  }

  /**
   * Starts screen capture via getDisplayMedia
   */
  public async startScreenShare(): Promise<MediaStream | null> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as any,
        audio: false,
      });

      const videoTrack = this.screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
      }

      this.updatePeerTracks();
      return this.screenStream;
    } catch (err) {
      console.error('Error starting screen share:', err);
      return null;
    }
  }

  public stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    this.updatePeerTracks();
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
      this.updatePeerTracks();
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
          this.localStream.addTrack(newVideoTrack);
          this.updatePeerTracks();
        }
        return this.localStream;
      } catch (err) {
        console.error('Failed to enable camera:', err);
        return this.localStream;
      }
    }
  }

  public setChannel(channelId: string) {
    this.currentChannelId = channelId;
  }

  /**
   * Connect to existing peers in the voice room
   */
  public async connectToPeers(peerUserIds: string[]) {
    for (const peerId of peerUserIds) {
      await this.createPeerConnection(peerId, true);
    }
  }

  /**
   * Handle incoming WebRTC signaling message
   */
  public async handleSignal(payload: RTCSignalPayload) {
    const { fromUserId, signal, channelId } = payload;
    if (!fromUserId || (this.currentChannelId && channelId !== this.currentChannelId)) return;

    let pc = this.peerConnections.get(fromUserId);

    if (signal.type === 'offer') {
      if (!pc) {
        pc = await this.createPeerConnection(fromUserId, false);
      }
      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
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
      }
    } else if (signal.type === 'answer') {
      if (pc && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
      }
    } else if (signal.type === 'ice-candidate') {
      if (pc && signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    }
  }

  public removePeer(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
    this.remoteStreams.delete(userId);
    this.notifyRemoteStreamsChanged();
  }

  public leaveAll() {
    this.stopLocalMedia();
    this.stopScreenShare();

    for (const [userId, pc] of this.peerConnections.entries()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.currentChannelId = null;
    this.notifyRemoteStreamsChanged();
  }

  private async createPeerConnection(targetUserId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(targetUserId)) {
      this.peerConnections.get(targetUserId)!.close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(targetUserId, pc);

    // Add local tracks to peer connection
    this.addTracksToPC(pc);

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

    // Remote Track handler
    pc.ontrack = (event) => {
      let remoteStream = this.remoteStreams.get(targetUserId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        this.remoteStreams.set(targetUserId, remoteStream);
      }

      remoteStream.addTrack(event.track);

      event.track.onended = () => {
        if (remoteStream) {
          remoteStream.removeTrack(event.track);
          this.notifyRemoteStreamsChanged();
        }
      };

      this.notifyRemoteStreamsChanged();
    };

    // Connection state logging
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(targetUserId);
      }
    };

    if (isInitiator) {
      try {
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
        console.error('Failed to create offer for peer:', targetUserId, err);
      }
    }

    return pc;
  }

  private addTracksToPC(pc: RTCPeerConnection) {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.screenStream!);
      });
    }
  }

  private updatePeerTracks() {
    for (const [userId, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();

      // Replace or add local audio track
      const audioTrack = this.localStream?.getAudioTracks()[0];
      const audioSender = senders.find((s) => s.track?.kind === 'audio');
      if (audioSender && audioTrack) {
        audioSender.replaceTrack(audioTrack);
      } else if (!audioSender && audioTrack) {
        pc.addTrack(audioTrack, this.localStream!);
      }

      // Replace or add video/screen track
      const videoTrack = this.screenStream?.getVideoTracks()[0] || this.localStream?.getVideoTracks()[0];
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender && videoTrack) {
        videoSender.replaceTrack(videoTrack);
      } else if (!videoSender && videoTrack) {
        pc.addTrack(videoTrack, this.screenStream || this.localStream!);
      } else if (videoSender && !videoTrack) {
        pc.removeTrack(videoSender);
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

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getScreenStream(): MediaStream | null {
    return this.screenStream;
  }
}

export const rtcManager = new WebRTCManager();
