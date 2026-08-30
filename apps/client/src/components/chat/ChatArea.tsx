import React, { useEffect, useRef } from 'react';
import { useChannelStore } from '../../stores/useChannelStore.js';
import { useChatStore } from '../../stores/useChatStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useServerStore } from '../../stores/useServerStore.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { MessageItem } from './MessageItem.js';
import { MessageInput } from './MessageInput.js';
import { Compass, Hash, Loader2, MessageSquare, Plus, Radio, RefreshCw, Users, Download } from 'lucide-react';
import { PermissionFlags, hasPermission } from '@gdisc/shared';
import { isWeb } from '../../utils/platform.js';

export const ChatArea: React.FC = () => {
  const { activeChannel, isLoading: channelsLoading } = useChannelStore();
  const {
    activeServer,
    members,
    servers,
    isLoading: serversLoading,
    error: serverError,
    fetchServers,
    selectServer,
  } = useServerStore();
  const { user } = useAuthStore();
  const { messages, typingUsers, isLoading: messagesLoading, cleanExpiredTyping } = useChatStore();
  const {
    isMemberListOpen,
    isMobileMemberListOpen,
    toggleMemberList,
    toggleMobileMemberList,
    openModal,
  } = useUIStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelMessages = activeChannel ? messages[activeChannel.id] || [] : [];
  const channelTyping = activeChannel ? typingUsers[activeChannel.id] || {} : {};
  const currentMember = members.find((member) => member.userId === user?.id);
  const canManageMessages = Boolean(
    user && activeServer && (
      activeServer.ownerId === user.id ||
      currentMember?.roles.some((role) =>
        hasPermission(role.permissions, PermissionFlags.MANAGE_MESSAGES)
      )
    ),
  );

  // Clean typing indicators periodically
  useEffect(() => {
    const interval = setInterval(() => {
      cleanExpiredTyping();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  if (!activeChannel) {
    const isLoading = (serversLoading && servers.length === 0) || (Boolean(activeServer) && channelsLoading);
    const isOwner = Boolean(user && activeServer?.ownerId === user.id);

    return (
      <div className="flex-1 min-w-0 h-full overflow-y-auto bg-gdisc-bg-primary p-5 pt-20 text-center select-none sm:p-8 sm:pt-20 md:pt-8">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center">
          {isLoading ? (
            <>
              <Loader2 className="mb-4 h-9 w-9 animate-spin text-gdisc-brand-secondary" />
              <h2 className="text-lg font-bold text-gdisc-text-primary">Carregando seus servidores...</h2>
              <p className="mt-1 text-sm text-gdisc-text-muted">Isso deve levar apenas alguns segundos.</p>
            </>
          ) : serverError && servers.length === 0 ? (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-gdisc-danger/30 bg-gdisc-danger/10 text-gdisc-danger">
                <RefreshCw className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-gdisc-text-primary">Não foi possível carregar o GDisC</h2>
              <p role="alert" className="mt-2 max-w-md text-sm leading-relaxed text-gdisc-text-muted">{serverError}</p>
              <button
                type="button"
                onClick={() => void fetchServers()}
                className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-gdisc-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-gdisc-brand-secondary"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </button>
            </>
          ) : activeServer ? (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-gdisc-bg-hover bg-gdisc-bg-card text-gdisc-brand-secondary shadow-gdisc-subtle">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-gdisc-text-primary">{activeServer.name} ainda não tem canais</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-gdisc-text-muted">
                {isOwner
                  ? 'Crie um canal de texto ou voz para começar a conversar.'
                  : 'Peça ao proprietário para criar um canal para a comunidade.'}
              </p>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => openModal('channel_settings', { serverId: activeServer.id })}
                  className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-gdisc-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-gdisc-brand-secondary"
                >
                  <Plus className="h-4 w-4" />
                  Criar primeiro canal
                </button>
              )}
            </>
          ) : (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-gdisc-brand-primary to-gdisc-brand-secondary text-white shadow-gdisc-glow">
                <Radio className="h-8 w-8" />
              </div>
              <h1 className="text-2xl font-extrabold text-gdisc-text-primary">Bem-vindo ao GDisC</h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-gdisc-text-muted">
                Crie uma comunidade ou entre com o convite de um amigo para conversar por texto, voz, câmera e compartilhamento de tela.
              </p>
              <div className="mt-5 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => openModal('create_server')}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gdisc-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-gdisc-brand-secondary"
                >
                  <Plus className="h-4 w-4" />
                  Criar servidor
                </button>
                <button
                  type="button"
                  onClick={() => openModal('join_invite')}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-gdisc-bg-hover bg-gdisc-bg-card px-5 py-2.5 text-sm font-semibold text-gdisc-text-primary hover:bg-gdisc-bg-hover"
                >
                  <Compass className="h-4 w-4" />
                  Usar convite
                </button>
              </div>
              {servers.length > 0 && (
                <div className="mt-8 w-full border-t border-gdisc-bg-hover/60 pt-6 text-left">
                  <h2 className="mb-3 text-sm font-semibold text-gdisc-text-secondary">Seus servidores</h2>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {servers.map((server) => (
                      <button
                        key={server.id}
                        type="button"
                        onClick={() => void selectServer(server.id)}
                        className="flex min-h-12 items-center gap-3 rounded-xl border border-gdisc-bg-hover bg-gdisc-bg-card px-4 py-3 text-left hover:border-gdisc-brand-primary/50 hover:bg-gdisc-bg-hover"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gdisc-brand-primary/15 font-bold text-gdisc-brand-secondary">
                          {server.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gdisc-text-primary">{server.name}</span>
                        <span className="text-xs text-gdisc-text-muted">{server.memberCount}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Format typing users text
  const typingNames = Object.values(channelTyping).map((t) => t.displayName);
  let typingText = '';
  if (typingNames.length === 1) {
    typingText = `${typingNames[0]} está digitando...`;
  } else if (typingNames.length === 2) {
    typingText = `${typingNames[0]} e ${typingNames[1]} estão digitando...`;
  } else if (typingNames.length > 2) {
    typingText = 'Várias pessoas estão digitando...';
  }

  return (
    <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col bg-gdisc-bg-primary overflow-hidden">
      {/* Header */}
      <div className="h-12 pl-14 pr-2 border-b border-gdisc-bg-hover/60 flex items-center justify-between select-none shrink-0 bg-gdisc-bg-primary/95 sm:pr-4 md:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="w-5 h-5 text-gdisc-text-muted shrink-0" />
          <h2 className="text-sm font-bold text-gdisc-text-primary truncate">
            {activeChannel.name}
          </h2>
          {activeChannel.topic && (
            <>
              <span className="w-1 h-1 rounded-full bg-gdisc-bg-hover shrink-0" />
              <p className="text-xs text-gdisc-text-muted truncate max-w-md hidden sm:block">
                {activeChannel.topic}
              </p>
            </>
          )}
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1">
          {isWeb && (
            <button
              type="button"
              onClick={() => openModal('download_apps')}
              title="Baixar Aplicativo GDisC (Windows / Android)"
              aria-label="Baixar Aplicativo GDisC"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gdisc-brand-primary/10 hover:bg-gdisc-brand-primary/20 text-gdisc-brand-secondary text-xs font-semibold transition-colors mr-1 border border-gdisc-brand-primary/20 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar App</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleMobileMemberList}
            title={isMobileMemberListOpen ? 'Ocultar Membros' : 'Exibir Membros'}
            aria-label={isMobileMemberListOpen ? 'Ocultar membros' : 'Exibir membros'}
            aria-controls="mobile-members-drawer"
            aria-expanded={isMobileMemberListOpen}
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors lg:hidden ${
              isMobileMemberListOpen
                ? 'text-gdisc-brand-secondary bg-gdisc-bg-card'
                : 'text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover'
            }`}
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleMemberList}
            title={isMemberListOpen ? 'Ocultar Membros' : 'Exibir Membros'}
            aria-label={isMemberListOpen ? 'Ocultar membros' : 'Exibir membros'}
            aria-controls="desktop-members-sidebar"
            aria-expanded={isMemberListOpen}
            className={`hidden min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors lg:flex ${
              isMemberListOpen
                ? 'text-gdisc-brand-secondary bg-gdisc-bg-card'
                : 'text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover'
            }`}
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-1 py-4 space-y-1 sm:px-2">
        {/* Welcome Channel Banner */}
        <div className="px-3 py-6 mb-4 border-b border-gdisc-bg-hover/40 sm:px-4 sm:py-8">
          <div className="w-14 h-14 rounded-2xl bg-gdisc-bg-card border border-gdisc-bg-hover flex items-center justify-center text-gdisc-brand-secondary mb-3">
            <Hash className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-gdisc-text-primary break-words sm:text-2xl">
            Bem-vindo a #{activeChannel.name}!
          </h1>
          <p className="text-xs text-gdisc-text-muted mt-1">
            Este é o início do canal #{activeChannel.name}.
          </p>
        </div>

        {/* Message Items List */}
        {messagesLoading && channelMessages.length === 0 && (
          <div role="status" className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-gdisc-text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-gdisc-brand-secondary" />
            Carregando mensagens...
          </div>
        )}
        {channelMessages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            canManageMessages={canManageMessages}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator Bar */}
      <div className="h-5 min-w-0 px-4 text-[11px] text-gdisc-brand-secondary font-medium select-none shrink-0 flex items-center sm:px-5">
        {typingText && (
          <span className="animate-fade-in flex min-w-0 items-center gap-1.5 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gdisc-brand-secondary animate-pulse" />
            {typingText}
          </span>
        )}
      </div>

      {/* Message Input */}
      <div className="gdisc-message-composer shrink-0">
        <MessageInput
          channelId={activeChannel.id}
          channelName={activeChannel.name}
        />
      </div>
    </div>
  );
};
