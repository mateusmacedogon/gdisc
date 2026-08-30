import React, { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../../stores/useUIStore.js';
import { useServerStore } from '../../stores/useServerStore.js';
import { useChannelStore } from '../../stores/useChannelStore.js';
import { Search, Hash, Volume2, Globe, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'server' | 'text_channel' | 'voice_channel';
  title: string;
  subtitle?: string;
  serverId?: string;
  channelId?: string;
}

export const QuickSwitcherModal: React.FC = () => {
  const { activeModal, closeModal } = useUIStore();
  const { servers, selectServer, activeServer } = useServerStore();
  const { channels, selectChannel } = useChannelStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = activeModal === 'quick_switcher';

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build searchable items list
  const results: SearchResult[] = [];
  const q = query.toLowerCase().trim();

  // 1. Channels from active server
  for (const c of channels) {
    if (!q || c.name.toLowerCase().includes(q)) {
      results.push({
        id: `channel-${c.id}`,
        type: c.type === 'VOICE' ? 'voice_channel' : 'text_channel',
        title: c.name,
        subtitle: activeServer?.name ? `no servidor ${activeServer.name}` : undefined,
        serverId: activeServer?.id,
        channelId: c.id,
      });
    }
  }

  // 2. Servers
  for (const s of servers) {
    if (!q || s.name.toLowerCase().includes(q)) {
      results.push({
        id: `server-${s.id}`,
        type: 'server',
        title: s.name,
        subtitle: 'Servidor',
        serverId: s.id,
      });
    }
  }

  const handleSelect = (item: SearchResult) => {
    if (item.type === 'server' && item.serverId) {
      selectServer(item.serverId);
    } else if (item.channelId) {
      if (item.serverId && (!activeServer || activeServer.id !== item.serverId)) {
        selectServer(item.serverId);
      }
      selectChannel(item.channelId);
    }
    closeModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      closeModal();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-switcher-title"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-xl bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-gdisc-bg-hover/70 bg-gdisc-bg-card">
          <Search className="w-5 h-5 text-gdisc-brand-secondary shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            id="quick-switcher-title"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Para onde você quer ir? (ex: #geral, voz, servidores)"
            className="w-full bg-transparent text-sm text-gdisc-text-primary placeholder:text-gdisc-text-muted focus:outline-none"
          />
          <div className="flex items-center gap-1 text-[11px] font-mono text-gdisc-text-muted bg-gdisc-bg-secondary px-2 py-1 rounded-md border border-gdisc-bg-hover">
            <span>ESC</span>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-12 text-center text-gdisc-text-muted text-xs">
              Nenhum canal ou servidor encontrado com esse nome.
            </div>
          ) : (
            results.slice(0, 15).map((item, index) => {
              const isSelected = selectedIndex === index;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-gdisc-brand-primary text-white shadow-md'
                      : 'hover:bg-gdisc-bg-hover/60 text-gdisc-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-gdisc-bg-card text-gdisc-brand-secondary border border-gdisc-bg-hover'
                      }`}
                    >
                      {item.type === 'text_channel' ? (
                        <Hash className="w-4 h-4" />
                      ) : item.type === 'voice_channel' ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <Globe className="w-4 h-4" />
                      )}
                    </div>

                    <div className="truncate">
                      <span className={`text-sm font-semibold truncate block ${isSelected ? 'text-white' : 'text-gdisc-text-primary'}`}>
                        {item.type === 'text_channel' ? `#${item.title}` : item.title}
                      </span>
                      {item.subtitle && (
                        <span className={`text-[11px] truncate block ${isSelected ? 'text-white/80' : 'text-gdisc-text-muted'}`}>
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-80">
                    <span className="text-[11px] font-medium hidden sm:inline">Pular para</span>
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Navigation Hints */}
        <div className="flex items-center justify-between px-4 py-2 bg-gdisc-bg-card border-t border-gdisc-bg-hover/60 text-[11px] text-gdisc-text-muted">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-gdisc-bg-secondary px-1.5 py-0.5 rounded border border-gdisc-bg-hover">↑</kbd> <kbd className="font-mono bg-gdisc-bg-secondary px-1.5 py-0.5 rounded border border-gdisc-bg-hover">↓</kbd> para navegar</span>
            <span><kbd className="font-mono bg-gdisc-bg-secondary px-1.5 py-0.5 rounded border border-gdisc-bg-hover">ENTER</kbd> para selecionar</span>
          </div>
          <span className="flex items-center gap-1 text-gdisc-brand-secondary font-medium">
            <Sparkles className="w-3 h-3" />
            Quick Switcher
          </span>
        </div>
      </div>
    </div>
  );
};
