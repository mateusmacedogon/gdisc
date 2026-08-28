import React from 'react';
import { useServerStore } from '../../stores/useServerStore.js';
import { Avatar } from '../common/Avatar.js';
import { Shield } from 'lucide-react';

export const MemberSidebar: React.FC = () => {
  const { members, activeServer } = useServerStore();

  if (!activeServer) return null;

  const onlineMembers = members.filter((m) => m.user.status !== 'OFFLINE');
  const offlineMembers = members.filter((m) => m.user.status === 'OFFLINE');

  const renderMember = (m: (typeof members)[0]) => {
    const highestRole = m.roles.length > 0 ? m.roles[0] : null;

    return (
      <div
        key={m.id}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-gdisc-bg-card/70 cursor-pointer transition-colors group"
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
              className="text-xs font-semibold truncate group-hover:text-gdisc-text-primary transition-colors"
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
            <div className="text-[10px] text-gdisc-text-muted truncate">
              {m.user.customStatus}
            </div>
          ) : (
            <div className="text-[10px] text-gdisc-text-muted truncate">
              @{m.user.username}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-56 h-full bg-gdisc-bg-secondary flex flex-col select-none shrink-0 border-l border-gdisc-bg-hover/30 overflow-y-auto p-3">
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
