import type { AzureProxyClient } from "./azureClient";

export const AZURE_VOICES = [
  { id: "en-US-AndrewMultilingualNeural", label: "Andrew (Calm / Clear)" },
  { id: "en-US-JennyNeural", label: "Jenny (Crisp Mission Ops)" },
  { id: "en-US-AriaNeural", label: "Aria (Warm / Conversational)" },
  { id: "en-US-GuyNeural", label: "Guy (Direct)" },
] as const;

export type AzureVoiceId = (typeof AZURE_VOICES)[number]["id"];

// Tiny silent PCM WAV so a single HTMLAudioElement can be unlocked synchronously in click handlers
const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

/**
 * Voice I/O hooks (SIM-HUD-005).
 * Audio stays strictly silent until the operator connects/enables voice.
 * Uses a single reusable HTMLAudioElement unlocked on user gesture so delayed
 * async TTS after LLM tool calls is never blocked by browser autoplay policies.
 */
export class VoiceService {
  public enabled = false;
  public selectedVoice: AzureVoiceId = "en-US-AndrewMultilingualNeural";
  private readonly client: AzureProxyClient;
  private player: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;
  private recognition: any = null;
  public isListening = false;
  public isSpeaking = false;
  private onSpeakingChange?: (speaking: boolean) => void;

  constructor(client: AzureProxyClient) {
    this.client = client;
  }

  public setSpeakingListener(cb: (speaking: boolean) => void): void {
    this.onSpeakingChange = cb;
  }

  private ensurePlayer(): HTMLAudioElement | null {
    if (typeof Audio === "undefined") return null;
    if (!this.player) {
      this.player = new Audio();
      this.player.preload = "auto";
    }
    return this.player;
  }

  /**
   * Call synchronously inside click/submit handlers so Chrome/Safari/Edge allow
   * asynchronous audio playback when Azure chat + TTS complete seconds later.
   */
  public unlockAudio(): void {
    const p = this.ensurePlayer();
    if (!p) return;
    if (p.paused && !p.src) {
      try {
        p.src = SILENT_WAV_DATA_URI;
        const prom = p.play();
        if (prom && typeof prom.catch === "function") {
          prom.catch(() => {
            // ignore unlock rejections in headless environments
          });
        }
      } catch {
        // ignore
      }
    }
  }

  public stopSpeaking(): void {
    if (this.player) {
      try {
        this.player.pause();
        this.player.currentTime = 0;
      } catch {
        // ignore
      }
    }
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakingChange?.(false);
    }
  }

  public async speak(text: string, forceEnable = false): Promise<boolean> {
    if ((!this.enabled && !forceEnable) || !text.trim()) return false;
    try {
      this.stopSpeaking();
      const player = this.ensurePlayer();
      if (!player) return false;

      const buf = await this.client.synthesizeSpeech(text, this.selectedVoice);
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      this.activeObjectUrl = url;

      this.isSpeaking = true;
      this.onSpeakingChange?.(true);

      player.onended = () => {
        if (this.activeObjectUrl === url) {
          URL.revokeObjectURL(url);
          this.activeObjectUrl = null;
        }
        this.isSpeaking = false;
        this.onSpeakingChange?.(false);
      };
      player.onerror = () => {
        this.isSpeaking = false;
        this.onSpeakingChange?.(false);
      };

      player.src = url;
      await player.play();
      return true;
    } catch {
      this.isSpeaking = false;
      this.onSpeakingChange?.(false);
      // Browser Web Speech fallback if Azure TTS failed or autoplay restricted
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = "en-US";
          window.speechSynthesis.speak(utter);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  public isSttSupported(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  public startListening(
    onTranscript: (text: string) => void,
    onStateChange?: (listening: boolean) => void
  ): boolean {
    if (!this.isSttSupported()) return false;
    const w = window as unknown as Record<string, any>;
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    try {
      this.unlockAudio();
      const rec = new Rec();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => {
        this.isListening = true;
        onStateChange?.(true);
      };
      rec.onresult = (evt: any) => {
        const transcript = evt?.results?.[0]?.[0]?.transcript;
        if (typeof transcript === "string" && transcript.trim()) {
          onTranscript(transcript.trim());
        }
      };
      rec.onerror = () => {
        this.isListening = false;
        onStateChange?.(false);
      };
      rec.onend = () => {
        this.isListening = false;
        onStateChange?.(false);
      };
      this.recognition = rec;
      rec.start();
      return true;
    } catch {
      this.isListening = false;
      onStateChange?.(false);
      return false;
    }
  }

  public stopListening(): void {
    try {
      this.recognition?.stop();
    } catch {
      // ignore
    }
    this.isListening = false;
  }
}
