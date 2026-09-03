/**
 * GDisC High-Performance Voice Activity Detection (VAD)
 * Analyzes audio volume with AnalyserNode and triggers speaking indicators.
 */

export class AudioActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  private isSpeaking = false;
  private onSpeakingChange: ((speaking: boolean) => void) | null = null;
  private silenceTimer: any = null;

  public start(stream: MediaStream, callback: (speaking: boolean) => void) {
    this.stop();
    this.onSpeakingChange = callback;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume().catch(() => undefined);
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;

      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);

      const checkAudio = () => {
        if (!this.analyser) return;

        // If audioContext suspended, attempt resume
        if (this.audioContext && this.audioContext.state === 'suspended') {
          void this.audioContext.resume().catch(() => undefined);
        }

        // If all audio tracks are muted or disabled, treat as absolute silence
        const hasLiveActiveAudio = stream
          .getAudioTracks()
          .some((track) => track.enabled && track.readyState === 'live');

        if (!hasLiveActiveAudio) {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            this.onSpeakingChange?.(false);
          }
          this.animationFrameId = requestAnimationFrame(checkAudio);
          return;
        }

        this.analyser.getByteFrequencyData(buffer);

        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;

        // Threshold for speaking detection (adjustable, ~15-20 is ideal for human voice)
        const threshold = 16;

        if (average > threshold) {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          if (!this.isSpeaking) {
            this.isSpeaking = true;
            this.onSpeakingChange?.(true);
          }
        } else {
          if (this.isSpeaking && !this.silenceTimer) {
            // Keep active for 350ms after last loud frame to avoid flickering
            this.silenceTimer = setTimeout(() => {
              this.isSpeaking = false;
              this.onSpeakingChange?.(false);
              this.silenceTimer = null;
            }, 350);
          }
        }

        this.animationFrameId = requestAnimationFrame(checkAudio);
      };

      this.animationFrameId = requestAnimationFrame(checkAudio);
    } catch (e) {
      console.warn('AudioContext VAD initialization warning:', e);
    }
  }

  public stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isSpeaking = false;
  }
}
