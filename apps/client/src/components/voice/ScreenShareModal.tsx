import React, { useState, useEffect } from 'react';
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

  if (activeModal !== 'screen_share') return null;

  const screenSources = sources.filter((s) => s.isScreen);
  const windowSources = sources.filter((s) => !s.isScreen);

  const handleStartShare = async () => {
    setIsStarting(true);
    try {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-full max-w-2xl bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gdisc-bg-hover/60 shrink-0">
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
            className="p-1.5 text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Source Tabs (Only if Desktop Electron or fallback web) */}
          {isElectron ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 p-1 bg-gdisc-bg-card rounded-xl border border-gdisc-bg-hover/60">
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
                      <div
                        key={source.id}
                        onClick={() => setSelectedSourceId(source.id)}
                        className={`group relative flex flex-col rounded-xl overflow-hidden border cursor-pointer transition-all duration-150 ${
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Web Browser Mode: Informative Cards */
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setSelectedSourceId('screen')}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center text-center ${
                  selectedSourceId !== 'window'
                    ? 'border-gdisc-brand-primary bg-gdisc-brand-primary/10 ring-2 ring-gdisc-brand-primary/40'
                    : 'border-gdisc-bg-hover bg-gdisc-bg-card hover:bg-gdisc-bg-hover/50'
                }`}
              >
                <Monitor className="w-10 h-10 text-gdisc-brand-secondary mb-2" />
                <h4 className="text-sm font-bold text-gdisc-text-primary">Tela Inteira</h4>
                <p className="text-xs text-gdisc-text-muted mt-1">
                  Transmita todo o conteúdo do seu monitor
                </p>
              </div>

              <div
                onClick={() => setSelectedSourceId('window')}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center text-center ${
                  selectedSourceId === 'window'
                    ? 'border-gdisc-brand-primary bg-gdisc-brand-primary/10 ring-2 ring-gdisc-brand-primary/40'
                    : 'border-gdisc-bg-hover bg-gdisc-bg-card hover:bg-gdisc-bg-hover/50'
                }`}
              >
                <AppWindow className="w-10 h-10 text-gdisc-brand-secondary mb-2" />
                <h4 className="text-sm font-bold text-gdisc-text-primary">Janela de Aplicativo</h4>
                <p className="text-xs text-gdisc-text-muted mt-1">
                  Transmita uma janela ou guia específica
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

              <input
                type="checkbox"
                id="share-audio-toggle"
                checked={withAudio}
                onChange={(e) => setWithAudio(e.target.checked)}
                className="w-4 h-4 rounded border-gdisc-bg-hover bg-gdisc-bg-secondary text-gdisc-brand-primary focus:ring-gdisc-brand-primary focus:ring-offset-0 cursor-pointer accent-gdisc-brand-primary"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gdisc-bg-card border-t border-gdisc-bg-hover/60 shrink-0">
          <button
            type="button"
            onClick={closeModal}
            disabled={isStarting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => void handleStartShare()}
            disabled={isStarting || (isElectron && !selectedSourceId)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-gdisc-brand-primary to-gdisc-brand-secondary text-white text-xs font-bold shadow-lg shadow-gdisc-brand-primary/25 hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
