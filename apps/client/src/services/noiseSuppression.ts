/**
 * GDisC Advanced Real-Time Noise Suppression & Voice Processing Engine
 * 
 * Implements a studio-grade Web Audio DSP pipeline:
 * 1. Parametric High-Pass Filter (removes sub-bass rumble, desk vibrations, AC hum < 85Hz)
 * 2. Dual Notch Filters (50Hz / 60Hz mains electrical hum elimination)
 * 3. High-Frequency Hiss Filter (attenuates high-pitched coil whine and hiss > 9.5kHz)
 * 4. Adaptive Intelligent Noise Gate & Downward Expander (smoothly attenuates background room noise, fans, and keyboard clatter)
 * 5. Voice Dynamics Compressor (levels speech peaks, prevents distortion, and boosts soft voices)
 * 6. Programmable Input Gain control (0% to 200%)
 * 7. Live Loopback Mic Test Mode for real-time previewing
 */

export type NoiseSuppressionLevel = 'off' | 'standard' | 'high' | 'aggressive';

export interface NoiseMetrics {
  rawVolume: number;        // 0 - 100
  processedVolume: number;  // 0 - 100
  isGateOpen: boolean;      // True if speech is passing through
  noiseFloor: number;       // Estimated background noise floor (0 - 100)
}

type MetricsCallback = (metrics: NoiseMetrics) => void;

class NoiseSuppressionEngine {
  private audioContext: AudioContext | null = null;
  private sourceStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private inputGainNode: GainNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private notch50: BiquadFilterNode | null = null;
  private notch60: BiquadFilterNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private gateGainNode: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private outputTrack: MediaStreamTrack | null = null;

  // Analyser nodes for live metering and noise estimation
  private rawAnalyser: AnalyserNode | null = null;
  private processedAnalyser: AnalyserNode | null = null;
  private analysisTimer: ReturnType<typeof setInterval> | null = null;

  // Configuration
  private currentLevel: NoiseSuppressionLevel = 'high';
  private inputGain = 1.0; // 100%
  private estimatedNoiseFloor = 8;
  private isGateOpen = true;
  private currentAppliedGateGain = 1.0;
  private metricsCallback: MetricsCallback | null = null;

  // Loopback test
  private loopbackAudio: HTMLAudioElement | null = null;

