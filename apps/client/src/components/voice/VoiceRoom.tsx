import React from 'react';
import { useChannelStore } from '../../stores/useChannelStore.js';
import { useVoiceStore } from '../../stores/useVoiceStore.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { ParticipantTile } from './ParticipantTile.js';
import { CallControls } from './CallControls.js';
import { Loader2, RefreshCw, ShieldCheck, Signal, SignalLow, Volume2, Users, WifiOff } from 'lucide-react';
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
    selectedAudioOutputId,
    connectionSnapshot,
    retryConnections,
  } = useVoiceStore();

  const connectionLabel = connectionSnapshot.status === 'connected'
    ? connectionSnapshot.quality === 'excellent' ? 'Conexão excelente' : 'Conectado'
    : connectionSnapshot.status === 'poor'
      ? 'Conexão instável'
      : connectionSnapshot.status === 'failed'
        ? 'Falha na mídia'
        : connectionSnapshot.status === 'reconnecting'
          ? 'Reconectando mídia…'
          : 'Conectando mídia…';
  const ConnectionIcon = connectionSnapshot.status === 'failed'
    ? WifiOff
    : connectionSnapshot.status === 'reconnecting' || connectionSnapshot.status === 'connecting'
      ? Loader2
      : connectionSnapshot.status === 'poor' ? SignalLow : Signal;
  const needsRetry = ['poor', 'failed', 'reconnecting'].includes(connectionSnapshot.status);

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
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2 max-w-4xl';
    if (count <= 4) return 'grid-cols-1 sm:grid-cols-2 max-w-5xl';
    if (count <= 6) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl';
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

        <div className="flex items-center gap-1.5">
          <div
            className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs sm:flex ${
              connectionSnapshot.status === 'failed' || connectionSnapshot.status === 'poor'
                ? 'border-gdisc-danger/40 bg-gdisc-danger/10 text-gdisc-danger'
                : 'border-gdisc-bg-hover bg-gdisc-bg-card text-gdisc-text-muted'
            }`}
            title={`${connectionSnapshot.connectedPeers}/${connectionSnapshot.peerCount} pares conectados${connectionSnapshot.roundTripTimeMs ? ` • ${connectionSnapshot.roundTripTimeMs} ms` : ''}${connectionSnapshot.packetLossPercent !== undefined ? ` • ${connectionSnapshot.packetLossPercent}% de perda` : ''}`}
            role="status"
            aria-live="polite"
          >
            <ConnectionIcon className={`h-3.5 w-3.5 ${connectionSnapshot.status === 'connecting' || connectionSnapshot.status === 'reconnecting' ? 'animate-spin' : ''}`} />
            <span>{connectionLabel}</span>
            {connectionSnapshot.usingTurn && <ShieldCheck className="h-3.5 w-3.5 text-gdisc-success" aria-label="Conexão protegida por relay TURN" />}
          </div>
          {needsRetry && (
            <button
              type="button"
              onClick={() => void retryConnections()}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-gdisc-bg-hover bg-gdisc-bg-card text-gdisc-text-muted transition-colors hover:text-white"
              aria-label="Tentar reconectar a mídia"
              title="Tentar reconectar áudio e vídeo"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="hidden items-center gap-1.5 rounded-lg border border-gdisc-bg-hover bg-gdisc-bg-card px-2.5 py-1 text-xs text-gdisc-text-muted md:flex">
            <Users className="w-3.5 h-3.5 text-gdisc-brand-secondary" />
            <span>WebRTC P2P</span>
          </div>
        </div>
      </div>

      {/* Main Call View Area */}
      <div className="flex-1 overflow-y-auto p-2 flex items-center justify-center sm:p-4">
        {screenSharer ? (
          /* Spotlight Layout when screen is being shared */
          <div className="w-full h-full flex flex-col md:flex-row gap-4 max-w-7xl">
            {/* Main Spotlight Screen */}
            <div className="min-h-[220px] flex-1 sm:min-h-[360px]">
              <ParticipantTile
                participant={screenSharer}
                isLocal={screenSharer.userId === user?.id}
                mediaStream={
                  screenSharer.userId === user?.id
                    ? screenStream || localStream
                    : remoteStreams.get(screenSharer.userId)
                }
                isScreenShareSpotlight={true}
                muteAudio={isDeafened}
                audioOutputDeviceId={selectedAudioOutputId}
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
                    <div key={p.userId} className="h-40 w-56 shrink-0 md:w-full">
                      <ParticipantTile
                        participant={p}
                        isLocal={isLocal}
                        mediaStream={stream}
                        muteAudio={isDeafened}
                        audioOutputDeviceId={selectedAudioOutputId}
                      />
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          /* Dynamic Grid Layout */
          <div
            className={`w-full h-full grid gap-3 items-center justify-center sm:gap-4 sm:p-2 ${getGridClass(
              allParticipants.length
            )}`}
          >
            {allParticipants.map((p) => {
              const isLocal = p.userId === user?.id;
              const stream = isLocal ? localStream : remoteStreams.get(p.userId);

              return (
                <div key={p.userId} className="w-full h-full min-h-[200px] aspect-video sm:min-h-[220px]">
                  <ParticipantTile
                    participant={p}
                    isLocal={isLocal}
                    mediaStream={stream}
                    muteAudio={isDeafened}
                    audioOutputDeviceId={selectedAudioOutputId}
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
