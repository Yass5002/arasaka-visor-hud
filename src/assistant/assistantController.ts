import type { AssistantEngineBridge } from "../engine/assistantApi";
import { ENGINE_LIMITS } from "../engine/config";
import type { AlertObject, IndicatorId, LiveState, ProtocolId } from "../engine/types";
import { AzureProxyClient, type ChatMessage, type ChatToolSpec } from "./azureClient";
import type { SpeechUrgency, VoiceService } from "./voiceService";

export interface AssistantCaptionState {
  speaker: "ASSISTANT" | "CREW";
  text: string;
  interimTranscript?: string;
  timestampT: number;
  alertClass: 0 | 1 | 2 | 3;
  isBusy: boolean;
  isListening: boolean;
  isSpeaking?: boolean;
  voiceConnected: boolean;
  cloudStatus: "ready" | "fallback" | "checking";
  escalationStage?: 0 | 1 | 2 | 3;
  unresponsiveEscalated?: boolean;
}

const SYSTEM_PROMPT = `You are the Arasaka EVA Suit Crew Health Assistant speaking over live helmet radio to an astronaut on the Mars surface (~12 min Earth reply delay; no evacuation).
PERSONA & COMMUNICATION STYLE:
- Address the astronaut naturally and respectfully as "Sir" (like JARVIS / NASA CAPCOM: calm, razor-sharp, zero fluff).
- COMMUNICATE, DO NOT LECTURE. Put the required action FIRST, keep responses to 1-2 short direct sentences (under ~25 words whenever an alert is active). Never recite textbook background stats unless Sir explicitly asks for detailed numbers or history.
STRICT SAFETY & TELEMETRY RULES (ARASAKA-ENG-001):
1. NEVER diagnose. Say "readings are consistent with" or "indicates risk of"—NEVER say "you have".
2. ALWAYS call tools to read live state, alerts, or history. Never invent numbers.
3. State whether cited numbers are measured (sensed) or estimated (modelled) with mission clock when quoting telemetry.
4. Guide ONE step at a time and wait for Sir to confirm.
5. Keep slow modelled indices (bone loss, immune_index, cognitive_drift, sans_risk) off visor alerts unless asked.
6. Only advise Flight Surgeon contact (~12 min delay) when serious escalation criteria apply.`;