  /**
   * Resumes AudioContext if suspended by browser autoplay policy
   */
  public resumeAudio(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      void this.audioContext.resume().catch(() => undefined);
    }
  }

  /**
   * Processes a raw microphone MediaStream through the DSP pipeline.
   * Returns a new MediaStream containing the cleaned, noise-suppressed audio track.
   */
  public processStream(rawStream: MediaStream, level: NoiseSuppressionLevel = this.currentLevel): MediaStream {
    this.cleanup();
    this.currentLevel = level;
    this.sourceStream = rawStream;

    const rawAudioTrack = rawStream.getAudioTracks()[0];
    if (!rawAudioTrack) {
      return rawStream;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx({ latencyHint: 'interactive' });
      this.resumeAudio();

      const unlock = () => {
        this.resumeAudio();
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });

      // Create DSP nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(rawStream);
      this.inputGainNode = this.audioContext.createGain();
      this.inputGainNode.gain.value = this.inputGain;

      // 1. High-Pass Filter at 85Hz (Q=0.707) removes desk rumbles and handling noise
      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.value = 85;
      this.highpassFilter.Q.value = 0.707;

      // 2. Dual notch filters for 50Hz and 60Hz power mains hum
      this.notch50 = this.audioContext.createBiquadFilter();
      this.notch50.type = 'notch';
      this.notch50.frequency.value = 50;
      this.notch50.Q.value = 4.0;

      this.notch60 = this.audioContext.createBiquadFilter();
      this.notch60.type = 'notch';
      this.notch60.frequency.value = 60;
      this.notch60.Q.value = 4.0;

      // 3. Low-Pass Filter at 9500Hz to eliminate high-pitched hiss while keeping voice crisp
      this.lowpassFilter = this.audioContext.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.value = 9500;
      this.lowpassFilter.Q.value = 0.707;

      // 4. Intelligent Noise Gate Gain
      this.gateGainNode = this.audioContext.createGain();
      this.gateGainNode.gain.value = 1.0;
      this.currentAppliedGateGain = 1.0;

      // 5. Speech Dynamics Compressor
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -24; // dB
      this.compressor.knee.value = 24;      // Smooth transition
      this.compressor.ratio.value = 3.5;    // Balanced voice compression
      this.compressor.attack.value = 0.003; // Fast attack (3ms)
      this.compressor.release.value = 0.25; // Gentle release (250ms)

      // 6. Analysers for metering
      this.rawAnalyser = this.audioContext.createAnalyser();
      this.rawAnalyser.fftSize = 256;
      this.rawAnalyser.smoothingTimeConstant = 0.3;

      this.processedAnalyser = this.audioContext.createAnalyser();
      this.processedAnalyser.fftSize = 256;
      this.processedAnalyser.smoothingTimeConstant = 0.3;

      // 7. Destination
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // Connect graph:
      // Source -> RawAnalyser -> InputGain -> Highpass -> Notch50 -> Notch60 -> Lowpass -> GateGain -> Compressor -> ProcessedAnalyser -> Destination
      this.sourceNode.connect(this.rawAnalyser);
      this.sourceNode.connect(this.inputGainNode);
      this.inputGainNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.notch50);
      this.notch50.connect(this.notch60);
      this.notch60.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.gateGainNode);
      this.gateGainNode.connect(this.compressor);
      this.compressor.connect(this.processedAnalyser);
      this.compressor.connect(this.destinationNode);

      // Apply initial filter parameters based on selected level
      this.applySuppressionParameters(this.currentLevel);

      // Extract processed track
      this.outputTrack = this.destinationNode.stream.getAudioTracks()[0];
      if (this.outputTrack) {
        this.outputTrack.contentHint = 'speech';
        this.outputTrack.enabled = rawAudioTrack.enabled;
      }

      // Synchronize track enabled status with raw track
      rawAudioTrack.addEventListener('ended', () => {
        this.outputTrack?.stop();
      });

      // Start processing loop
      this.startAnalysisLoop();

      // Return stream with the processed audio track plus any live video tracks
      const videoTracks = rawStream.getVideoTracks();
      return new MediaStream([this.outputTrack, ...videoTracks]);
    } catch (error) {
      console.warn('[NoiseSuppression] Web Audio DSP initialization failed, falling back to raw stream:', error);
      return rawStream;
    }
  }

  public setLevel(level: NoiseSuppressionLevel): void {
    this.currentLevel = level;
    this.applySuppressionParameters(level);
  }

  public getLevel(): NoiseSuppressionLevel {
    return this.currentLevel;
  }

  public setInputGain(gain: number): void {
    this.inputGain = Math.max(0, Math.min(2.5, gain));
    if (this.inputGainNode && this.audioContext) {
      this.inputGainNode.gain.setTargetAtTime(this.inputGain, this.audioContext.currentTime, 0.05);
    }
  }

  public getInputGain(): number {
    return this.inputGain;
  }

  public setMetricsCallback(callback: MetricsCallback | null): void {
    this.metricsCallback = callback;
  }

  /**
   * Starts a real-time loopback preview of the noise-suppressed microphone
   * so the user can test their voice in settings.
   */
  public startLoopbackTest(sinkId?: string): void {
    if (!this.outputTrack) return;
    this.stopLoopbackTest();

    try {
      const stream = new MediaStream([this.outputTrack]);
      const audio = new Audio();
      audio.srcObject = stream;
      audio.autoplay = true;
      audio.volume = 1.0;
      if (sinkId && 'setSinkId' in audio) {
        void (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> })
          .setSinkId(sinkId)
          .catch(() => undefined);
      }
      void audio.play().catch((err) => {
        console.warn('[NoiseSuppression] Loopback play blocked:', err);
      });
      this.loopbackAudio = audio;
    } catch (err) {
      console.warn('[NoiseSuppression] Failed to start loopback test:', err);
    }
  }

  public stopLoopbackTest(): void {
    if (this.loopbackAudio) {
      this.loopbackAudio.pause();
      this.loopbackAudio.srcObject = null;
      this.loopbackAudio = null;
    }
  }

  public isLoopbackActive(): boolean {
    return this.loopbackAudio !== null;
  }

  private applySuppressionParameters(level: NoiseSuppressionLevel): void {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    switch (level) {
      case 'off':
        // Bypass filters completely
        if (this.gateGainNode) {
          this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.05);
          this.currentAppliedGateGain = 1.0;
        }
        if (this.highpassFilter) this.highpassFilter.frequency.setTargetAtTime(10, now, 0.05);
        if (this.notch50) this.notch50.frequency.setTargetAtTime(10, now, 0.05);
        if (this.notch60) this.notch60.frequency.setTargetAtTime(10, now, 0.05);
        if (this.lowpassFilter) this.lowpassFilter.frequency.setTargetAtTime(22000, now, 0.05);
        if (this.compressor) {
          this.compressor.threshold.setTargetAtTime(0, now, 0.05);
          this.compressor.ratio.setTargetAtTime(1.0, now, 0.05);
        }
        break;

      case 'standard':
        // Gentle filtering, soft gate
        if (this.highpassFilter) this.highpassFilter.frequency.setTargetAtTime(70, now, 0.05);
        if (this.notch50) this.notch50.frequency.setTargetAtTime(50, now, 0.05);
        if (this.notch60) this.notch60.frequency.setTargetAtTime(60, now, 0.05);
        if (this.lowpassFilter) this.lowpassFilter.frequency.setTargetAtTime(12000, now, 0.05);
        if (this.compressor) {
          this.compressor.threshold.setTargetAtTime(-20, now, 0.05);
          this.compressor.ratio.setTargetAtTime(2.5, now, 0.05);
        }
        break;

      case 'high':
        // Studio quality balance
        if (this.highpassFilter) this.highpassFilter.frequency.setTargetAtTime(85, now, 0.05);
        if (this.notch50) this.notch50.frequency.setTargetAtTime(50, now, 0.05);
        if (this.notch60) this.notch60.frequency.setTargetAtTime(60, now, 0.05);
        if (this.lowpassFilter) this.lowpassFilter.frequency.setTargetAtTime(9500, now, 0.05);
        if (this.compressor) {
          this.compressor.threshold.setTargetAtTime(-24, now, 0.05);
          this.compressor.ratio.setTargetAtTime(3.5, now, 0.05);
        }
        break;

      case 'aggressive':
        // Maximum suppression for noisy environments (fans, mechanical keyboards)
        if (this.highpassFilter) this.highpassFilter.frequency.setTargetAtTime(110, now, 0.05);
        if (this.notch50) this.notch50.frequency.setTargetAtTime(50, now, 0.05);
        if (this.notch60) this.notch60.frequency.setTargetAtTime(60, now, 0.05);
        if (this.lowpassFilter) this.lowpassFilter.frequency.setTargetAtTime(8000, now, 0.05);
        if (this.compressor) {
          this.compressor.threshold.setTargetAtTime(-28, now, 0.05);
          this.compressor.ratio.setTargetAtTime(4.5, now, 0.05);
        }
        break;
    }
  }

  private startAnalysisLoop(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }

    const rawBuffer = new Uint8Array(this.rawAnalyser?.frequencyBinCount ?? 128);
    const procBuffer = new Uint8Array(this.processedAnalyser?.frequencyBinCount ?? 128);

    let silenceHoldTicks = 0;
    const holdTicksThreshold = 7; // ~210ms hold time at 30ms interval

    const analyze = () => {
      if (!this.rawAnalyser || !this.audioContext || this.audioContext.state === 'closed') {
        return;
      }
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume().catch(() => undefined);
      }

      this.rawAnalyser.getByteFrequencyData(rawBuffer);
      let rawSum = 0;
      for (let i = 0; i < rawBuffer.length; i++) {
        rawSum += rawBuffer[i];
      }
      const rawAvg = rawSum / rawBuffer.length;
      const rawVolume = Math.min(100, Math.round((rawAvg / 128) * 100));

      let procVolume = rawVolume;
      if (this.processedAnalyser) {
        this.processedAnalyser.getByteFrequencyData(procBuffer);
        let procSum = 0;
        for (let i = 0; i < procBuffer.length; i++) {
          procSum += procBuffer[i];
        }
        procVolume = Math.min(100, Math.round((procSum / procBuffer.length / 128) * 100));
      }

      // Slowly adapt noise floor (exponential moving average)
      if (rawVolume < this.estimatedNoiseFloor) {
        this.estimatedNoiseFloor = this.estimatedNoiseFloor * 0.95 + rawVolume * 0.05;
      } else {
        this.estimatedNoiseFloor = this.estimatedNoiseFloor * 0.999 + rawVolume * 0.001;
      }

      // Dynamic gate threshold based on suppression level
      let gateOpenThreshold = 14;
      let gateCloseThreshold = 10;
      let attenuationGain = 0.05; // -26dB

      if (this.currentLevel === 'standard') {
        gateOpenThreshold = Math.max(12, this.estimatedNoiseFloor + 4);
        gateCloseThreshold = Math.max(8, this.estimatedNoiseFloor + 2);
        attenuationGain = 0.12; // -18dB
      } else if (this.currentLevel === 'high') {
        gateOpenThreshold = Math.max(15, this.estimatedNoiseFloor + 6);
        gateCloseThreshold = Math.max(11, this.estimatedNoiseFloor + 3);
        attenuationGain = 0.04; // -28dB
      } else if (this.currentLevel === 'aggressive') {
        gateOpenThreshold = Math.max(20, this.estimatedNoiseFloor + 9);
        gateCloseThreshold = Math.max(15, this.estimatedNoiseFloor + 5);
        attenuationGain = 0.01; // -40dB deep downward expansion
      }

      if (this.currentLevel === 'off') {
        this.isGateOpen = true;
        silenceHoldTicks = 0;
        if (this.gateGainNode && this.audioContext && this.currentAppliedGateGain !== 1.0) {
          this.currentAppliedGateGain = 1.0;
          this.gateGainNode.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.05);
        }
      } else {
        if (rawVolume >= gateOpenThreshold) {
          this.isGateOpen = true;
          silenceHoldTicks = 0;
          if (this.gateGainNode && this.audioContext && this.currentAppliedGateGain !== 1.0) {
            this.currentAppliedGateGain = 1.0;
            // Smooth fast attack for speech
            this.gateGainNode.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.02);
          }
        } else if (rawVolume <= gateCloseThreshold) {
          silenceHoldTicks++;
          if (silenceHoldTicks >= holdTicksThreshold) {
            this.isGateOpen = false;
            if (this.gateGainNode && this.audioContext && this.currentAppliedGateGain !== attenuationGain) {
              this.currentAppliedGateGain = attenuationGain;
              // Smooth release curve downward expansion
              this.gateGainNode.gain.setTargetAtTime(attenuationGain, this.audioContext.currentTime, 0.12);
            }
          }
        }
      }

      if (this.metricsCallback) {
        this.metricsCallback({
          rawVolume,
          processedVolume: this.isGateOpen ? procVolume : Math.round(procVolume * attenuationGain),
          isGateOpen: this.isGateOpen,
          noiseFloor: Math.round(this.estimatedNoiseFloor),
        });
      }
    };

    // Use interval instead of requestAnimationFrame so background tabs and minimized windows never stall audio gating
    this.analysisTimer = setInterval(analyze, 30);
  }

  public cleanup(): void {
    this.stopLoopbackTest();
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
    if (this.outputTrack) {
      this.outputTrack.stop();
      this.outputTrack = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.inputGainNode) {
      this.inputGainNode.disconnect();
      this.inputGainNode = null;
    }
    if (this.highpassFilter) {
      this.highpassFilter.disconnect();
      this.highpassFilter = null;
    }
    if (this.notch50) {
      this.notch50.disconnect();
      this.notch50 = null;
    }
    if (this.notch60) {
      this.notch60.disconnect();
      this.notch60 = null;
    }
    if (this.lowpassFilter) {
      this.lowpassFilter.disconnect();
      this.lowpassFilter = null;
    }
    if (this.gateGainNode) {
      this.gateGainNode.disconnect();
      this.gateGainNode = null;
    }
    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }
    if (this.destinationNode) {
      this.destinationNode.disconnect();
      this.destinationNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.sourceStream = null;
    this.isGateOpen = true;
    this.currentAppliedGateGain = 1.0;
  }
}

export const noiseSuppression = new NoiseSuppressionEngine();
