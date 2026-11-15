import { ENGINE_LIMITS, INDICATOR_META } from "./config";
import type {
  ActiveProtocolState,
  AlertObject,
  BoneSiteKey,
  CrewProfile,
  EngineSnapshot,
  EventLogEntry,
  EventLogType,
  HealthArea,
  IndicatorId,
  IndicatorSample,
  IndicatorSummary,
  MissionContext,
} from "./types";

export interface RollupBucket {
  bucketIndex: number;
  min: number;
  max: number;
  sum: number;
  count: number;
}

export class EngineStore {
  public runId: string;
  public missionLengthDays: 180 | 1000;
  public context: MissionContext;
  public profile: CrewProfile;

  private samplesByIndicator: Map<IndicatorId, IndicatorSample[]> = new Map();
  private hourlyRollups: Map<IndicatorId, Map<number, RollupBucket>> = new Map();
  private dailyRollups: Map<IndicatorId, Map<number, RollupBucket>> = new Map();

  /** Append-only event log across ALL runs (abandoned runs remain in full export per SIM-CLK-005) */
  private readonly eventLog: EventLogEntry[] = [];
  private eventSeq = 0;

  // Running physical accumulators
  public cumulativeDoseMsv: number;
  public speEventDoseMsv = 0;
  public lastDoseSampleT = -1;
  public boneDensity: Record<BoneSiteKey, number> = {
    lumbar: 1.0,
    femoral_neck: 1.0,
    trochanter: 1.0,
    pelvis: 1.0,
    total: 1.0,
  };
  public lastBoneUpdateT = 0;
  public sleepHistoryByDay: Record<number, number> = {};

  public activeAlerts: AlertObject[] = [];
  public cooldownUntilByArea: Partial<Record<HealthArea, number>> = {};
  public activeProtocol: ActiveProtocolState | null = null;
  public pausedProtocols: ActiveProtocolState[] = [];

  constructor(
    missionLengthDays: 180 | 1000,
    context: MissionContext,
    profile: CrewProfile
  ) {
    this.runId = `run-${Date.now()}-1`;
    this.missionLengthDays = missionLengthDays;
    this.context = { ...context };
    this.profile = { ...profile };
    this.cumulativeDoseMsv = profile.priorCareerDoseMsv;
  }

  public addSample(sample: IndicatorSample): void {
    let list = this.samplesByIndicator.get(sample.id);
    if (!list) {
      list = [];
      this.samplesByIndicator.set(sample.id, list);
    }

    // Keep chronological order (append fast-path)
    if (list.length === 0 || sample.t >= list[list.length - 1].t) {
      list.push(sample);
    } else {
      const idx = list.findIndex((s) => s.t > sample.t);
      if (idx === -1) list.push(sample);
      else list.splice(idx, 0, sample);
    }

    // Update hourly & daily rollups for whole-mission history (ENG-REC-005)
    this.updateRollup(this.hourlyRollups, sample.id, Math.floor(sample.t / 3600), sample.value);
    this.updateRollup(this.dailyRollups, sample.id, Math.floor(sample.t / 86400), sample.value);

    // Prune full-res samples older than 30 days (ENG-REC-005) in amortized batches
    const retentionSec = ENGINE_LIMITS.fullResRetentionDays.value * 86400;
    const cutoff = sample.t - retentionSec;
    if (cutoff > 0 && list.length > 3200 && list[320].t < cutoff) {
      let dropCount = 0;
      while (dropCount < list.length - 64 && list[dropCount + 1].t < cutoff) {
        dropCount++;
      }
      if (dropCount > 0) {
        list.splice(0, dropCount);
      }
    }
  }

  private updateRollup(
    map: Map<IndicatorId, Map<number, RollupBucket>>,
    id: IndicatorId,
    bucketIndex: number,
    value: number
  ): void {
    let byBucket = map.get(id);
    if (!byBucket) {
      byBucket = new Map();
      map.set(id, byBucket);
    }
    const existing = byBucket.get(bucketIndex);
    if (!existing) {
      byBucket.set(bucketIndex, {
        bucketIndex,
        min: value,
        max: value,
        sum: value,
        count: 1,
      });
    } else {
      existing.min = Math.min(existing.min, value);
      existing.max = Math.max(existing.max, value);
      existing.sum += value;
      existing.count += 1;
    }
  }

