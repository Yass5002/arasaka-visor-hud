import {
  BONE_EXERCISE_PROTECTIVE_EPSILON,
  BONE_LOSS_TABLE,
  COMPOSITE_INDEX_WEIGHTS,
  ENGINE_LIMITS,
} from "./config";
import type { EngineStore } from "./store";
import type { BoneSiteKey, IndicatorSample, UncertaintyRange } from "./types";

const SECONDS_PER_MONTH = 30 * 86400;

/**
 * Computes one bone-density step per ENG-001 Section 5.1:
 *   B_s(t + dt) = B_s(t) * [1 - r_s * (1 - epsilon * c(t)) * dtMonths]
 */
export function stepBoneDensity(
  currentDensity: number,
  monthlyLossRate: number,
  compliance: number,
  dtMonths: number,
  epsilon = BONE_EXERCISE_PROTECTIVE_EPSILON
): number {
  const c = Math.max(0, Math.min(1, compliance));
  const factor = Math.max(0, 1 - monthlyLossRate * (1 - epsilon * c) * dtMonths);
  return Math.max(0.5, currentDensity * factor);
}

/**
 * Computes trailing 14-day resistive exercise compliance c(t) in [0, 1].
 */
export function computeTrailingExerciseCompliance(store: EngineStore, t: number): number {
  const habitPerWeek = Math.max(1, store.profile.exerciseSessionsPerWeek);
  const windowDays = Math.min(14, Math.max(1, t / 86400));
  // If mission just started (< 1 day), assume baseline compliant until a missed streak builds
  if (t < 86400) return 1.0;

  const sessions = store.getExerciseSessionsInTrailingDays(t, 14);
  const expected = Math.max(1, (windowDays / 7) * habitPerWeek);
  return Math.max(0, Math.min(1, sessions / expected));
}

export function getBoneUncertaintyRange(
  site: BoneSiteKey,
  densityPct: number,
  elapsedSec: number
): UncertaintyRange {
  const months = elapsedSec / SECONDS_PER_MONTH;
  const sdPct = BONE_LOSS_TABLE[site].monthlySd * 100 * months;
  return {
    low: Math.max(50, Number((densityPct - sdPct).toFixed(2))),
    high: Math.min(100, Number((densityPct + sdPct).toFixed(2))),
    note: `±1 SD (${BONE_LOSS_TABLE[site].monthlySd * 100}%/mo × ${months.toFixed(2)} mo, Sibonga DXA [R7]; DXA/QCT is record)`,
  };
}

/**
 * Updates modelled indicators (dose integral, bone density sites, sleep debt,
 * immune_index, cognitive_drift, sans_risk) from current store state at mission time t.
 */
