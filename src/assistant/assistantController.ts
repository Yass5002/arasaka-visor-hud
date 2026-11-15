import type { AssistantEngineBridge } from "../engine/assistantApi";
import { ENGINE_LIMITS, PROTOCOLS } from "../engine/config";
import type { AlertObject, IndicatorId, LiveState, ProtocolId } from "../engine/types";
import { AzureProxyClient, type ChatMessage, type ChatToolSpec } from "./azureClient";
import type { SpeechUrgency, VoiceService } from "./voiceService";

export type CrewCallsign = "Sir" | "Commander";

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
  callsign?: CrewCallsign;
  escalationStage?: 0 | 1 | 2 | 3;
  unresponsiveEscalated?: boolean;
}

function buildSystemPrompt(callsign: CrewCallsign): string {
  return `You are the Arasaka EVA Suit Crew Health Assistant speaking directly into an astronaut's Mars surface helmet visor (Jezero Crater, outside habitat; ~12 min Earth light-time delay; no evacuation).
PERSONA & TONE:
- Address the astronaut concisely and respectfully as "${callsign}" (similar to a calm, authoritative spacecraft AI — composed under normal conditions, focused and decisive during emergencies).
- Speak naturally for two-way live helmet radio (short punchy sentences, at most 2-3 sentences per reply).
STRICT MEDICAL & TELEMETRY RULES (ARASAKA-ENG-001 & ARASAKA-SIM-001):
1. NEVER diagnose. Use "consistent with", "indicates risk of", or observational phrasing—NEVER "you have".
2. ALWAYS call the provided tools to read live state, history, or alerts. Never invent numbers.
3. For every value you cite, state whether it is measured (sensed), estimated (modelled), or self-reported, and give the mission day/time.
4. When guiding a protocol, state the hazard briefly and give ONE step at a time, then wait for confirmation from ${callsign}.
5. Keep slow modelled indices (bone loss, immune_index, cognitive_drift, sans_risk) out of visor alerts unless specifically asked.
6. When escalation criteria are met (or unresponsive crew / persistent serious anomalies), advise contacting Habitat / Flight Surgeon and note the ~12 minute one-way light-time reply delay.`;
}