  public appendEvent(
    t: number,
    type: EventLogType,
    payload: Record<string, unknown>,
    links?: string[]
  ): EventLogEntry {
    this.eventSeq += 1;
    const entry: EventLogEntry = {
      id: `evt-${this.eventSeq}`,
      t,
      runId: this.runId,
      type,
      payload,
      links,
    };
    this.eventLog.push(entry);
    return entry;
  }

  public getLatestSample(id: IndicatorId): IndicatorSample | undefined {
    const list = this.samplesByIndicator.get(id);
    return list && list.length > 0 ? list[list.length - 1] : undefined;
  }

  public getSamplesInRange(id: IndicatorId, fromT: number, toT: number): IndicatorSample[] {
    const list = this.samplesByIndicator.get(id);
    if (!list || list.length === 0) return [];
    const out: IndicatorSample[] = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.t < fromT) break;
      if (s.t <= toT) out.push(s);
    }
    return out.reverse();
  }

  public getRollupSeries(
    id: IndicatorId,
    fromT: number,
    toT: number,
    resolution: "full" | "hourly" | "daily"
  ): Array<{ t: number; value: number; min: number; max: number }> {
    if (resolution === "full") {
      return this.getSamplesInRange(id, fromT, toT).map((s) => ({
        t: s.t,
        value: s.value,
        min: s.value,
        max: s.value,
      }));
    }
    const bucketSec = resolution === "hourly" ? 3600 : 86400;
    const map = resolution === "hourly" ? this.hourlyRollups.get(id) : this.dailyRollups.get(id);
    if (!map) return [];
    const minB = Math.floor(fromT / bucketSec);
    const maxB = Math.floor(toT / bucketSec);
    const out: Array<{ t: number; value: number; min: number; max: number }> = [];
    for (const b of map.values()) {
      if (b.bucketIndex >= minB && b.bucketIndex <= maxB) {
        out.push({
          t: b.bucketIndex * bucketSec,
          value: b.sum / b.count,
          min: b.min,
          max: b.max,
        });
      }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  /**
   * Computes time-weighted mean over [toT - windowSec, toT] using trapezoidal integration.
   * Ensures identical detector behaviour at 60 s live cadence and 15 min jump cadence (SIM-ARC-004).
   */
  public getTimeWeightedMean(id: IndicatorId, toT: number, windowSec: number): number | null {
    const list = this.samplesByIndicator.get(id);
    if (!list || list.length === 0) return null;

    const fromT = Math.max(0, toT - windowSec);
    if (toT <= fromT) {
      return list[list.length - 1].value;
    }

    // Find value at fromT by linear interpolation or nearest preceding sample
    const valueAt = (targetT: number): number => {
      if (targetT <= list[0].t) return list[0].value;
      const last = list[list.length - 1];
      if (targetT >= last.t) return last.value;
      for (let i = list.length - 2; i >= 0; i--) {
        if (list[i].t <= targetT) {
          const a = list[i];
          const b = list[i + 1];
          const dt = b.t - a.t;
          if (dt <= 0) return b.value;
          const frac = (targetT - a.t) / dt;
          return a.value + (b.value - a.value) * frac;
        }
      }
      return list[0].value;
    };

    const points: Array<{ t: number; v: number }> = [{ t: fromT, v: valueAt(fromT) }];
    const mid: Array<{ t: number; v: number }> = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.t <= fromT) break;
      if (s.t < toT) mid.push({ t: s.t, v: s.value });
    }
    for (let i = mid.length - 1; i >= 0; i--) {
      points.push(mid[i]);
    }
    points.push({ t: toT, v: valueAt(toT) });

    let area = 0;
    for (let i = 1; i < points.length; i++) {
      const dt = points[i].t - points[i - 1].t;
      area += 0.5 * (points[i].v + points[i - 1].v) * dt;
    }
    return area / (toT - fromT);
  }

  public summarise(id: IndicatorId, toT: number, windowMinutes: number): IndicatorSummary | null {
    const meta = INDICATOR_META[id];
    const windowSec = windowMinutes * 60;
    const fromT = Math.max(0, toT - windowSec);
    let samples = this.getSamplesInRange(id, fromT, toT);

    if (samples.length === 0) {
      const latest = this.getLatestSample(id);
      if (!latest) return null;
      return {
        id,
        unit: meta.unit,
        kind: latest.kind,
        windowMinutes,
        min: latest.value,
        max: latest.value,
        mean: latest.value,
        latest: latest.value,
        latestT: latest.t,
        trendPerHour: 0,
        sampleCount: 1,
      };
    }

    let min = Infinity;
    let max = -Infinity;
    for (const s of samples) {
      if (s.value < min) min = s.value;
      if (s.value > max) max = s.value;
    }
    const mean = this.getTimeWeightedMean(id, toT, windowSec) ?? samples[samples.length - 1].value;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dtHours = Math.max(1 / 60, (last.t - first.t) / 3600);
    const trendPerHour = samples.length >= 2 ? (last.value - first.value) / dtHours : 0;

    return {
      id,
      unit: meta.unit,
      kind: last.kind,
      windowMinutes,
      min,
      max,
      mean,
      latest: last.value,
      latestT: last.t,
      trendPerHour,
      sampleCount: samples.length,
    };
  }

  public getEvents(
    options: { type?: EventLogType; fromT?: number; toT?: number; includeAbandonedRuns?: boolean } = {}
  ): EventLogEntry[] {
    const { type, fromT, toT, includeAbandonedRuns = false } = options;
    return this.eventLog.filter((e) => {
      if (!includeAbandonedRuns && e.runId !== this.runId) return false;
      if (type && e.type !== type) return false;
      if (fromT !== undefined && e.t < fromT) return false;
      if (toT !== undefined && e.t > toT) return false;
      return true;
    });
  }

  public getExerciseSessionsInTrailingDays(toT: number, trailingDays: number): number {
    const fromT = toT - trailingDays * 86400;
    let count = 0;
    for (let i = this.eventLog.length - 1; i >= 0; i--) {
      const e = this.eventLog[i];
      if (e.runId === this.runId && e.t < fromT) break;
      if (e.runId === this.runId && e.type === "exercise_session" && e.t <= toT) {
        count++;
      }
    }
    return count;
  }

  public createSnapshot(t: number, label: string): EngineSnapshot {
    const samplesObj = {} as Record<IndicatorId, IndicatorSample[]>;
    // Keep trailing 48h of full-res samples per snapshot (all sliding detector windows are <= 24h;
    // multi-day history is preserved in hourlyRollups & dailyRollups). Prevents multi-million object bloat.
    const cutoff = t - 48 * 3600;
    for (const [k, v] of this.samplesByIndicator.entries()) {
      const recent = v.filter((s) => s.t >= cutoff);
      const tail = recent.length > 0 ? recent : v.slice(-2);
      samplesObj[k] = tail.map((s) => ({ ...s }));
    }

    const serializeRollups = (
      src: Map<IndicatorId, Map<number, RollupBucket>>,
      keyName: "bucketHour" | "day"
    ) => {
      const out: Record<string, Array<any>> = {};
      for (const [id, map] of src.entries()) {
        out[id] = Array.from(map.values()).map((b) => ({
          [keyName]: b.bucketIndex,
          min: b.min,
          max: b.max,
          mean: b.sum / b.count,
          count: b.count,
        }));
      }
      return out;
    };

    return {
      snapshotId: `snap-${Math.round(t)}-${Date.now()}`,
      t,
      runId: this.runId,
      label,
      context: { ...this.context },
      profile: { ...this.profile },
      missionLengthDays: this.missionLengthDays,
      samplesByIndicator: samplesObj,
      hourlyRollups: serializeRollups(this.hourlyRollups, "bucketHour"),
      dailyRollups: serializeRollups(this.dailyRollups, "day"),
      cumulativeDoseMsv: this.cumulativeDoseMsv,
      speEventDoseMsv: this.speEventDoseMsv,
      lastDoseSampleT: this.lastDoseSampleT,
      boneDensity: { ...this.boneDensity },
      lastBoneUpdateT: this.lastBoneUpdateT,
      sleepHistoryByDay: { ...this.sleepHistoryByDay },
      activeAlerts: this.activeAlerts.map((a) => ({
        ...a,
        evidence: a.evidence.map((ev) => ({ ...ev })),
        suggestedActions: [...a.suggestedActions],
      })),
      cooldownUntilByArea: { ...this.cooldownUntilByArea },
      activeProtocol: this.activeProtocol
        ? {
            ...this.activeProtocol,
            completedSteps: [...this.activeProtocol.completedSteps],
          }
        : null,
      pausedProtocols: this.pausedProtocols.map((p) => ({
        ...p,
        completedSteps: [...p.completedSteps],
      })),
    };
  }

  public restoreSnapshot(snap: EngineSnapshot): void {
    // Restore starts a new runId while keeping old entries in append-only log (SIM-CLK-005)
    const nextRunNum =
      this.eventLog.reduce((acc, e) => (e.runId !== this.runId ? acc : acc), 0) +
      Math.floor(Math.random() * 10000);
    const oldRunId = this.runId;
    this.runId = `run-${Math.round(snap.t)}-${nextRunNum}-${Date.now()}`;

    // Carry forward active run entries up to snap.t into the new runId view
    const validPreEntries = this.eventLog.filter((e) => e.runId === oldRunId && e.t <= snap.t);
    for (const e of validPreEntries) {
      this.eventLog.push({
        ...e,
        id: `${e.id}-restored-${++this.eventSeq}`,
        runId: this.runId,
      });
    }

    this.missionLengthDays = snap.missionLengthDays;
    this.context = { ...snap.context };
    this.profile = { ...snap.profile };

    this.samplesByIndicator.clear();
    for (const [k, list] of Object.entries(snap.samplesByIndicator)) {
      this.samplesByIndicator.set(
        k as IndicatorId,
        list.map((s) => ({ ...s }))
      );
    }

    this.hourlyRollups.clear();
    for (const [id, buckets] of Object.entries(snap.hourlyRollups)) {
      const m = new Map<number, RollupBucket>();
      for (const b of buckets) {
        m.set(b.bucketHour, {
          bucketIndex: b.bucketHour,
          min: b.min,
          max: b.max,
          sum: b.mean * b.count,
          count: b.count,
        });
      }
      this.hourlyRollups.set(id as IndicatorId, m);
    }

    this.dailyRollups.clear();
    for (const [id, buckets] of Object.entries(snap.dailyRollups)) {
      const m = new Map<number, RollupBucket>();
      for (const b of buckets) {
        m.set(b.day, {
          bucketIndex: b.day,
          min: b.min,
          max: b.max,
          sum: b.mean * b.count,
          count: b.count,
        });
      }
      this.dailyRollups.set(id as IndicatorId, m);
    }

    this.cumulativeDoseMsv = snap.cumulativeDoseMsv;
    this.speEventDoseMsv = snap.speEventDoseMsv;
    this.lastDoseSampleT = snap.lastDoseSampleT;
    this.boneDensity = { ...snap.boneDensity };
    this.lastBoneUpdateT = snap.lastBoneUpdateT;
    this.sleepHistoryByDay = { ...snap.sleepHistoryByDay };
    this.activeAlerts = snap.activeAlerts.map((a) => ({
      ...a,
      evidence: a.evidence.map((ev) => ({ ...ev })),
      suggestedActions: [...a.suggestedActions],
    }));
    this.cooldownUntilByArea = { ...snap.cooldownUntilByArea };
    this.activeProtocol = snap.activeProtocol
      ? {
          ...snap.activeProtocol,
          completedSteps: [...snap.activeProtocol.completedSteps],
        }
      : null;
    this.pausedProtocols = (snap.pausedProtocols ?? []).map((p) => ({
      ...p,
      completedSteps: [...p.completedSteps],
    }));
  }

  public exportAllJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        activeRunId: this.runId,
        context: this.context,
        profile: this.profile,
        cumulativeDoseMsv: this.cumulativeDoseMsv,
        boneDensity: this.boneDensity,
        activeAlerts: this.activeAlerts,
        eventLogAllRuns: this.eventLog,
      },
      null,
      2
    );
  }
}
