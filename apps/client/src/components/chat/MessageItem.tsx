import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useChatStore } from '../../stores/useChatStore.js';
import { Avatar } from '../common/Avatar.js';
import { Reply, Edit3, Trash2, Check, X, CornerDownRight } from 'lucide-react';
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

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isAuthor = user?.id === message.authorId;
  const canDelete = isAuthor || canManageMessages;

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await editMessage(message.id, editContent);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save edit:', err);
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
        <div className="flex-1 min-w-0">
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
              {message.content}
            </div>
          )}
        </div>

        {/* Action Toolbar on Hover */}
        {!isEditing && (
          <div className="absolute right-4 -top-3 hidden group-hover:flex items-center bg-gdisc-bg-card border border-gdisc-bg-hover rounded-lg shadow-lg p-0.5 z-10 animate-fade-in">
            <button
              onClick={() => setReplyingTo(message)}
              title="Responder mensagem"
              className="p-1.5 text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover rounded-md transition-colors"
            >
              <Reply className="w-4 h-4" />
            </button>

            {isAuthor && (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setEditContent(message.content);
                }}
                title="Editar mensagem"
                className="p-1.5 text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover rounded-md transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => {
                  if (confirm('Deseja realmente apagar esta mensagem?')) {
                    deleteMessage(message.id);
                  }
                }}
                title="Excluir mensagem"
                className="p-1.5 text-gdisc-text-muted hover:text-gdisc-danger hover:bg-gdisc-danger/10 rounded-md transition-colors"
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
