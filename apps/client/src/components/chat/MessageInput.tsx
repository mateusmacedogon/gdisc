import React, { useState, useRef } from 'react';
import { useChatStore } from '../../stores/useChatStore.js';
import { Send, X, CornerDownRight } from 'lucide-react';

interface MessageInputProps {
  channelId: string;
  channelName: string;
  disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  channelId,
  channelName,
  disabled = false,
}) => {
  const [content, setContent] = useState('');
  const { sendMessage, replyingTo, setReplyingTo, sendTyping } = useChatStore();
  const lastTypingSent = useRef<number>(0);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    try {
      setContent('');
      await sendMessage(channelId, trimmed, replyingTo?.id);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send typing notification throttled to once every 2.5s
    const now = Date.now();
    if (now - lastTypingSent.current > 2500) {
      sendTyping(channelId);
      lastTypingSent.current = now;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 pb-4 select-none">
      <div className="bg-gdisc-bg-card border border-gdisc-bg-hover rounded-2xl overflow-hidden shadow-lg focus-within:border-gdisc-brand-primary/60 transition-colors">
        {/* Replying Banner */}
        {replyingTo && (
          <div className="flex items-center justify-between px-3.5 py-1.5 bg-gdisc-bg-secondary/70 border-b border-gdisc-bg-hover/60 text-xs text-gdisc-text-secondary animate-fade-in">
            <div className="flex items-center gap-1.5 truncate">
              <CornerDownRight className="w-3.5 h-3.5 text-gdisc-brand-secondary shrink-0" />
              <span>Respondendo a</span>
              <strong className="text-gdisc-text-primary">
                @{replyingTo.author.displayName}
              </strong>
              <span className="truncate italic text-gdisc-text-muted">
                "{replyingTo.content}"
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-0.5 rounded text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end gap-2 px-3.5 py-2.5">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              disabled
                ? 'Você não possui permissão para enviar mensagens'
                : `Conversar em #${channelName}`
            }
            rows={1}
            className="flex-1 bg-transparent border-0 text-sm text-gdisc-text-primary placeholder:text-gdisc-text-muted focus:outline-none resize-none max-h-32 min-h-[24px] py-1 select-text"
          />

          <button
            onClick={handleSend}
            disabled={!content.trim() || disabled}
            className="p-2 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary disabled:opacity-40 disabled:hover:bg-gdisc-brand-primary text-white rounded-xl transition-all shadow-md shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