const ASSISTANT_TOOLS: ChatToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_state",
      description:
        "Get current live telemetry, EVA context, active alerts, active protocol, and queued paused protocols.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "summarise",
      description: "Summarise an indicator over a recent time window in minutes.",
      parameters: {
        type: "object",
        properties: {
          indicator: { type: "string" },
          windowMinutes: { type: "number" },
        },
        required: ["indicator", "windowMinutes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_alerts",
      description: "List active alerts ranked by class and urgency.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "explain",
      description: "Get the recorded evidence chain for an alert ID.",
      parameters: {
        type: "object",
        properties: { alertId: { type: "string" } },
        required: ["alertId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_to_plan",
      description: "Compare dose_cumulative, sleep_hours, exercise_sessions, ppco2, or pio2 to NASA/mission limits.",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            enum: ["dose_cumulative", "sleep_hours", "exercise_sessions", "ppco2", "pio2"],
          },
        },
        required: ["metric"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_protocol",
      description: "Start a guided step-by-step response protocol.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: [
              "shelter",
              "air_check",
              "exertion_recovery",
              "orthostatic_response",
              "resistive_exercise",
              "sleep_reset",
              "calm_breathing",
            ],
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_step",
      description: "Confirm completion of the current protocol step and advance to the next step.",
      parameters: {
        type: "object",
        properties: {
          protocol: { type: "string" },
          step: { type: "number" },
        },
        required: ["protocol", "step"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "acknowledge",
      description: "Mark an alert as acknowledged.",
      parameters: {
        type: "object",
        properties: { alertId: { type: "string" } },
        required: ["alertId"],
      },
    },
  },
];

function formatMissionClock(day: number, todSec: number): string {
  const h = Math.floor(todSec / 3600) % 24;
  const m = Math.floor((todSec % 3600) / 60);
  return `Day ${day} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function classToUrgency(alertClass: 0 | 1 | 2 | 3): SpeechUrgency {
  if (alertClass === 1) return "emergency";
  if (alertClass === 2) return "caution";
  if (alertClass === 3) return "advisory";
  return "nominal";
}

export class AssistantController {
  private readonly bridge: AssistantEngineBridge;
  public readonly client: AzureProxyClient;
  public readonly voice: VoiceService;

  private history: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  private lastAnnouncedAlertIds = new Set<string>();
  private announcedDetectorClass = new Map<string, number>();
  private lastDetectorAnnouncedAtMs = new Map<string, number>();
  private captionListeners = new Set<(cap: AssistantCaptionState) => void>();

  // Prevents step-completion synchronous notify() from causing duplicate alert speech
  private suppressAlertSync = false;

  // Wall-clock NASA No-Response Escalation Ladder state
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private hazardTrackingKey: string | null = null;
  private hazardUnconfirmedSinceMs = 0;
  private lastCrewInteractionMs = Date.now();
  private lastAiBusyAtMs = 0;
  private lastStage3PulseMs = 0;
  private escalationStage: 0 | 1 | 2 | 3 = 0;

  public caption: AssistantCaptionState = {
    speaker: "ASSISTANT",
    text: "Suit systems nominal, Sir.",
    interimTranscript: "",
    timestampT: 0,
    alertClass: 0,
    isBusy: false,
    isListening: false,
    isSpeaking: false,
    voiceConnected: false,
    cloudStatus: "checking",
    escalationStage: 0,
    unresponsiveEscalated: false,
  };

  constructor(
    bridge: AssistantEngineBridge,
    client: AzureProxyClient,
    voice: VoiceService
  ) {
    this.bridge = bridge;
    this.client = client;
    this.voice = voice;
    this.voice.onSpeakingChange = (speaking) => {
      this.emitCaption({ isSpeaking: speaking });
    };
  }

  public subscribe(fn: (cap: AssistantCaptionState) => void): () => void {
    this.captionListeners.add(fn);
    fn(this.caption);
    return () => {
      this.captionListeners.delete(fn);
    };
  }

  private emitCaption(patch: Partial<AssistantCaptionState>): void {
    this.caption = { ...this.caption, ...patch };
    for (const fn of this.captionListeners) {
      fn(this.caption);
    }
  }

  public async probeCloud(): Promise<void> {
    this.emitCaption({ cloudStatus: "checking" });
    const res = await this.client.checkHealth();
    this.emitCaption({ cloudStatus: res.ok && res.hasLlmKey ? "ready" : "fallback" });
  }

  public setVoiceConnected(connected: boolean): void {
    this.voice.enabled = connected;
    if (connected) {
      this.voice.unlockAudio();
      this.voice.fx.setMuted(false);
    } else {
      this.voice.stopSpeech();
      this.voice.fx.setMuted(true);
    }
    this.emitCaption({ voiceConnected: connected });
  }

  /**
   * Silent nominal suit entry: plays short boot wake chord, opens mic if enabled,
   * and stays quiet during nominal conditions unless spoken to.
   */
  public enterSuitSilent(openMic = false): void {
    this.voice.fx.playBootChime();
    const live = this.bridge.get_state();
    this.emitCaption({
      speaker: "ASSISTANT",
      text: "Suit systems nominal, Sir. Standing by.",
      timestampT: live.t,
      alertClass: live.overallClass,
    });
    if (openMic) {
      this.startOpenMic();
    }
    this.startWatchdog();
  }

  public startOpenMic(): boolean {
    if (this.voice.listening) return true;
    this.voice.unlockAudio();
    if (!this.voice.enabled) {
      this.setVoiceConnected(true);
    }
    return this.voice.startContinuousListening({
      onInterim: (interim) => {
        this.emitCaption({ interimTranscript: interim });
      },
      onBargeIn: () => {
        this.markCrewResponsive();
      },
      onFinal: (transcript) => {
        this.emitCaption({ interimTranscript: "" });
        this.handleVoiceUtterance(transcript);
      },
      onStateChange: (listening, errorNote) => {
        this.emitCaption({
          isListening: listening,
          interimTranscript: listening ? this.caption.interimTranscript : "",
          ...(errorNote ? { speaker: "ASSISTANT", text: `${errorNote}, Sir.` } : {}),
        });
      },
    });
  }

  public stopOpenMic(): void {
    this.voice.stopListening();
    this.emitCaption({ isListening: false, interimTranscript: "" });
  }

  public toggleListening(): void {
    if (this.voice.listening) {
      this.stopOpenMic();
    } else {
      this.startOpenMic();
    }
  }

  private handleVoiceUtterance(transcript: string): void {
    const clean = transcript.trim().toLowerCase();
    if (!clean) return;

    if (/^(mic off|stop listening|close mic|standby mic)/.test(clean)) {
      this.stopOpenMic();
      this.emitCaption({ speaker: "ASSISTANT", text: "Mic standing by, Sir." });
      return;
    }

    if (/^(stop talking|quiet|silence|mute|belay that)/.test(clean)) {
      this.voice.stopSpeech();
      this.markCrewResponsive();
      return;
    }

    void this.ask(transcript);
  }

  public startWatchdog(): void {
    if (this.watchdogTimer) return;
    this.watchdogTimer = setInterval(() => {
      this.evaluateUnresponsiveEscalation();
    }, 1000);
  }

  public dispose(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.voice.stopListening();
    this.voice.stopSpeech();
    this.voice.fx.dispose();
  }

  private markCrewResponsive(): void {
    this.lastCrewInteractionMs = Date.now();
    if (this.escalationStage !== 0 || this.caption.unresponsiveEscalated) {
      this.escalationStage = 0;
      this.emitCaption({ escalationStage: 0, unresponsiveEscalated: false });
    }
  }

  private evaluateUnresponsiveEscalation(): void {
    const live = this.bridge.get_state();
    const activeProto = live.activeProtocol && !live.activeProtocol.completed ? live.activeProtocol : null;
    const primary = live.rankedPrimaryAlert;
    const hasUrgentHazard =
      Boolean(activeProto) || Boolean(primary && primary.class <= 2 && primary.state !== "acknowledged");

    if (!hasUrgentHazard) {
      this.hazardTrackingKey = null;
      if (this.escalationStage !== 0 || this.caption.unresponsiveEscalated) {
        this.escalationStage = 0;
        this.emitCaption({ escalationStage: 0, unresponsiveEscalated: false });
      }
      return;
    }

    const key = activeProto
      ? `${activeProto.id}:${activeProto.currentStepIndex}`
      : `${primary!.id}:${primary!.class}`;
    const now = Date.now();
    // Never count silence or stack escalation prompts while AI is actively speaking or synthesizing
    if (this.voice.busySpeaking) {
      this.lastAiBusyAtMs = now;
      return;
    }

    if (this.hazardTrackingKey !== key) {
      this.hazardTrackingKey = key;
      this.hazardUnconfirmedSinceMs = now;
      this.escalationStage = 0;
      return;
    }

    const silentSince = Math.max(
      this.hazardUnconfirmedSinceMs,
      this.lastCrewInteractionMs,
      this.lastAiBusyAtMs
    );
    const elapsedSec = (now - silentSince) / 1000;

    // Stage 1 (~14s): Direct action check-in
    if (this.escalationStage === 0 && elapsedSec >= 14) {
      this.escalationStage = 1;
      const telemetryHint = this.buildLiveHazardTelemetryHint(live);
      const stepHint = activeProto ? activeProto.currentStep.instruction : primary?.suggestedActions[0] ?? "Acknowledge";
      const msg = `Sir, check in — ${telemetryHint}. ${stepHint} Say confirm.`;
      this.voice.fx.playAlertTone(live.overallClass || 2);
      this.emitCaption({
        speaker: "ASSISTANT",
        text: msg,
        timestampT: live.t,
        alertClass: live.overallClass,
        escalationStage: 1,
      });
      if (this.voice.enabled && this.voice.autoSpeakAlerts) {
        void this.voice.speak(msg, classToUrgency(live.overallClass), false);
      }
      return;
    }

    // Stage 2 (~30s): Incapacitation check + backup order
    if (this.escalationStage === 1 && elapsedSec >= 30) {
      this.escalationStage = 2;
      const hr = Math.round(live.indicators.heart_rate.value);
      const msg = `Sir, respond now. Measured heart rate ${hr} bpm. Execute backup failsafe or confirm comms.`;
      this.voice.fx.playAlertTone(1);
      this.emitCaption({
        speaker: "ASSISTANT",
        text: msg,
        timestampT: live.t,
        alertClass: 1,
        escalationStage: 2,
      });
      if (this.voice.enabled && this.voice.autoSpeakAlerts) {
        void this.voice.speak(msg, "emergency", false);
      }
      return;
    }

    // Stage 3 (~46s+): Log unresponsive crew & hail Habitat / Flight Surgeon
    if (this.escalationStage === 2 && elapsedSec >= 46) {
      this.escalationStage = 3;
      this.lastStage3PulseMs = now;
      const protoId = activeProto?.id ?? primary?.protocolId ?? "none";
      this.bridge.log_escalation(protoId, 3, `Crew unresponsive >45s on ${primary?.title ?? protoId}`);
      const msg = `No response, Sir. Hailing Habitat Flight Surgeon — 12-minute relay delay.`;
      this.voice.fx.playEscalationPulse();
      this.emitCaption({
        speaker: "ASSISTANT",
        text: msg,
        timestampT: live.t,
        alertClass: 1,
        escalationStage: 3,
        unresponsiveEscalated: true,
      });
      if (this.voice.enabled && this.voice.autoSpeakAlerts) {
        void this.voice.speak(msg, "emergency", false);
      }
      return;
    }

    if (this.escalationStage === 3 && now - this.lastStage3PulseMs >= 22000) {
      this.lastStage3PulseMs = now;
      this.voice.fx.playEscalationPulse();
    }
  }

  private buildLiveHazardTelemetryHint(live: LiveState): string {
    const primary = live.rankedPrimaryAlert;
    if (!primary) return `HR ${Math.round(live.indicators.heart_rate.value)} bpm`;
    switch (primary.area) {
      case "radiation":
        return `dose ${live.indicators.dose_rate.value.toFixed(1)} mSv/day`;
      case "environment": {
        const suitP = live.indicators.suit_pressure.value;
        if (suitP < 31) return `suit ${suitP.toFixed(1)} kPa`;
        if (live.indicators.pio2.value < 142) return `PIO₂ ${live.indicators.pio2.value.toFixed(0)} mmHg`;
        return `ppCO₂ ${live.indicators.ppco2.value.toFixed(2)} mmHg`;
      }
      default:
        return `HR ${Math.round(live.indicators.heart_rate.value)} bpm`;
    }
  }

  private buildTacticalCallout(
    primary: AlertObject,
    stepInstruction: string,
    extraQueued: number
  ): string {
    const leadMap: Record<string, string> = {
      rad_spe_rate: `Solar flare, Sir — ${primary.whyLine}.`,
      env_pressure_bounds: `Suit leak, Sir — ${primary.whyLine}.`,
      env_pio2_low: `Oxygen dropping, Sir — ${primary.whyLine}.`,
      env_ppco2_1h: `High CO₂, Sir — ${primary.whyLine}.`,
      cv_context_hr: `High heart rate, Sir — ${primary.whyLine}.`,
      cascade_coupled: `Multiple hazards, Sir — ${primary.whyLine}.`,
    };
    const head = leadMap[primary.detectorId] ?? `${primary.title}, Sir — ${primary.whyLine}.`;
    const action = stepInstruction || primary.suggestedActions[0] || "Check suit telemetry.";
    const qNote = extraQueued > 0 ? ` (${extraQueued} more queued.)` : "";
    return `${head} ${action}${qNote}`;
  }

  /**
   * Handles newly raised alerts deterministically (< 2 s per ENG-DET-008):
   * starts/preempts top protocol, queues all concurrent secondary protocols,
   * and NEVER speaks unprompted when nominal.
   */
  public onAlertsUpdated(alerts: AlertObject[]): void {
    const activeIds = new Set(alerts.map((a) => a.id));
    const activeDetectors = new Set(alerts.map((a) => a.detectorId));
    for (const oldId of this.lastAnnouncedAlertIds) {
      if (!activeIds.has(oldId)) {
        this.lastAnnouncedAlertIds.delete(oldId);
      }
    }
    for (const det of Array.from(this.announcedDetectorClass.keys())) {
      if (!activeDetectors.has(det)) {
        this.announcedDetectorClass.delete(det);
      }
    }

    if (alerts.length === 0) {
      this.escalationStage = 0;
      if (this.caption.unresponsiveEscalated || this.caption.alertClass !== 0) {
        const live = this.bridge.get_state();
        this.emitCaption({
          alertClass: 0,
          escalationStage: 0,
          unresponsiveEscalated: false,
          speaker: "ASSISTANT",
          text: "Suit systems nominal, Sir.",
          timestampT: live.t,
        });
      }
      return;
    }

    // Queue EVERY distinct concurrent alert protocol cleanly so dual hazards never vanish
    const distinctProtocols: ProtocolId[] = [];
    for (const alr of alerts) {
      if (alr.protocolId && !distinctProtocols.includes(alr.protocolId)) {
        distinctProtocols.push(alr.protocolId);
      }
    }

    const primary = alerts[0];
    const nowWall = Date.now();
    const prevDetClass = this.announcedDetectorClass.get(primary.detectorId);
    const lastDetAt = this.lastDetectorAnnouncedAtMs.get(primary.detectorId) ?? 0;
    const escalatedToEmergency =
      prevDetClass !== undefined && prevDetClass > primary.class && primary.class === 1 && nowWall - lastDetAt >= 8000;
    const isUnannouncedPrimary =
      (!this.lastAnnouncedAlertIds.has(primary.id) && prevDetClass === undefined) || escalatedToEmergency;

    if (!isUnannouncedPrimary) {
      for (const pid of distinctProtocols) {
        this.bridge.queue_protocol(pid, true);
      }
      this.lastAnnouncedAlertIds.add(primary.id);
      return;
    }

    // Record ALL currently active alerts so dismantling cascade_coupled doesn't re-announce already-queued alerts
    for (const alr of alerts) {
      this.lastAnnouncedAlertIds.add(alr.id);
      const existingCls = this.announcedDetectorClass.get(alr.detectorId);
      if (existingCls === undefined || alr.class < existingCls) {
        this.announcedDetectorClass.set(alr.detectorId, alr.class);
      }
      this.lastDetectorAnnouncedAtMs.set(alr.detectorId, nowWall);
    }

    // If this alert arrived synchronously during confirmCurrentProtocolStep, let confirmCurrentProtocolStep speak cleanly once!
    if (this.suppressAlertSync) {
      for (const pid of distinctProtocols) {
        this.bridge.queue_protocol(pid, true);
      }
      return;
    }

    const liveBefore = this.bridge.get_state();
    let stepInstruction = "";
    if (primary.protocolId) {
      const currentProto = liveBefore.activeProtocol;
      const currentProtoClass = currentProto
        ? Math.min(
            3,
            ...(alerts.filter((a) => a.protocolId === currentProto.id).map((a) => a.class) || [3])
          )
        : 99;
      const shouldStartOrPreempt =
        !currentProto ||
        currentProto.completed ||
        (currentProto.id !== primary.protocolId && primary.class < currentProtoClass);

      if (shouldStartOrPreempt) {
        const started = this.bridge.start_protocol(primary.protocolId, true);
        stepInstruction = started.currentStep.instruction;
      } else {
        stepInstruction = currentProto.currentStep.instruction;
      }
    }

    for (const pid of distinctProtocols) {
      this.bridge.queue_protocol(pid, true);
    }

    const extraQueued = Math.max(0, distinctProtocols.length - 1);
    const msg = this.buildTacticalCallout(primary, stepInstruction, extraQueued);

    const live = this.bridge.get_state();
    this.bridge.log_activity("activity_start", { event: "alert_announced", alertId: primary.id });
    this.hazardUnconfirmedSinceMs = nowWall;
    this.lastAiBusyAtMs = nowWall;
    this.escalationStage = 0;

    if (this.voice.enabled) {
      this.voice.fx.playAlertTone(primary.class);
    }

    this.emitCaption({
      speaker: "ASSISTANT",
      text: msg,
      timestampT: live.t,
      alertClass: primary.class,
      escalationStage: 0,
      unresponsiveEscalated: false,
    });

    if (this.voice.enabled && this.voice.autoSpeakAlerts) {
      // Queue FIFO strictly without interrupting active transmissions
      void this.voice.speak(msg, classToUrgency(primary.class), false);
    }
  }

  public confirmCurrentProtocolStep(): void {
    this.markCrewResponsive();
    const live = this.bridge.get_state();
    const proto = live.activeProtocol;
    if (!proto || proto.completed) return;

    const confirmedStep = proto.currentStepIndex;
    const confirmedProtoId = proto.id;

    let updated: ReturnType<AssistantEngineBridge["complete_step"]> = null;
    this.suppressAlertSync = true;
    try {
      updated = this.bridge.complete_step(confirmedProtoId, confirmedStep);
    } finally {
      this.suppressAlertSync = false;
    }
    if (!updated) return;

    this.voice.fx.playStepConfirm();

    const postState = this.bridge.get_state();
    let reply: string;
    if (updated.completed && postState.activeProtocol && postState.activeProtocol.id !== updated.id) {
      const resumed = postState.activeProtocol;
      reply = `${updated.name} clear, Sir. Next: ${resumed.currentStep.instruction}`;
    } else if (updated.completed) {
      reply = `Cleared, Sir.`;
    } else {
      reply = `Copy, Sir. Next: ${updated.currentStep.instruction}`;
    }

    this.hazardUnconfirmedSinceMs = Date.now();
    this.emitCaption({
      speaker: "ASSISTANT",
      text: reply,
      timestampT: postState.t,
      alertClass: postState.overallClass,
      escalationStage: 0,
      unresponsiveEscalated: false,
    });
    if (this.voice.enabled) {
      void this.voice.speak(reply, classToUrgency(postState.overallClass), false);
    }
  }

  public async ask(question: string): Promise<string> {
    const trimmed = question.trim();
    if (!trimmed) return "";

    this.markCrewResponsive();
    if (this.voice.enabled) {
      this.voice.unlockAudio();
    }

    const live = this.bridge.get_state();
    this.emitCaption({
      speaker: "CREW",
      text: trimmed,
      interimTranscript: "",
      timestampT: live.t,
      isBusy: true,
    });

    // Fast voice/text confirmation shortcut
    if (
      live.activeProtocol &&
      !live.activeProtocol.completed &&
      /\b(confirm|inside|done|complete|completed|roger|copy|acknowledged|yes)\b/i.test(trimmed)
    ) {
      this.confirmCurrentProtocolStep();
      this.emitCaption({ isBusy: false });
      return this.caption.text;
    }

    if (
      !live.activeProtocol &&
      live.rankedPrimaryAlert &&
      /\b(confirm|roger|copy|acknowledged|acknowledge)\b/i.test(trimmed)
    ) {
      this.bridge.acknowledge(live.rankedPrimaryAlert.id);
      this.voice.fx.playStepConfirm();
      const ackReply = `Acknowledged, Sir.`;
      this.emitCaption({
        speaker: "ASSISTANT",
        text: ackReply,
        timestampT: this.bridge.get_state().t,
        alertClass: this.bridge.get_state().overallClass,
        isBusy: false,
      });
      if (this.voice.enabled) {
        void this.voice.speak(ackReply, classToUrgency(this.bridge.get_state().overallClass), false);
      }
      return ackReply;
    }

    let reply = "";
    try {
      reply = await this.runAzureToolLoop(trimmed);
      this.emitCaption({ cloudStatus: "ready" });
    } catch {
      reply = this.buildDeterministicFallback(trimmed);
      this.emitCaption({ cloudStatus: "fallback" });
    }

    const post = this.bridge.get_state();
    this.emitCaption({
      speaker: "ASSISTANT",
      text: reply,
      timestampT: post.t,
      alertClass: post.overallClass,
      isBusy: false,
    });
    if (this.voice.enabled) {
      void this.voice.speak(reply, classToUrgency(post.overallClass), false);
    }
    return reply;
  }

  private async runAzureToolLoop(userText: string): Promise<string> {
    const messages: ChatMessage[] = [
      ...this.history.slice(-10),
      { role: "user", content: userText },
    ];

    for (let round = 0; round < 4; round++) {
      const { message } = await this.client.chatCompletion(messages, ASSISTANT_TOOLS);
      messages.push(message);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        const finalContent = message.content?.trim() || this.buildDeterministicFallback(userText);
        this.history = [this.history[0], ...messages.slice(-8)];
        return finalContent;
      }

      for (const tc of message.tool_calls) {
        const result = this.executeTool(tc.function.name, tc.function.arguments);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return this.buildDeterministicFallback(userText);
  }

  private executeTool(name: string, rawArgs: string): unknown {
    let args: Record<string, any> = {};
    try {
      args = rawArgs ? JSON.parse(rawArgs) : {};
    } catch {
      args = {};
    }

    switch (name) {
      case "get_state": {
        const s = this.bridge.get_state();
        return {
          missionDay: s.missionDay,
          clock: formatMissionClock(s.missionDay, s.timeOfDaySec),
          context: s.context,
          overallClass: s.overallClass,
          careerDosePercent: s.careerDosePercent,
          speEventDoseMsv: s.speEventDoseMsv,
          activeProtocol: s.activeProtocol,
          pausedProtocols: s.pausedProtocols,
          activeAlerts: s.activeAlerts,
          primaryVitals: {
            dose_rate: s.indicators.dose_rate,
            dose_cumulative: s.indicators.dose_cumulative,
            ppco2: s.indicators.ppco2,
            pio2: s.indicators.pio2,
            pressure:
              s.context.activity === "eva"
                ? s.indicators.suit_pressure
                : s.indicators.cabin_pressure,
            heart_rate: s.indicators.heart_rate,
            hrv_rmssd: s.indicators.hrv_rmssd,
            sleep_hours: s.indicators.sleep_hours,
            bone_loss_lumbar: s.indicators.bone_loss_lumbar,
            immune_index: s.indicators.immune_index,
            cognitive_drift: s.indicators.cognitive_drift,
            sans_risk: s.indicators.sans_risk,
          },
        };
      }
      case "summarise":
        return this.bridge.summarise(
          args.indicator as IndicatorId,
          Number(args.windowMinutes ?? 60)
        );
      case "get_alerts":
        return this.bridge.get_alerts("active");
      case "explain":
        return this.bridge.explain(String(args.alertId || ""));
      case "compare_to_plan":
        return this.bridge.compare_to_plan(args.metric);
      case "start_protocol":
        return this.bridge.start_protocol(args.name as ProtocolId);
      case "complete_step": {
        const proto = args.protocol as ProtocolId;
        const step = Number(args.step ?? 0);
        let res: ReturnType<AssistantEngineBridge["complete_step"]> = null;
        this.suppressAlertSync = true;
        try {
          res = this.bridge.complete_step(proto, step);
        } finally {
          this.suppressAlertSync = false;
        }
        if (res) {
          this.voice.fx.playStepConfirm();
        }
        return res;
      }
      case "acknowledge":
        return this.bridge.acknowledge(String(args.alertId || ""));
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  /**
   * Guarantees grounded, non-diagnostic replies if offline or before proxy setup (V-11).
   */
  public buildDeterministicFallback(question: string): string {
    const s = this.bridge.get_state();
    const clk = formatMissionClock(s.missionDay, s.timeOfDaySec);
    const q = question.toLowerCase();

    if (/dose|rad|shelter|dangerous|how long/.test(q)) {
      const rate = s.indicators.dose_rate;
      const cum = s.indicators.dose_cumulative;
      return `Sir, at ${clk}, measured dose rate is ${rate.value.toFixed(2)} mSv/day and estimated cumulative dose is ${cum.value.toFixed(1)} mSv (${s.careerDosePercent.toFixed(1)}% of 600 mSv limit).`;
    }

    if (/heart|hr|bpm|pulse|exercise/.test(q)) {
      const hr = s.indicators.heart_rate;
      const limit = ENGINE_LIMITS.hrLimitByActivity[s.context.activity].value;
      const status =
        hr.value <= limit
          ? `within the ${limit} bpm limit expected for ${s.context.activity}`
          : `above the ${limit} bpm limit for ${s.context.activity}`;
      return `Sir, at ${clk}, measured heart rate is ${Math.round(hr.value)} bpm (${hr.kind}), which is ${status}.`;
    }

    if (/co2|air|oxygen|pio2|pressure|breathe|leak/.test(q)) {
      const co2 = s.indicators.ppco2;
      const o2 = s.indicators.pio2;
      const press = s.indicators.suit_pressure;
      return `Sir, at ${clk}, suit pressure is ${press.value.toFixed(1)} kPa, measured ppCO₂ is ${co2.value.toFixed(2)} mmHg, and PIO₂ is ${o2.value.toFixed(0)} mmHg.`;
    }

    if (/bone|immune|sleep|vision|sans|cognitive/.test(q)) {
      const lum = s.indicators.bone_loss_lumbar;
      const imm = s.indicators.immune_index;
      return `Sir, at ${clk}, estimated lumbar BMD is ${lum.value.toFixed(2)}% of preflight (${lum.uncertainty?.low}–${lum.uncertainty?.high}%, DXA is record) and the demonstration immune index is ${imm.value.toFixed(0)}/100.`;
    }

    if (s.rankedPrimaryAlert) {
      const alr = s.rankedPrimaryAlert;
      const stepHint = s.activeProtocol
        ? ` Action: ${s.activeProtocol.currentStep.instruction}`
        : "";
      return `Sir, ${alr.whyLine}.${stepHint}`;
    }

    const hr = s.indicators.heart_rate;
    const pio2 = s.indicators.pio2;
    const press = s.indicators.suit_pressure;
    return `All nominal, Sir (${clk}). Measured HR ${Math.round(hr.value)} bpm, suit pressure ${press.value.toFixed(1)} kPa, PIO₂ ${pio2.value.toFixed(0)} mmHg.`;
  }
}
