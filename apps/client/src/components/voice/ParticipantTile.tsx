import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../common/Avatar.js';
import { Maximize2, MicOff, Minimize2, Video, Monitor, Volume2, X, Loader2 } from 'lucide-react';
import type { VoiceState } from '@gdisc/shared';

interface ParticipantTileProps {
  participant: VoiceState;
  isLocal?: boolean;
  mediaStream?: MediaStream | null;
  isScreenShareSpotlight?: boolean;
  muteAudio?: boolean;
  audioOutputDeviceId?: string;
}

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

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [, setTrackVersion] = useState(0);

  // Active listener on MediaStream tracks to dynamically catch newly unmuted or added video/audio tracks
  useEffect(() => {
    if (!mediaStream) return;

    const handleTrackUpdate = () => {
      setTrackVersion((v) => v + 1);
    };

    mediaStream.addEventListener('addtrack', handleTrackUpdate);
    mediaStream.addEventListener('removetrack', handleTrackUpdate);

    const tracks = mediaStream.getTracks();
    tracks.forEach((track) => {
      track.addEventListener('mute', handleTrackUpdate);
      track.addEventListener('unmute', handleTrackUpdate);
      track.addEventListener('ended', handleTrackUpdate);
    });

    return () => {
      mediaStream.removeEventListener('addtrack', handleTrackUpdate);
      mediaStream.removeEventListener('removetrack', handleTrackUpdate);
      tracks.forEach((track) => {
        track.removeEventListener('mute', handleTrackUpdate);
        track.removeEventListener('unmute', handleTrackUpdate);
        track.removeEventListener('ended', handleTrackUpdate);
      });
    };
  }, [mediaStream]);

  const hasVideoTrack = Boolean(
    mediaStream &&
    mediaStream.getVideoTracks().some(
      (track) => track.readyState === 'live' && track.enabled
    )
  );

  const shouldRenderVideo = hasVideoTrack || participant.selfScreen || participant.selfVideo;

  const hasAudioTrack = Boolean(
    mediaStream &&
    mediaStream.getAudioTracks().some(
      (track) => track.readyState === 'live'
    )
  );

  const attachAndPlayVideo = useCallback((videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;
    if (mediaStream) {
      if (videoEl.srcObject !== mediaStream) {
        videoEl.srcObject = mediaStream;
      }
      videoEl.play()
        .then(() => setIsVideoPlaying(true))
        .catch(() => undefined);
    } else {
      videoEl.srcObject = null;
      setIsVideoPlaying(false);
    }
  }, [mediaStream]);

  // Sync video stream to regular tile
  useEffect(() => {
    attachAndPlayVideo(videoRef.current);
  }, [attachAndPlayVideo, hasVideoTrack, shouldRenderVideo]);

  // Sync video stream to fullscreen portal
  useEffect(() => {
    if (!isFullscreen) return;
    attachAndPlayVideo(fullscreenVideoRef.current);
  }, [isFullscreen, attachAndPlayVideo, hasVideoTrack, shouldRenderVideo]);

  // Audio output handler
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      if (mediaStream && !isLocal && !muteAudio) {
        if (audio.srcObject !== mediaStream) {
          audio.srcObject = mediaStream;
        }
        const sinkAudio = audio as HTMLAudioElement & {
          setSinkId?: (deviceId: string) => Promise<void>;
        };
        if (sinkAudio.setSinkId) {
          void sinkAudio.setSinkId(audioOutputDeviceId || 'default').catch(() => undefined);
        }
        void audio.play().catch(() => undefined);
      } else {
        audio.srcObject = null;
      }
    }
    return () => {
      if (audio) audio.srcObject = null;
    };
  }, [audioOutputDeviceId, mediaStream, hasAudioTrack, isLocal, muteAudio]);

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
        {hasAudioTrack && !isLocal && (
          <audio
            ref={audioRef}
            autoPlay
            muted={muteAudio}
            onLoadedMetadata={(e) => {
              void e.currentTarget.play().catch(() => undefined);
            }}
            className="hidden"
          />
        )}

        {/* Video Element (Pre-mounted for zero latency frame decoding) */}
        {shouldRenderVideo ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onPlaying={() => setIsVideoPlaying(true)}
              onLoadedMetadata={(e) => {
                void e.currentTarget.play().then(() => setIsVideoPlaying(true)).catch(() => undefined);
              }}
              className={`w-full h-full ${
                participant.selfScreen ? 'object-contain' : 'object-cover'
              } rounded-2xl transition-opacity duration-300 ${isVideoPlaying ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Connecting placeholder overlay while initial keyframe is arriving */}
            {!isVideoPlaying && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gdisc-bg-card/90 backdrop-blur-sm z-10 p-6">
                <Avatar
                  src={participant.user.avatarUrl}
                  name={participant.user.displayName}
                  size={isScreenShareSpotlight ? 'xl' : 'lg'}
                  isSpeaking={participant.isSpeaking}
                  className="mb-3 animate-pulse"
                />
                <div className="flex items-center gap-2 text-xs font-semibold text-gdisc-text-secondary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gdisc-brand-secondary" />
                  <span>Sincronizando transmissão...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Avatar Display when camera/screen is off */
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

        {/* Bottom Name & Audio Status Pill */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
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
          </div>
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
              onLoadedMetadata={(e) => {
                void e.currentTarget.play().catch(() => undefined);
              }}
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
