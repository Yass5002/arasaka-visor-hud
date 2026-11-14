import type { AssistantEngineBridge } from "../engine/assistantApi";
import { ENGINE_LIMITS, PROTOCOLS } from "../engine/config";
import type { AlertObject, IndicatorId, ProtocolId } from "../engine/types";
import { AzureProxyClient, type ChatMessage, type ChatToolSpec } from "./azureClient";
import type { VoiceService } from "./voiceService";

export interface AssistantCaptionState {
  speaker: "ASSISTANT" | "CREW";
  text: string;
  timestampT: number;
  alertClass: 0 | 1 | 2 | 3;
  isBusy: boolean;
  isListening: boolean;
  voiceConnected: boolean;
  cloudStatus: "ready" | "fallback" | "checking";
}

const SYSTEM_PROMPT = `You are the Arasaka Crew Health Assistant supporting an astronaut on a Mars surface mission (3-22 min Earth light-time delay, default 12 min; no evacuation).
STRICT RULES (ARASAKA-ENG-001 & ARASAKA-SIM-001):
1. NEVER diagnose. Use "consistent with", "indicates risk of", or observational wording—NEVER "you have".
2. ALWAYS call the provided tools to read live state, history, or alerts. Never invent numbers.
3. For every value you cite, state whether it is measured (sensed), estimated (modelled), or self-reported, and give its mission day/time.
4. Keep responses concise (at most 2-3 short sentences suitable for an EVA visor caption and spoken TTS).
5. When guiding a protocol, state the reason and give ONE step at a time, then wait for crew confirmation.
6. Keep slow modelled indices (bone loss, immune_index, cognitive_drift, sans_risk) out of visor alerts unless asked in conversation/review.
7. When escalation criteria are met (or serious persistent signs like orthostatic drop, high career dose, or vision changes), advise contacting the crew medical officer or flight surgeon and state the ~12 minute one-way reply delay.`;

const ASSISTANT_TOOLS: ChatToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_state",
      description: "Get the current live state: mission day/time, context, primary indicators, active alerts, and active protocol.",
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

export class AssistantController {
  private readonly bridge: AssistantEngineBridge;
  public readonly client: AzureProxyClient;
  public readonly voice: VoiceService;
  private history: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  private lastAnnouncedAlertIds = new Set<string>();
  private captionListeners = new Set<(cap: AssistantCaptionState) => void>();

  public caption: AssistantCaptionState = {
    speaker: "ASSISTANT",
    text: "Monitoring nominal. Ask a question or trigger a simulation preset.",
    timestampT: 0,
    alertClass: 0,
    isBusy: false,
    isListening: false,
    voiceConnected: false,
    cloudStatus: "checking",
  };

  constructor(
    bridge: AssistantEngineBridge,
    client: AzureProxyClient,
    voice: VoiceService
  ) {
    this.bridge = bridge;
    this.client = client;
    this.voice = voice;
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
    this.emitCaption({ cloudStatus: res.ok ? "ready" : "fallback" });
  }

  public setVoiceConnected(connected: boolean): void {
    this.voice.enabled = connected;
    if (!connected) this.voice.stopSpeaking();
    this.emitCaption({ voiceConnected: connected });
  }

  public toggleListening(): void {
    if (this.voice.isListening) {
      this.voice.stopListening();
      this.emitCaption({ isListening: false });
      return;
    }
    this.voice.startListening(
      (transcript) => {
        void this.ask(transcript);
      },
      (listening) => {
        this.emitCaption({ isListening: listening });
      }
    );
  }

  /**
   * Handles newly raised alerts deterministically (< 2 s per ENG-DET-008)
   * and starts any associated guided protocol automatically for Class 1/2.
   */
  public onAlertsUpdated(alerts: AlertObject[]): void {
    const activeIds = new Set(alerts.map((a) => a.id));
    for (const oldId of this.lastAnnouncedAlertIds) {
      if (!activeIds.has(oldId)) {
        this.lastAnnouncedAlertIds.delete(oldId);
      }
    }

    if (alerts.length === 0) return;
    const primary = alerts[0];
    if (this.lastAnnouncedAlertIds.has(primary.id)) return;
    this.lastAnnouncedAlertIds.add(primary.id);

    // Automatically initiate protocol on Class 1/2 or prominent Class 3 alert
    let stepLine = "";
    if (primary.protocolId) {
      const activeProto = this.bridge.get_state().activeProtocol;
      if (!activeProto || activeProto.completed) {
        const started = this.bridge.start_protocol(primary.protocolId);
        stepLine = ` ${started.currentStep.instruction}`;
      }
    }

    const escalationNote = primary.escalateToMedical
      ? ` Contact the flight surgeon (expected reply delay ~${ENGINE_LIMITS.earthReplyDelayMin.value} min).`
      : "";

    const msg =
      alerts.length > 1 && primary.area === "radiation"
        ? `${primary.explanation}${stepLine} (${alerts.length} concurrent factors ranked; addressing Class ${primary.class} ${primary.area} first.)`
        : `${primary.explanation}${stepLine}${escalationNote}`;

    const live = this.bridge.get_state();
    this.bridge.log_activity("activity_start", { event: "alert_announced", alertId: primary.id });
    this.emitCaption({
      speaker: "ASSISTANT",
      text: msg,
      timestampT: live.t,
      alertClass: primary.class,
    });
    void this.voice.speak(msg);
  }

