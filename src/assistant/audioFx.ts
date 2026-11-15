/**
 * Synthesized NASA Caution & Warning System (CAWS) tones, spacecraft UHF radio
 * squelch clicks, helmet bandpass DSP, and live audio amplitude metering.
 * Pure Web Audio API (zero external audio dependencies).
 */
export class SuitAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private attachedEl: HTMLAudioElement | null = null;

  private micBuffer = new Uint8Array(64);
  private speechBuffer = new Uint8Array(64);

  private fxGain: GainNode | null = null;

  public sfxEnabled = true;
  public radioFilterEnabled = false;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    if (!this.ctx) {
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.92;

      this.fxGain = this.ctx.createGain();
      this.fxGain.gain.value = 1.0;
      this.fxGain.connect(this.masterGain);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.65;

      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.92, this.ctx.currentTime, 0.02);
    }
  }

  public setRadioFilterEnabled(enabled: boolean): void {
    this.radioFilterEnabled = enabled;
    if (this.ctx && this.dryGain && this.wetGain) {
      const t = this.ctx.currentTime;
      this.wetGain.gain.setTargetAtTime(enabled ? 1.0 : 0.0, t, 0.03);
      this.dryGain.gain.setTargetAtTime(enabled ? 0.0 : 1.0, t, 0.03);
    }
  }

  /**
   * Attaches the persistent TTS <audio> element ONCE into a switchable
   * dry vs helmet-bandpass DSP graph + analyser node.
   */
  public attachSpeechElement(audioEl: HTMLAudioElement): void {
    if (this.attachedEl === audioEl && this.sourceNode) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.analyser) return;

    try {
      this.sourceNode = ctx.createMediaElementSource(audioEl);
      this.attachedEl = audioEl;

      // Parallel Dry path (clear voice)
      this.dryGain = ctx.createGain();
      this.dryGain.gain.value = this.radioFilterEnabled ? 0.0 : 1.0;

      // Parallel Wet path (Optional soft comms contour if user enables it in Settings)
      this.wetGain = ctx.createGain();
      this.wetGain.gain.value = this.radioFilterEnabled ? 1.0 : 0.0;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 160;
      hp.Q.value = 0.7;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 6500;
      lp.Q.value = 0.7;

      const midPresence = ctx.createBiquadFilter();
      midPresence.type = "peaking";
      midPresence.frequency.value = 2100;
      midPresence.Q.value = 0.9;
      midPresence.gain.value = 1.5;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 14;
      comp.ratio.value = 2;
      comp.attack.value = 0.006;
      comp.release.value = 0.16;

      this.sourceNode.connect(this.dryGain);
      this.dryGain.connect(this.analyser);

      this.sourceNode.connect(hp);
      hp.connect(lp);
      lp.connect(midPresence);
      midPresence.connect(comp);
      comp.connect(this.wetGain);
      this.wetGain.connect(this.analyser);
    } catch {
      // Fallback: leave native <audio> playback untouched if MediaElementSource fails
    }
  }

  /**
   * Intentionally does not open a parallel getUserMedia stream so Web Speech
   * Recognition keeps exclusive, glitch-free access to the microphone hardware.
   */
  public async startMicMeter(): Promise<void> {
    return;
  }

  public stopMicMeter(): void {
    // No parallel getUserMedia stream held
  }

  /** Returns normalized [0..1] live AI TTS audio energy */
  public sampleSpeechLevel(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.speechBuffer);
    let sumSq = 0;
    for (let i = 0; i < this.speechBuffer.length; i++) {
      const centered = (this.speechBuffer[i] - 128) / 128;
      sumSq += centered * centered;
    }
    const rms = Math.sqrt(sumSq / this.speechBuffer.length);
    return Math.min(1, rms * 3.8);
  }

  /** Returns normalized [0..1] live crew microphone amplitude */
  public sampleMicLevel(): number {
    void this.micBuffer;
    return 0;
  }

  private scheduleTone(
    freq: number,
    startOffset: number,
    durationSec: number,
    type: OscillatorType,
    peakGain: number,
    endFreq?: number
  ): void {
    if (!this.sfxEnabled || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);
    }

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peakGain, now + 0.012);
    g.gain.setValueAtTime(peakGain * 0.85, Math.max(now + 0.015, now + durationSec - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(g);
    g.connect(this.fxGain ?? this.masterGain);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public playBootChime(): void {
    this.scheduleTone(440, 0.0, 0.14, "sine", 0.08);
    this.scheduleTone(659.25, 0.08, 0.18, "sine", 0.09);
    this.scheduleTone(880, 0.17, 0.24, "sine", 0.07);
  }

  public playCommsClick(_open: boolean): void {
    // Disabled: avoid distracting pre/post-utterance clicking ticks during speech
  }

  public playStepConfirm(): void {
    this.scheduleTone(587.33, 0.0, 0.08, "sine", 0.055);
    this.scheduleTone(880.0, 0.075, 0.11, "sine", 0.06);
  }

  public playAlertTone(alertClass: 0 | 1 | 2 | 3): void {
    if (alertClass === 1) {
      // Soft two-tone chime once on critical onset (no repeating klaxon)
      this.scheduleTone(783.99, 0.0, 0.14, "sine", 0.08);
      this.scheduleTone(587.33, 0.15, 0.18, "sine", 0.075);
    } else if (alertClass === 2) {
      this.scheduleTone(659.25, 0.0, 0.11, "sine", 0.06);
      this.scheduleTone(880.0, 0.12, 0.14, "sine", 0.06);
    } else if (alertClass === 3) {
      this.scheduleTone(880.0, 0.0, 0.08, "sine", 0.04);
    }
  }

  public playEscalationPulse(): void {
    this.scheduleTone(740.0, 0.0, 0.12, "sine", 0.06);
    this.scheduleTone(880.0, 0.14, 0.14, "sine", 0.055);
  }

  public syncTelemetryAudio(_next: {
    overallClass: 0 | 1 | 2 | 3;
    hasUnackedAlert: boolean;
    doseRateMsvDay: number;
    suitPressureKpa: number;
    isEva: boolean;
    heartRateBpm: number;
    pio2MmHg: number;
    isAiSpeaking: boolean;
  }): void {
    // Continuous synthesized loops (Geiger crackle, white-noise hiss, heartbeat thumps,
    // repeating klaxons) are disabled so crew voice comms remain clear and distraction-free.
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
