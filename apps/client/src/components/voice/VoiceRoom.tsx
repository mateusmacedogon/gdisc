import React from 'react';
import { useChannelStore } from '../../stores/useChannelStore.js';
import { useVoiceStore } from '../../stores/useVoiceStore.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { ParticipantTile } from './ParticipantTile.js';
import { CallControls } from './CallControls.js';
import { Volume2, Users } from 'lucide-react';
import type { VoiceState } from '@gdisc/shared';

export const VoiceRoom: React.FC = () => {
  const { activeChannel } = useChannelStore();
  const { user } = useAuthStore();
  const {
    activeVoiceChannelId,
    voiceStates,
    localStream,
    screenStream,
    remoteStreams,
    isMuted,
    isDeafened,
    isVideoOn,
    isScreenSharing,
    isSpeaking,
  } = useVoiceStore();

  const channelParticipants: VoiceState[] = activeChannel
    ? voiceStates[activeChannel.id] || []
    : [];

  // Construct local user state representation
  const localVoiceState: VoiceState | null = user && activeVoiceChannelId
    ? {
        userId: user.id,
        channelId: activeVoiceChannelId,
        serverId: activeChannel?.serverId || '',
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          status: user.status,
          customStatus: user.customStatus,
        },
        selfMute: isMuted,
        selfDeaf: isDeafened,
        selfVideo: isVideoOn,
        selfScreen: isScreenSharing,
        isSpeaking,
        joinedAt: Date.now(),
      }
    : null;

  // Filter out local participant from remote list to prevent duplicates
  const remoteParticipants = channelParticipants.filter(
    (p) => p.userId !== user?.id
  );

  const allParticipants = localVoiceState
    ? [localVoiceState, ...remoteParticipants]
    : remoteParticipants;

  // Check if anyone is sharing a screen
  const screenSharer = allParticipants.find((p) => p.selfScreen);

  // Dynamic grid column class based on participant count
  const getGridClass = (count: number) => {
    if (count <= 1) return 'grid-cols-1 max-w-2xl max-h-[540px]';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2 max-w-4xl';
    if (count <= 4) return 'grid-cols-2 max-w-5xl';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3 max-w-6xl';
    return 'grid-cols-3 md:grid-cols-4 max-w-7xl';
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-gdisc-bg-primary overflow-hidden select-none relative">
      {/* Voice Header */}
      <div className="h-12 px-4 border-b border-gdisc-bg-hover/60 flex items-center justify-between shrink-0 bg-gdisc-bg-primary/95">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-gdisc-success" />
          <h2 className="text-sm font-bold text-gdisc-text-primary">
            {activeChannel?.name || 'Canal de Voz'}
          </h2>
          <span className="w-1.5 h-1.5 rounded-full bg-gdisc-success" />
          <span className="text-xs text-gdisc-text-muted">
            {allParticipants.length} conectado(s)
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gdisc-text-muted bg-gdisc-bg-card px-2.5 py-1 rounded-lg border border-gdisc-bg-hover">
          <Users className="w-3.5 h-3.5 text-gdisc-brand-secondary" />
          <span>WebRTC P2P</span>
        </div>
      </div>

      {/* Main Call View Area */}
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        {screenSharer ? (
          /* Spotlight Layout when screen is being shared */
          <div className="w-full h-full flex flex-col md:flex-row gap-4 max-w-7xl">
            {/* Main Spotlight Screen */}
            <div className="flex-1 h-full min-h-[360px]">
              <ParticipantTile
                participant={screenSharer}
                isLocal={screenSharer.userId === user?.id}
                mediaStream={
                  screenSharer.userId === user?.id
                    ? screenStream || localStream
                    : remoteStreams.get(screenSharer.userId)
                }
                isScreenShareSpotlight={true}
              />
            </div>

            {/* Sidebar Strip of other participants */}
            <div className="w-full md:w-64 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto shrink-0">
              {allParticipants
                .filter((p) => p.userId !== screenSharer.userId)
                .map((p) => {
                  const isLocal = p.userId === user?.id;
                  const stream = isLocal ? localStream : remoteStreams.get(p.userId);

                  return (
                    <div key={p.userId} className="h-40 shrink-0">
                      <ParticipantTile
                        participant={p}
                        isLocal={isLocal}
                        mediaStream={stream}
                      />
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          /* Dynamic Grid Layout */
          <div
            className={`w-full h-full grid gap-4 items-center justify-center p-2 ${getGridClass(
              allParticipants.length
            )}`}
          >
            {allParticipants.map((p) => {
              const isLocal = p.userId === user?.id;
              const stream = isLocal ? localStream : remoteStreams.get(p.userId);

              return (
                <div key={p.userId} className="w-full h-full min-h-[220px] aspect-video">
                  <ParticipantTile
                    participant={p}
                    isLocal={isLocal}
                    mediaStream={stream}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Call Floating Controls */}
      <CallControls />
    </div>
  );
};
