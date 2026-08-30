import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useChatStore } from '../../stores/useChatStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { Avatar } from '../common/Avatar.js';
import { MarkdownContent } from './MarkdownContent.js';
import { Reply, Edit3, Trash2, CornerDownRight, MoreHorizontal } from 'lucide-react';
import type { MessageSummary } from '@gdisc/shared';

interface MessageItemProps {
  message: MessageSummary;
  canManageMessages?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  canManageMessages = false,
}) => {
  const { user } = useAuthStore();
  const { setReplyingTo, editMessage, deleteMessage } = useChatStore();
  const { addToast } = useUIStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const isAuthor = user?.id === message.authorId;
  const canDelete = isAuthor || canManageMessages;

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await editMessage(message.id, editContent);
      setIsEditing(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Não foi possível editar a mensagem.', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Deseja realmente apagar esta mensagem?')) return;

    setIsDeleting(true);
    try {
      await deleteMessage(message.id);
      setIsActionsOpen(false);
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : 'Não foi possível apagar a mensagem.',
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Hoje às ${time}`;
    }
    return `${date.toLocaleDateString()} às ${time}`;
  };

  return (
    <div className="relative group flex flex-col px-4 py-1.5 hover:bg-gdisc-bg-hover/30 rounded-lg transition-colors">
      {/* Reply Banner if applicable */}
      {message.replyTo && (
        <div className="flex items-center gap-1.5 text-xs text-gdisc-text-muted mb-1 pl-6">
          <CornerDownRight className="w-3.5 h-3.5 text-gdisc-text-muted shrink-0" />
          <span className="font-semibold text-gdisc-text-secondary">
            @{message.replyTo.author.displayName}
          </span>
          <span className="truncate max-w-md italic">{message.replyTo.content}</span>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Author Avatar */}
        <Avatar
          src={message.author.avatarUrl}
          name={message.author.displayName}
          size="md"
          status={message.author.status}
          className="mt-0.5"
        />

        {/* Message Content */}
        <div className="flex-1 min-w-0 pr-11 sm:pr-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gdisc-text-primary hover:underline cursor-pointer">
              {message.author.displayName}
            </span>
            <span className="text-[11px] text-gdisc-text-muted">
              {formatTimestamp(message.createdAt)}
            </span>
            {message.isEdited && (
              <span className="text-[10px] text-gdisc-text-muted italic">(editado)</span>
            )}
          </div>

          {isEditing ? (
            <div className="mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                autoFocus
                className="w-full p-2 bg-gdisc-bg-primary border border-gdisc-brand-primary rounded-lg text-sm text-gdisc-text-primary focus:outline-none resize-none"
              />
              <div className="flex items-center gap-2 mt-1 text-xs text-gdisc-text-muted">
                <span>
                  ESC para <button onClick={() => setIsEditing(false)} className="text-gdisc-brand-secondary hover:underline">cancelar</button> • Enter para <button onClick={handleSaveEdit} className="text-gdisc-success hover:underline">salvar</button>
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gdisc-text-primary whitespace-pre-wrap break-words leading-relaxed select-text">
              <MarkdownContent content={message.content} />
            </div>
          )}
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsActionsOpen((open) => !open)}
            aria-label={isActionsOpen ? 'Fechar ações da mensagem' : 'Abrir ações da mensagem'}
            aria-expanded={isActionsOpen}
            title="Ações da mensagem"
            className="absolute right-2 top-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gdisc-text-muted hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary sm:hidden"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}

        {/* Compact menu on touch; hover-revealed toolbar on larger screens. */}
        {!isEditing && (
          <div className={`absolute right-2 top-12 z-20 items-center rounded-lg border border-gdisc-bg-hover bg-gdisc-bg-card p-0.5 shadow-lg animate-fade-in sm:right-4 sm:-top-3 sm:hidden sm:group-hover:flex sm:group-focus-within:flex ${isActionsOpen ? 'flex' : 'hidden'}`}>
            <button
              type="button"
              onClick={() => {
                setReplyingTo(message);
                setIsActionsOpen(false);
              }}
              aria-label="Responder mensagem"
              title="Responder mensagem"
              className="flex min-h-11 min-w-11 items-center justify-center text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover rounded-md transition-colors sm:min-h-9 sm:min-w-9"
            >
              <Reply className="w-4 h-4" />
            </button>

            {isAuthor && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(true);
                  setEditContent(message.content);
                  setIsActionsOpen(false);
                }}
                aria-label="Editar mensagem"
                title="Editar mensagem"
                className="flex min-h-11 min-w-11 items-center justify-center text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover rounded-md transition-colors sm:min-h-9 sm:min-w-9"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                aria-label="Excluir mensagem"
                title="Excluir mensagem"
                className="flex min-h-11 min-w-11 items-center justify-center text-gdisc-text-muted hover:text-gdisc-danger hover:bg-gdisc-danger/10 rounded-md transition-colors disabled:cursor-wait disabled:opacity-50 sm:min-h-9 sm:min-w-9"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
