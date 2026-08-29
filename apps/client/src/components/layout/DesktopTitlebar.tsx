import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Radio } from 'lucide-react';
import { useServerStore } from '../../stores/useServerStore.js';
import { useChannelStore } from '../../stores/useChannelStore.js';

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizedChange: (callback: (isMax: boolean) => void) => () => void;
    };
  }
}

export const DesktopTitlebar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { activeServer } = useServerStore();
  const { activeChannel } = useChannelStore();

  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    window.electronAPI.isMaximized().then(setIsMaximized);

    const cleanup = window.electronAPI.onMaximizedChange((max) => {
      setIsMaximized(max);
    });

    return cleanup;
  }, [isElectron]);

  // If not running in Electron, do not render extra titlebar space
  if (!isElectron) return null;

  return (
    <header
      style={{ WebkitAppRegion: 'drag' } as any}
      className="h-8 w-full bg-gdisc-bg-primary border-b border-gdisc-bg-hover/30 flex items-center justify-between select-none z-50 shrink-0 text-xs text-gdisc-text-secondary"
    >
      {/* App Branding & Server Breadcrumb */}
      <div className="flex items-center gap-2 px-3 min-w-0">
        <div className="w-4 h-4 rounded-md bg-gdisc-brand-primary flex items-center justify-center text-white shrink-0">
          <Radio className="w-2.5 h-2.5" />
        </div>
        <span className="font-bold text-gdisc-text-primary tracking-wide text-[11px]">
          GDisC
        </span>

        {activeServer && (
          <>
            <span className="text-gdisc-text-muted text-[10px]">/</span>
            <span className="truncate text-[11px] font-medium text-gdisc-text-secondary max-w-[160px]">
              {activeServer.name}
            </span>
          </>
        )}

        {activeChannel && (
          <>
            <span className="text-gdisc-text-muted text-[10px]">/</span>
            <span className="truncate text-[11px] text-gdisc-brand-secondary max-w-[120px]">
              #{activeChannel.name}
            </span>
          </>
        )}
      </div>

      {/* Windows Window Control Buttons (Non-draggable) */}
      <div
        style={{ WebkitAppRegion: 'no-drag' } as any}
        className="flex items-center h-full shrink-0"
      >
        {/* Minimize */}
        <button
          onClick={() => window.electronAPI?.minimize()}
          title="Minimizar"
          className="h-full px-3.5 flex items-center justify-center text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={() => window.electronAPI?.maximize()}
          title={isMaximized ? 'Restaurar Tamanho' : 'Maximizar'}
          className="h-full px-3.5 flex items-center justify-center text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover transition-colors"
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-180" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        {/* Close */}
        <button
          onClick={() => window.electronAPI?.close()}
          title="Fechar"
          className="h-full px-4 flex items-center justify-center text-gdisc-text-muted hover:text-white hover:bg-gdisc-danger transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
