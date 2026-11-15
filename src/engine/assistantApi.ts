import { ENGINE_LIMITS } from "./config";
import type { CrewHealthEngine } from "./engine";
import type {
  ActiveProtocolState,
  AlertObject,
  AlertState,
  EventLogEntry,
  EventLogType,
  IndicatorId,
  IndicatorSummary,
  LiveState,
  ProtocolId,
} from "./types";

/**
 * Exposes ONLY the Section 8 query & action calls of ARASAKA-ENG-001 (ENG-AST-001).
 * The Assistant has zero direct access to underlying store internals and every call
 * is logged to the append-only event log (ENG-AST-003).
 */
export class AssistantEngineBridge {
  private readonly engine: CrewHealthEngine;

  constructor(engine: CrewHealthEngine) {
    this.engine = engine;
  }

  // =========================================================================
  // 8.1 QUERY CALLS
  // =========================================================================

  public get_state(): LiveState {
    return this.engine.getLiveState();
  }

  public get_history(
    indicator: IndicatorId,
    fromT: number,
    toT: number,
    resolution: "full" | "hourly" | "daily" = "hourly"
  ): Array<{ t: number; value: number; min: number; max: number }> {
    return this.engine.store.getRollupSeries(indicator, fromT, toT, resolution);
  }

  public summarise(indicator: IndicatorId, windowMinutes: number): IndicatorSummary | null {
    return this.engine.store.summarise(indicator, this.engine.getTime(), windowMinutes);
  }

  public get_events(
    type?: EventLogType,
    fromT?: number,
    toT?: number
  ): EventLogEntry[] {
    return this.engine.store.getEvents({ type, fromT, toT });
  }

  public get_alerts(state: AlertState | "all" = "active"): AlertObject[] {
    const active = this.engine.getLiveState().activeAlerts;
    if (state === "all" || state === "active") return active;
    return active.filter((a) => a.state === state);
  }

  public compare_to_plan(metric: "dose_cumulative" | "sleep_hours" | "exercise_sessions" | "ppco2" | "pio2") {
    const live = this.engine.getLiveState();
    switch (metric) {
      case "dose_cumulative":
        return {
          metric,
          observed: live.indicators.dose_cumulative.value,
          kind: live.indicators.dose_cumulative.kind,
          t: live.indicators.dose_cumulative.t,
          limit: ENGINE_LIMITS.careerDoseLimitMsv.value,
          percentUsed: live.careerDosePercent,
          basis: ENGINE_LIMITS.careerDoseLimitMsv.basis,
        };
      case "sleep_hours":
        return {
          metric,
          observed: live.indicators.sleep_hours.value,
          kind: live.indicators.sleep_hours.kind,
          t: live.indicators.sleep_hours.t,
          baselineTarget: live.profile.usualSleepHours,
          basis: live.indicators.sleep_hours.basis,
        };
      case "exercise_sessions":
        return {
          metric,
          observed: live.indicators.exercise_sessions.value,
          kind: live.indicators.exercise_sessions.kind,
          t: live.indicators.exercise_sessions.t,
          targetPerWeek: live.profile.exerciseSessionsPerWeek,
          basis: live.indicators.exercise_sessions.basis,
        };
      case "ppco2":
        return {
          metric,
          observed: live.indicators.ppco2.value,
          kind: live.indicators.ppco2.kind,
          t: live.indicators.ppco2.t,
          limit1h: ENGINE_LIMITS.ppco2OneHourLimitMmHg.value,
          basis: ENGINE_LIMITS.ppco2OneHourLimitMmHg.basis,
        };
      case "pio2":
        return {
          metric,
          observed: live.indicators.pio2.value,
          kind: live.indicators.pio2.kind,
          t: live.indicators.pio2.t,
          normoxiaMin: ENGINE_LIMITS.pio2NormoxiaLowMmHg.value,
          normoxiaMax: ENGINE_LIMITS.pio2NormoxiaHighMmHg.value,
          mildHypoxiaFloor: ENGINE_LIMITS.pio2MildHypoxiaMmHg.value,
          basis: ENGINE_LIMITS.pio2NormoxiaLowMmHg.basis,
        };
    }
  }

  public explain(alertId: string) {
    const alr = this.engine.getLiveState().activeAlerts.find((a) => a.id === alertId);
    if (!alr) return null;
    return {
      id: alr.id,
      class: alr.class,
      area: alr.area,
      title: alr.title,
      whyLine: alr.whyLine,
      evidence: alr.evidence,
      explanation: alr.explanation,
      suggestedActions: alr.suggestedActions,
      escalateToMedical: alr.escalateToMedical ?? false,
      expectedReplyDelayMin: ENGINE_LIMITS.earthReplyDelayMin.value,
    };
  }

  // =========================================================================
  // 8.2 ACTION CALLS
  // =========================================================================

  public start_protocol(name: ProtocolId, autoTriggered = false): ActiveProtocolState {
    return this.engine.startProtocol(name, autoTriggered);
  }

  public queue_protocol(name: ProtocolId, autoTriggered = false): void {
    this.engine.queueProtocol(name, autoTriggered);
  }

  public complete_step(protocol: ProtocolId, step: number): ActiveProtocolState | null {
    return this.engine.completeProtocolStep(protocol, step);
  }

  public log_activity(type: "exercise_session" | "meal" | "sleep_end" | "activity_start", details: Record<string, unknown>) {
    return this.engine.ingestEvent(this.engine.getTime(), type, { ...details, loggedBy: "assistant" }, undefined, true);
  }

  public acknowledge(alertId: string): AlertObject | null {
    return this.engine.acknowledgeAlert(alertId);
  }

  public log_escalation(
    protocolId: ProtocolId | "none",
    stage: number,
    summary: string
  ): EventLogEntry {
    return this.engine.ingestEvent(
      this.engine.getTime(),
      "unresponsive_crew_escalation",
      {
        protocolId,
        stage,
        summary,
        earthDelayMin: ENGINE_LIMITS.earthReplyDelayMin.value,
      },
      undefined,
      true
    );
  }
}
