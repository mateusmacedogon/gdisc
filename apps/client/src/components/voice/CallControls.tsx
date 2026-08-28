import React from 'react';
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
} from 'lucide-react';

export const CallControls: React.FC = () => {
  const {
    isMuted,
    isVideoOn,
    isScreenSharing,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    leaveVoice,
  } = useVoiceStore();

  const { openModal } = useUIStore();

  return (
    <div className="flex items-center justify-center p-4 z-20 select-none">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gdisc-bg-card/90 backdrop-blur-xl border border-gdisc-bg-hover rounded-2xl shadow-2xl animate-fade-in">
        {/* Toggle Microphone */}
        <button
          onClick={toggleMute}
          title={isMuted ? 'Ativar Microfone' : 'Desativar Microfone'}
          className={`p-3 rounded-xl transition-all shadow-md ${
            isMuted
              ? 'bg-gdisc-danger text-white hover:opacity-90'
              : 'bg-gdisc-bg-secondary text-gdisc-text-primary hover:bg-gdisc-bg-hover hover:text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Camera */}
        <button
          onClick={toggleVideo}
          title={isVideoOn ? 'Desligar Câmera' : 'Ligar Câmera'}
          className={`p-3 rounded-xl transition-all shadow-md ${
            isVideoOn
              ? 'bg-gdisc-brand-primary text-white hover:bg-gdisc-brand-secondary shadow-gdisc-glow'
              : 'bg-gdisc-bg-secondary text-gdisc-text-primary hover:bg-gdisc-bg-hover hover:text-white'
          }`}
        >
          {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Toggle Screen Share */}
        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? 'Parar Compartilhamento' : 'Compartilhar Tela'}
          className={`p-3 rounded-xl transition-all shadow-md ${
            isScreenSharing
              ? 'bg-gdisc-success text-white hover:opacity-90'
              : 'bg-gdisc-bg-secondary text-gdisc-text-primary hover:bg-gdisc-bg-hover hover:text-white'
          }`}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        {/* Device Settings */}
        <button
          onClick={() => openModal('device_settings')}
          title="Configurações de Dispositivos de Áudio e Vídeo"
          className="p-3 bg-gdisc-bg-secondary text-gdisc-text-primary hover:bg-gdisc-bg-hover hover:text-white rounded-xl transition-all shadow-md"
        >
          <Sliders className="w-5 h-5" />
        </button>

        {/* Leave Voice Call */}
        <button
          onClick={leaveVoice}
          title="Desconectar da Chamada"
          className="px-4 py-3 bg-gdisc-danger hover:bg-rose-600 text-white rounded-xl transition-all shadow-md flex items-center gap-2 font-semibold text-sm"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden sm:inline">Desconectar</span>
        </button>
      </div>
    </div>
  );
};
