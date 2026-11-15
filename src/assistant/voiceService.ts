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

  private currentAudioUrl: string | null = null;
  private player: HTMLAudioElement | null = null;
  private speechGeneration = 0;
  private isSpeaking = false;
  private lastSpokenNormalized = "";
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

  public stopSpeech(): void {
    this.speechGeneration += 1;
    if (this.player) {
      try {
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
  }

  public async speak(text: string, urgency: SpeechUrgency = "nominal"): Promise<void> {
    if (!this.enabled || !text.trim() || typeof window === "undefined") return;

    this.stopSpeech();
    const myGen = this.speechGeneration;
    this.lastSpokenNormalized = normalizeForEcho(text);

    // Clear short helmet radio open-squelch click
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
        const done = () => {
          audio.onended = null;
          audio.onerror = null;
          if (myGen === this.speechGeneration) {
            this.setSpeaking(false);
            this.fx.playCommsClick(false);
          }
          resolve();
        };
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
        const finish = () => {
          if (myGen === this.speechGeneration) {
            this.setSpeaking(false);
            this.fx.playCommsClick(false);
          }
          resolve();
        };
        utter.onend = finish;
        utter.onerror = finish;
        window.speechSynthesis.speak(utter);
      });
    }
  }

  /**
   * Filters likely speaker->mic acoustic feedback shortly after/during AI speech
   * while still allowing genuine human barge-in phrases cleanly.
   */
  private isLikelySelfEcho(transcript: string): boolean {
    const clean = normalizeForEcho(transcript);
    if (!clean) return true;

    // Short clear commands are always treated as genuine operator intent
    if (/^(confirm|check|done|acknowledged|roger|copy|stop|quiet|status|mic off)/.test(clean)) {
      return false;
    }

    const recentlySpoke = this.isSpeaking || Date.now() - this.lastSpokeEndedAtMs < 1400;
    if (!recentlySpoke || !this.lastSpokenNormalized) return false;

    const spokenWords = new Set(this.lastSpokenNormalized.split(" "));
    const heardWords = clean.split(" ");
    if (heardWords.length <= 2 && spokenWords.has(heardWords[0])) return true;

    let overlap = 0;
    for (const w of heardWords) {
      if (w.length > 2 && spokenWords.has(w)) overlap += 1;
    }
    return overlap / Math.max(1, heardWords.length) >= 0.6;
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
    this.keepListening = true;
    void this.fx.startMicMeter();
    this.spawnRecognitionInstance(Ctor);
    return true;
  }

  private spawnRecognitionInstance(Ctor: new () => SpeechRecognitionLike): void {
    if (!this.keepListening) return;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.activeRecognition) {
      try {
        this.activeRecognition.abort?.();
        this.activeRecognition.stop();
      } catch {
        // ignore
      }
      this.activeRecognition = null;
    }

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    this.activeRecognition = rec;

    let lastFinalIdx = -1;

    rec.onresult = (ev) => {
      if (!this.keepListening) return;
      let interimBuf = "";

      for (let i = ev.resultIndex ?? 0; i < ev.results.length; i++) {
        const res = ev.results[i];
        const text = res[0]?.transcript?.trim() ?? "";
        if (!text) continue;

        if (res.isFinal) {
          if (i <= lastFinalIdx) continue;
          lastFinalIdx = i;
          if (!this.isLikelySelfEcho(text)) {
            if (this.isSpeaking) {
              this.stopSpeech();
              this.micCallbacks?.onBargeIn();
            }
            this.micCallbacks?.onFinal(text);
          }
        } else {
          interimBuf += (interimBuf ? " " : "") + text;
        }
      }

      if (interimBuf && !this.isLikelySelfEcho(interimBuf)) {
        if (this.isSpeaking && interimBuf.split(/\s+/).length >= 2) {
          this.stopSpeech();
          this.micCallbacks?.onBargeIn();
        }
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
      if (this.keepListening && this.micCallbacks) {
        this.restartTimer = setTimeout(() => {
          this.spawnRecognitionInstance(Ctor);
        }, 220);
      } else {
        this.micCallbacks?.onStateChange(false);
      }
    };

    try {
      rec.start();
      this.micCallbacks?.onStateChange(true);
    } catch {
      if (this.keepListening) {
        this.restartTimer = setTimeout(() => {
          this.spawnRecognitionInstance(Ctor);
        }, 450);
      }
    }
  }

  public stopListening(): void {
    this.keepListening = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch {
        // ignore
      }
      this.activeRecognition = null;
    }
    this.fx.stopMicMeter();
    this.micCallbacks?.onStateChange(false);
    this.micCallbacks = null;
  }
}