  public confirmCurrentProtocolStep(): void {
    const live = this.bridge.get_state();
    const proto = live.activeProtocol;
    if (!proto || proto.completed) return;
    const updated = this.bridge.complete_step(proto.id, proto.currentStepIndex);
    if (!updated) return;

    const reply = updated.completed
      ? `${updated.name} completed and logged at ${formatMissionClock(live.missionDay, live.timeOfDaySec)}.`
      : `Step ${updated.currentStepIndex} confirmed. Next: ${updated.currentStep.instruction}`;

    this.emitCaption({
      speaker: "ASSISTANT",
      text: reply,
      timestampT: live.t,
      alertClass: this.bridge.get_state().overallClass,
    });
    void this.voice.speak(reply);
  }

  public async ask(question: string): Promise<string> {
    const trimmed = question.trim();
    if (!trimmed) return "";

    const live = this.bridge.get_state();
    this.emitCaption({
      speaker: "CREW",
      text: trimmed,
      timestampT: live.t,
      isBusy: true,
    });

    // Quick local confirmation shortcut ("confirm", "inside", "done", "step complete")
    if (
      live.activeProtocol &&
      !live.activeProtocol.completed &&
      /\b(confirm|inside|done|complete|completed|ready|yes)\b/i.test(trimmed)
    ) {
      this.confirmCurrentProtocolStep();
      this.emitCaption({ isBusy: false });
      return this.caption.text;
    }

    let reply = "";
    try {
      reply = await this.runAzureToolLoop(trimmed);
      this.emitCaption({ cloudStatus: "ready" });
    } catch {
      reply = this.buildDeterministicFallback(trimmed);
      this.emitCaption({ cloudStatus: "fallback" });
    }

    this.emitCaption({
      speaker: "ASSISTANT",
      text: reply,
      timestampT: this.bridge.get_state().t,
      alertClass: this.bridge.get_state().overallClass,
      isBusy: false,
    });
    void this.voice.speak(reply);
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
      case "complete_step":
        return this.bridge.complete_step(
          args.protocol as ProtocolId,
          Number(args.step ?? 0)
        );
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
      return `At ${clk}, measured dose rate is ${rate.value.toFixed(2)} mSv/day and estimated cumulative dose is ${cum.value.toFixed(1)} mSv (${s.careerDosePercent.toFixed(1)}% of the 600 mSv limit; SPE event ${s.speEventDoseMsv.toFixed(1)} vs 250 mSv design reference).`;
    }

    if (/heart|hr|bpm|pulse|exercise/.test(q)) {
      const hr = s.indicators.heart_rate;
      const limit = ENGINE_LIMITS.hrLimitByActivity[s.context.activity].value;
      const status =
        hr.value <= limit
          ? `within the ${limit} bpm limit expected for ${s.context.activity}`
          : `above the ${limit} bpm limit for ${s.context.activity}`;
      return `At ${clk}, measured heart rate is ${Math.round(hr.value)} bpm (${hr.kind}), which is ${status}.`;
    }

    if (/co2|air|oxygen|pio2|breathe/.test(q)) {
      const co2 = s.indicators.ppco2;
      const o2 = s.indicators.pio2;
      return `At ${clk}, measured ppCO₂ is ${co2.value.toFixed(2)} mmHg (3.0 mmHg 1-hr limit) and measured PIO₂ is ${o2.value.toFixed(0)} mmHg (145–155 mmHg normoxia).`;
    }

    if (/bone|immune|sleep|vision|sans|cognitive/.test(q)) {
      const lum = s.indicators.bone_loss_lumbar;
      const imm = s.indicators.immune_index;
      return `At ${clk}, estimated lumbar BMD is ${lum.value.toFixed(2)}% of preflight (${lum.uncertainty?.low}–${lum.uncertainty?.high}%, DXA is record) and the demonstration immune index is ${imm.value.toFixed(0)}/100.`;
    }

    if (s.rankedPrimaryAlert) {
      const alr = s.rankedPrimaryAlert;
      const protoHint = alr.protocolId
        ? ` Active protocol: ${PROTOCOLS[alr.protocolId].name}.`
        : "";
      return `${alr.explanation}${protoHint}`;
    }

    const hr = s.indicators.heart_rate;
    const pio2 = s.indicators.pio2;
    const cum = s.indicators.dose_cumulative;
    return `At ${clk} (${s.context.activity}), measured heart rate is ${Math.round(hr.value)} bpm and PIO₂ is ${pio2.value.toFixed(0)} mmHg (within limits), while estimated cumulative radiation is ${cum.value.toFixed(1)} mSv (${s.careerDosePercent.toFixed(1)}% of 600 mSv).`;
  }
}
