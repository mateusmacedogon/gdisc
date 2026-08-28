import React, { useState } from 'react';
import { useServerStore } from '../../stores/useServerStore.js';
import { useChannelStore } from '../../stores/useChannelStore.js';
import { useVoiceStore } from '../../stores/useVoiceStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { UserControlBar } from './UserControlBar.js';
import { Avatar } from '../common/Avatar.js';
import {
  Hash,
  Volume2,
  ChevronDown,
  Plus,
  Settings,
  UserPlus,
  LogOut,
  PhoneOff,
  MicOff,
  Video,
  Monitor,
} from 'lucide-react';
import type { ChannelSummary } from '@gdisc/shared';

export const ChannelSidebar: React.FC = () => {
  const { activeServer, deleteServer, leaveServer } = useServerStore();
  const { channels, activeChannelId, selectChannel } = useChannelStore();
  const {
    activeVoiceChannelId,
    voiceStates,
    joinVoice,
    leaveVoice,
  } = useVoiceStore();
  const { openModal } = useUIStore();
  const { user } = useAuthStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const textChannels = channels.filter((c) => c.type === 'TEXT');
  const voiceChannels = channels.filter((c) => c.type === 'VOICE');

  const isOwner = activeServer && user && activeServer.ownerId === user.id;

  const handleVoiceChannelClick = (channel: ChannelSummary) => {
    if (!activeServer) return;
    if (activeVoiceChannelId === channel.id) {
      // Already in this channel, select it to view the call
      selectChannel(channel.id);
    } else {
      joinVoice(channel.id, activeServer.id);
      selectChannel(channel.id);
    }
  };

  return (
    <div className="w-60 h-full bg-gdisc-bg-secondary flex flex-col select-none shrink-0 border-r border-gdisc-bg-hover/30 relative">
      {/* Server Header Dropdown */}
      <div className="relative border-b border-gdisc-bg-hover/60">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-full h-12 px-4 flex items-center justify-between font-bold text-sm text-gdisc-text-primary hover:bg-gdisc-bg-hover/50 transition-colors"
        >
          <span className="truncate">{activeServer ? activeServer.name : 'GDisC'}</span>
          <ChevronDown
            className={`w-4 h-4 text-gdisc-text-secondary transition-transform duration-200 ${
              isMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Server Context Menu */}
        {isMenuOpen && activeServer && (
          <>
            <div
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-30"
            />
            <div className="absolute top-13 left-2 right-2 z-40 bg-gdisc-bg-card border border-gdisc-bg-hover rounded-xl shadow-2xl p-1.5 animate-scale-in">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  openModal('invite', { serverId: activeServer.id });
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gdisc-brand-secondary hover:bg-gdisc-brand-primary hover:text-white rounded-lg transition-colors"
              >
                <span>Convidar Pessoas</span>
                <UserPlus className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  openModal('server_settings', { serverId: activeServer.id });
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gdisc-text-secondary hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary rounded-lg transition-colors"
              >
                <span>Configurações do Servidor</span>
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  openModal('channel_settings', { serverId: activeServer.id });
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gdisc-text-secondary hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary rounded-lg transition-colors"
              >
                <span>Criar Canal</span>
                <Plus className="w-4 h-4" />
              </button>

              <div className="my-1 border-t border-gdisc-bg-hover" />

              {isOwner ? (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (confirm('Tem certeza que deseja excluir este servidor permanentemente?')) {
                      deleteServer(activeServer.id);
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gdisc-danger hover:bg-gdisc-danger/10 rounded-lg transition-colors"
                >
                  <span>Excluir Servidor</span>
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (confirm('Deseja realmente sair deste servidor?')) {
                      leaveServer(activeServer.id);
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gdisc-danger hover:bg-gdisc-danger/10 rounded-lg transition-colors"
                >
                  <span>Sair do Servidor</span>
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Channel Categories & Lists */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Text Channels Category */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1 text-[11px] font-bold text-gdisc-text-muted uppercase tracking-wider">
            <span>Canais de Texto</span>
            {activeServer && (
              <button
                onClick={() =>
                  openModal('channel_settings', { serverId: activeServer.id, initialType: 'TEXT' })
                }
                title="Criar canal de texto"
                className="hover:text-gdisc-text-primary p-0.5 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {textChannels.map((channel) => {
              const isActive = activeChannelId === channel.id;

              return (
                <button
                  key={channel.id}
                  onClick={() => selectChannel(channel.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all group ${
                    isActive
                      ? 'bg-gdisc-bg-card font-semibold text-gdisc-text-primary shadow-sm'
                      : 'text-gdisc-text-secondary hover:bg-gdisc-bg-hover/60 hover:text-gdisc-text-primary'
                  }`}
                >
                  <Hash className="w-4 h-4 text-gdisc-text-muted group-hover:text-gdisc-text-secondary" />
                  <span className="truncate">{channel.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Channels Category */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1 text-[11px] font-bold text-gdisc-text-muted uppercase tracking-wider">
            <span>Canais de Voz</span>
            {activeServer && (
              <button
                onClick={() =>
                  openModal('channel_settings', { serverId: activeServer.id, initialType: 'VOICE' })
                }
                title="Criar canal de voz"
                className="hover:text-gdisc-text-primary p-0.5 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {voiceChannels.map((channel) => {
              const isInThisVoice = activeVoiceChannelId === channel.id;
              const participants = voiceStates[channel.id] || [];

              return (
                <div key={channel.id} className="space-y-0.5">
                  <button
                    onClick={() => handleVoiceChannelClick(channel)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-all group ${
                      isInThisVoice
                        ? 'bg-gdisc-brand-primary/15 text-gdisc-brand-secondary font-semibold'
                        : 'text-gdisc-text-secondary hover:bg-gdisc-bg-hover/60 hover:text-gdisc-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Volume2 className="w-4 h-4 text-gdisc-text-muted group-hover:text-gdisc-text-secondary shrink-0" />
                      <span className="truncate">{channel.name}</span>
                    </div>

                    {participants.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gdisc-bg-card font-mono text-gdisc-text-muted">
                        {participants.length}
                      </span>
                    )}
                  </button>

                  {/* Connected Voice Participants list below channel */}
                  {participants.length > 0 && (
                    <div className="pl-6 pr-2 py-0.5 space-y-1">
                      {participants.map((p) => (
                        <div
                          key={p.userId}
                          className="flex items-center justify-between py-1 text-xs text-gdisc-text-secondary"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar
                              src={p.user.avatarUrl}
                              name={p.user.displayName}
                              size="xs"
                              isSpeaking={p.isSpeaking}
                            />
                            <span className="truncate text-xs">{p.user.displayName}</span>
                          </div>

                          <div className="flex items-center gap-1 text-gdisc-text-muted">
                            {p.selfMute && <MicOff className="w-3 h-3 text-gdisc-danger" />}
                            {p.selfVideo && <Video className="w-3 h-3 text-gdisc-brand-secondary" />}
                            {p.selfScreen && <Monitor className="w-3 h-3 text-gdisc-success" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Voice Status Pill if active */}
      {activeVoiceChannelId && (
        <div className="p-2.5 bg-gdisc-bg-card border-t border-gdisc-bg-hover/60 flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gdisc-success animate-pulse" />
            <div>
              <div className="font-semibold text-gdisc-success">Voz Conectada</div>
              <div className="text-[10px] text-gdisc-text-muted">WebRTC Mesh P2P</div>
            </div>
          </div>
          <button
            onClick={leaveVoice}
            title="Desconectar da chamada"
            className="p-1.5 rounded-lg text-gdisc-danger hover:bg-gdisc-danger/10 transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* User Bottom Bar */}
      <UserControlBar />
    </div>
  );
};
