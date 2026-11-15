import type { AzureProxyClient } from "./azureClient";
import { SuitAudioEngine } from "./audioFx";

export type VoiceGender = "male" | "female";
export type SpeechUrgency = "nominal" | "advisory" | "caution" | "emergency";
export type AzureVoiceId =
  | "en-US-AndrewMultilingualNeural"
  | "en-US-AvaMultilingualNeural"
  | "en-US-BrianMultilingualNeural"
  | "en-US-EmmaMultilingualNeural";

export const AZURE_VOICES: Record<VoiceGender, AzureVoiceId> = {
  male: "en-US-AndrewMultilingualNeural",
  female: "en-US-AvaMultilingualNeural",
};

export const AZURE_VOICE_OPTIONS: ReadonlyArray<{ id: AzureVoiceId; label: string }> = [
  { id: "en-US-AndrewMultilingualNeural", label: "Andrew — Composed Suit AI (Male)" },
  { id: "en-US-AvaMultilingualNeural", label: "Ava — Warm Aerospace AI (Female)" },
  { id: "en-US-BrianMultilingualNeural", label: "Brian — Mission Flight Controller (Male)" },
  { id: "en-US-EmmaMultilingualNeural", label: "Emma — Crisp Telemetry Lead (Female)" },
];

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [idx: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

export interface DuplexMicCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onBargeIn: () => void;
  onStateChange: (listening: boolean, errorNote?: string) => void;
}