export function updateModelledIndicators(store: EngineStore, t: number): void {
  // 1. Update cumulative dose integral if time advanced (ENG-EST-002)
  const doseSample = store.getLatestSample("dose_rate");
  if (doseSample) {
    if (store.lastDoseSampleT < 0) {
      store.lastDoseSampleT = t;
    } else if (t > store.lastDoseSampleT) {
      const dtDays = (t - store.lastDoseSampleT) / 86400;
      const meanRate =
        store.getTimeWeightedMean("dose_rate", t, t - store.lastDoseSampleT) ?? doseSample.value;
      const deltaMsv = meanRate * dtDays;
      store.cumulativeDoseMsv += deltaMsv;

      // Track excess above baseline surface rate for active SPE event tracking
      const baseline = ENGINE_LIMITS.doseRateBaselineSurfaceMsvDay.value;
      if (meanRate > baseline * 1.8) {
        store.speEventDoseMsv += Math.max(0, (meanRate - baseline) * dtDays);
      } else if (doseSample.value <= baseline * 1.25 && store.speEventDoseMsv > 0) {
        // Decay SPE event counter only when resetting; otherwise keep accumulated event dose visible until cleared
      }
      store.lastDoseSampleT = t;
    }
  }

  // 2. Update bone mineral density per site (ENG-001 5.1)
  if (t > store.lastBoneUpdateT) {
    const dtMonths = (t - store.lastBoneUpdateT) / SECONDS_PER_MONTH;
    const compliance = computeTrailingExerciseCompliance(store, t);
    (Object.keys(BONE_LOSS_TABLE) as BoneSiteKey[]).forEach((site) => {
      const rate = BONE_LOSS_TABLE[site].monthlyLossRate;
      store.boneDensity[site] = stepBoneDensity(store.boneDensity[site], rate, compliance, dtMonths);
    });
    store.lastBoneUpdateT = t;
  }

  const pushModelSample = (id: IndicatorSample["id"], value: number, unit: string) => {
    store.addSample({
      id,
      t,
      value,
      unit,
      kind: "modelled",
      source: "simulator",
      quality: 0.78,
    });
  };

  pushModelSample("dose_cumulative", Number(store.cumulativeDoseMsv.toFixed(3)), "mSv");
  pushModelSample("spe_event_dose", Number(store.speEventDoseMsv.toFixed(2)), "mSv");

  (Object.keys(BONE_LOSS_TABLE) as BoneSiteKey[]).forEach((site) => {
    const pct = Number((store.boneDensity[site] * 100).toFixed(3));
    pushModelSample(BONE_LOSS_TABLE[site].indicatorId, pct, "%");
  });

  // 3. Sleep debt (rolling 14-day shortfall vs crewmember baseline)
  const dayKeys = Object.keys(store.sleepHistoryByDay)
    .map(Number)
    .sort((a, b) => a - b);
  const recentDays = dayKeys.slice(-14);
  let sleepDebt = 0;
  for (const d of recentDays) {
    const slept = store.sleepHistoryByDay[d];
    sleepDebt += Math.max(0, store.profile.usualSleepHours - slept);
  }
  pushModelSample("sleep_debt", Number(sleepDebt.toFixed(2)), "h");

  const isolationDays = Math.floor(t / 86400);
  pushModelSample("isolation_days", isolationDays, "days");

  const sessions7d = store.getExerciseSessionsInTrailingDays(t, 7);
  pushModelSample("exercise_sessions", sessions7d, "sess/wk");

  // 4. Composite demonstration indices (ENG-001 Section 5.2)
  const stress = store.getLatestSample("stress_score")?.value ?? 20;
  const cortisol = store.getLatestSample("cortisol_trend")?.value ?? 20;
  const circadian = store.getLatestSample("circadian_drift")?.value ?? 0.2;
  const rt = store.getLatestSample("reaction_time")?.value ?? store.profile.reactionTimeBaselineMs;
  const visionSym = store.getLatestSample("vision_symptom")?.value ?? 0;

  const normSleepDebt = Math.min(1, sleepDebt / 18);
  const normStress = Math.min(1, Math.max(0, stress / 100));
  const normDose = Math.min(
    1,
    Math.max(0, (store.cumulativeDoseMsv - store.profile.priorCareerDoseMsv) / 150)
  );
  const normCortisol = Math.min(1, Math.max(0, cortisol / 100));

  const iw = COMPOSITE_INDEX_WEIGHTS.immune_index;
  const immunePenalty =
    iw.sleepDebt * normSleepDebt +
    iw.stress * normStress +
    iw.cumulativeDose * normDose +
    iw.cortisolTrend * normCortisol;
  const immuneIndex = Math.max(0, Math.min(100, 100 * (1 - immunePenalty)));
  pushModelSample("immune_index", Number(immuneIndex.toFixed(1)), "/100");

  const cw = COMPOSITE_INDEX_WEIGHTS.cognitive_drift;
  const normCircadian = Math.min(1, Math.max(0, circadian / 4.0));
  const normIsolation = Math.min(1, isolationDays / 180);
  const normRt = Math.min(1, Math.max(0, (rt - store.profile.reactionTimeBaselineMs) / 120));
  const cognitiveDrift = Math.max(
    0,
    Math.min(
      100,
      100 *
        (cw.sleepDebt * normSleepDebt +
          cw.circadianDrift * normCircadian +
          cw.isolation * normIsolation +
          cw.reactionTime * normRt)
    )
  );
  pushModelSample("cognitive_drift", Number(cognitiveDrift.toFixed(1)), "/100");

  const sw = COMPOSITE_INDEX_WEIGHTS.sans_risk;
  const normFluidShift = Math.min(1, isolationDays / 120);
  const normVisionSym = Math.min(1, Math.max(0, visionSym / 2));
  const sansRisk = Math.max(
    0,
    Math.min(
      100,
      100 * (sw.missionDays * normIsolation + sw.fluidShift * normFluidShift + sw.visionSymptom * normVisionSym)
    )
  );
  pushModelSample("sans_risk", Number(sansRisk.toFixed(1)), "/100");
}