const ASSISTANT_TOOLS: ChatToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_state",
      description:
        "Get the current live state: mission day/time, EVA context, primary indicators, active alerts, active protocol, and paused protocol queue.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "summarise",
      description: "Summarise an indicator over a recent time window in minutes (min, max, mean, trend).",
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
      description: "List currently active alerts ranked by class and urgency.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "explain",
      description: "Get the full recorded evidence chain for an alert ID.",
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

  public callsign: CrewCallsign = "Sir";
  public onStepMitigation?: (protocolId: ProtocolId, stepIndex: number) => void;

  private history: ChatMessage[] = [{ role: "system", content: buildSystemPrompt("Sir") }];
  private lastAnnouncedAlertIds = new Set<string>();
  private captionListeners = new Set<(cap: AssistantCaptionState) => void>();

  // Wall-clock NASA No-Response Escalation Ladder state
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private hazardTrackingKey: string | null = null;
  private hazardUnconfirmedSinceMs = 0;
  private lastCrewInteractionMs = Date.now();
  private lastStage3PulseMs = 0;
  private escalationStage: 0 | 1 | 2 | 3 = 0;

  public caption: AssistantCaptionState = {
    speaker: "ASSISTANT",
    text: "All suit systems nominal, Sir. Monitoring surface EVA telemetry.",
    interimTranscript: "",
    timestampT: 0,
    alertClass: 0,
    isBusy: false,
    isListening: false,
    isSpeaking: false,
    voiceConnected: false,
    cloudStatus: "checking",
    callsign: "Sir",
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

  public setCallsign(callsign: CrewCallsign): void {
    this.callsign = callsign;
    this.history[0] = { role: "system", content: buildSystemPrompt(callsign) };
    this.emitCaption({ callsign });
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

  /** Plays welcoming EVA suit boot greeting once the operator enters the visor */
  public announceSuitEntry(openMic = false): void {
    this.voice.fx.playBootChime();
    const msg = `EVA visor online, ${this.callsign}. Suit pressure 43.0 kilopascals, oxygen nominal. Standing by on live comms.`;
    const live = this.bridge.get_state();
    this.emitCaption({
      speaker: "ASSISTANT",
      text: msg,
      timestampT: live.t,
      alertClass: live.overallClass,
      callsign: this.callsign,
    });
    if (this.voice.enabled) {
      void this.voice.speak(msg, "nominal");
    }
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
    const ok = this.voice.startContinuousListening({
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
          ...(errorNote ? { speaker: "ASSISTANT", text: `${this.callsign}, ${errorNote}.` } : {}),
        });
      },
    });
    return ok;
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

    // Hands-free mic & audio control commands
    if (/^(mic off|stop listening|close mic|standby mic)/.test(clean)) {
      this.stopOpenMic();
      const ack = `Microphone standing by, ${this.callsign}.`;
      this.emitCaption({ speaker: "ASSISTANT", text: ack });
      void this.voice.speak(ack, "nominal");
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
    if (this.hazardTrackingKey !== key) {
      this.hazardTrackingKey = key;
      this.hazardUnconfirmedSinceMs = now;
      this.escalationStage = 0;
      return;
    }

    const silentSince = Math.max(this.hazardUnconfirmedSinceMs, this.lastCrewInteractionMs);
    const elapsedSec = (now - silentSince) / 1000;

    // Stage 1 (~14s): Direct NASA verification nudge with live sensor delta
    if (this.escalationStage === 0 && elapsedSec >= 14) {
      this.escalationStage = 1;
      const telemetryHint = this.buildLiveHazardTelemetryHint(live);
      const stepHint = activeProto ? activeProto.currentStep.instruction : primary?.title ?? "active alert";
      const msg = `${this.callsign}, verification needed: ${stepHint} (${telemetryHint}). Say confirm when done.`;
      this.voice.fx.playAlertTone(live.overallClass || 2);
      this.emitCaption({
        speaker: "ASSISTANT",
        text: msg,
        timestampT: live.t,
        alertClass: live.overallClass,
        escalationStage: 1,
      });
      if (this.voice.enabled && this.voice.autoSpeakAlerts) {
        void this.voice.speak(msg, classToUrgency(live.overallClass));
      }
      return;
    }

    // Stage 2 (~30s): Incapacitation physiology cross-check + backup directive
    if (this.escalationStage === 1 && elapsedSec >= 30) {
      this.escalationStage = 2;
      const hr = Math.round(live.indicators.heart_rate.value);
      const resp = Math.round(live.indicators.respiration_rate.value);
      const msg = `${this.callsign}, still no acknowledgment. Measured HR ${hr} bpm, resp ${resp}/min. Execute backup fail-safe immediately or acknowledge comms.`;
      this.voice.fx.playAlertTone(1);
      this.emitCaption({
        speaker: "ASSISTANT",
        text: msg,
        timestampT: live.t,
        alertClass: 1,
        escalationStage: 2,
      });
      if (this.voice.enabled && this.voice.autoSpeakAlerts) {
        void this.voice.speak(msg, "emergency");
      }
      return;
    }

    // Stage 3 (~46s+): Unresponsive Crew Escalation + Habitat / Flight Surgeon hail
    if (this.escalationStage === 2 && elapsedSec >= 46) {
      this.escalationStage = 3;
      this.lastStage3PulseMs = now;
      const protoId = activeProto?.id ?? primary?.protocolId ?? "none";
      const summary = `${this.callsign} unresponsive >45s on ${primary?.title ?? protoId}`;
      this.bridge.log_escalation(protoId, 3, summary);
      const msg = `CREW UNRESPONSIVE — ${this.callsign}, escalating telemetry packet and hailing Habitat / Flight Surgeon (expected ~12 min Earth reply delay).`;
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
        void this.voice.speak(msg, "emergency");
      }
      return;
    }

    // Periodic Class 1 transponder pulse while escalated (every ~22s)
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
        return `dose rate ${live.indicators.dose_rate.value.toFixed(1)} mSv/day`;
      case "environment": {
        const suitP = live.indicators.suit_pressure.value;
        if (suitP < 31) return `suit pressure ${suitP.toFixed(1)} kPa`;
        if (live.indicators.pio2.value < 142) return `PIO₂ ${live.indicators.pio2.value.toFixed(0)} mmHg`;
        return `ppCO₂ ${live.indicators.ppco2.value.toFixed(2)} mmHg`;
      }
      case "cardiovascular":
        return `HR ${Math.round(live.indicators.heart_rate.value)} bpm`;
      default:
        return `HR ${Math.round(live.indicators.heart_rate.value)} bpm`;
    }
  }

  /**
   * Handles newly raised alerts deterministically (< 2 s per ENG-DET-008)
   * and starts/preempts guided protocols automatically.
   */
  public onAlertsUpdated(alerts: AlertObject[]): void {
    const activeIds = new Set(alerts.map((a) => a.id));
    for (const oldId of this.lastAnnouncedAlertIds) {
      if (!activeIds.has(oldId)) {
        this.lastAnnouncedAlertIds.delete(oldId);
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
          text: `All anomalies cleared, ${this.callsign}. EVA telemetry within limits.`,
          timestampT: live.t,
        });
      }
      return;
    }

    const primary = alerts[0];
    if (this.lastAnnouncedAlertIds.has(primary.id)) return;
    this.lastAnnouncedAlertIds.add(primary.id);

    const liveBefore = this.bridge.get_state();
    let stepLine = "";
    let preemptNote = "";

    if (primary.protocolId) {
      const currentProto = liveBefore.activeProtocol;
      const shouldStartOrPreempt =
        !currentProto ||
        currentProto.completed ||
        (currentProto.id !== primary.protocolId && primary.class === 1);

      if (shouldStartOrPreempt) {
        if (currentProto && !currentProto.completed && currentProto.id !== primary.protocolId) {
          preemptNote = ` Pausing ${currentProto.name} for Class 1 priority.`;
        }
        const started = this.bridge.start_protocol(primary.protocolId);
        stepLine = ` ${started.currentStep.instruction}`;
      }
    }

    const escalationNote = primary.escalateToMedical
      ? ` Contact Flight Surgeon (~${ENGINE_LIMITS.earthReplyDelayMin.value} min reply delay).`
      : "";

    const queueNote =
      alerts.length > 1
        ? ` (${alerts.length} concurrent hazards detected; prioritizing Class ${primary.class} ${primary.area}.)`
        : "";

    const leadCall =
      primary.class === 1
        ? `Emergency alert, ${this.callsign}: `
        : primary.class === 2
          ? `Caution, ${this.callsign}: `
          : `Advisory, ${this.callsign}: `;

    const msg = `${leadCall}${primary.explanation}${preemptNote}${stepLine}${escalationNote}${queueNote}`;

    const live = this.bridge.get_state();
    this.bridge.log_activity("activity_start", { event: "alert_announced", alertId: primary.id });
    this.hazardUnconfirmedSinceMs = Date.now();
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
      void this.voice.speak(msg, classToUrgency(primary.class));
    }
  }

  public confirmCurrentProtocolStep(): void {
    this.markCrewResponsive();
    const live = this.bridge.get_state();
    const proto = live.activeProtocol;
    if (!proto || proto.completed) return;

    const confirmedStep = proto.currentStepIndex;
    const confirmedProtoId = proto.id;
    const updated = this.bridge.complete_step(confirmedProtoId, confirmedStep);
    if (!updated) return;

    this.voice.fx.playStepConfirm();
    this.onStepMitigation?.(confirmedProtoId, confirmedStep);

    const postState = this.bridge.get_state();
    let reply: string;
    if (updated.completed && postState.activeProtocol && postState.activeProtocol.id !== updated.id) {
      const resumed = postState.activeProtocol;
      reply = `${updated.name} complete, ${this.callsign}. Resuming ${resumed.name}: ${resumed.currentStep.instruction}`;
    } else if (updated.completed) {
      reply = `${updated.name} completed and logged at ${formatMissionClock(live.missionDay, live.timeOfDaySec)}, ${this.callsign}. Telemetry stabilizing.`;
    } else {
      reply = `Step ${confirmedStep + 1} confirmed, ${this.callsign}. Next: ${updated.currentStep.instruction}`;
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
      void this.voice.speak(reply, classToUrgency(postState.overallClass));
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

    // Quick local confirmation shortcut ("confirm", "inside", "done", "roger", "copy")
    if (
      live.activeProtocol &&
      !live.activeProtocol.completed &&
      /\b(confirm|inside|done|complete|completed|roger|copy|acknowledged|yes)\b/i.test(trimmed)
    ) {
      this.confirmCurrentProtocolStep();
      this.emitCaption({ isBusy: false });
      return this.caption.text;
    }

    // Quick acknowledgement for un-protocoled active alerts
    if (
      !live.activeProtocol &&
      live.rankedPrimaryAlert &&
      /\b(confirm|roger|copy|acknowledged|acknowledge)\b/i.test(trimmed)
    ) {
      this.bridge.acknowledge(live.rankedPrimaryAlert.id);
      this.voice.fx.playStepConfirm();
      const ackReply = `Acknowledged and logged, ${this.callsign}. Monitoring continues.`;
      this.emitCaption({
        speaker: "ASSISTANT",
        text: ackReply,
        timestampT: this.bridge.get_state().t,
        alertClass: this.bridge.get_state().overallClass,
        isBusy: false,
      });
      if (this.voice.enabled) {
        void this.voice.speak(ackReply, classToUrgency(this.bridge.get_state().overallClass));
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
      void this.voice.speak(reply, classToUrgency(post.overallClass));
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
        const res = this.bridge.complete_step(proto, step);
        if (res) {
          this.voice.fx.playStepConfirm();
          this.onStepMitigation?.(proto, step);
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
      return `${this.callsign}, at ${clk}, measured dose rate is ${rate.value.toFixed(2)} mSv/day and estimated cumulative dose is ${cum.value.toFixed(1)} mSv (${s.careerDosePercent.toFixed(1)}% of the 600 mSv limit; SPE event ${s.speEventDoseMsv.toFixed(1)} vs 250 mSv design reference).`;
    }

    if (/heart|hr|bpm|pulse|exercise/.test(q)) {
      const hr = s.indicators.heart_rate;
      const limit = ENGINE_LIMITS.hrLimitByActivity[s.context.activity].value;
      const status =
        hr.value <= limit
          ? `within the ${limit} bpm limit expected for ${s.context.activity}`
          : `above the ${limit} bpm limit for ${s.context.activity}`;
      return `${this.callsign}, at ${clk}, measured heart rate is ${Math.round(hr.value)} bpm (${hr.kind}), which is ${status}.`;
    }

    if (/co2|air|oxygen|pio2|pressure|breathe|leak/.test(q)) {
      const co2 = s.indicators.ppco2;
      const o2 = s.indicators.pio2;
      const press = s.indicators.suit_pressure;
      return `${this.callsign}, at ${clk}, measured suit pressure is ${press.value.toFixed(1)} kPa, measured ppCO₂ is ${co2.value.toFixed(2)} mmHg (3.0 mmHg 1-hr limit), and measured PIO₂ is ${o2.value.toFixed(0)} mmHg (145–155 mmHg normoxia).`;
    }

    if (/bone|immune|sleep|vision|sans|cognitive/.test(q)) {
      const lum = s.indicators.bone_loss_lumbar;
      const imm = s.indicators.immune_index;
      return `${this.callsign}, at ${clk}, estimated lumbar BMD is ${lum.value.toFixed(2)}% of preflight (${lum.uncertainty?.low}–${lum.uncertainty?.high}%, DXA is record) and the demonstration immune index is ${imm.value.toFixed(0)}/100.`;
    }

    if (s.rankedPrimaryAlert) {
      const alr = s.rankedPrimaryAlert;
      const protoHint = alr.protocolId
        ? ` Active protocol: ${PROTOCOLS[alr.protocolId].name}.`
        : "";
      return `${this.callsign}, ${alr.explanation}${protoHint}`;
    }

    const hr = s.indicators.heart_rate;
    const pio2 = s.indicators.pio2;
    const cum = s.indicators.dose_cumulative;
    return `${this.callsign}, at ${clk} (${s.context.activity}), measured heart rate is ${Math.round(hr.value)} bpm and PIO₂ is ${pio2.value.toFixed(0)} mmHg (within limits), while estimated cumulative radiation is ${cum.value.toFixed(1)} mSv (${s.careerDosePercent.toFixed(1)}% of 600 mSv).`;
  }
}
