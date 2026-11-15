import { ENGINE_LIMITS, INDICATOR_META } from "../engine/config";
import type { CrewHealthEngine } from "../engine/engine";
import type {
  ActivityType,
  EngineSnapshot,
  IndicatorId,
  IndicatorSample,
  LocationType,
  ProtocolId,
} from "../engine/types";
import { PRESET_CATALOGUE, type PresetDefinition } from "./presets";

export type ClockSpeed = 1 | 60 | 3600 | 86400;

interface ActivePresetInstance {
  id: string;
  startT: number;
  definition: PresetDefinition;
}

function deterministicNoise(t: number, salt: number): number {
  const x = Math.sin(t * 0.00173 + salt * 19.37) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Mars Mission Simulator & Mission Clock (ARASAKA-SIM-001 Sections 3, 4, 7).
 * Generates realistic baseline mission-day telemetry & presets, writing ONLY through
 * CrewHealthEngine's single write interface (SIM-ARC-001).
 */
export class MissionSimulator {
  public readonly engine: CrewHealthEngine;
  public playing = false;
  public speed: ClockSpeed = 1;

  private activePresets: ActivePresetInstance[] = [];
  private mitigatedPresets = new Set<string>();
  private manualOverrides: Partial<Record<IndicatorId, number>> = {};
  private manualContextLock: { activity: ActivityType; location: LocationType } | null = null;
  private snapshots: EngineSnapshot[] = [];
  private lastDailySnapshotDay = 0;
  private lastExerciseLoggedDay = 0;
  private lastSleepLoggedDay = 0;
  private customPresets: PresetDefinition[] = [];

  /** Live 60s cadence vs 15min jump cadence (SIM-ARC-004) */
  public static readonly LIVE_STEP_SEC = 60;
  public static readonly JUMP_STEP_SEC = 900;

  constructor(engine: CrewHealthEngine) {
    this.engine = engine;
    this.saveSnapshot("Mission start (Day 1)");
  }

  public getActivePresetIds(): string[] {
    return this.activePresets.map((p) => p.id);
  }

  public getCustomPresets(): PresetDefinition[] {
    return [...this.customPresets];
  }

  public getSnapshots(): Array<{ snapshotId: string; t: number; label: string }> {
    return this.snapshots.map((s) => ({
      snapshotId: s.snapshotId,
      t: s.t,
      label: s.label,
    }));
  }

  public saveSnapshot(label: string): EngineSnapshot {
    const snap = this.engine.createSnapshot(label);
    this.snapshots.push(snap);
    if (this.snapshots.length > 24) {
      this.snapshots.shift();
    }
    return snap;
  }

  /**
   * Backward jump restores nearest earlier snapshot (SIM-CLK-004).
   */
  public jumpBackward(): boolean {
    const nowT = this.engine.getTime();
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].t < nowT - 1 || (nowT === 0 && i === 0)) {
        const target = this.snapshots[i];
        this.engine.restoreSnapshot(target);
        this.activePresets = this.activePresets.filter((p) => p.startT <= target.t);
        this.lastDailySnapshotDay = Math.floor(target.t / 86400);
        return true;
      }
    }
    return false;
  }

  /**
   * Forward jump fast-simulates every intermediate day at 15-min steps (SIM-CLK-003).
   */
  public jumpForward(deltaSeconds: number): void {
    const targetT = this.engine.getTime() + Math.max(0, deltaSeconds);
    this.advanceTo(targetT, MissionSimulator.JUMP_STEP_SEC);
  }

  public tickRealTime(dtRealSec: number): void {
    if (!this.playing) return;
    const simDelta = dtRealSec * this.speed;
    const stepSize =
      this.speed >= 3600 ? MissionSimulator.JUMP_STEP_SEC : MissionSimulator.LIVE_STEP_SEC;
    this.advanceTo(this.engine.getTime() + simDelta, stepSize);
  }

  public advanceTo(targetT: number, stepSec = MissionSimulator.LIVE_STEP_SEC): void {
    let t = this.engine.getTime();
    const maxT = this.engine.getLiveState().missionLengthDays * 86400;
    const clampedTarget = Math.min(targetT, maxT);

    while (t < clampedTarget) {
      const nextT = Math.min(clampedTarget, t + stepSec);
      this.stepSimulation(nextT, nextT >= clampedTarget);
      t = nextT;
    }
  }

  /**
   * Scheduled baseline mission day (SIM-001 Section 4.2):
   * 22:30-06:30 Sleep, 06:30-08:00 Hygiene/Breakfast, 08:00-12:00 Cabin work,
   * 12:00-13:00 Meal, 13:00-14:00 Resistive exercise (6d/wk), 14:30-18:30 Task/EVA, 18:30-22:30 Rest.
   */
  private getScheduledBlock(t: number): { activity: ActivityType; location: LocationType } {
    const day = Math.floor(t / 86400) + 1;
    const todHours = ((t + 8 * 3600) % 86400) / 3600; // starts Day 1 at 08:00

    if (todHours >= 22.5 || todHours < 6.5) {
      return { activity: "sleep", location: "habitat" };
    }
    if (todHours >= 13.0 && todHours < 14.0 && day % 7 !== 0) {
      return { activity: "exercise", location: "habitat" };
    }
    if (todHours >= 14.5 && todHours < 18.5 && day % 2 === 1) {
      return { activity: "eva", location: "surface" };
    }
    if (todHours >= 18.5 && todHours < 22.5) {
      return { activity: "rest", location: "habitat" };
    }
    return { activity: "cabin", location: "habitat" };
  }

  private stepSimulation(t: number, notifyNow = true): void {
    const day = Math.floor(t / 86400) + 1;
    const todHours = ((t + 8 * 3600) % 86400) / 3600;
    const sched = this.getScheduledBlock(t);
    const activeCtx = this.manualContextLock ?? sched;

    this.engine.setContext(
      {
        activity: activeCtx.activity,
        location: activeCtx.location,
        scheduledActivity: sched.activity,
        missionDay: day,
        timeOfDaySec: Math.floor(((t + 8 * 3600) % 86400)),
      },
      false
    );

    // Log daily 00:00 snapshot (SIM-CLK-004)
    const zeroBasedDay = Math.floor(t / 86400);
    if (zeroBasedDay > this.lastDailySnapshotDay) {
      this.lastDailySnapshotDay = zeroBasedDay;
      this.saveSnapshot(`Day ${day} 00:00`);
    }

    // Check missed-exercise preset S-07
    const hasS07 = this.activePresets.some((p) => p.id === "S-07");
    if (!hasS07 && sched.activity === "exercise" && day > this.lastExerciseLoggedDay) {
      this.lastExerciseLoggedDay = day;
      this.engine.ingestEvent(
        t,
        "exercise_session",
        { durationMin: this.engine.store.profile.exerciseSessionMinutes, device: "ARED/Resistive" },
        undefined,
        false
      );
    }

    // Log nightly sleep summary at wake-up (06:30)
    if (todHours >= 6.5 && todHours < 7.0 && day > this.lastSleepLoggedDay) {
      this.lastSleepLoggedDay = day;
      const sleepHours = this.computeNightlySleep(t);
      this.engine.ingestEvent(t, "sleep_end", { hoursSlept: sleepHours }, undefined, false);
      this.engine.ingestSample(
        {
          id: "sleep_hours",
          t,
          value: sleepHours,
          unit: "h",
          kind: "sensed",
          source: "simulator",
          quality: 0.94,
        },
        false
      );
    }

    const samples = this.synthesizeSamples(t, activeCtx.activity);
    this.engine.ingestSamples(samples, t, notifyNow);
  }

  private computeNightlySleep(t: number): number {
    const base = this.engine.store.profile.usualSleepHours;
    const s06 = this.activePresets.find((p) => p.id === "S-06" || p.id === "S-12");
    if (s06) {
      const daysElapsed = Math.max(0, (t - s06.startT) / 86400);
      const frac = Math.min(1, daysElapsed / 14);
      // Falls linearly from 7.0h to 5.5h over 14 days (SIM-001 S-06)
      return Number((base - 1.5 * frac).toFixed(2));
    }
    return Number((base + deterministicNoise(t, 11) * 0.25).toFixed(2));
  }

  private synthesizeSamples(t: number, activity: ActivityType): IndicatorSample[] {
    const profile = this.engine.store.profile;
    const isEva = activity === "eva";

    // Baseline Mars surface & habitat atmosphere physics
    let doseRate = ENGINE_LIMITS.doseRateBaselineSurfaceMsvDay.value + deterministicNoise(t, 1) * 0.04;
    let solarFlag = 0;
    let ppco2 = 1.5 + deterministicNoise(t, 2) * 0.04;
    let cabinPressure = 70.0 + deterministicNoise(t, 3) * 0.2;
    let suitPressure = 43.0 + deterministicNoise(t, 4) * 0.15;
    let pio2 = 150 + deterministicNoise(t, 5) * 1.2;

    let hr = profile.restingHeartRate + 4;
    let hrv = profile.hrvBaselineMs;
    let respRate = 14;
    let o2Consumption = 0.42;
    let sbp = 118;
    let orthoDrop = 4;
    let rt = profile.reactionTimeBaselineMs + deterministicNoise(t, 6) * 6;
    let stress = 20;
    let cortisol = 20;
    let circadian = 0.2;
    let visionSym = 0;

    if (activity === "sleep") {
      hr = profile.restingHeartRate - 8;
      hrv = profile.hrvBaselineMs + 10;
      respRate = 12;
      o2Consumption = 0.28;
    } else if (activity === "exercise") {
      hr = 130 + deterministicNoise(t, 7) * 8;
      hrv = profile.hrvBaselineMs * 0.72;
      respRate = 26;
      o2Consumption = 1.65;
    } else if (isEva) {
      hr = 104 + deterministicNoise(t, 8) * 7;
      hrv = profile.hrvBaselineMs * 0.85;
      respRate = 20;
      o2Consumption = 1.05;
      // EVA suit enriched O2 physics: PIO2 = (P_baro_mmHg - 47) * F_O2
      const suitMmHg = suitPressure * 7.50062;
      const suitFO2 = 0.545;
      pio2 = Math.round((suitMmHg - 47) * suitFO2);
    }

    let sourceTag: IndicatorSample["source"] = "simulator";

    // Apply active presets forward from their startT (SIM-001 Section 3 & 7)
    for (const active of this.activePresets) {
      sourceTag = "preset";
      const dtMin = Math.max(0, (t - active.startT) / 60);
      const dtDays = dtMin / 1440;

      switch (active.id) {
        case "S-01": {
          if (this.mitigatedPresets.has("S-01")) {
            // Crew inside storm shelter shielding: ambient radiation heavily attenuated
            doseRate = Math.max(doseRate, 0.72);
            hr += 6;
            stress = Math.max(stress, 24);
            solarFlag = 0;
            break;
          }
          // Rises immediately on onset (>1.2 mSv/d) and hits 5x baseline within 5 min (~40 mSv over 6h)
          const ramp5 = Math.min(1, dtMin / 5);
          const bell6h = dtMin <= 360 ? Math.sin(Math.min(1, dtMin / 360) * Math.PI) : 0.1;
          doseRate = Math.max(doseRate, 1.2 + ramp5 * 1.8 + bell6h * 195);
          hr += 25;
          stress = Math.max(stress, 40);
          solarFlag = 1;
          break;
        }
        case "S-02": {
          if (this.mitigatedPresets.has("S-02")) {
            ppco2 = 1.65;
            hr += 4;
            break;
          }
          // +0.05 mmHg/min from 1.5 mmHg baseline -> 1h avg 2.4 @ ~47m, 3.0 @ 60m
          ppco2 = 1.5 + 0.05 * Math.min(dtMin, 90);
          rt = Math.round(profile.reactionTimeBaselineMs * (1 + 0.15 * Math.min(1, dtMin / 45)));
          hr += Math.min(14, dtMin * 0.2);
          break;
        }
        case "S-03": {
          if (this.mitigatedPresets.has("S-03")) {
            pio2 = 152;
            hr += 4;
            break;
          }
          // PIO2 falls 150 -> 120 over 10 min
          pio2 = 150 - 30 * Math.min(1, dtMin / 10);
          hr += 20 * Math.min(1, dtMin / 10);
          break;
        }
        case "S-04": {
          if (this.mitigatedPresets.has("S-04")) {
            hr = 108;
            o2Consumption = 1.1;
            break;
          }
          hr = 158;
          hrv = Math.round(profile.hrvBaselineMs * 0.6); // 40% under baseline
          o2Consumption = 2.15;
          break;
        }
        case "S-14": {
          if (this.mitigatedPresets.has("S-14")) {
            suitPressure = 42.4;
            hr += 6;
            break;
          }
          // Suit pressure seal breach: drops from 43.0 kPa below 29.6 kPa floor over ~8 min
          const frac = Math.min(1, dtMin / 8);
          suitPressure = Number((43.0 - 18.5 * frac).toFixed(2));
          if (isEva) {
            const suitMmHg = suitPressure * 7.50062;
            pio2 = Math.round((suitMmHg - 47) * 0.545);
          }
          hr += Math.round(28 * frac);
          respRate += Math.round(10 * frac);
          break;
        }
        case "S-05": {
          orthoDrop = 24;
          sbp = 94;
          hr = 108;
          break;
        }
        case "S-06": {
          const frac = Math.min(1, dtDays / 14);
          rt += 55 * frac;
          stress = Math.max(stress, 20 + 28 * frac);
          circadian = 0.2 + 2.1 * frac;
          break;
        }
        case "S-08": {
          const frac = Math.min(1, Math.max(0.4, dtDays / 14));
          stress = Math.max(stress, 62 * frac);
          cortisol = Math.max(cortisol, 82 * frac);
          doseRate = Math.max(doseRate, 2.2);
          break;
        }
        case "S-09": {
          const frac = Math.min(1, dtDays / 28);
          stress = Math.max(stress, 30 + 48 * frac);
          break;
        }
        case "S-10": {
          visionSym = 2;
          break;
        }
        case "S-11": {
          // Climb dose rapidly toward 600 mSv when running forward
          doseRate = Math.max(doseRate, 9.5);
          break;
        }
        case "S-12": {
          // Cascade: sleep debt + dose rate rise + isolation stress
          const frac = Math.min(1, Math.max(0.75, dtDays / 10));
          rt += 45 * frac;
          stress = Math.max(stress, 74);
          doseRate = Math.max(doseRate, 3.6);
          solarFlag = 1;
          break;
        }
        case "S-13":
        case "S-13b": {
          hr = 140;
          break;
        }
        case "S-15": {
          hr = 138;
          respRate = 24;
          o2Consumption = 1.32;
          break;
        }
      }
    }

    const rawValues: Partial<Record<IndicatorId, { val: number; kind: IndicatorSample["kind"] }>> = {
      dose_rate: { val: Number(doseRate.toFixed(3)), kind: "sensed" },
      solar_event_flag: { val: solarFlag, kind: "source_input" },
      ppco2: { val: Number(ppco2.toFixed(3)), kind: "sensed" },
      pio2: { val: Number(pio2.toFixed(1)), kind: "sensed" },
      cabin_pressure: { val: Number(cabinPressure.toFixed(2)), kind: "sensed" },
      suit_pressure: { val: Number(suitPressure.toFixed(2)), kind: "sensed" },
      cabin_temperature: { val: Number((22.0 + deterministicNoise(t, 12) * 0.3).toFixed(1)), kind: "sensed" },
      cabin_humidity: { val: Number((45 + deterministicNoise(t, 13) * 1.5).toFixed(0)), kind: "sensed" },
      heart_rate: { val: Math.round(hr), kind: "sensed" },
      hrv_rmssd: { val: Math.round(hrv), kind: "sensed" },
      respiration_rate: { val: Math.round(respRate), kind: "sensed" },
      o2_consumption: { val: Number(o2Consumption.toFixed(2)), kind: "sensed" },
      blood_pressure: { val: Math.round(sbp), kind: "sensed" },
      orthostatic_drop: { val: Math.round(orthoDrop), kind: "modelled" },
      reaction_time: { val: Math.round(rt), kind: "sensed" },
      stress_score: { val: Math.round(stress), kind: "self_reported" },
      cortisol_trend: { val: Math.round(cortisol), kind: "modelled" },
      circadian_drift: { val: Number(circadian.toFixed(2)), kind: "modelled" },
      vision_symptom: { val: visionSym, kind: "self_reported" },
    };

    const samples: IndicatorSample[] = [];
    for (const [key, entry] of Object.entries(rawValues)) {
      const id = key as IndicatorId;
      const meta = INDICATOR_META[id];
      const overridden = this.manualOverrides[id];
      const finalVal = overridden !== undefined ? overridden : entry!.val;
      const finalSource = overridden !== undefined ? "manual" : sourceTag;
      samples.push({
        id,
        t,
        value: finalVal,
        unit: meta.unit,
        kind: entry!.kind,
        source: finalSource,
        quality: 0.95,
      });
    }
    return samples;
  }

  // =========================================================================
  // PRESETS, SCENARIO STARTS & MANUAL CONTROL INTERFACE
  // =========================================================================

  public firePreset(presetId: string, mode: "forward" | "scenario_start" = "forward"): void {
    const def =
      PRESET_CATALOGUE.find((p) => p.id === presetId) ??
      this.customPresets.find((p) => p.id === presetId);
    if (!def) return;

    this.saveSnapshot(`Pre-${def.code} (${def.name})`);

    if (mode === "scenario_start" && def.supportsScenarioStart) {
      // Fresh run + fast-simulate established drift forward from day 1 (SIM-001 Section 3 & 7)
      this.resetAll();
      const startDays = def.scenarioStartDays ?? 14;
      this.activePresets.push({ id: def.id, startT: 0, definition: def });
      this.engine.ingestEvent(0, "preset_fired", { presetId: def.id, mode: "scenario_start" });
      if (def.id === "S-08") {
        // Seed sleep shortfall history so immune_index drops realistically
        for (let d = 1; d <= startDays; d++) {
          this.engine.store.sleepHistoryByDay[d] = 5.4;
        }
      }
      if (def.id === "S-11") {
        this.engine.store.cumulativeDoseMsv = 455;
      }
      this.jumpForward(startDays * 86400);
      return;
    }

    if (def.targetContext) {
      this.manualContextLock = { ...def.targetContext };
      this.engine.setContext(
        {
          activity: def.targetContext.activity,
          location: def.targetContext.location,
          scheduledActivity: def.id === "S-13" ? "exercise" : def.targetContext.activity,
        },
        false
      );
    }

    if (def.customOverrides) {
      Object.assign(this.manualOverrides, def.customOverrides);
    }

    // Avoid duplicate identical preset instance; replace startT to re-run cleanly
    this.mitigatedPresets.delete(def.id);
    this.activePresets = this.activePresets.filter((p) => p.id !== def.id);
    const nowT = this.engine.getTime();
    this.activePresets.push({ id: def.id, startT: nowT, definition: def });

    if (def.id === "S-06") {
      // Also seed current day sleep start if already mid-mission
      const d = Math.floor(nowT / 86400) + 1;
      this.engine.store.sleepHistoryByDay[d] = this.engine.store.profile.usualSleepHours;
    }

    this.engine.ingestEvent(nowT, "preset_fired", { presetId: def.id, mode: "forward" });
    this.stepSimulation(nowT);
  }

  public clearPresets(): void {
    this.activePresets = [];
    this.mitigatedPresets.clear();
    this.manualOverrides = {};
    this.manualContextLock = null;
    this.stepSimulation(this.engine.getTime());
  }

  /** Switches simulation context directly into outside-cabin Mars Surface EVA mode */
  public enterEvaSurface(): void {
    this.setManualContext("eva");
  }

  /**
   * Feeds corrective crew actions from confirmed protocol steps directly back
   * into the physical suit/environment model so confirmed fixes stabilize telemetry.
   */
  public applyMitigationForStep(protocolId: ProtocolId, stepIndex: number): void {
    let changed = false;
    if (protocolId === "shelter" && stepIndex >= 2) {
      this.mitigatedPresets.add("S-01");
      changed = true;
    } else if (protocolId === "air_check" && stepIndex >= 1) {
      this.mitigatedPresets.add("S-02");
      this.mitigatedPresets.add("S-03");
      this.mitigatedPresets.add("S-14");
      changed = true;
    } else if (protocolId === "exertion_recovery" && stepIndex >= 1) {
      this.mitigatedPresets.add("S-04");
      changed = true;
    }
    if (changed) {
      this.stepSimulation(this.engine.getTime(), true);
    }
  }

  public setManualOverride(id: IndicatorId, value: number): void {
    this.manualOverrides[id] = value;
    const t = this.engine.getTime();
    const meta = INDICATOR_META[id];
    this.engine.ingestEvent(t, "manual_override", { indicator: id, value, unit: meta.unit });
    this.engine.ingestSample(
      {
        id,
        t,
        value,
        unit: meta.unit,
        kind: meta.kind,
        source: "manual",
        quality: 1.0,
      },
      true
    );
  }

  public setManualContext(activity: ActivityType): void {
    const location: LocationType = activity === "eva" ? "surface" : "habitat";
    this.manualContextLock = { activity, location };
    this.engine.setContext({ activity, location, scheduledActivity: activity }, true);
    this.stepSimulation(this.engine.getTime());
  }

  public saveCustomPreset(name: string): PresetDefinition {
    const live = this.engine.getLiveState();
    const overrides: Partial<Record<IndicatorId, number>> = {};
    (Object.keys(INDICATOR_META) as IndicatorId[]).forEach((id) => {
      if (Math.abs(live.indicators[id].value - INDICATOR_META[id].defaultValue) > 0.001) {
        overrides[id] = live.indicators[id].value;
      }
    });
    const custom: PresetDefinition = {
      id: `CUSTOM-${Date.now()}`,
      code: "CUSTOM",
      name: name.trim() || "Custom Snapshot",
      group: "custom",
      summary: "Operator-saved indicator state.",
      basis: "Demo (Operator Custom Preset)",
      customOverrides: overrides,
    };
    this.customPresets.push(custom);
    return custom;
  }

  public resetAll(): void {
    this.playing = false;
    this.activePresets = [];
    this.mitigatedPresets.clear();
    this.manualOverrides = {};
    this.manualContextLock = null;
    this.lastDailySnapshotDay = 0;
    this.lastExerciseLoggedDay = 0;
    this.lastSleepLoggedDay = 0;
    this.snapshots = [];
    this.engine.resetMission();
    this.saveSnapshot("Mission start (Day 1)");
  }
}
