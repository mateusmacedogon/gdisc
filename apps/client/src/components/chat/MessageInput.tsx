import React, { useEffect, useState, useRef } from 'react';
import { useChatStore } from '../../stores/useChatStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { Loader2, Send, X, CornerDownRight } from 'lucide-react';

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
  const [isSending, setIsSending] = useState(false);
  const { sendMessage, replyingTo, setReplyingTo, sendTyping } = useChatStore();
  const { addToast } = useUIStore();
  const lastTypingSent = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [content]);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || disabled || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(channelId, trimmed, replyingTo?.id);
      setContent('');
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : 'Não foi possível enviar a mensagem.',
        'error'
      );
      textareaRef.current?.focus();
    } finally {
      setIsSending(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    const now = Date.now();
    if (e.target.value.trim() && now - lastTypingSent.current > 2500) {
      sendTyping(channelId);
      lastTypingSent.current = now;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] select-none sm:px-4 sm:pb-4">
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
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancelar resposta"
              title="Cancelar resposta"
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover sm:min-h-8 sm:min-w-8"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end gap-2 px-3.5 py-2.5">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSending}
            maxLength={4000}
            aria-label={`Mensagem para o canal ${channelName}`}
            placeholder={
              disabled
                ? 'Você não possui permissão para enviar mensagens'
                : `Conversar em #${channelName}`
            }
            rows={1}
            className="flex-1 overflow-y-auto bg-transparent border-0 text-base text-gdisc-text-primary placeholder:text-gdisc-text-muted focus:outline-none resize-none max-h-32 min-h-7 py-1 select-text sm:text-sm"
          />

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!content.trim() || disabled || isSending}
            aria-label={isSending ? 'Enviando mensagem' : 'Enviar mensagem'}
            title={isSending ? 'Enviando...' : 'Enviar mensagem'}
            className="flex min-h-11 min-w-11 items-center justify-center bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary disabled:opacity-40 disabled:hover:bg-gdisc-brand-primary text-white rounded-xl transition-all shadow-md shrink-0"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
