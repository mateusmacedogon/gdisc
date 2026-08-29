import React, { useEffect, useState } from 'react';
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
  X,
  Loader2,
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
  const { openModal, closeMobileSidebar, addToast } = useUIStore();
  const { user } = useAuthStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [joiningChannelId, setJoiningChannelId] = useState<string | null>(null);
  const [isServerActionPending, setIsServerActionPending] = useState(false);

  const textChannels = channels.filter((c) => c.type === 'TEXT');
  const voiceChannels = channels.filter((c) => c.type === 'VOICE');

  const isOwner = activeServer && user && activeServer.ownerId === user.id;

  useEffect(() => {
    setIsMenuOpen(false);
  }, [activeServer?.id]);

  const handleVoiceChannelClick = async (channel: ChannelSummary) => {
    if (!activeServer) return;
    if (activeVoiceChannelId === channel.id) {
      // Already in this channel, select it to view the call
      selectChannel(channel.id);
    } else {
      if (joiningChannelId) return;
      setJoiningChannelId(channel.id);
      closeMobileSidebar();
      try {
        await joinVoice(channel.id, activeServer.id);
        selectChannel(channel.id);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Não foi possível entrar na call.';
        addToast(message, 'error');
        const fallbackChannel = textChannels[0];
        selectChannel(fallbackChannel?.id ?? null);
      } finally {
        setJoiningChannelId(null);
      }
    }
    closeMobileSidebar();
  };

  const handleDeleteServer = async () => {
    if (!activeServer || !confirm('Tem certeza que deseja excluir este servidor permanentemente?')) return;
    setIsServerActionPending(true);
    try {
      await deleteServer(activeServer.id);
      closeMobileSidebar();
      addToast('Servidor excluído.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível excluir o servidor.', 'error');
    } finally {
      setIsServerActionPending(false);
    }
  };

  const handleLeaveServer = async () => {
    if (!activeServer || !confirm('Deseja realmente sair deste servidor?')) return;
    setIsServerActionPending(true);
    try {
      await leaveServer(activeServer.id);
      closeMobileSidebar();
      addToast('Você saiu do servidor.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível sair do servidor.', 'error');
    } finally {
      setIsServerActionPending(false);
    }
  };

  const handleTextChannelClick = (channelId: string) => {
    selectChannel(channelId);
    closeMobileSidebar();
  };

  return (
    <aside
      aria-label="Canais do servidor"
      className="gdisc-mobile-navigation min-w-0 w-full h-full bg-gdisc-bg-secondary flex flex-1 flex-col select-none border-r border-gdisc-bg-hover/30 relative md:w-60 md:flex-none"
    >
      {/* Server Header Dropdown */}
      <div className="relative flex h-12 shrink-0 border-b border-gdisc-bg-hover/60">
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          className="min-w-0 h-full px-4 flex flex-1 items-center justify-between font-bold text-sm text-gdisc-text-primary hover:bg-gdisc-bg-hover/50 transition-colors"
        >
          <span className="truncate">{activeServer ? activeServer.name : 'GDisC'}</span>
          <ChevronDown
            className={`w-4 h-4 text-gdisc-text-secondary transition-transform duration-200 ${
              isMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={closeMobileSidebar}
          aria-label="Fechar navegação"
          title="Fechar navegação"
          className="flex min-h-11 min-w-11 items-center justify-center text-gdisc-text-muted hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary md:hidden"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Server Context Menu */}
        {isMenuOpen && activeServer && (
          <>
            <div
              onClick={() => setIsMenuOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 z-30"
            />
            <div
              role="menu"
              className="absolute top-12 left-2 right-2 z-40 bg-gdisc-bg-card border border-gdisc-bg-hover rounded-xl shadow-2xl p-1.5 animate-scale-in"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  closeMobileSidebar();
                  openModal('invite', { serverId: activeServer.id });
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gdisc-brand-secondary hover:bg-gdisc-brand-primary hover:text-white rounded-lg transition-colors"
              >
                <span>Convidar Pessoas</span>
                <UserPlus className="w-4 h-4" />
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  closeMobileSidebar();
                  openModal('server_settings', { serverId: activeServer.id });
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gdisc-text-secondary hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary rounded-lg transition-colors"
              >
                <span>Configurações do Servidor</span>
                <Settings className="w-4 h-4" />
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  closeMobileSidebar();
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
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    void handleDeleteServer();
                  }}
                  disabled={isServerActionPending}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gdisc-danger hover:bg-gdisc-danger/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  <span>Excluir Servidor</span>
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    void handleLeaveServer();
                  }}
                  disabled={isServerActionPending}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gdisc-danger hover:bg-gdisc-danger/10 rounded-lg transition-colors disabled:opacity-50"
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
                type="button"
                onClick={() => {
                  closeMobileSidebar();
                  openModal('channel_settings', { serverId: activeServer.id, initialType: 'TEXT' })
                }}
                title="Criar canal de texto"
                aria-label="Criar canal de texto"
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
                  type="button"
                  onClick={() => handleTextChannelClick(channel.id)}
                  aria-current={isActive ? 'page' : undefined}
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
                type="button"
                onClick={() => {
                  closeMobileSidebar();
                  openModal('channel_settings', { serverId: activeServer.id, initialType: 'VOICE' })
                }}
                title="Criar canal de voz"
                aria-label="Criar canal de voz"
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
                    type="button"
                    onClick={() => void handleVoiceChannelClick(channel)}
                    disabled={joiningChannelId !== null}
                    aria-current={isInThisVoice ? 'page' : undefined}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-all group disabled:cursor-wait disabled:opacity-60 ${
                      isInThisVoice
                        ? 'bg-gdisc-brand-primary/15 text-gdisc-brand-secondary font-semibold'
                        : 'text-gdisc-text-secondary hover:bg-gdisc-bg-hover/60 hover:text-gdisc-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {joiningChannelId === channel.id ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gdisc-brand-secondary" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-gdisc-text-muted group-hover:text-gdisc-text-secondary shrink-0" />
                      )}
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
            type="button"
            onClick={leaveVoice}
            title="Desconectar da chamada"
            aria-label="Desconectar da chamada"
            className="p-1.5 rounded-lg text-gdisc-danger hover:bg-gdisc-danger/10 transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* User Bottom Bar */}
      <UserControlBar />
    </aside>
  );
};
