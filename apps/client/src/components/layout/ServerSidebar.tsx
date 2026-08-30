import React from 'react';
import { useServerStore } from '../../stores/useServerStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { Plus, Compass, Radio, Download } from 'lucide-react';
import { isWeb } from '../../utils/platform.js';

export const ServerSidebar: React.FC = () => {
  const { servers, activeServerId, selectServer } = useServerStore();
  const { openModal, closeMobileSidebar } = useUIStore();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
  };

  const handleSelectServer = (serverId: string | null) => {
    selectServer(serverId);
    closeMobileSidebar();
  };

  const handleOpenModal = (type: 'create_server' | 'join_invite') => {
    closeMobileSidebar();
    openModal(type);
  };

  return (
    <aside
      aria-label="Servidores"
      className="w-[72px] h-full min-h-0 bg-gdisc-bg-primary flex flex-col items-center py-3 select-none shrink-0 border-r border-gdisc-bg-hover/30 overflow-y-auto overflow-x-hidden"
    >
      {/* GDisC Brand Home Button */}
      <div className="relative group mb-2 flex items-center justify-center">
        {/* Active Pill indicator */}
        <span
          className={`absolute left-0 w-1 bg-gdisc-text-primary rounded-r-full transition-all duration-200 ${
            activeServerId === null ? 'h-10' : 'h-2 group-hover:h-5'
          }`}
        />
        <button
          type="button"
          onClick={() => handleSelectServer(null)}
          title="Início & Mensagens Diretas"
          aria-label="Início e mensagens diretas"
          aria-current={activeServerId === null ? 'page' : undefined}
          className={`w-12 h-12 rounded-3xl group-hover:rounded-2xl transition-all duration-200 flex items-center justify-center ${
            activeServerId === null
              ? 'bg-gdisc-brand-primary text-white rounded-2xl shadow-gdisc-glow'
              : 'bg-gdisc-bg-card text-gdisc-brand-secondary hover:bg-gdisc-brand-primary hover:text-white'
          }`}
        >
          <Radio className="w-6 h-6" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-8 h-[2px] bg-gdisc-bg-hover rounded-full my-1.5" />

      {/* Server List */}
      <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto overflow-x-hidden py-1">
        {servers.map((server) => {
          const isActive = activeServerId === server.id;

          return (
            <div key={server.id} className="relative group flex items-center justify-center w-full">
              {/* Active Pill indicator */}
              <span
                className={`absolute left-0 w-1 bg-gdisc-text-primary rounded-r-full transition-all duration-200 ${
                  isActive ? 'h-10' : 'h-0 group-hover:h-5'
                }`}
              />

              <button
                type="button"
                onClick={() => handleSelectServer(server.id)}
                title={server.name}
                aria-label={`Abrir servidor ${server.name}`}
                aria-current={isActive ? 'page' : undefined}
                className={`w-12 h-12 transition-all duration-200 flex items-center justify-center overflow-hidden font-bold text-sm ${
                  isActive
                    ? 'rounded-2xl bg-gdisc-brand-primary text-white shadow-gdisc-glow'
                    : 'rounded-3xl hover:rounded-2xl bg-gdisc-bg-card text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover'
                }`}
              >
                {server.iconUrl ? (
                  <img
                    src={server.iconUrl}
                    alt={server.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getInitials(server.name)}</span>
                )}
              </button>
            </div>
          );
        })}

        {/* Add Server Button */}
        <div className="relative group mt-1">
          <button
            type="button"
            onClick={() => handleOpenModal('create_server')}
            title="Criar um Servidor"
            aria-label="Criar um servidor"
            className="w-12 h-12 rounded-3xl hover:rounded-2xl bg-gdisc-bg-card hover:bg-gdisc-success text-gdisc-success hover:text-white flex items-center justify-center transition-all duration-200 group-hover:shadow-lg"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Join Server by Invite Button */}
        <div className="relative group">
          <button
            type="button"
            onClick={() => handleOpenModal('join_invite')}
            title="Entrar com Código de Convite"
            aria-label="Entrar em um servidor com código de convite"
            className="w-12 h-12 rounded-3xl hover:rounded-2xl bg-gdisc-bg-card hover:bg-gdisc-brand-secondary text-gdisc-brand-secondary hover:text-white flex items-center justify-center transition-all duration-200"
          >
            <Compass className="w-5 h-5" />
          </button>
        </div>

        {/* Download Apps Button (Visible ONLY on Web version) */}
        {isWeb && (
          <div className="relative group mt-auto pt-2">
            <button
              type="button"
              onClick={() => openModal('download_apps')}
              title="Baixar Aplicativo para Windows ou Android"
              aria-label="Baixar aplicativo GDisC"
              className="w-12 h-12 rounded-3xl hover:rounded-2xl bg-gdisc-bg-card hover:bg-gdisc-brand-primary text-gdisc-brand-secondary hover:text-white flex items-center justify-center transition-all duration-200 shadow-md group-hover:shadow-gdisc-glow relative"
            >
              <Download className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-gdisc-brand-primary rounded-full ring-2 ring-gdisc-bg-primary animate-pulse" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
