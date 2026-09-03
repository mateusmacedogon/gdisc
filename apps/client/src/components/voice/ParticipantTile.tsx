import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../common/Avatar.js';
import { Loader2, Maximize2, MicOff, Minimize2, Video, Monitor, Volume2, VolumeX, X, Sliders } from 'lucide-react';
import type { VoiceState } from '@gdisc/shared';
import { useVoiceStore } from '../../stores/useVoiceStore.js';

interface ParticipantTileProps {
  participant: VoiceState;
  isLocal?: boolean;
  mediaStream?: MediaStream | null;
  isScreenShareSpotlight?: boolean;
  muteAudio?: boolean;
  audioOutputDeviceId?: string;
}

const isExpectedPlaybackInterruption = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');

const attachMutedVideo = (
  video: HTMLVideoElement,
  mediaStream: MediaStream | null | undefined,
  warningLabel: string,
): (() => void) => {
  let active = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');

  if (!mediaStream) {
    video.pause();
    video.srcObject = null;
    return () => { active = false; };
  }

  if (video.srcObject !== mediaStream) video.srcObject = mediaStream;

  const play = () => {
    if (!active || !video.isConnected || video.srcObject !== mediaStream) return;
    void video.play().catch((error) => {
      if (
        active
        && video.isConnected
        && video.srcObject === mediaStream
        && !isExpectedPlaybackInterruption(error)
      ) {
        console.warn(`[ParticipantTile] ${warningLabel}:`, error);
      }
    });
  };

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    play();
  } else {
    video.addEventListener('loadedmetadata', play, { once: true });
  }

  return () => {
    active = false;
    video.removeEventListener('loadedmetadata', play);
  };
};

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  isLocal = false,
  mediaStream,
  isScreenShareSpotlight = false,
  muteAudio = false,
  audioOutputDeviceId,
}) => {
  const tileRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const usesNativeFullscreenRef = useRef(false);
  const audioPlaybackRequestRef = useRef(0);

  // Web Audio pipeline for amplifying volume up to 200%
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [, setTrackVersion] = useState(0);

  const participantVolume = useVoiceStore((s) => s.participantVolumes[participant.userId] ?? 100);
  const setParticipantVolume = useVoiceStore((s) => s.setParticipantVolume);

  // Click outside to dismiss user volume popover
  useEffect(() => {
    if (!showVolumeSlider) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowVolumeSlider(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showVolumeSlider]);

  // Active listener on MediaStream tracks to dynamically trigger updates on track state changes
  useEffect(() => {
    if (!mediaStream) return;

    const handleTrackUpdate = () => {
      setTrackVersion((v) => v + 1);
    };

    const bindTrack = (track: MediaStreamTrack) => {
      track.addEventListener('mute', handleTrackUpdate);
      track.addEventListener('unmute', handleTrackUpdate);
      track.addEventListener('ended', handleTrackUpdate);
    };
    const unbindTrack = (track: MediaStreamTrack) => {
      track.removeEventListener('mute', handleTrackUpdate);
      track.removeEventListener('unmute', handleTrackUpdate);
      track.removeEventListener('ended', handleTrackUpdate);
    };

    const onAddTrack = (e: MediaStreamTrackEvent) => {
      bindTrack(e.track);
      handleTrackUpdate();
    };
    const onRemoveTrack = (e: MediaStreamTrackEvent) => {
      unbindTrack(e.track);
      handleTrackUpdate();
    };

    mediaStream.addEventListener('addtrack', onAddTrack);
    mediaStream.addEventListener('removetrack', onRemoveTrack);

    const tracks = mediaStream.getTracks();
    tracks.forEach(bindTrack);

    return () => {
      mediaStream.removeEventListener('addtrack', onAddTrack);
      mediaStream.removeEventListener('removetrack', onRemoveTrack);
      tracks.forEach(unbindTrack);
    };
  }, [mediaStream]);

  const hasVideoTrack = Boolean(
    mediaStream &&
    mediaStream.getVideoTracks().some(
      (track) => track.readyState === 'live' && track.enabled && !track.muted
    )
  );

  const hasAudioTrack = Boolean(
    mediaStream &&
    mediaStream.getAudioTracks().some(
      (track) => track.readyState === 'live'
    )
  );

  // Sync video stream to regular tile with unconditional native DOM attributes for web autoplay
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    return attachMutedVideo(video, mediaStream, 'Video play');
  }, [mediaStream]);

  // Sync video stream to fullscreen portal
  useEffect(() => {
    if (!isFullscreen) return;
    const fsVideo = fullscreenVideoRef.current;
    if (!fsVideo) return;
    return attachMutedVideo(fsVideo, mediaStream, 'Fullscreen play');
  }, [isFullscreen, mediaStream]);

  const playRemoteAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !mediaStream || isLocal || !hasAudioTrack) {
      setIsAudioBlocked(false);
      return;
    }

    const playbackRequest = ++audioPlaybackRequestRef.current;
    const isCurrentRequest = () => (
      playbackRequest === audioPlaybackRequestRef.current
      && audioRef.current === audio
      && audio.isConnected
    );

    audio.muted = muteAudio;
    audio.defaultMuted = false;

    let targetStream = mediaStream;

    // Use Web Audio GainNode for boosting volume over 100%
    if (participantVolume > 100) {
      try {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => undefined);
        }
        if (!gainNodeRef.current) {
          gainNodeRef.current = ctx.createGain();
        }
        gainNodeRef.current.gain.setValueAtTime(participantVolume / 100, ctx.currentTime);

        if (!sourceNodeRef.current || sourceNodeRef.current.mediaStream !== mediaStream || !destinationNodeRef.current) {
          sourceNodeRef.current?.disconnect();
          destinationNodeRef.current?.disconnect();
          sourceNodeRef.current = ctx.createMediaStreamSource(mediaStream);
          const dest = ctx.createMediaStreamDestination();
          destinationNodeRef.current = dest;
          sourceNodeRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(dest);
        }
        targetStream = destinationNodeRef.current ? destinationNodeRef.current.stream : mediaStream;
        audio.volume = 1.0;
      } catch (err) {
        console.warn('[ParticipantTile] Web Audio boost fallback:', err);
        targetStream = mediaStream;
        audio.volume = 1.0;
      }
    } else {
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setValueAtTime(1.0, audioCtxRef.current.currentTime);
      }
      targetStream = mediaStream;
      audio.volume = Math.max(0, Math.min(1, participantVolume / 100));
    }

    if (audio.srcObject !== targetStream) audio.srcObject = targetStream;

    const sinkAudio = audio as HTMLAudioElement & {
      setSinkId?: (deviceId: string) => Promise<void>;
    };
    if (sinkAudio.setSinkId) {
      try {
        await sinkAudio.setSinkId(audioOutputDeviceId || 'default');
      } catch (error) {
        console.warn('[ParticipantTile] Audio output device unavailable, using default:', error);
        if (audioOutputDeviceId) {
          await sinkAudio.setSinkId('default').catch(() => undefined);
        }
      }
    }

    if (!isCurrentRequest()) return;

    try {
      await audio.play();
      if (isCurrentRequest()) setIsAudioBlocked(false);
    } catch (error) {
      if (!isCurrentRequest() || isExpectedPlaybackInterruption(error)) return;
      if (!muteAudio) {
        console.warn('[ParticipantTile] Remote audio playback was blocked:', error);
        setIsAudioBlocked(true);
      }
    }
  }, [audioOutputDeviceId, hasAudioTrack, isLocal, mediaStream, muteAudio, participantVolume]);

  // Audio output handler. Browsers may block autoplay until the first user
  // interaction, so retry on media readiness and on the next click/key press.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !mediaStream || isLocal || !hasAudioTrack) {
      audioPlaybackRequestRef.current += 1;
      if (audio) {
        audio.pause();
        audio.srcObject = null;
      }
      setIsAudioBlocked(false);
      return;
    }

    audio.muted = muteAudio;
    const retryPlayback = () => void playRemoteAudio();
    audio.addEventListener('canplay', retryPlayback, { once: true });
    audio.addEventListener('loadedmetadata', retryPlayback, { once: true });
    document.addEventListener('pointerdown', retryPlayback, { once: true });
    document.addEventListener('keydown', retryPlayback, { once: true });
    void playRemoteAudio();

    return () => {
      audioPlaybackRequestRef.current += 1;
      audio.removeEventListener('canplay', retryPlayback);
      audio.removeEventListener('loadedmetadata', retryPlayback);
      document.removeEventListener('pointerdown', retryPlayback);
      document.removeEventListener('keydown', retryPlayback);
    };
  }, [hasAudioTrack, isLocal, mediaStream, muteAudio, playRemoteAudio]);

  useEffect(() => () => {
    audioPlaybackRequestRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.srcObject = null;
    }
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    gainNodeRef.current?.disconnect();
    gainNodeRef.current = null;
    destinationNodeRef.current?.disconnect();
    destinationNodeRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isLocal) {
      void playRemoteAudio();
    }
  }, [participantVolume, isLocal, playRemoteAudio]);

  // Escape key closes fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (usesNativeFullscreenRef.current && !document.fullscreenElement) {
        usesNativeFullscreenRef.current = false;
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      setIsFullscreen(false);
      usesNativeFullscreenRef.current = false;
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
    } else {
      setIsFullscreen(true);
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          usesNativeFullscreenRef.current = true;
        }
      } catch {
        // Fallback portal active
      }
    }
  };

  return (
    <>
      <div
        ref={tileRef}
        onDoubleClick={() => hasVideoTrack && void toggleFullscreen()}
        className={`w-full h-full bg-gdisc-bg-card border overflow-hidden flex items-center justify-center select-none shadow-xl transition-all duration-150 relative rounded-2xl ${
          participant.isSpeaking
            ? 'border-gdisc-status-online shadow-gdisc-speaking'
            : 'border-gdisc-bg-hover/80 hover:border-gdisc-brand-primary/40'
        }`}
      >
        {/* Audio element for remote participant */}
        {!isLocal && (
          <audio
            ref={audioRef}
            autoPlay
            muted={muteAudio}
            className="hidden"
          />
        )}

        {isAudioBlocked && !isLocal && !muteAudio && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void playRemoteAudio();
            }}
            className="absolute bottom-14 left-1/2 z-30 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-xl border border-gdisc-brand-primary/50 bg-gdisc-brand-primary px-4 py-2 text-xs font-bold text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
            aria-label={`Ativar áudio de ${participant.user.displayName}`}
          >
            <Volume2 className="h-4 w-4" />
            Ativar áudio
          </button>
        )}

        {/* Video Element is PERMANENTLY mounted in the DOM to avoid teardown/blackouts */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full ${
            participant.selfScreen ? 'object-contain bg-black' : 'object-cover'
          } ${isLocal && !participant.selfScreen ? '-scale-x-100' : ''} rounded-2xl ${hasVideoTrack ? 'block' : 'hidden'}`}
        />

        {/* Avatar Display when video is inactive */}
        {!hasVideoTrack && (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Avatar
              src={participant.user.avatarUrl}
              name={participant.user.displayName}
              size={isScreenShareSpotlight ? '2xl' : 'xl'}
              isSpeaking={participant.isSpeaking}
              className="mb-3"
            />
            <h4 className="text-base font-bold text-gdisc-text-primary tracking-tight">
              {participant.user.displayName}
            </h4>
            <span className="text-xs text-gdisc-text-muted mt-0.5">
              {isLocal ? '(Você)' : `@${participant.user.username}`}
            </span>
          </div>
        )}

        {!isLocal && (participant.selfVideo || participant.selfScreen) && !hasVideoTrack && (
          <div className="absolute inset-x-3 bottom-14 z-20 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/65 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur-md">
            <Loader2 className="h-4 w-4 animate-spin text-gdisc-brand-secondary" />
            Reconectando {participant.selfScreen ? 'compartilhamento' : 'câmera'}…
          </div>
        )}

        {/* Fullscreen Button on Top Left when video / screen active */}
        {hasVideoTrack && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleFullscreen();
            }}
            aria-label="Exibir transmissão em tela cheia"
            title="Tela cheia (ou clique duplo)"
            className="absolute left-3 top-3 z-20 flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-white shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-black/90 active:scale-95 sm:min-h-9 sm:min-w-9"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {/* Top Indicators (Screen share badge, Video badge) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
          {participant.selfScreen && (
            <span className="px-2 py-1 rounded-md bg-gdisc-success/20 border border-gdisc-success/40 text-gdisc-success text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Monitor className="w-3 h-3" />
              Tela
            </span>
          )}
          {participant.selfVideo && (
            <span className="p-1 rounded-md bg-gdisc-brand-primary/30 border border-gdisc-brand-primary/50 text-gdisc-brand-secondary text-xs">
              <Video className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Bottom Name & Audio Status Pill + Individual Volume Slider */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-xs font-semibold text-gdisc-text-primary border border-white/10 shadow-md">
            {participant.selfMute ? (
              <MicOff className="w-3.5 h-3.5 text-gdisc-danger shrink-0" />
            ) : (
              <Volume2
                className={`w-3.5 h-3.5 shrink-0 ${
                  participant.isSpeaking ? 'text-gdisc-success' : 'text-gdisc-text-muted'
                }`}
              />
            )}
            <span className="truncate max-w-[140px]">
              {participant.user.displayName} {isLocal && '(Você)'}
            </span>
            {!isLocal && participantVolume !== 100 && (
              <span className="text-[10px] text-gdisc-brand-secondary font-mono">
                {participantVolume}%
              </span>
            )}
          </div>

          {!isLocal && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVolumeSlider(!showVolumeSlider);
                }}
                title="Ajustar volume deste usuário"
                className={`p-1.5 rounded-xl border backdrop-blur-md transition-all shadow-md ${
                  showVolumeSlider || participantVolume !== 100
                    ? 'bg-gdisc-brand-primary text-white border-gdisc-brand-primary'
                    : 'bg-black/60 text-white/80 border-white/10 hover:bg-black/90'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>

              {showVolumeSlider && (
                <div
                  ref={popoverRef}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full right-0 mb-2 p-3 bg-gdisc-bg-card/95 border border-gdisc-bg-hover rounded-xl shadow-2xl backdrop-blur-md z-30 min-w-[190px] space-y-2 animate-fade-in"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-gdisc-text-secondary">
                    <span>Volume do Usuário</span>
                    <span className="text-gdisc-brand-secondary font-mono">{participantVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="5"
                    value={participantVolume}
                    onChange={(e) => setParticipantVolume(participant.userId, parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gdisc-bg-secondary rounded-lg appearance-none cursor-pointer accent-gdisc-brand-primary border border-gdisc-bg-hover"
                  />
                  <div className="flex justify-between text-[10px] text-gdisc-text-muted">
                    <span>0%</span>
                    <button
                      type="button"
                      onClick={() => setParticipantVolume(participant.userId, 100)}
                      className="hover:text-gdisc-brand-secondary underline"
                    >
                      Padrão (100%)
                    </button>
                    <span>200%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Portal Fullscreen Overlay */}
      {isFullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-black flex items-center justify-center select-none animate-fade-in"
            onDoubleClick={() => void toggleFullscreen()}
          >
            <video
              ref={fullscreenVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />

            {/* Top Control Bar in Fullscreen */}
            <div className="absolute left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex items-center justify-between gap-2 pointer-events-auto sm:left-4 sm:right-4 sm:top-4">
              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-md sm:gap-2.5 sm:px-4">
                {participant.selfScreen ? (
                  <Monitor className="w-4 h-4 text-gdisc-success" />
                ) : (
                  <Video className="w-4 h-4 text-gdisc-brand-secondary" />
                )}
                <span className="truncate">
                  {participant.user.displayName} — {participant.selfScreen ? 'Compartilhamento de Tela' : 'Câmera'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  title="Sair da Tela Cheia (Esc)"
                  className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Sair da Tela Cheia</span>
                </button>

                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  title="Fechar (Esc)"
                  className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-black/70 text-white shadow-2xl backdrop-blur-md transition-colors hover:bg-red-600 sm:flex"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom floating hint */}
            <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-[11px] text-white/70 pointer-events-none backdrop-blur-md sm:block">
              Pressione <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-white font-mono text-[10px]">Esc</kbd> ou dê duplo clique para sair
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
