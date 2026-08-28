import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useVoiceStore } from '../../stores/useVoiceStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { Avatar } from '../common/Avatar.js';
import {
  Mic,
  MicOff,
  Headphones,
  Settings,
  Circle,
  LogOut,
} from 'lucide-react';
import type { UserStatus } from '@gdisc/shared';

export const UserControlBar: React.FC = () => {
  const { user, setStatus, logout } = useAuthStore();
  const { isMuted, isDeafened, isSpeaking, toggleMute, toggleDeaf } = useVoiceStore();
  const { openModal } = useUIStore();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  if (!user) return null;

  const statuses: Array<{ value: UserStatus; label: string; color: string }> = [
    { value: 'ONLINE', label: 'Online', color: 'text-gdisc-status-online' },
    { value: 'IDLE', label: 'Ausente', color: 'text-gdisc-status-idle' },
    { value: 'DND', label: 'Não Perturbe', color: 'text-gdisc-status-dnd' },
    { value: 'OFFLINE', label: 'Invisível', color: 'text-gdisc-status-offline' },
  ];

  return (
    <div className="relative h-14 bg-gdisc-bg-primary/95 border-t border-gdisc-bg-hover/40 px-2.5 flex items-center justify-between select-none">
      {/* User Info & Status Trigger */}
      <div
        onClick={() => setShowStatusMenu(!showStatusMenu)}
        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gdisc-bg-card/70 cursor-pointer min-w-0 flex-1 mr-1 transition-colors"
      >
        <Avatar
          src={user.avatarUrl}
          name={user.displayName}
          size="sm"
          status={user.status}
          isSpeaking={isSpeaking}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-gdisc-text-primary truncate leading-tight">
            {user.displayName}
          </div>
          <div className="text-[10px] text-gdisc-text-muted truncate leading-tight">
            @{user.username}
          </div>
        </div>
      </div>

      {/* Control Buttons (Mute, Deafen, Settings) */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={toggleMute}
          title={isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          className={`p-2 rounded-lg transition-colors ${
            isMuted
              ? 'text-gdisc-danger hover:bg-gdisc-danger/10'
              : 'text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover'
          }`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleDeaf}
          title={isDeafened ? 'Desensurdecer' : 'Ensurdecer'}
          className={`p-2 rounded-lg transition-colors ${
            isDeafened
              ? 'text-gdisc-danger hover:bg-gdisc-danger/10'
              : 'text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover'
          }`}
        >
          <Headphones className="w-4 h-4" />
        </button>

        <button
          onClick={() => openModal('user_settings')}
          title="Configurações do Usuário"
          className="p-2 rounded-lg text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Status Switcher Popover */}
      {showStatusMenu && (
        <>
          <div
            onClick={() => setShowStatusMenu(false)}
            className="fixed inset-0 z-30"
          />
          <div className="absolute bottom-16 left-2 z-40 w-48 bg-gdisc-bg-card border border-gdisc-bg-hover rounded-xl shadow-2xl p-1.5 animate-scale-in">
            <div className="px-2.5 py-1 text-[10px] font-semibold text-gdisc-text-muted uppercase tracking-wider">
              Definir Presença
            </div>
            {statuses.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  setStatus(s.value);
                  setShowStatusMenu(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                  user.status === s.value
                    ? 'bg-gdisc-bg-hover font-semibold text-gdisc-text-primary'
                    : 'text-gdisc-text-secondary hover:bg-gdisc-bg-hover/60 hover:text-gdisc-text-primary'
                }`}
              >
                <Circle className={`w-2.5 h-2.5 fill-current ${s.color}`} />
                <span>{s.label}</span>
              </button>
            ))}

            <div className="my-1 border-t border-gdisc-bg-hover" />

            <button
              onClick={() => {
                setShowStatusMenu(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gdisc-danger hover:bg-gdisc-danger/10 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
