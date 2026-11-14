import type { AzureProxyClient } from "./azureClient";

export const AZURE_VOICES = [
  { id: "en-US-AndrewMultilingualNeural", label: "Andrew (Calm / Clear)" },
  { id: "en-US-JennyNeural", label: "Jenny (Crisp Mission Ops)" },
  { id: "en-US-AriaNeural", label: "Aria (Warm / Conversational)" },
  { id: "en-US-GuyNeural", label: "Guy (Direct)" },
] as const;

export type AzureVoiceId = (typeof AZURE_VOICES)[number]["id"];

/**
 * Voice I/O hooks (SIM-HUD-005).
 * Audio stays strictly silent until the operator connects/enables voice.
 */
export class VoiceService {
  public enabled = false;
  public selectedVoice: AzureVoiceId = "en-US-AndrewMultilingualNeural";
  private readonly client: AzureProxyClient;
  private activeAudio: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;
  private recognition: any = null;
  public isListening = false;

  constructor(client: AzureProxyClient) {
    this.client = client;
  }

  public stopSpeaking(): void {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
    }
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
  }

  public async speak(text: string): Promise<boolean> {
    if (!this.enabled || !text.trim()) return false;
    try {
      this.stopSpeaking();
      const buf = await this.client.synthesizeSpeech(text, this.selectedVoice);
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      this.activeObjectUrl = url;
      const audio = new Audio(url);
      this.activeAudio = audio;
      audio.onended = () => {
        if (this.activeObjectUrl === url) {
          URL.revokeObjectURL(url);
          this.activeObjectUrl = null;
        }
      };
      await audio.play();
      return true;
    } catch {
      // Degrade gracefully without crashing (V-11)
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