function normalizeForEcho(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class VoiceService {
  private readonly azure: AzureProxyClient;
  public readonly fx = new SuitAudioEngine();

  /** Starts false before user audio unlock gesture; App sets true on EVA Suit entry */
  public enabled = false;
  public gender: VoiceGender = "male";
  public selectedVoiceId: AzureVoiceId = "en-US-AndrewMultilingualNeural";
  public autoSpeakAlerts = true;

  private activeRecognition: SpeechRecognitionLike | null = null;
  private keepListening = false;
  private micCallbacks: DuplexMicCallbacks | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private activeRecCtor: (new () => SpeechRecognitionLike) | null = null;
  private isTxActive = false;
  private micCooldownUntilMs = 0;

  private currentAudioUrl: string | null = null;
  private player: HTMLAudioElement | null = null;
  private speechGeneration = 0;
  private speechQueueTail: Promise<void> = Promise.resolve();
  private pendingSpeechCount = 0;
  private pendingNormalizedTexts = new Set<string>();
  private recentSpokenNormalized: string[] = [];
  private activeUrgency: SpeechUrgency = "nominal";
  private settleCurrentPlayback: (() => void) | null = null;
  private isSpeaking = false;
  private lastSpokeEndedAtMs = 0;

  public onSpeakingChange?: (speaking: boolean) => void;

  constructor(azure: AzureProxyClient) {
    this.azure = azure;
  }

  public get voiceName(): string {
    return this.selectedVoiceId || AZURE_VOICES[this.gender];
  }

  public setVoiceById(id: AzureVoiceId): void {
    this.selectedVoiceId = id;
    this.gender = id.includes("Ava") || id.includes("Emma") ? "female" : "male";
  }

  public get speaking(): boolean {
    return this.isSpeaking;
  }

  public get busySpeaking(): boolean {
    return this.isSpeaking || this.isTxActive || this.pendingSpeechCount > 0;
  }

  public get listening(): boolean {
    return this.keepListening;
  }

  public get supportsSpeechRecognition(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  public unlockAudio(): void {
    this.fx.unlock();
    if (typeof window === "undefined") return;
    try {
      if (!this.player) {
        this.player = new Audio();
        this.player.preload = "auto";
        this.fx.attachSpeechElement(this.player);
      }
      // Subtle unlocked zero-volume warm-up inside click handler
      this.player.muted = true;
      this.player.play().catch(() => {});
      this.player.pause();
      this.player.muted = false;
    } catch {
      // ignore unlock errors
    }
  }

  private setSpeaking(speaking: boolean): void {
    if (this.isSpeaking === speaking) return;
    this.isSpeaking = speaking;
    if (!speaking) {
      this.lastSpokeEndedAtMs = Date.now();
    }
    this.onSpeakingChange?.(speaking);
  }

  private pauseRecognitionForTx(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.activeRecognition) {
      const rec = this.activeRecognition;
      this.activeRecognition = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort?.();
        rec.stop();
      } catch {
        // ignore
      }
    }
  }

  private scheduleRecognitionResumeAfterTx(delayMs = 850): void {
    if (!this.keepListening || !this.activeRecCtor || this.isTxActive || this.pendingSpeechCount > 0) {
      return;
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.keepListening && this.activeRecCtor && !this.isTxActive && this.pendingSpeechCount === 0) {
        this.spawnRecognitionInstance(this.activeRecCtor);
      }
    }, delayMs);
  }

  public stopSpeech(): void {
    this.speechGeneration += 1;
    this.speechQueueTail = Promise.resolve();
    this.pendingSpeechCount = 0;
    this.pendingNormalizedTexts.clear();
    this.isTxActive = false;
    this.activeUrgency = "nominal";

    const settle = this.settleCurrentPlayback;
    this.settleCurrentPlayback = null;
    if (settle) {
      try {
        settle();
      } catch {
        // ignore
      }
    }

    if (this.player) {
      try {
        this.player.onended = null;
        this.player.onerror = null;
        this.player.pause();
        this.player.currentTime = 0;
      } catch {
        // ignore
      }
    }
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.setSpeaking(false);
    this.micCooldownUntilMs = Date.now() + 300;
    this.scheduleRecognitionResumeAfterTx(300);
  }

  public speak(
    text: string,
    urgency: SpeechUrgency = "nominal",
    interrupt = false
  ): Promise<void> {
    if (!this.enabled || !text.trim() || typeof window === "undefined") {
      return Promise.resolve();
    }

    const norm = normalizeForEcho(text);
    if (!norm) return Promise.resolve();

    // Never allow a lower/equal-urgency automated call to chop an active emergency mid-sentence
    const shouldInterrupt =
      interrupt && !(this.busySpeaking && this.activeUrgency === "emergency" && urgency !== "nominal");

    if (shouldInterrupt) {
      this.stopSpeech();
    } else if (this.pendingNormalizedTexts.has(norm)) {
      // Drop exact duplicate already speaking or sitting in the FIFO queue
      return this.speechQueueTail;
    }

    this.pendingNormalizedTexts.add(norm);
    this.pendingSpeechCount += 1;
    const targetGen = this.speechGeneration;

    const job = async () => {
      try {
        if (targetGen !== this.speechGeneration || !this.enabled) return;
        this.isTxActive = true;
        this.activeUrgency = urgency;
        this.pauseRecognitionForTx();
        await this.playUtteranceNow(text, urgency, targetGen);
      } finally {
        this.pendingNormalizedTexts.delete(norm);
        this.pendingSpeechCount = Math.max(0, this.pendingSpeechCount - 1);
        if (targetGen === this.speechGeneration && this.pendingSpeechCount === 0) {
          this.isTxActive = false;
          this.activeUrgency = "nominal";
          this.micCooldownUntilMs = Date.now() + 850;
          this.scheduleRecognitionResumeAfterTx(850);
        }
      }
    };

    this.speechQueueTail = this.speechQueueTail.then(job, job);
    return this.speechQueueTail;
  }

  private async playUtteranceNow(
    text: string,
    urgency: SpeechUrgency,
    myGen: number
  ): Promise<void> {
    if (myGen !== this.speechGeneration || !this.enabled || !text.trim()) return;

    const norm = normalizeForEcho(text);
    this.recentSpokenNormalized.push(norm);
    if (this.recentSpokenNormalized.length > 5) {
      this.recentSpokenNormalized.shift();
    }
    this.fx.playCommsClick(true);

    try {
      const mp3Bytes = await this.azure.synthesizeSpeech(text, this.voiceName, urgency);
      if (myGen !== this.speechGeneration || !this.enabled) return;

      const blob = new Blob([mp3Bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      this.currentAudioUrl = url;

      if (!this.player) {
        this.player = new Audio();
        this.fx.attachSpeechElement(this.player);
      }

      const audio = this.player;
      audio.src = url;
      this.setSpeaking(true);

      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          if (this.settleCurrentPlayback === done) {
            this.settleCurrentPlayback = null;
          }
          audio.onended = null;
          audio.onerror = null;
          if (myGen === this.speechGeneration) {
            this.setSpeaking(false);
            this.fx.playCommsClick(false);
          }
          resolve();
        };
        this.settleCurrentPlayback = done;
        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(done);
      });
      return;
    } catch {
      if (myGen !== this.speechGeneration || !this.enabled) return;
    }

    // Fallback to browser Web Speech Synthesis if Azure TTS proxy unreachable
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate =
        urgency === "emergency"
          ? 1.14
          : urgency === "caution"
            ? 1.06
            : urgency === "advisory"
              ? 1.02
              : 0.98;
      utter.pitch = this.gender === "male" ? 0.94 : 1.08;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utter.voice = preferred;
      this.setSpeaking(true);
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (this.settleCurrentPlayback === finish) {
            this.settleCurrentPlayback = null;
          }
          if (myGen === this.speechGeneration) {
            this.setSpeaking(false);
            this.fx.playCommsClick(false);
          }
          resolve();
        };
        this.settleCurrentPlayback = finish;
        utter.onend = finish;
        utter.onerror = finish;
        window.speechSynthesis.speak(utter);
      });
    }
  }

  /**
   * Secondary echo shield against acoustic feedback in open-mic mode.
   */
  private isLikelySelfEcho(transcript: string): boolean {
    const clean = normalizeForEcho(transcript);
    if (!clean) return true;
    if (this.isTxActive || this.isSpeaking || Date.now() < this.micCooldownUntilMs) {
      return true;
    }

    const recentlySpoke = Date.now() - this.lastSpokeEndedAtMs < 1800;
    if (!recentlySpoke || this.recentSpokenNormalized.length === 0) return false;

    const spokenWords = new Set(this.recentSpokenNormalized.join(" ").split(" "));
    const heardWords = clean.split(" ");
    let overlap = 0;
    for (const w of heardWords) {
      if (w.length > 2 && spokenWords.has(w)) overlap += 1;
    }
    return overlap / Math.max(1, heardWords.length) >= 0.45;
  }

  /**
   * Keeps the helmet microphone open continuously across silence/timeouts until
   * stopListening() is explicitly called by the crew or voice command ("mic off").
   */
  public startContinuousListening(callbacks: DuplexMicCallbacks): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return false;

    this.micCallbacks = callbacks;
    this.activeRecCtor = Ctor;
    this.keepListening = true;
    void this.fx.startMicMeter();
    this.micCallbacks?.onStateChange(true);
    if (!this.isTxActive && this.pendingSpeechCount === 0) {
      this.spawnRecognitionInstance(Ctor);
    }
    return true;
  }

  private spawnRecognitionInstance(Ctor: new () => SpeechRecognitionLike): void {
    if (!this.keepListening || this.isTxActive || this.pendingSpeechCount > 0) return;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.activeRecognition) {
      const oldRec = this.activeRecognition;
      this.activeRecognition = null;
      oldRec.onresult = null;
      oldRec.onerror = null;
      oldRec.onend = null;
      try {
        oldRec.abort?.();
        oldRec.stop();
      } catch {
        // ignore
      }
    }

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    this.activeRecognition = rec;

    let lastFinalIdx = -1;

    rec.onresult = (ev) => {
      // Strictly ignore speaker playback / cooldown windows so AI NEVER hears or interrupts itself
      if (
        !this.keepListening ||
        this.isTxActive ||
        this.isSpeaking ||
        Date.now() < this.micCooldownUntilMs
      ) {
        return;
      }
      let interimBuf = "";

      for (let i = ev.resultIndex ?? 0; i < ev.results.length; i++) {
        const res = ev.results[i];
        const text = res[0]?.transcript?.trim() ?? "";
        if (!text) continue;

        if (res.isFinal) {
          if (i <= lastFinalIdx) continue;
          lastFinalIdx = i;
          if (!this.isLikelySelfEcho(text)) {
            this.micCallbacks?.onBargeIn();
            this.micCallbacks?.onFinal(text);
          }
        } else {
          interimBuf += (interimBuf ? " " : "") + text;
        }
      }

      if (interimBuf && !this.isLikelySelfEcho(interimBuf)) {
        this.micCallbacks?.onInterim(interimBuf);
      }
    };

    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        this.keepListening = false;
        this.fx.stopMicMeter();
        this.micCallbacks?.onStateChange(false, "Microphone permission denied");
      }
    };

    rec.onend = () => {
      if (this.activeRecognition === rec) {
        this.activeRecognition = null;
      }
      if (!this.keepListening || !this.micCallbacks) {
        this.micCallbacks?.onStateChange(false);
        return;
      }
      // During AI transmission, resume is handled after TX cooldown instead of spawning mid-speech
      if (!this.isTxActive && this.pendingSpeechCount === 0) {
        this.restartTimer = setTimeout(() => {
          this.spawnRecognitionInstance(Ctor);
        }, 250);
      }
    };

    try {
      rec.start();
      this.micCallbacks?.onStateChange(true);
    } catch {
      if (this.keepListening && !this.isTxActive) {
        this.restartTimer = setTimeout(() => {
          this.spawnRecognitionInstance(Ctor);
        }, 450);
      }
    }
  }

  public stopListening(): void {
    this.keepListening = false;
    this.activeRecCtor = null;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.activeRecognition) {
      const rec = this.activeRecognition;
      this.activeRecognition = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
    this.fx.stopMicMeter();
    this.micCallbacks?.onStateChange(false);
    this.micCallbacks = null;
  }
}
