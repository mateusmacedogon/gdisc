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

  const isDesktop =
    typeof window !== 'undefined' &&
    (Boolean(window.electronAPI) ||
      window.navigator.userAgent.includes('Electron') ||
      window.navigator.userAgent.includes('GDisC-Desktop'));

  useEffect(() => {
    if (!isDesktop) return;

    if (window.electronAPI?.isMaximized) {
      window.electronAPI.isMaximized().then(setIsMaximized).catch(() => {});
    }

    if (window.electronAPI?.onMaximizedChange) {
      const cleanup = window.electronAPI.onMaximizedChange((max) => {
        setIsMaximized(max);
      });
      return cleanup;
    }
  }, [isDesktop]);

  // If running in browser web, do not show native window titlebar
  if (!isDesktop) return null;

  return (
    <header
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="h-8 w-full bg-gdisc-bg-primary border-b border-gdisc-bg-hover/20 flex items-center justify-between select-none z-50 shrink-0 text-xs text-gdisc-text-secondary"
    >
      {/* Left: App Branding & Server/Channel Context */}
      <div className="flex items-center gap-2 px-3 min-w-0 pointer-events-none">
        <div className="w-4 h-4 rounded-md bg-gradient-to-tr from-gdisc-brand-primary to-gdisc-brand-secondary flex items-center justify-center text-white shrink-0 shadow-sm">
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
            <span className="truncate text-[11px] text-gdisc-brand-secondary font-medium max-w-[120px]">
              #{activeChannel.name}
            </span>
          </>
        )}
      </div>

      {/* Center Drag Region Filler */}
      <div className="flex-1 h-full" />

      {/* Right: Windows Window Control Buttons */}
      <div
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center h-full shrink-0"
      >
        {/* Minimize Button */}
        <button
          type="button"
          onClick={() => window.electronAPI?.minimize()}
          title="Minimizar"
          className="h-full w-11 flex items-center justify-center text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-white/10 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore Button */}
        <button
          type="button"
          onClick={() => window.electronAPI?.maximize()}
          title={isMaximized ? 'Restaurar Tamanho' : 'Maximizar'}
          className="h-full w-11 flex items-center justify-center text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-white/10 transition-colors"
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-180" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => window.electronAPI?.close()}
          title="Fechar"
          className="h-full w-12 flex items-center justify-center text-gdisc-text-muted hover:text-white hover:bg-red-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
