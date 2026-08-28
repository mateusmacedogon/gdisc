import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useVoiceStore } from '../../stores/useVoiceStore.js';
import { Mic, Video, Volume2 } from 'lucide-react';

export const DeviceSettingsModal: React.FC = () => {
  const { activeModal, closeModal } = useUIStore();
  const {
    selectedAudioInputId,
    selectedVideoInputId,
    setAudioInput,
    setVideoInput,
    localStream,
  } = useVoiceStore();

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [micVolume, setMicVolume] = useState(0);

  const isOpen = activeModal === 'device_settings';
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      } catch (err) {
        console.error('Error enumerating media devices:', err);
      }
    };

    loadDevices();
  }, [isOpen]);

  // Audio meter test preview
  useEffect(() => {
    if (!isOpen || !localStream) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;

      const source = audioCtx.createMediaStreamSource(localStream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();

      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        source.disconnect();
        audioCtx.close();
      };
    } catch (e) {
      console.warn('Could not initialize audio test meter:', e);
    }
  }, [isOpen, localStream]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Dispositivos de Voz e Vídeo"
      description="Configure seu microfone, alto-falante e webcam para as chamadas WebRTC."
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Microphone Selector */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-2">
            <Mic className="w-4 h-4 text-gdisc-brand-secondary" />
            Microfone (Dispositivo de Entrada)
          </label>
          <select
            value={selectedAudioInputId || ''}
            onChange={(e) => setAudioInput(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
          >
            <option value="">Padrão do Sistema</option>
            {audioDevices.map((d, index) => (
              <option key={d.deviceId || index} value={d.deviceId}>
                {d.label || `Microfone ${index + 1}`}
              </option>
            ))}
          </select>

          {/* Live Mic Test Meter */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gdisc-text-muted mb-1">
              <span>Teste de Microfone</span>
              <span>{micVolume}%</span>
            </div>
            <div className="w-full h-2.5 bg-gdisc-bg-secondary rounded-full overflow-hidden p-0.5 border border-gdisc-bg-hover">
              <div
                style={{ width: `${micVolume}%` }}
                className="h-full bg-gradient-to-r from-gdisc-brand-primary to-gdisc-success rounded-full transition-all duration-75"
              />
            </div>
          </div>
        </div>

        {/* Camera Selector */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-2">
            <Video className="w-4 h-4 text-gdisc-brand-secondary" />
            Câmera / Webcam
          </label>
          <select
            value={selectedVideoInputId || ''}
            onChange={(e) => setVideoInput(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
          >
            <option value="">Padrão do Sistema</option>
            {videoDevices.map((d, index) => (
              <option key={d.deviceId || index} value={d.deviceId}>
                {d.label || `Câmera ${index + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={closeModal}
            className="px-5 py-2.5 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary text-white text-sm font-semibold rounded-xl transition-all shadow-md"
          >
            Concluído
          </button>
        </div>
      </div>
    </Modal>
  );
};
