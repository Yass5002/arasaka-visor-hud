import {
  BONE_LOSS_TABLE,
  COMPOSITE_INDEX_WEIGHTS,
  DEFAULT_CREW_PROFILE,
  ENGINE_LIMITS,
  INDICATOR_META,
  PROTOCOLS,
} from "./config";
import { evaluateDetectorsAndAlerts } from "./detectors";
import { getBoneUncertaintyRange, updateModelledIndicators } from "./models";
import { EngineStore } from "./store";
import type {
  ActiveProtocolState,
  AlertClass,
  AlertObject,
  BoneSiteKey,
  CrewProfile,
  EngineSnapshot,
  EventLogEntry,
  EventLogType,
  IndicatorId,
  IndicatorLiveValue,
  IndicatorSample,
  LiveState,
  MissionContext,
  ProtocolId,
} from "./types";

export class CrewHealthEngine {
  public readonly store: EngineStore;
  public onStepMitigation?: (protocolId: ProtocolId, stepIndex: number) => void;
  private currentT = 0;
  private listeners: Set<(state: LiveState) => void> = new Set();
  private cachedLiveState: LiveState;

  constructor(options?: {
    missionLengthDays?: 180 | 1000;
    profile?: Partial<CrewProfile>;
    initialContext?: Partial<MissionContext>;
  }) {
    const profile: CrewProfile = { ...DEFAULT_CREW_PROFILE, ...options?.profile };
    const initialContext: MissionContext = {
      activity: "cabin",
      location: "habitat",
      missionDay: 1,
      timeOfDaySec: 8 * 3600,
      scheduledActivity: "cabin",
      ...options?.initialContext,
    };
    this.store = new EngineStore(options?.missionLengthDays ?? 180, initialContext, profile);
    this.seedInitialBaselineSamples(0);
    this.cachedLiveState = this.buildLiveState();
  }

  private seedInitialBaselineSamples(t: number): void {
    (Object.keys(INDICATOR_META) as IndicatorId[]).forEach((id) => {
      const meta = INDICATOR_META[id];
      let val = meta.defaultValue;
      if (id === "dose_cumulative") val = this.store.profile.priorCareerDoseMsv;
      if (id === "sleep_hours") val = this.store.profile.usualSleepHours;
      if (id === "reaction_time") val = this.store.profile.reactionTimeBaselineMs;
      if (id === "heart_rate") val = this.store.profile.restingHeartRate + 4;
      if (id === "hrv_rmssd") val = this.store.profile.hrvBaselineMs;

      this.store.addSample({
        id,
        t,
        value: val,
        unit: meta.unit,
        kind: meta.kind,
        source: "simulator",
        quality: 0.95,
      });
    });
    this.store.lastDoseSampleT = t;
    this.store.lastBoneUpdateT = t;
  }

