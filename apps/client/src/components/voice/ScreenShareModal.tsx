import React, { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../../stores/useUIStore.js';
import { useVoiceStore } from '../../stores/useVoiceStore.js';
import {
  Monitor,
  AppWindow,
  X,
  Radio,
  Check,
  Volume2,
  Sliders,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import type { DesktopCaptureSource } from '../../types/electron.d.js';
import { platformCapabilities } from '../../utils/platform.js';

export const ScreenShareModal: React.FC = () => {
  const { activeModal, closeModal, addToast } = useUIStore();
  const { toggleScreenShare } = useVoiceStore();

  const [activeTab, setActiveTab] = useState<'screens' | 'windows'>('screens');
  const [sources, setSources] = useState<DesktopCaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState(false);

  // Quality & Audio settings
  const [resolution, setResolution] = useState<'720p' | '1080p' | 'original'>('1080p');
  const [fps, setFps] = useState<15 | 30 | 60>(30);
  const [withAudio, setWithAudio] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isElectron =
    typeof window !== 'undefined' &&
    Boolean(window.electronAPI?.getScreenSources);

  const loadSources = async () => {
    if (!isElectron || !window.electronAPI?.getScreenSources) return;
    setIsLoadingSources(true);
    try {
      const desktopSources = await window.electronAPI.getScreenSources();
      setSources(desktopSources);

      // Auto-select first screen
      const firstScreen = desktopSources.find((s) => s.isScreen);
      if (firstScreen && !selectedSourceId) {
        setSelectedSourceId(firstScreen.id);
      }
    } catch (err) {
      console.error('Failed to load screen sources:', err);
      addToast('Não foi possível listar as janelas abertas.', 'error');
    } finally {
      setIsLoadingSources(false);
    }
  };

  useEffect(() => {
    if (activeModal === 'screen_share') {
      if (isElectron) {
        void loadSources();
      }
    }
  }, [activeModal, isElectron]);

  useEffect(() => {
    if (activeModal !== 'screen_share') return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [activeModal, closeModal]);

  if (activeModal !== 'screen_share') return null;

  const screenSources = sources.filter((s) => s.isScreen);
  const windowSources = sources.filter((s) => !s.isScreen);

  const handleStartShare = async () => {
    setIsStarting(true);
    try {
      if (!platformCapabilities.screenShare) {
        throw new Error('O compartilhamento de tela não é suportado neste dispositivo.');
      }
      if (isElectron && selectedSourceId && window.electronAPI?.selectScreenSource) {
        await window.electronAPI.selectScreenSource(selectedSourceId);
      }
      await toggleScreenShare({
        sourceId: isElectron ? selectedSourceId || undefined : undefined,
        resolution,
        fps,
        withAudio,
      });
      closeModal();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : 'Falha ao iniciar compartilhamento de tela.',
        'error'
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="screen-share-title"
      onClick={closeModal}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm animate-fade-in sm:p-4"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gdisc-bg-hover bg-gdisc-bg-secondary shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gdisc-bg-hover/60 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-gdisc-brand-primary to-gdisc-brand-secondary flex items-center justify-center text-white shadow-md">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 id="screen-share-title" className="text-base font-bold text-gdisc-text-primary">
                Transmitir Tela
              </h3>
              <p className="text-xs text-gdisc-text-muted">
                Escolha o que deseja compartilhar com os membros do canal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            aria-label="Fechar"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gdisc-text-muted transition-colors hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          {/* Source Tabs (Only if Desktop Electron or fallback web) */}
          {isElectron ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto rounded-xl border border-gdisc-bg-hover/60 bg-gdisc-bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('screens')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'screens'
                        ? 'bg-gdisc-brand-primary text-white shadow-md'
                        : 'text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover/50'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Telas Inteiras ({screenSources.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('windows')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'windows'
                        ? 'bg-gdisc-brand-primary text-white shadow-md'
                        : 'text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover/50'
                    }`}
                  >
                    <AppWindow className="w-3.5 h-3.5" />
                    <span>Janelas de Apps ({windowSources.length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void loadSources()}
                  disabled={isLoadingSources}
                  title="Atualizar lista de janelas"
                  className="p-2 text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover rounded-xl transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingSources ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Source Grid Cards */}
              {isLoadingSources ? (
                <div className="flex flex-col items-center justify-center py-12 text-gdisc-text-muted">
                  <Loader2 className="w-8 h-8 animate-spin text-gdisc-brand-secondary mb-2" />
                  <span className="text-xs">Carregando janelas e monitores...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-1">
                  {(activeTab === 'screens' ? screenSources : windowSources).map((source) => {
                    const isSelected = selectedSourceId === source.id;

                    return (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => setSelectedSourceId(source.id)}
                        className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-150 ${
                          isSelected
                            ? 'border-gdisc-brand-primary ring-2 ring-gdisc-brand-primary/40 bg-gdisc-brand-primary/10 shadow-lg'
                            : 'border-gdisc-bg-hover/80 bg-gdisc-bg-card hover:border-gdisc-text-muted/40 hover:bg-gdisc-bg-hover/50'
                        }`}
                      >
                        {/* Thumbnail View */}
                        <div className="relative aspect-video w-full bg-black/60 overflow-hidden flex items-center justify-center">
                          {source.thumbnail ? (
                            <img
                              src={source.thumbnail}
                              alt={source.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <Monitor className="w-8 h-8 text-gdisc-text-muted" />
                          )}

                          {/* Selected Checkmark Badge */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gdisc-brand-primary flex items-center justify-center text-white shadow-md">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}

                          {/* App Icon if available */}
                          {source.appIcon && (
                            <img
                              src={source.appIcon}
                              alt=""
                              className="absolute bottom-1.5 left-1.5 w-4 h-4 rounded shadow-sm pointer-events-none"
                            />
                          )}
                        </div>

                        {/* Title */}
                        <div className="p-2.5">
                          <p className="text-xs font-semibold text-gdisc-text-primary truncate">
                            {source.name}
                          </p>
                          <span className="text-[10px] text-gdisc-text-muted block truncate">
                            {source.isScreen ? 'Monitor Completo' : 'Aplicativo Aberto'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Web Browser Mode: Informative Cards */
            <div className="flex items-center gap-4 rounded-xl border border-gdisc-brand-primary/40 bg-gdisc-brand-primary/10 p-4">
              <Monitor className="h-10 w-10 shrink-0 text-gdisc-brand-secondary" />
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-gdisc-text-primary">Escolha no painel do navegador</h4>
                <p className="mt-1 text-xs leading-relaxed text-gdisc-text-muted">
                  Ao iniciar, o navegador permitirá escolher uma tela, janela ou guia e informará quais opções aceitam áudio.
                </p>
              </div>
            </div>
          )}

          {/* Stream Quality & Audio Options */}
          <div className="bg-gdisc-bg-card border border-gdisc-bg-hover/60 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-gdisc-text-primary">
              <Sliders className="w-4 h-4 text-gdisc-brand-secondary" />
              <span>Qualidade da Transmissão</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Resolution Picker */}
              <div>
                <label className="text-[11px] font-semibold text-gdisc-text-muted uppercase tracking-wider block mb-1.5">
                  Resolução
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-gdisc-bg-secondary rounded-lg border border-gdisc-bg-hover/40">
                  {(['720p', '1080p', 'original'] as const).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResolution(res)}
                      className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                        resolution === res
                          ? 'bg-gdisc-brand-primary text-white shadow-sm'
                          : 'text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover/40'
                      }`}
                    >
                      {res === '720p' ? '720p HD' : res === '1080p' ? '1080p FHD' : 'Original'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Framerate Picker */}
              <div>
                <label className="text-[11px] font-semibold text-gdisc-text-muted uppercase tracking-wider block mb-1.5">
                  Taxa de Quadros (FPS)
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-gdisc-bg-secondary rounded-lg border border-gdisc-bg-hover/40">
                  {([15, 30, 60] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFps(f)}
                      className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                        fps === f
                          ? 'bg-gdisc-brand-primary text-white shadow-sm'
                          : 'text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover/40'
                      }`}
                    >
                      {f} FPS
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Audio Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-gdisc-bg-hover/40">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-gdisc-brand-secondary" />
                <div>
                  <span className="text-xs font-semibold text-gdisc-text-primary block">
                    Compartilhar Áudio do Sistema
                  </span>
                  <span className="text-[11px] text-gdisc-text-muted">
                    Inclui sons de jogos, vídeos e aplicativos na chamada
                  </span>
                </div>
              </div>

              <label htmlFor="share-audio-toggle" className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg hover:bg-gdisc-bg-hover/50">
                <input
                  type="checkbox"
                  id="share-audio-toggle"
                  checked={withAudio}
                  onChange={(e) => setWithAudio(e.target.checked)}
                  className="h-5 w-5 cursor-pointer rounded border-gdisc-bg-hover bg-gdisc-bg-secondary text-gdisc-brand-primary accent-gdisc-brand-primary focus:ring-gdisc-brand-primary focus:ring-offset-0"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gdisc-bg-hover/60 bg-gdisc-bg-card px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={closeModal}
            disabled={isStarting}
            className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-gdisc-text-secondary transition-colors hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary disabled:opacity-50 sm:text-xs"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => void handleStartShare()}
            disabled={isStarting || (isElectron && !selectedSourceId)}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-gdisc-brand-primary to-gdisc-brand-secondary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-gdisc-brand-primary/25 transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Iniciando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Transmitir ao Vivo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
