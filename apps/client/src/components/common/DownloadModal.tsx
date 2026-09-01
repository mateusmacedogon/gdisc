import React from 'react';
import { Modal } from './Modal.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { Monitor, Smartphone, Download, ExternalLink, ShieldCheck, Zap } from 'lucide-react';

export const DownloadModal: React.FC = () => {
  const { activeModal, closeModal } = useUIStore();

  const isOpen = activeModal === 'download_apps';
  if (!isOpen) return null;

  const githubReleasesUrl = 'https://github.com/mateusmacedogon/gdisc/releases';
  const windowsDownloadUrl = 'https://github.com/mateusmacedogon/gdisc/releases/latest/download/GDisC-1.0.5-x64.exe';
  const androidDownloadUrl = 'https://github.com/mateusmacedogon/gdisc/releases/latest/download/GDisC-1.0.5-debug.apk';

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Baixar o GDisC"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        <p className="text-sm text-gdisc-text-secondary">
          Instale o GDisC para manter uma janela dedicada, usar os controles nativos do Windows e ter uma experiência adaptada ao Android.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Windows Download Card */}
          <div className="flex flex-col justify-between p-5 bg-gdisc-bg-secondary border border-gdisc-bg-hover hover:border-gdisc-brand-primary/50 rounded-2xl transition-all group shadow-lg">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gdisc-brand-primary/10 text-gdisc-brand-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Monitor className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-gdisc-text-primary mb-1">
                Windows
              </h3>
              <p className="text-xs text-gdisc-text-muted mb-4">
                Compatível com Windows 10 e Windows 11 (64-bit), com controles de janela, bandeja do sistema e seleção nativa de tela ou aplicativo.
              </p>

              <div className="flex items-center gap-2 text-[11px] text-gdisc-success mb-4 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Aplicativo portátil para Windows 64-bit</span>
              </div>
            </div>

            <a
              href={windowsDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary text-white text-sm font-semibold rounded-xl transition-all shadow-md group-hover:shadow-gdisc-glow"
            >
              <Download className="w-4 h-4" />
              <span>Baixar para Windows (.exe)</span>
            </a>
          </div>

          {/* Android Download Card */}
          <div className="flex flex-col justify-between p-5 bg-gdisc-bg-secondary border border-gdisc-bg-hover hover:border-gdisc-brand-primary/50 rounded-2xl transition-all group shadow-lg">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gdisc-success/10 text-gdisc-success flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Smartphone className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-gdisc-text-primary mb-1">
                Android
              </h3>
              <p className="text-xs text-gdisc-text-muted mb-4">
                Compatível com Android 8.0+. Suporte a chat, chamadas de voz e vídeo, teclado adaptativo e retomada automática da conexão.
              </p>

              <div className="flex items-center gap-2 text-[11px] text-gdisc-brand-secondary mb-4 font-medium">
                <Zap className="w-3.5 h-3.5" />
                <span>WebRTC de alta performance</span>
              </div>
            </div>

            <a
              href={androidDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-gdisc-bg-card hover:bg-gdisc-bg-hover border border-gdisc-bg-hover text-gdisc-text-primary hover:text-white text-sm font-semibold rounded-xl transition-all shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Baixar APK do Android</span>
            </a>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between text-xs text-gdisc-text-muted border-t border-gdisc-bg-hover/50">
          <span>Versão atual 1.0.5</span>
          <a
            href={githubReleasesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-gdisc-brand-secondary hover:underline"
          >
            <span>Ver todas as versões no GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </Modal>
  );
};
