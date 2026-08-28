import React, { useEffect, useRef } from 'react';
import { useChannelStore } from '../../stores/useChannelStore.js';
import { useChatStore } from '../../stores/useChatStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { MessageItem } from './MessageItem.js';
import { MessageInput } from './MessageInput.js';
import { Hash, Users, MessageSquare } from 'lucide-react';

export const ChatArea: React.FC = () => {
  const { activeChannel } = useChannelStore();
  const { messages, typingUsers, fetchMessages, cleanExpiredTyping } = useChatStore();
  const { isMemberListOpen, toggleMemberList } = useUIStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelMessages = activeChannel ? messages[activeChannel.id] || [] : [];
  const channelTyping = activeChannel ? typingUsers[activeChannel.id] || {} : {};

  // Fetch channel messages on channel switch
  useEffect(() => {
    if (activeChannel && activeChannel.type === 'TEXT') {
      fetchMessages(activeChannel.id);
    }
  }, [activeChannel?.id]);

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
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center text-center p-6 bg-gdisc-bg-primary select-none">
        <div className="w-16 h-16 rounded-3xl bg-gdisc-bg-card border border-gdisc-bg-hover flex items-center justify-center text-gdisc-brand-secondary mb-4 shadow-gdisc-subtle">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gdisc-text-primary">Nenhum canal selecionado</h3>
        <p className="text-xs text-gdisc-text-muted mt-1 max-w-sm">
          Escolha um canal de texto ou voz na barra lateral para começar a conversar ou participar de chamadas.
        </p>
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
    <div className="flex-1 h-full flex flex-col bg-gdisc-bg-primary overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 border-b border-gdisc-bg-hover/60 flex items-center justify-between select-none shrink-0 bg-gdisc-bg-primary/95">
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
          <button
            onClick={toggleMemberList}
            title={isMemberListOpen ? 'Ocultar Membros' : 'Exibir Membros'}
            className={`p-1.5 rounded-lg transition-colors ${
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
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {/* Welcome Channel Banner */}
        <div className="px-4 py-8 mb-4 border-b border-gdisc-bg-hover/40">
          <div className="w-14 h-14 rounded-2xl bg-gdisc-bg-card border border-gdisc-bg-hover flex items-center justify-center text-gdisc-brand-secondary mb-3">
            <Hash className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-gdisc-text-primary">
            Bem-vindo a #{activeChannel.name}!
          </h1>
          <p className="text-xs text-gdisc-text-muted mt-1">
            Este é o início do canal #{activeChannel.name}.
          </p>
        </div>

        {/* Message Items List */}
        {channelMessages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator Bar */}
      <div className="h-5 px-5 text-[11px] text-gdisc-brand-secondary font-medium select-none shrink-0 flex items-center">
        {typingText && (
          <span className="animate-fade-in flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gdisc-brand-secondary animate-pulse" />
            {typingText}
          </span>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        channelId={activeChannel.id}
        channelName={activeChannel.name}
      />
    </div>
  );
};
