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

  private micAnalyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micBuffer = new Uint8Array(64);
  private speechBuffer = new Uint8Array(64);

  // Continuous immersive hazard soundscape nodes & schedulers
  private fxGain: GainNode | null = null;
  private leakNoiseGain: GainNode | null = null;
  private leakNoiseSource: AudioBufferSourceNode | null = null;
  private hazardTimer: ReturnType<typeof setInterval> | null = null;
  private lastKlaxonAtMs = 0;
  private lastCautionAtMs = 0;
  private lastHeartbeatAtMs = 0;
  private telemetryState = {
    overallClass: 0 as 0 | 1 | 2 | 3,
    hasUnackedAlert: false,
    doseRateMsvDay: 0.6,
    suitPressureKpa: 43,
    isEva: true,
    heartRateBpm: 72,
    pio2MmHg: 150,
    isAiSpeaking: false,
  };

  public sfxEnabled = true;
  public radioFilterEnabled = true;
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

      // Parallel Wet path (Helmet Suit Comms Radio Bandpass 340Hz-3.4kHz + mild compression)
      this.wetGain = ctx.createGain();
      this.wetGain.gain.value = this.radioFilterEnabled ? 1.0 : 0.0;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 340;
      hp.Q.value = 0.75;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3400;
      lp.Q.value = 0.85;

      const midPresence = ctx.createBiquadFilter();
      midPresence.type = "peaking";
      midPresence.frequency.value = 1850;
      midPresence.Q.value = 1.1;
      midPresence.gain.value = 3.2;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;

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
   * Optional Web Audio mic level probe using hardware echoCancellation so the
   * visor waveform animates smoothly with crew speech.
   */
  public async startMicMeter(): Promise<void> {
    if (this.micStream || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.micStream = stream;
      this.micSource = ctx.createMediaStreamSource(stream);
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 128;
      this.micAnalyser.smoothingTimeConstant = 0.6;
      this.micSource.connect(this.micAnalyser);
    } catch {
      // Permission declined or no hardware mic; SpeechRecognition can still operate independently
    }
  }

  public stopMicMeter(): void {
    try {
      this.micSource?.disconnect();
    } catch {
      // ignore
    }
    this.micSource = null;
    this.micAnalyser = null;
    if (this.micStream) {
      this.micStream.getTracks().forEach((tr) => tr.stop());
      this.micStream = null;
    }
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
    if (!this.micAnalyser) return 0;
    this.micAnalyser.getByteTimeDomainData(this.micBuffer);
    let sumSq = 0;
    for (let i = 0; i < this.micBuffer.length; i++) {
      const centered = (this.micBuffer[i] - 128) / 128;
      sumSq += centered * centered;
    }
    const rms = Math.sqrt(sumSq / this.micBuffer.length);
    return Math.min(1, rms * 4.2);
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

  public playCommsClick(open: boolean): void {
    if (open) {
      this.scheduleTone(1480, 0.0, 0.026, "triangle", 0.05, 1120);
      this.scheduleTone(2200, 0.015, 0.018, "sine", 0.03);
    } else {
      this.scheduleTone(980, 0.0, 0.024, "triangle", 0.04, 620);
    }
  }

  public playStepConfirm(): void {
    this.scheduleTone(587.33, 0.0, 0.09, "sine", 0.08);
    this.scheduleTone(880.0, 0.085, 0.13, "sine", 0.09);
  }

  public playAlertTone(alertClass: 0 | 1 | 2 | 3): void {
    if (alertClass === 1) {
      // NASA Emergency Klaxon pulse: urgent alternating triangle-sine
      this.scheduleTone(880, 0.0, 0.13, "triangle", 0.16);
      this.scheduleTone(622.25, 0.14, 0.14, "triangle", 0.16);
      this.scheduleTone(880, 0.30, 0.13, "triangle", 0.16);
      this.scheduleTone(622.25, 0.44, 0.16, "triangle", 0.14);
    } else if (alertClass === 2) {
      // Caution chime
      this.scheduleTone(740, 0.0, 0.12, "sine", 0.11);
      this.scheduleTone(987.77, 0.13, 0.16, "sine", 0.11);
    } else if (alertClass === 3) {
      // Advisory chirp
      this.scheduleTone(1046.5, 0.0, 0.09, "sine", 0.07);
    }
  }

  public playEscalationPulse(): void {
    this.scheduleTone(987.77, 0.0, 0.1, "triangle", 0.15);
    this.scheduleTone(783.99, 0.11, 0.1, "triangle", 0.15);
    this.scheduleTone(1174.66, 0.24, 0.14, "sine", 0.13);
  }

  private ensureHazardLoop(): void {
    if (this.hazardTimer || typeof window === "undefined") return;
    this.hazardTimer = setInterval(() => {
      this.tickHazardSoundscape();
    }, 200);
  }

  private ensureLeakNoiseNode(): GainNode | null {
    if (this.leakNoiseGain) return this.leakNoiseGain;
    const ctx = this.ensureContext();
    if (!ctx || !this.fxGain) return null;

    const bufferSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600;
    bp.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.fxGain);
    src.start();

    this.leakNoiseSource = src;
    this.leakNoiseGain = gain;
    return gain;
  }

  private triggerGeigerClick(intensity01: number): void {
    if (!this.sfxEnabled || this.muted || !this.ctx || !this.fxGain) return;
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(2400 + Math.random() * 1400, now);
    const peak = 0.02 + intensity01 * 0.045;
    g.gain.setValueAtTime(peak, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.004);
    osc.connect(g);
    g.connect(this.fxGain);
    osc.start(now);
    osc.stop(now + 0.006);
  }

  private triggerHeartbeatPulse(): void {
    this.scheduleTone(56, 0.0, 0.075, "sine", 0.075, 42);
    this.scheduleTone(48, 0.14, 0.09, "sine", 0.055, 36);
  }

  private tickHazardSoundscape(): void {
    const st = this.telemetryState;
    if (!this.ctx || !this.fxGain || !this.sfxEnabled || this.muted) {
      if (this.leakNoiseGain && this.ctx) {
        this.leakNoiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
      }
      return;
    }
    if (this.ctx.state !== "running") return;

    const nowMs = Date.now();
    // Auto-duck background hazard SFX under AI radio speech
    this.fxGain.gain.setTargetAtTime(st.isAiSpeaking ? 0.18 : 1.0, this.ctx.currentTime, 0.06);

    // 1. Suit seal depressurization air-escape hiss
    const leakGain = this.ensureLeakNoiseNode();
    if (leakGain) {
      const leakTarget =
        st.isEva && st.suitPressureKpa < 37.5
          ? Math.min(0.055, ((37.5 - st.suitPressureKpa) / 14) * 0.055)
          : 0;
      leakGain.gain.setTargetAtTime(leakTarget, this.ctx.currentTime, 0.08);
    }

    // 2. Repeating NASA Master Warning / Caution loops while hazard unacknowledged
    if (st.hasUnackedAlert && !st.isAiSpeaking) {
      if (st.overallClass === 1 && nowMs - this.lastKlaxonAtMs >= 4600) {
        this.lastKlaxonAtMs = nowMs;
        this.playAlertTone(1);
      } else if (st.overallClass === 2 && nowMs - this.lastCautionAtMs >= 7200) {
        this.lastCautionAtMs = nowMs;
        this.playAlertTone(2);
      }
    }

    // 3. Geiger dosimeter crackle during radiation surge
    if (st.doseRateMsvDay > 1.35) {
      const norm = Math.min(1, Math.log10(st.doseRateMsvDay) / 2.2);
      const chance = 0.12 + norm * 0.78;
      if (Math.random() < chance) {
        this.triggerGeigerClick(norm);
        if (norm > 0.5 && Math.random() < 0.45) {
          setTimeout(() => this.triggerGeigerClick(norm * 0.8), 45 + Math.random() * 65);
        }
      }
    }

    // 4. Low heartbeat pulse on tachycardia (>138 bpm) or hypoxia (<127 mmHg)
    if ((st.heartRateBpm > 138 || st.pio2MmHg < 127) && !st.isAiSpeaking) {
      const intervalMs = Math.max(400, Math.round(60000 / Math.max(70, st.heartRateBpm)));
      if (nowMs - this.lastHeartbeatAtMs >= intervalMs) {
        this.lastHeartbeatAtMs = nowMs;
        this.triggerHeartbeatPulse();
      }
    }
  }

  public syncTelemetryAudio(next: {
    overallClass: 0 | 1 | 2 | 3;
    hasUnackedAlert: boolean;
    doseRateMsvDay: number;
    suitPressureKpa: number;
    isEva: boolean;
    heartRateBpm: number;
    pio2MmHg: number;
    isAiSpeaking: boolean;
  }): void {
    this.telemetryState = next;
    if (next.hasUnackedAlert || next.doseRateMsvDay > 1.35 || (next.isEva && next.suitPressureKpa < 37.5)) {
      this.ensureHazardLoop();
    }
  }

  public dispose(): void {
    if (this.hazardTimer) {
      clearInterval(this.hazardTimer);
      this.hazardTimer = null;
    }
    try {
      this.leakNoiseSource?.stop();
      this.leakNoiseSource?.disconnect();
    } catch {
      // ignore
    }
    this.leakNoiseSource = null;
    this.leakNoiseGain = null;
    this.stopMicMeter();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
