import React, { useState } from 'react';
import { useVoiceStore } from '../../stores/useVoiceStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Sliders,
  Loader2,
} from 'lucide-react';
import { platformCapabilities } from '../../utils/platform.js';

export const CallControls: React.FC = () => {
  const {
    isMuted,
    isVideoOn,
    isScreenSharing,
    isSpeaking,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    leaveVoice,
  } = useVoiceStore();

  const { openModal, addToast } = useUIStore();
  const [pendingAction, setPendingAction] = useState<'camera' | 'screen' | 'leave' | null>(null);

  const runAction = async (
    action: 'camera' | 'screen' | 'leave',
    operation: () => Promise<void>,
    fallbackMessage: string,
  ) => {
    if (pendingAction) return;
    setPendingAction(action);
    try {
      await operation();
    } catch (error) {
      addToast(error instanceof Error ? error.message : fallbackMessage, 'error');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="z-20 flex w-full items-center justify-center overflow-x-auto px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 select-none sm:p-4">
      <div className="flex max-w-full items-center gap-1.5 rounded-2xl border border-gdisc-bg-hover bg-gdisc-bg-card/90 px-2 py-2.5 shadow-2xl backdrop-blur-xl animate-fade-in sm:gap-2.5 sm:px-4">
        {/* Toggle Microphone */}
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Ativar microfone' : 'Desativar microfone'}
          aria-pressed={isMuted}
          title={isMuted ? 'Ativar Microfone' : 'Desativar Microfone'}
          className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-all shadow-md ${
            isMuted
              ? 'bg-gdisc-danger text-white hover:opacity-90'
              : isSpeaking
              ? 'bg-gdisc-bg-secondary text-gdisc-status-online ring-2 ring-gdisc-status-online shadow-gdisc-speaking'
              : 'bg-gdisc-bg-secondary text-gdisc-text-primary hover:bg-gdisc-bg-hover hover:text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Camera */}
        <button
          type="button"
          onClick={() => {
            if (!platformCapabilities.camera) {
              addToast('A câmera não é suportada neste dispositivo.', 'info');
              return;
            }
            void runAction('camera', toggleVideo, 'Não foi possível alterar a câmera.');
          }}
          disabled={pendingAction !== null}
          aria-disabled={!platformCapabilities.camera}
          aria-label={isVideoOn ? 'Desligar câmera' : 'Ligar câmera'}
          aria-pressed={isVideoOn}
          title={isVideoOn ? 'Desligar Câmera' : 'Ligar Câmera'}
          className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-all shadow-md disabled:opacity-50 ${
            isVideoOn
              ? 'bg-gdisc-brand-primary text-white hover:bg-gdisc-brand-secondary shadow-gdisc-glow'
              : 'bg-gdisc-bg-secondary text-gdisc-text-primary hover:bg-gdisc-bg-hover hover:text-white'
          }`}
        >
          {pendingAction === 'camera' ? <Loader2 className="h-5 w-5 animate-spin" /> : isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Toggle Screen Share */}
        <button
          type="button"
          onClick={() => {
            if (isScreenSharing) {
              void runAction('screen', () => toggleScreenShare(), 'Não foi possível parar o compartilhamento.');
            } else if (!platformCapabilities.screenShare) {
              addToast('O compartilhamento de tela não está disponível no Android. Use o site ou o aplicativo para Windows.', 'info');
            } else {
              openModal('screen_share');
            }
          }}
          disabled={pendingAction !== null}
          aria-disabled={!isScreenSharing && !platformCapabilities.screenShare}
          aria-label={isScreenSharing ? 'Parar compartilhamento de tela' : 'Compartilhar tela'}
          aria-pressed={isScreenSharing}
          title={isScreenSharing
            ? 'Parar Compartilhamento'
            : platformCapabilities.screenShare
              ? 'Compartilhar Tela (Opções)'
              : 'Compartilhamento indisponível neste dispositivo'}
          className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-all shadow-md disabled:opacity-50 ${
            isScreenSharing
              ? 'bg-gdisc-success text-white hover:opacity-90'
              : platformCapabilities.screenShare
                ? 'bg-gdisc-bg-secondary text-gdisc-text-primary hover:bg-gdisc-bg-hover hover:text-white'
                : 'bg-gdisc-bg-secondary text-gdisc-text-muted opacity-60'
          }`}
        >
          {pendingAction === 'screen' ? <Loader2 className="h-5 w-5 animate-spin" /> : isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        {/* Device Settings */}
        <button
          type="button"
          onClick={() => openModal('device_settings')}
          disabled={pendingAction !== null}
          aria-label="Configurar dispositivos de áudio e vídeo"
          title="Configurações de Dispositivos de Áudio e Vídeo"
          className="flex min-h-11 min-w-11 items-center justify-center bg-gdisc-bg-secondary text-gdisc-text-primary hover:bg-gdisc-bg-hover hover:text-white rounded-xl transition-all shadow-md disabled:opacity-50"
        >
          <Sliders className="w-5 h-5" />
        </button>

        {/* Leave Voice Call */}
        <button
          type="button"
          onClick={() => void runAction('leave', leaveVoice, 'Não foi possível sair da chamada.')}
          disabled={pendingAction !== null}
          aria-label="Desconectar da chamada"
          title="Desconectar da Chamada"
          className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-gdisc-danger px-3 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-rose-600 disabled:opacity-50 sm:px-4"
        >
          {pendingAction === 'leave' ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="w-5 h-5" />}
          <span className="hidden sm:inline">Desconectar</span>
        </button>
      </div>
    </div>
  );
};
