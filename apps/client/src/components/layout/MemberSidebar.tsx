import React, { useState } from 'react';
import { useServerStore } from '../../stores/useServerStore.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { Avatar } from '../common/Avatar.js';
import { Shield, UserMinus } from 'lucide-react';

export const MemberSidebar: React.FC = () => {
  const { members, activeServer, kickMember } = useServerStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);

  if (!activeServer) return null;

  const onlineMembers = members.filter((m) => m.user.status !== 'OFFLINE');
  const offlineMembers = members.filter((m) => m.user.status === 'OFFLINE');

  const renderMember = (m: (typeof members)[0]) => {
    const highestRole = m.roles.length > 0 ? m.roles[0] : null;
    const canKick = user?.id === activeServer.ownerId && m.userId !== activeServer.ownerId;

    const handleKick = async () => {
      const displayName = m.nickname || m.user.displayName;
      if (!confirm(`Expulsar ${displayName} deste servidor?`)) return;
      setKickingMemberId(m.id);
      try {
        await kickMember(activeServer.id, m.id, m.userId);
        addToast(`${displayName} foi expulso do servidor.`, 'success');
      } catch (error) {
        addToast(error instanceof Error ? error.message : 'Não foi possível expulsar o membro.', 'error');
      } finally {
        setKickingMemberId(null);
      }
    };

    return (
      <div
        key={m.id}
        className="flex min-h-11 items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-gdisc-bg-card/70 cursor-default transition-colors group lg:min-h-0"
      >
        <Avatar
          src={m.user.avatarUrl}
          name={m.nickname || m.user.displayName}
          size="sm"
          status={m.user.status}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              style={{ color: highestRole?.color || undefined }}
              className="text-sm font-semibold truncate group-hover:text-gdisc-text-primary transition-colors"
            >
              {m.nickname || m.user.displayName}
            </span>
            {m.userId === activeServer.ownerId && (
              <span title="Proprietário do Servidor">
                <Shield className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400/20" />
              </span>
            )}
          </div>
          {m.user.customStatus ? (
            <div className="text-xs text-gdisc-text-muted truncate">
              {m.user.customStatus}
            </div>
          ) : (
            <div className="text-xs text-gdisc-text-muted truncate">
              @{m.user.username}
            </div>
          )}
        </div>
        {canKick && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleKick();
            }}
            disabled={kickingMemberId === m.id}
            aria-label={`Expulsar ${m.nickname || m.user.displayName}`}
            title="Expulsar membro"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-gdisc-text-muted transition-colors hover:bg-gdisc-danger/10 hover:text-gdisc-danger disabled:cursor-wait disabled:opacity-50 sm:min-h-9 sm:min-w-9 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          >
            <UserMinus className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <aside
      aria-label="Membros do servidor"
      className="gdisc-member-sidebar w-full min-w-0 h-full bg-gdisc-bg-secondary flex flex-col select-none border-l border-gdisc-bg-hover/30 overflow-y-auto overscroll-contain p-3 pt-14 lg:w-56 lg:shrink-0 lg:pt-3"
    >
      {/* Online Category */}
      <div className="mb-4">
        <div className="px-2 mb-1.5 text-[11px] font-bold text-gdisc-text-muted uppercase tracking-wider">
          Online — {onlineMembers.length}
        </div>
        <div className="space-y-0.5">
          {onlineMembers.map(renderMember)}
        </div>
      </div>

      {/* Offline Category */}
      {offlineMembers.length > 0 && (
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-bold text-gdisc-text-muted uppercase tracking-wider">
            Offline — {offlineMembers.length}
          </div>
          <div className="space-y-0.5 opacity-70">
            {offlineMembers.map(renderMember)}
          </div>
        </div>
      )}
    </aside>
  );
};
