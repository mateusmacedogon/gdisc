import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useVoiceStore } from '../../stores/useVoiceStore.js';
import {
  Mic,
  Video,
  Volume2,
  Waves,
  ShieldCheck,
  Sparkles,
  Sliders,
  Check,
  Play,
  Square,
  VolumeX,
} from 'lucide-react';
import { platformCapabilities } from '../../utils/platform.js';
import {
  noiseSuppression,
  type NoiseSuppressionLevel,
  type NoiseMetrics,
} from '../../services/noiseSuppression.js';

export const DeviceSettingsModal: React.FC = () => {
  const { activeModal, closeModal, addToast } = useUIStore();
  const {
    selectedAudioInputId,
    selectedAudioOutputId,
    selectedVideoInputId,
    setAudioInput,
    setAudioOutput,
    setVideoInput,
    noiseSuppressionLevel,
    setNoiseSuppressionLevel,
    micGain,
    setMicGain,
    echoCancellation,
    setEchoCancellation,
    localStream,
  } = useVoiceStore();

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [switchingDevice, setSwitchingDevice] = useState<'audio' | 'output' | 'video' | 'noise' | null>(null);

  // Live noise & mic metrics
  const [metrics, setMetrics] = useState<NoiseMetrics>({
    rawVolume: 0,
    processedVolume: 0,
    isGateOpen: false,
    noiseFloor: 10,
  });

  // Test microphone stream when modal is opened outside an active call
  const [testMicStream, setTestMicStream] = useState<MediaStream | null>(null);
  const testMicStreamRef = useRef<MediaStream | null>(null);

  // Loopback test
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  // Camera preview in modal
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const isOpen = activeModal === 'device_settings';

  // Load available devices
  useEffect(() => {
    if (!isOpen) return;

    const loadDevices = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) {
        addToast('Este dispositivo não permite listar microfones e câmeras.', 'info');
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
        setAudioOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      } catch (err) {
        console.error('Error enumerating media devices:', err);
        addToast('Não foi possível listar os dispositivos de mídia.', 'error');
      }
    };

    void loadDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', loadDevices);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', loadDevices);
  }, [addToast, isOpen]);

  // Connect live noise metrics from DSP engine & acquire test stream if not in call
  useEffect(() => {
    if (!isOpen) return;

    noiseSuppression.resumeAudio();
    noiseSuppression.setMetricsCallback((newMetrics) => {
      setMetrics(newMetrics);
    });

    let cancelled = false;

    // If not in a call with localStream, acquire a test stream so volume and noise gate can be tested
    if (!localStream || localStream.getAudioTracks().length === 0) {
      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation,
              noiseSuppression: noiseSuppressionLevel !== 'off',
              autoGainControl: true,
              ...(selectedAudioInputId ? { deviceId: { exact: selectedAudioInputId } } : {}),
            },
            video: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          testMicStreamRef.current = stream;
          setTestMicStream(stream);
          noiseSuppression.processStream(stream, noiseSuppressionLevel);
        } catch (err) {
          console.warn('[DeviceSettingsModal] Could not open test mic stream:', err);
        }
      })();
    }

    return () => {
      cancelled = true;
      noiseSuppression.setMetricsCallback(null);
      noiseSuppression.stopLoopbackTest();
      setIsTestingMic(false);
      if (testMicStreamRef.current) {
        testMicStreamRef.current.getTracks().forEach((t) => t.stop());
        testMicStreamRef.current = null;
        setTestMicStream(null);
        if (!localStream) {
          noiseSuppression.cleanup();
        }
      }
    };
  }, [isOpen, localStream, selectedAudioInputId, noiseSuppressionLevel, echoCancellation]);

  // Clean up camera preview stream when closing modal
  useEffect(() => {
    if (!isOpen && cameraPreviewStream) {
      cameraPreviewStream.getTracks().forEach((track) => track.stop());
      setCameraPreviewStream(null);
      setShowCameraPreview(false);
    }
  }, [isOpen, cameraPreviewStream]);

  // Sync camera preview video element
  useEffect(() => {
    if (previewVideoRef.current && cameraPreviewStream) {
      previewVideoRef.current.srcObject = cameraPreviewStream;
      previewVideoRef.current.play().catch(() => undefined);
    }
  }, [cameraPreviewStream, showCameraPreview]);

  const toggleCameraPreview = async () => {
    if (showCameraPreview) {
      cameraPreviewStream?.getTracks().forEach((t) => t.stop());
      setCameraPreviewStream(null);
      setShowCameraPreview(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoInputId ? { deviceId: { exact: selectedVideoInputId } } : true,
        });
        setCameraPreviewStream(stream);
        setShowCameraPreview(true);
      } catch (err) {
        addToast('Não foi possível iniciar o teste da câmera.', 'error');
      }
    }
  };

  const toggleMicLoopback = () => {
    if (isTestingMic) {
      noiseSuppression.stopLoopbackTest();
      setIsTestingMic(false);
    } else {
      noiseSuppression.resumeAudio();
      noiseSuppression.startLoopbackTest(selectedAudioOutputId);
      setIsTestingMic(true);
      addToast('Você está ouvindo o seu microfone processado.', 'info');
    }
  };

  const playTestSound = () => {
    if (isPlayingTestSound) return;
    setIsPlayingTestSound(true);

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc1.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.3); // G5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(261.63, ctx.currentTime); // C4
      osc2.frequency.setValueAtTime(329.63, ctx.currentTime + 0.15); // E4
      osc2.frequency.setValueAtTime(392.00, ctx.currentTime + 0.3); // G4

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);

      setTimeout(() => {
        setIsPlayingTestSound(false);
        void ctx.close();
      }, 650);
    } catch {
      setIsPlayingTestSound(false);
    }
  };

  const changeAudioInput = async (deviceId: string) => {
    setSwitchingDevice('audio');
    try {
      await setAudioInput(deviceId);
      addToast('Microfone atualizado com sucesso.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível trocar o microfone.', 'error');
    } finally {
      setSwitchingDevice(null);
    }
  };

  const changeVideoInput = async (deviceId: string) => {
    setSwitchingDevice('video');
    try {
      await setVideoInput(deviceId);
      if (showCameraPreview) {
        cameraPreviewStream?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        setCameraPreviewStream(stream);
      }
      addToast('Câmera atualizada com sucesso.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível trocar a câmera.', 'error');
    } finally {
      setSwitchingDevice(null);
    }
  };

  const changeAudioOutput = async (deviceId: string) => {
    setSwitchingDevice('output');
    try {
      await setAudioOutput(deviceId);
      addToast('Saída de áudio atualizada.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível trocar a saída de áudio.', 'error');
    } finally {
      setSwitchingDevice(null);
    }
  };

  const changeNoiseLevel = async (level: NoiseSuppressionLevel) => {
    setSwitchingDevice('noise');
    try {
      await setNoiseSuppressionLevel(level);
      const labels: Record<NoiseSuppressionLevel, string> = {
        off: 'Supressão de ruído desativada.',
        standard: 'Supressão padrão ativada.',
        high: 'Supressão de ruído inteligente DSP ativada.',
        aggressive: 'Supressão de ruído agressiva ativada.',
      };
      addToast(labels[level], 'success');
    } catch (error) {
      addToast('Não foi possível alterar o nível de supressão.', 'error');
    } finally {
      setSwitchingDevice(null);
    }
  };

  const handleClose = () => {
    noiseSuppression.stopLoopbackTest();
    setIsTestingMic(false);
    if (cameraPreviewStream) {
      cameraPreviewStream.getTracks().forEach((t) => t.stop());
      setCameraPreviewStream(null);
    }
    if (testMicStreamRef.current) {
      testMicStreamRef.current.getTracks().forEach((t) => t.stop());
      testMicStreamRef.current = null;
      setTestMicStream(null);
      if (!localStream) {
        noiseSuppression.cleanup();
      }
    }
    closeModal();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Dispositivos de Voz e Vídeo"
      description="Configure seu microfone, supressão de ruído DSP, alto-falante e webcam."
      maxWidth="lg"
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* SECTION 1: MICROPHONE & DSP NOISE SUPPRESSION */}
        <div className="rounded-2xl border border-gdisc-bg-hover bg-gdisc-bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="audio-input-device" className="flex items-center gap-2 text-xs font-bold text-gdisc-text-secondary uppercase tracking-wider">
              <Mic className="w-4 h-4 text-gdisc-brand-secondary" />
              Microfone (Dispositivo de Entrada)
            </label>
            <span className="text-[11px] text-gdisc-text-muted">
              {audioDevices.length} dispositivo(s)
            </span>
          </div>

          <select
            id="audio-input-device"
            value={selectedAudioInputId || ''}
            onChange={(e) => void changeAudioInput(e.target.value)}
            disabled={switchingDevice !== null}
            className="min-h-11 w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-base text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors disabled:opacity-50 sm:text-sm"
          >
            <option value="">Padrão do Sistema</option>
            {audioDevices.map((d, index) => (
              <option key={d.deviceId || index} value={d.deviceId}>
                {d.label || `Microfone ${index + 1}`}
              </option>
            ))}
          </select>

          {/* Mic Input Gain / Volume Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs font-semibold text-gdisc-text-muted">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-gdisc-brand-secondary" />
                Ganho de Entrada do Microfone
              </span>
              <span className="text-gdisc-text-primary font-mono">{Math.round(micGain * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={micGain}
              onChange={(e) => setMicGain(parseFloat(e.target.value))}
              className="w-full h-2 bg-gdisc-bg-secondary rounded-lg appearance-none cursor-pointer accent-gdisc-brand-primary border border-gdisc-bg-hover"
            />
          </div>

          {/* Real-Time Live Volume & Noise Gate Visualizer */}
          <div className="space-y-2 pt-1 border-t border-gdisc-bg-hover/60">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gdisc-text-muted font-semibold">Teste de Volume em Tempo Real</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                metrics.isGateOpen
                  ? 'bg-gdisc-success/20 text-gdisc-success border border-gdisc-success/40'
                  : 'bg-gdisc-bg-hover text-gdisc-text-muted'
              }`}>
                {metrics.isGateOpen ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-gdisc-success animate-pulse" />
                    Voz Detectada
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3 h-3" />
                    Ruído Suprimido
                  </>
                )}
              </span>
            </div>

            {/* Meter Bar */}
            <div className="w-full h-3 bg-gdisc-bg-secondary rounded-full overflow-hidden p-0.5 border border-gdisc-bg-hover relative">
              {/* Noise floor marker */}
              <div
                style={{ left: `${Math.min(95, metrics.noiseFloor)}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400/70 z-10"
                title={`Piso de ruído: ${metrics.noiseFloor}%`}
              />
              <div
                style={{ width: `${metrics.processedVolume}%` }}
                className={`h-full rounded-full transition-all duration-75 ${
                  metrics.isGateOpen
                    ? 'bg-gradient-to-r from-gdisc-brand-primary to-gdisc-success'
                    : 'bg-gdisc-text-muted/40'
                }`}
              />
            </div>

            <div className="flex justify-between text-[11px] text-gdisc-text-muted">
              <span>0%</span>
              <span className="text-amber-400/80 text-[10px]">Marcador: Piso de Ruído ({metrics.noiseFloor}%)</span>
              <span>100%</span>
            </div>
          </div>

          {/* Test Mic Loopback Button */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={toggleMicLoopback}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
                isTestingMic
                  ? 'bg-gdisc-danger text-white border-gdisc-danger animate-pulse'
                  : 'bg-gdisc-bg-secondary text-gdisc-text-primary border-gdisc-bg-hover hover:border-gdisc-brand-primary'
              }`}
            >
              {isTestingMic ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-gdisc-success" />}
              <span>{isTestingMic ? 'Parar Teste de Microfone' : 'Testar e Ouvir Meu Microfone'}</span>
            </button>

            <span className="text-[11px] text-gdisc-text-muted">
              {isTestingMic ? 'Falando com retorno ao vivo' : 'Ouça como os outros ouvem sua voz'}
            </span>
          </div>
        </div>

        {/* SECTION 2: NOISE SUPPRESSION SYSTEM (DSP) */}
        <div className="rounded-2xl border border-gdisc-brand-primary/30 bg-gdisc-brand-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gdisc-brand-primary/20 flex items-center justify-center text-gdisc-brand-secondary">
                <Waves className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gdisc-text-primary uppercase tracking-wider">
                  Sistema de Supressão de Ruídos Inteligente (DSP)
                </h4>
                <p className="text-[11px] text-gdisc-text-muted">
                  Filtro anti-rumble, corte de zumbidos elétricos (50/60Hz), Noise Gate e Compressor de voz
                </p>
              </div>
            </div>

            <Sparkles className="w-4 h-4 text-gdisc-brand-secondary shrink-0" />
          </div>

          {/* 4 Noise Suppression Level Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {(
              [
                {
                  id: 'off',
                  title: 'Desativado',
                  desc: 'Som puro sem cortes',
                },
                {
                  id: 'standard',
                  title: 'Padrão',
                  desc: 'Filtro básico',
                },
                {
                  id: 'high',
                  title: 'Alta (Estúdio)',
                  desc: 'DSP completo + Gate',
                  badge: 'Ideal',
                },
                {
                  id: 'aggressive',
                  title: 'Agressiva',
                  desc: 'Ventilador & teclado',
                },
              ] as Array<{ id: NoiseSuppressionLevel; title: string; desc: string; badge?: string }>
            ).map((level) => {
              const isSelected = noiseSuppressionLevel === level.id;
              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => void changeNoiseLevel(level.id)}
                  disabled={switchingDevice !== null}
                  className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-gdisc-brand-primary bg-gdisc-brand-primary/15 text-white shadow-md ring-1 ring-gdisc-brand-primary'
                      : 'border-gdisc-bg-hover bg-gdisc-bg-card text-gdisc-text-secondary hover:border-gdisc-brand-primary/40 hover:bg-gdisc-bg-hover/40'
                  }`}
                >
                  {level.badge && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-gdisc-brand-primary text-white">
                      {level.badge}
                    </span>
                  )}
                  <div>
                    <span className="block text-xs font-bold text-gdisc-text-primary">
                      {level.title}
                    </span>
                    <span className="block text-[10px] text-gdisc-text-muted mt-0.5">
                      {level.desc}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-gdisc-brand-secondary font-semibold">
                      <Check className="w-3 h-3" />
                      <span>Ativo</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Echo Cancellation Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-gdisc-bg-hover/60">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-gdisc-brand-secondary" />
              <div>
                <span className="text-xs font-semibold text-gdisc-text-primary block">
                  Cancelamento de Eco Acústico
                </span>
                <span className="text-[11px] text-gdisc-text-muted">
                  Evita que a voz de outros participantes vaze no seu microfone
                </span>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={echoCancellation}
              onClick={() => void setEchoCancellation(!echoCancellation)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                echoCancellation ? 'bg-gdisc-brand-primary' : 'bg-gdisc-bg-hover'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  echoCancellation ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* SECTION 3: AUDIO OUTPUT (SPEAKERS / HEADPHONES) */}
        <div className="rounded-2xl border border-gdisc-bg-hover bg-gdisc-bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="audio-output-device" className="flex items-center gap-2 text-xs font-bold text-gdisc-text-secondary uppercase tracking-wider">
              <Volume2 className="w-4 h-4 text-gdisc-brand-secondary" />
              Alto-falante / Fone de Ouvido
            </label>
            <span className="text-[11px] text-gdisc-text-muted">
              {audioOutputDevices.length} saída(s)
            </span>
          </div>

          {platformCapabilities.audioOutputSelection ? (
            <div className="space-y-2">
              <select
                id="audio-output-device"
                value={selectedAudioOutputId || ''}
                onChange={(e) => void changeAudioOutput(e.target.value)}
                disabled={switchingDevice !== null}
                className="min-h-11 w-full rounded-xl border border-gdisc-bg-hover bg-gdisc-bg-secondary px-3.5 py-2.5 text-base text-gdisc-text-primary transition-colors focus:border-gdisc-brand-primary focus:outline-none disabled:opacity-50 sm:text-sm"
              >
                <option value="">Padrão do Sistema</option>
                {audioOutputDevices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label || `Saída de áudio ${index + 1}`}
                  </option>
                ))}
              </select>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={playTestSound}
                  disabled={isPlayingTestSound}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gdisc-bg-secondary border border-gdisc-bg-hover hover:border-gdisc-brand-primary text-xs font-semibold text-gdisc-text-primary transition-all"
                >
                  <Volume2 className="w-3.5 h-3.5 text-gdisc-brand-secondary" />
                  <span>{isPlayingTestSound ? 'Reproduzindo som...' : 'Testar Saída de Som'}</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-gdisc-bg-hover bg-gdisc-bg-secondary px-3.5 py-3 text-sm leading-relaxed text-gdisc-text-muted">
              A saída de áudio é gerenciada automaticamente pelo sistema operacional neste dispositivo.
            </p>
          )}
        </div>

        {/* SECTION 4: CAMERA / WEBCAM & TEST PREVIEW */}
        <div className="rounded-2xl border border-gdisc-bg-hover bg-gdisc-bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="video-input-device" className="flex items-center gap-2 text-xs font-bold text-gdisc-text-secondary uppercase tracking-wider">
              <Video className="w-4 h-4 text-gdisc-brand-secondary" />
              Câmera / Webcam
            </label>
            <span className="text-[11px] text-gdisc-text-muted">
              {videoDevices.length} câmera(s)
            </span>
          </div>

          <select
            id="video-input-device"
            value={selectedVideoInputId || ''}
            onChange={(e) => void changeVideoInput(e.target.value)}
            disabled={switchingDevice !== null}
            className="min-h-11 w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-base text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors disabled:opacity-50 sm:text-sm"
          >
            <option value="">Padrão do Sistema</option>
            {videoDevices.map((d, index) => (
              <option key={d.deviceId || index} value={d.deviceId}>
                {d.label || `Câmera ${index + 1}`}
              </option>
            ))}
          </select>

          {/* Camera Preview Button and Video Box */}
          <div className="pt-1">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => void toggleCameraPreview()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gdisc-bg-secondary border border-gdisc-bg-hover hover:border-gdisc-brand-primary text-xs font-semibold text-gdisc-text-primary transition-all"
              >
                <Video className="w-3.5 h-3.5 text-gdisc-brand-secondary" />
                <span>{showCameraPreview ? 'Ocultar Prévia da Câmera' : 'Testar e Ver Prévia da Câmera'}</span>
              </button>
              <span className="text-[11px] text-gdisc-text-muted">
                {showCameraPreview ? 'Visualização ao vivo espelhada' : 'Verifique iluminação e enquadramento'}
              </span>
            </div>

            {showCameraPreview && (
              <div className="mt-3 aspect-video w-full max-w-sm mx-auto bg-black rounded-xl overflow-hidden border border-gdisc-bg-hover relative shadow-inner">
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white backdrop-blur-sm">
                  Prévia Espelhada
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 bg-gradient-to-r from-gdisc-brand-primary to-gdisc-brand-secondary hover:opacity-95 text-white text-sm font-bold rounded-xl transition-all shadow-lg"
          >
            Concluído
          </button>
        </div>
      </div>
    </Modal>
  );
};
