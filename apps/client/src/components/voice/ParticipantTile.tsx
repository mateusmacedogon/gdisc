import React, { useRef, useEffect, useState } from 'react';
import { Avatar } from '../common/Avatar.js';
import { Maximize2, MicOff, Minimize2, Video, Monitor, Volume2 } from 'lucide-react';
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);
  const isFullscreen = isNativeFullscreen || isFallbackFullscreen;

  const hasVideoTrack = Boolean(
    mediaStream &&
    (participant.selfVideo || participant.selfScreen) &&
    mediaStream.getVideoTracks().some((track) =>
      track.readyState === 'live' && track.enabled && !track.muted
    ),
  );
  const hasAudioTrack = Boolean(
    mediaStream?.getAudioTracks().some((track) => track.readyState === 'live'),
  );

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(document.fullscreenElement === tileRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFallbackFullscreen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFallbackFullscreen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFallbackFullscreen]);

  useEffect(() => {
    if (participant.selfScreen) return;
    setIsFallbackFullscreen(false);
    if (document.fullscreenElement === tileRef.current) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, [participant.selfScreen]);

  const toggleFullscreen = async () => {
    const tile = tileRef.current;
    if (!tile) return;

    if (document.fullscreenElement === tile) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (isFallbackFullscreen) {
      setIsFallbackFullscreen(false);
      return;
    }

    if (tile.requestFullscreen) {
      try {
        await tile.requestFullscreen();
        return;
      } catch {
        // Capacitor/Tauri WebViews may expose the API but reject it. The fixed
        // overlay below provides the same viewing experience in that case.
      }
    }
    setIsFallbackFullscreen(true);
  };

  return (
    <div
      ref={tileRef}
      className={`w-full h-full bg-gdisc-bg-card border overflow-hidden flex items-center justify-center select-none shadow-xl transition-all duration-150 ${
        isFullscreen
          ? 'fixed inset-0 z-[100] rounded-none border-0 bg-black'
          : 'relative rounded-2xl'
      } ${
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
          muted // Remote audio is played by the dedicated audio element above.
          className={`w-full h-full ${participant.selfScreen || isFullscreen ? 'object-contain' : 'object-cover'} ${
            isFullscreen ? 'rounded-none' : 'rounded-2xl'
          }`}
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

      {isScreenShareSpotlight && participant.selfScreen && hasVideoTrack && (
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label={isFullscreen ? 'Sair da tela cheia' : 'Exibir compartilhamento em tela cheia'}
          title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          className="absolute left-3 top-3 z-20 flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-gdisc-brand-secondary"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
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
  );
};
