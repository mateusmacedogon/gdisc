import React, { useRef, useEffect } from 'react';
import { Avatar } from '../common/Avatar.js';
import { MicOff, Video, Monitor, Volume2 } from 'lucide-react';
import type { VoiceState } from '@gdisc/shared';

interface ParticipantTileProps {
  participant: VoiceState;
  isLocal?: boolean;
  mediaStream?: MediaStream | null;
  isScreenShareSpotlight?: boolean;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  isLocal = false,
  mediaStream,
  isScreenShareSpotlight = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const hasVideoTrack =
    mediaStream &&
    mediaStream.getVideoTracks().length > 0 &&
    mediaStream.getVideoTracks()[0].enabled;

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, hasVideoTrack]);

  return (
    <div
      className={`relative w-full h-full bg-gdisc-bg-card border rounded-2xl overflow-hidden flex items-center justify-center select-none shadow-xl transition-all duration-150 ${
        participant.isSpeaking
          ? 'border-gdisc-status-online shadow-gdisc-speaking'
          : 'border-gdisc-bg-hover/80 hover:border-gdisc-brand-primary/40'
      }`}
    >
      {/* Video Element */}
      {hasVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Mute local video to prevent audio feedback
          className="w-full h-full object-cover rounded-2xl"
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