  public subscribe(listener: (state: LiveState) => void): () => void {
    this.listeners.add(listener);
    listener(this.cachedLiveState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.cachedLiveState = this.buildLiveState();
    for (const fn of this.listeners) {
      fn(this.cachedLiveState);
    }
  }

  public getLiveState(): LiveState {
    return this.cachedLiveState;
  }

  public getTime(): number {
    return this.currentT;
  }

  // =========================================================================
  // SINGLE WRITE INTERFACE (ENG-SRC-001, SIM-ARC-001)
  // Downstream analysis never branches on sample.source (V-02).
  // =========================================================================

  public ingestSample(sample: IndicatorSample, evaluateNow = true): void {
    this.currentT = Math.max(this.currentT, sample.t);
    this.store.addSample(sample);

    if (sample.id === "sleep_hours") {
      const day = Math.floor(sample.t / 86400) + 1;
      this.store.sleepHistoryByDay[day] = sample.value;
    }

    if (sample.id === "dose_cumulative" && sample.source === "manual") {
      this.store.cumulativeDoseMsv = sample.value;
    }

    if (evaluateNow) {
      this.evaluate(this.currentT);
    }
  }

  public ingestSamples(samples: IndicatorSample[], evaluateAtT?: number, notifyNow = true): void {
    for (const s of samples) {
      this.ingestSample(s, false);
    }
    if (evaluateAtT !== undefined) {
      this.currentT = Math.max(this.currentT, evaluateAtT);
    }
    this.evaluate(this.currentT, notifyNow);
  }

  public ingestEvent(
    t: number,
    type: EventLogType,
    payload: Record<string, unknown>,
    links?: string[],
    evaluateNow = false
  ): EventLogEntry {
    this.currentT = Math.max(this.currentT, t);
    const entry = this.store.appendEvent(t, type, payload, links);
    if (type === "sleep_end" && typeof payload.hoursSlept === "number") {
      const day = Math.floor(t / 86400) + 1;
      this.store.sleepHistoryByDay[day] = payload.hoursSlept;
    }
    if (evaluateNow) {
      this.evaluate(this.currentT);
    }
    return entry;
  }

  public setContext(patch: Partial<MissionContext>, evaluateNow = true): void {
    this.store.context = { ...this.store.context, ...patch };
    if (evaluateNow) {
      this.evaluate(this.currentT);
    }
  }

  public updateProfile(patch: Partial<CrewProfile>): void {
    const prevPrior = this.store.profile.priorCareerDoseMsv;
    this.store.profile = { ...this.store.profile, ...patch };
    if (patch.priorCareerDoseMsv !== undefined && patch.priorCareerDoseMsv !== prevPrior) {
      this.store.cumulativeDoseMsv += patch.priorCareerDoseMsv - prevPrior;
    }
    this.evaluate(this.currentT);
  }

  public setMissionLengthDays(days: 180 | 1000): void {
    this.store.missionLengthDays = days;
    this.notify();
  }

  public evaluate(t: number, notifyNow = true): void {
    this.currentT = Math.max(this.currentT, t);
    this.store.context.missionDay = Math.floor(this.currentT / 86400) + 1;
    this.store.context.timeOfDaySec =
      Math.floor((this.currentT + 8 * 3600) % 86400);

    updateModelledIndicators(this.store, this.currentT);
    evaluateDetectorsAndAlerts(this.store, this.currentT);
    this.pruneResolvedAutoProtocols();
    if (notifyNow) {
      this.notify();
    }
  }

  private pruneResolvedAutoProtocols(): void {
    const activeProtoIds = new Set(
      this.store.activeAlerts.map((a) => a.protocolId).filter((p): p is ProtocolId => Boolean(p))
    );
    this.store.pausedProtocols = this.store.pausedProtocols.filter(
      (p) => !p.autoTriggered || p.completedSteps.length > 0 || activeProtoIds.has(p.id)
    );
    if (
      this.store.activeProtocol &&
      !this.store.activeProtocol.completed &&
      this.store.activeProtocol.autoTriggered &&
      this.store.activeProtocol.completedSteps.length === 0 &&
      !activeProtoIds.has(this.store.activeProtocol.id)
    ) {
      const next = this.store.pausedProtocols.shift() ?? null;
      this.store.activeProtocol = next;
    }
  }

  // =========================================================================
  // SNAPSHOT / RESTORE (ENG-SRC-003) & RESET
  // =========================================================================

  public createSnapshot(label: string): EngineSnapshot {
    return this.store.createSnapshot(this.currentT, label);
  }

  public restoreSnapshot(snap: EngineSnapshot): void {
    this.store.restoreSnapshot(snap);
    this.currentT = snap.t;
    this.notify();
  }

  public resetMission(): void {
    const lengthDays = this.store.missionLengthDays;
    const profile = { ...this.store.profile };
    const fresh = new EngineStore(
      lengthDays,
      {
        activity: "cabin",
        location: "habitat",
        missionDay: 1,
        timeOfDaySec: 8 * 3600,
        scheduledActivity: "cabin",
      },
      profile
    );
    // Replace internal store fields by snapshot restore pattern
    const snap = fresh.createSnapshot(0, "reset");
    this.store.restoreSnapshot(snap);
    this.currentT = 0;
    this.seedInitialBaselineSamples(0);
    this.evaluate(0);
  }

  // =========================================================================
  // PROTOCOL & ALERT ACTIONS (called via AssistantEngineBridge or UI confirm)
  // =========================================================================

  public startProtocol(protocolId: ProtocolId, autoTriggered = false): ActiveProtocolState {
    const current = this.store.activeProtocol;
    if (current && current.id === protocolId && !current.completed) {
      return current;
    }

    if (current && !current.completed && current.id !== protocolId) {
      this.store.pausedProtocols = [
        { ...current, completedSteps: [...current.completedSteps] },
        ...this.store.pausedProtocols.filter((p) => p.id !== current.id),
      ];
    }

    const pausedIdx = this.store.pausedProtocols.findIndex((p) => p.id === protocolId);
    if (pausedIdx !== -1) {
      const resumed = this.store.pausedProtocols.splice(pausedIdx, 1)[0];
      this.store.activeProtocol = resumed;
      this.notify();
      return resumed;
    }

    const def = PROTOCOLS[protocolId];
    const state: ActiveProtocolState = {
      id: protocolId,
      name: def.name,
      startedAt: this.currentT,
      currentStepIndex: 0,
      totalSteps: def.steps.length,
      currentStep: def.steps[0],
      completedSteps: [],
      completed: false,
      autoTriggered,
    };
    this.store.activeProtocol = state;
    this.notify();
    return state;
  }

  public queueProtocol(protocolId: ProtocolId, autoTriggered = false): void {
    const cur = this.store.activeProtocol;
    if (!cur || cur.completed) {
      this.startProtocol(protocolId, autoTriggered);
      return;
    }
    if (cur.id === protocolId || this.store.pausedProtocols.some((p) => p.id === protocolId)) {
      return;
    }
    const def = PROTOCOLS[protocolId];
    this.store.pausedProtocols.push({
      id: protocolId,
      name: def.name,
      startedAt: this.currentT,
      currentStepIndex: 0,
      totalSteps: def.steps.length,
      currentStep: def.steps[0],
      completedSteps: [],
      completed: false,
      autoTriggered,
    });
    this.notify();
  }

  public completeProtocolStep(protocolId: ProtocolId, stepIndex: number): ActiveProtocolState | null {
    const active = this.store.activeProtocol;
    if (!active || active.id !== protocolId) return null;
    const def = PROTOCOLS[protocolId];

    if (!active.completedSteps.includes(stepIndex)) {
      active.completedSteps.push(stepIndex);
    }
    this.store.appendEvent(this.currentT, "step_completed", {
      protocolId,
      stepIndex,
      instruction: def.steps[stepIndex]?.instruction,
    });

    const nextIdx = stepIndex + 1;
    if (nextIdx >= def.steps.length) {
      active.completed = true;
      if (protocolId === "air_check") {
        // Flush stale pre-scrubber ppCO2 samples out of the 1-hr rolling average window
        this.store.rollingWindowFloorByIndicator.ppco2 = this.currentT;
      }
      // Run physical mitigation cleanly BEFORE updating alert resolution or notifying listeners
      this.onStepMitigation?.(protocolId, stepIndex);

      // Resolve any alerts bound to this finished protocol
      for (const alr of this.store.activeAlerts) {
        if (alr.protocolId === protocolId) {
          alr.state = "resolved";
          this.store.appendEvent(this.currentT, "alert_cleared", {
            alertId: alr.id,
            reason: "protocol_completed",
            protocolId,
          });
        }
      }
      this.store.activeAlerts = this.store.activeAlerts.filter((a) => a.state !== "resolved");

      // Automatically resume next valid paused protocol on the preemption stack if one exists
      this.pruneResolvedAutoProtocols();
      const nextQueued = this.store.pausedProtocols.shift();
      if (nextQueued) {
        this.store.activeProtocol = nextQueued;
      }
    } else {
      active.currentStepIndex = nextIdx;
      active.currentStep = def.steps[nextIdx];
      this.onStepMitigation?.(protocolId, stepIndex);
    }

    this.notify();
    return active;
  }

  public acknowledgeAlert(alertId: string): AlertObject | null {
    const alr = this.store.activeAlerts.find((a) => a.id === alertId);
    if (!alr) return null;
    alr.state = "acknowledged";
    alr.acknowledgedAt = this.currentT;
    this.notify();
    return alr;
  }

  // =========================================================================
  // LIVE STATE PROJECTION (SIM-ARC-003: ONLY object display surfaces read)
  // =========================================================================

  private buildLiveState(): LiveState {
    const indicators = {} as Record<IndicatorId, IndicatorLiveValue>;
    const alertClassByIndicator = new Map<IndicatorId, AlertClass>();

    for (const alr of this.store.activeAlerts) {
      for (const ev of alr.evidence) {
        if (ev.indicator) {
          const prev = alertClassByIndicator.get(ev.indicator) ?? 0;
          if (prev === 0 || alr.class < prev) {
            alertClassByIndicator.set(ev.indicator, alr.class);
          }
        }
      }
    }

    const boneSiteById: Partial<Record<IndicatorId, BoneSiteKey>> = {};
    (Object.keys(BONE_LOSS_TABLE) as BoneSiteKey[]).forEach((site) => {
      boneSiteById[BONE_LOSS_TABLE[site].indicatorId] = site;
    });

    (Object.keys(INDICATOR_META) as IndicatorId[]).forEach((id) => {
      const meta = INDICATOR_META[id];
      const latest = this.store.getLatestSample(id);
      const value = latest ? latest.value : meta.defaultValue;

      let uncertainty = undefined;
      const boneSite = boneSiteById[id];
      if (boneSite) {
        uncertainty = getBoneUncertaintyRange(boneSite, value, this.currentT);
      } else if (id === "immune_index") {
        const half = Math.max(2, Math.round(value * COMPOSITE_INDEX_WEIGHTS.immune_index.uncertaintyPct));
        uncertainty = {
          low: Math.max(0, value - half),
          high: Math.min(100, value + half),
          note: "Demo composite uncertainty band",
        };
      } else if (id === "cognitive_drift") {
        const half = Math.max(3, Math.round(value * COMPOSITE_INDEX_WEIGHTS.cognitive_drift.uncertaintyPct));
        uncertainty = {
          low: Math.max(0, value - half),
          high: Math.min(100, value + half),
          note: "Demo composite uncertainty band",
        };
      } else if (id === "sans_risk") {
        const half = Math.max(4, Math.round(value * COMPOSITE_INDEX_WEIGHTS.sans_risk.uncertaintyPct));
        uncertainty = {
          low: Math.max(0, value - half),
          high: Math.min(100, value + half),
          note: "Demo composite uncertainty band",
        };
      }

      indicators[id] = {
        id,
        label: meta.label,
        area: meta.area,
        value,
        unit: meta.unit,
        t: latest?.t ?? this.currentT,
        kind: latest?.kind ?? meta.kind,
        source: latest?.source ?? "simulator",
        quality: latest?.quality ?? 0.9,
        alertClass: alertClassByIndicator.get(id) ?? 0,
        basis: meta.basis,
        uncertainty,
        demonstrationIndex:
          id === "immune_index" || id === "cognitive_drift" || id === "sans_risk",
        visorVisible: meta.visorVisible,
      };
    });

    const overallClass: AlertClass =
      this.store.activeAlerts.length > 0 ? this.store.activeAlerts[0].class : 0;

    return {
      t: this.currentT,
      missionLengthDays: this.store.missionLengthDays,
      missionDay: this.store.context.missionDay,
      timeOfDaySec: this.store.context.timeOfDaySec,
      runId: this.store.runId,
      context: { ...this.store.context },
      profile: { ...this.store.profile },
      overallClass,
      indicators,
      activeAlerts: this.store.activeAlerts.map((a) => ({
        ...a,
        evidence: [...a.evidence],
        suggestedActions: [...a.suggestedActions],
      })),
      rankedPrimaryAlert: this.store.activeAlerts[0]
        ? { ...this.store.activeAlerts[0] }
        : null,
      activeProtocol: this.store.activeProtocol ? { ...this.store.activeProtocol } : null,
      pausedProtocols: this.store.pausedProtocols.map((p) => ({
        ...p,
        completedSteps: [...p.completedSteps],
      })),
      careerDosePercent: Number(
        ((this.store.cumulativeDoseMsv / ENGINE_LIMITS.careerDoseLimitMsv.value) * 100).toFixed(2)
      ),
      speEventDoseMsv: Number(this.store.speEventDoseMsv.toFixed(2)),
    };
  }
}
