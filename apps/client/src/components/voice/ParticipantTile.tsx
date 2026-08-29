import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../common/Avatar.js';
import { Maximize2, MicOff, Minimize2, Video, Monitor, Volume2, X } from 'lucide-react';
import type { VoiceState } from '@gdisc/shared';

interface ParticipantTileProps {
  participant: VoiceState;
  isLocal?: boolean;
  mediaStream?: MediaStream | null;
  isScreenShareSpotlight?: boolean;
  muteAudio?: boolean;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  isLocal = false,
  mediaStream,
  isScreenShareSpotlight = false,
  muteAudio = false,
}) => {
  const tileRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasVideoTrack = Boolean(
    mediaStream &&
    mediaStream.getVideoTracks().some((track) =>
      track.readyState === 'live' && track.enabled
    )
  );
  const hasAudioTrack = Boolean(
    mediaStream?.getAudioTracks().some((track) => track.readyState === 'live')
  );

  // Sync video stream to regular tile
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.srcObject = mediaStream ?? null;
      if (mediaStream) void video.play().catch(() => undefined);
    }
    return () => {
      if (video) video.srcObject = null;
    };
  }, [mediaStream, hasVideoTrack]);

  // Sync video stream to fullscreen portal
  useEffect(() => {
    if (!isFullscreen) return;
    const fsVideo = fullscreenVideoRef.current;
    if (fsVideo) {
      fsVideo.srcObject = mediaStream ?? null;
      if (mediaStream) void fsVideo.play().catch(() => undefined);
    }
    return () => {
      if (fsVideo) fsVideo.srcObject = null;
    };
  }, [isFullscreen, mediaStream]);

  // Audio output handler
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.srcObject = mediaStream ?? null;
      if (mediaStream && !isLocal && !muteAudio) void audio.play().catch(() => undefined);
    }
    return () => {
      if (audio) audio.srcObject = null;
    };
  }, [mediaStream, hasAudioTrack, isLocal, muteAudio]);

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

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      setIsFullscreen(false);
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
    } else {
      setIsFullscreen(true);
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
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
        {hasAudioTrack && (
          <audio ref={audioRef} autoPlay muted={isLocal || muteAudio} className="hidden" />
        )}

        {/* Video Element */}
        {hasVideoTrack ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full ${
              participant.selfScreen ? 'object-contain bg-black' : 'object-cover'
            } rounded-2xl`}
          />
        ) : (
          /* Avatar Display when camera is off */
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
            className="absolute left-3 top-3 z-20 flex min-h-9 min-w-9 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-white shadow-lg backdrop-blur-md transition-all hover:bg-black/90 hover:scale-105 active:scale-95"
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
              className="w-full h-full object-contain"
            />

            {/* Top Control Bar in Fullscreen */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-50 pointer-events-auto">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-white text-xs font-semibold shadow-2xl">
                {participant.selfScreen ? (
                  <Monitor className="w-4 h-4 text-gdisc-success" />
                ) : (
                  <Video className="w-4 h-4 text-gdisc-brand-secondary" />
                )}
                <span>
                  {participant.user.displayName} — {participant.selfScreen ? 'Compartilhamento de Tela' : 'Câmera'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  title="Sair da Tela Cheia (Esc)"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors shadow-2xl"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>Sair da Tela Cheia</span>
                </button>

                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  title="Fechar (Esc)"
                  className="p-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-white hover:bg-red-600 transition-colors shadow-2xl"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom floating hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] text-white/70 pointer-events-none">
              Pressione <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-white font-mono text-[10px]">Esc</kbd> ou dê duplo clique para sair
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
