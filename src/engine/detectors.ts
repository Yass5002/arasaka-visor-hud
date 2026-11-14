import { ENGINE_LIMITS, INDICATOR_META } from "./config";
import type { EngineStore } from "./store";
import type { AlertEvidenceItem, AlertObject, HealthArea, ProtocolId } from "./types";

interface CandidateAlert {
  detectorId: string;
  class: 1 | 2 | 3;
  area: HealthArea;
  title: string;
  whyLine: string;
  evidence: AlertEvidenceItem[];
  explanation: string;
  suggestedActions: string[];
  protocolId?: ProtocolId;
  escalateToMedical?: boolean;
  timeToEffectSec: number;
}

/**
 * Evaluates all four detector families (Threshold + Context, Rate of Change,
 * Multi-day Baseline Trend, and Cascade Combination) and manages alert hysteresis,
 * per-area cooldowns, and priority ranking (ENG-DET-001..008, ENG-ALR-001..003).
 */
export function evaluateDetectorsAndAlerts(store: EngineStore, t: number): void {
  const candidates: CandidateAlert[] = [];
  const delayMin = ENGINE_LIMITS.earthReplyDelayMin.value;

  const doseRate = store.getLatestSample("dose_rate");
  const solarFlag = store.getLatestSample("solar_event_flag");
  const doseCum = store.getLatestSample("dose_cumulative");
  const ppco2 = store.getLatestSample("ppco2");
  const pio2 = store.getLatestSample("pio2");
  const cabinPress = store.getLatestSample("cabin_pressure");
  const suitPress = store.getLatestSample("suit_pressure");
  const hr = store.getLatestSample("heart_rate");
  const hrv = store.getLatestSample("hrv_rmssd");
  const o2Rate = store.getLatestSample("o2_consumption");
  const ortho = store.getLatestSample("orthostatic_drop");
  const rt = store.getLatestSample("reaction_time");
  const stress = store.getLatestSample("stress_score");
  const immune = store.getLatestSample("immune_index");
  const visionSym = store.getLatestSample("vision_symptom");
  const sansRisk = store.getLatestSample("sans_risk");

  // ---------------------------------------------------------------------------
  // 1. RADIATION DETECTORS (SPE rate-of-change / threshold + career limit)
  // ---------------------------------------------------------------------------
  const speThreshold =
    ENGINE_LIMITS.doseRateBaselineSurfaceMsvDay.value * ENGINE_LIMITS.doseRateSpeTriggerMultiplier.value;
  if (
    doseRate &&
    (doseRate.value >= speThreshold ||
      doseRate.value >= ENGINE_LIMITS.doseRateSpeAbsoluteClass2MsvDay.value ||
      (solarFlag && solarFlag.value >= 1 && doseRate.value > ENGINE_LIMITS.doseRateSurfaceDesignMsvDay.value))
  ) {
    const mult = (doseRate.value / ENGINE_LIMITS.doseRateBaselineSurfaceMsvDay.value).toFixed(1);
    const ev: AlertEvidenceItem[] = [
      {
        indicator: "dose_rate",
        metric: "Radiation dose rate",
        observed: `${doseRate.value.toFixed(2)} mSv/day (${mult}× baseline)`,
        threshold: `>= ${speThreshold.toFixed(2)} mSv/day`,
        basis: "[V2 6164] / [V1 4031]",
        t: doseRate.t,
      },
    ];
    if (hr && hr.value > store.profile.restingHeartRate + 15) {
      ev.push({
        indicator: "heart_rate",
        metric: "Heart rate",
        observed: `${Math.round(hr.value)} bpm`,
        threshold: `baseline ${store.profile.restingHeartRate} bpm`,
        basis: "Demo physiological response",
        t: hr.t,
      });
    }
    candidates.push({
      detectorId: "rad_spe_rate",
      class: 2,
      area: "radiation",
      title: "SOLAR PARTICLE EVENT",
      whyLine: `Dose rate ${doseRate.value.toFixed(2)} mSv/d (${mult}× baseline)`,
      evidence: ev,
      explanation: `Measured radiation dose rate is ${doseRate.value.toFixed(2)} mSv/day (${mult}× Mars surface baseline). This is consistent with a solar particle event; cumulative event dose is tracked against the 250 mSv design reference.`,
      suggestedActions: [
        "Terminate EVA and move to shielded shelter immediately",
        "Track cumulative dose against 250 mSv SPE reference and 600 mSv career limit",
      ],
      protocolId: "shelter",
      timeToEffectSec: 120,
    });
  }

  if (doseCum) {
    const careerPct = (doseCum.value / ENGINE_LIMITS.careerDoseLimitMsv.value) * 100;
    if (careerPct >= ENGINE_LIMITS.careerDoseClass2Pct.value) {
      candidates.push({
        detectorId: "rad_career_limit",
        class: 2,
        area: "radiation",
        title: "CAREER DOSE NEAR LIMIT",
        whyLine: `Career dose ${careerPct.toFixed(1)}% of 600 mSv (${doseCum.value.toFixed(1)} mSv)`,
        evidence: [
          {
            indicator: "dose_cumulative",
            metric: "Cumulative effective dose",
            observed: `${doseCum.value.toFixed(1)} mSv (${careerPct.toFixed(1)}%)`,
            threshold: `90% of 600 mSv (540 mSv)`,
            basis: "[V1 4030] / Demo",
            t: doseCum.t,
          },
        ],
        explanation: `Estimated cumulative career dose has reached ${doseCum.value.toFixed(1)} mSv (${careerPct.toFixed(1)}% of the 600 mSv NASA-STD-3001 limit). Advise contacting the flight surgeon (expected reply delay ~${delayMin} min).`,
        suggestedActions: ["Restrict external EVA exposure", "Contact crew medical officer / flight surgeon"],
        escalateToMedical: true,
        timeToEffectSec: 3600,
      });
    } else if (careerPct >= ENGINE_LIMITS.careerDoseClass3Pct.value) {
      candidates.push({
        detectorId: "rad_career_limit",
        class: 3,
        area: "radiation",
        title: "CAREER DOSE ELEVATED",
        whyLine: `Career dose ${careerPct.toFixed(1)}% of 600 mSv (${doseCum.value.toFixed(1)} mSv)`,
        evidence: [
          {
            indicator: "dose_cumulative",
            metric: "Cumulative effective dose",
            observed: `${doseCum.value.toFixed(1)} mSv (${careerPct.toFixed(1)}%)`,
            threshold: `75% of 600 mSv (450 mSv)`,
            basis: "[V1 4030] / Demo",
            t: doseCum.t,
          },
        ],
        explanation: `Estimated cumulative dose is ${doseCum.value.toFixed(1)} mSv (${careerPct.toFixed(1)}% of 600 mSv career limit). Review remaining EVA budget against mission plan.`,
        suggestedActions: ["Compare exposure budget to remaining mission plan"],
        timeToEffectSec: 86400,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. ENVIRONMENT DETECTORS (1-hr ppCO2 average, PIO2 hypoxia, pressure)
  // ---------------------------------------------------------------------------
  const ppco2OneHourMean = store.getTimeWeightedMean("ppco2", t, 3600);
  const activeCo2Alert = store.activeAlerts.find((a) => a.detectorId === "env_ppco2_1h");
  const co2HystClass2 = activeCo2Alert?.class === 2 ? ENGINE_LIMITS.ppco2HysteresisMmHg.value : 0;
  const co2HystClass3 = activeCo2Alert ? ENGINE_LIMITS.ppco2HysteresisMmHg.value : 0;

  if (ppco2 && ppco2OneHourMean !== null) {
    if (ppco2OneHourMean >= ENGINE_LIMITS.ppco2OneHourLimitMmHg.value - co2HystClass2) {
      const ev: AlertEvidenceItem[] = [
        {
          indicator: "ppco2",
          metric: "1-hour mean ppCO₂",
          observed: `${ppco2OneHourMean.toFixed(2)} mmHg (current ${ppco2.value.toFixed(2)} mmHg)`,
          threshold: `<= ${ENGINE_LIMITS.ppco2OneHourLimitMmHg.value.toFixed(1)} mmHg`,
          basis: "[V2 6004]",
          t: ppco2.t,
        },
      ];
      if (rt && rt.value > store.profile.reactionTimeBaselineMs * 1.1) {
        ev.push({
          indicator: "reaction_time",
          metric: "Reaction time",
          observed: `${Math.round(rt.value)} ms`,
          threshold: `baseline ${store.profile.reactionTimeBaselineMs} ms`,
          basis: "Demo cognitive correlate",
          t: rt.t,
        });
      }
      candidates.push({
        detectorId: "env_ppco2_1h",
        class: 2,
        area: "environment",
        title: "HIGH CO₂ (1-HR LIMIT)",
        whyLine: `1h avg ppCO₂ ${ppco2OneHourMean.toFixed(2)} mmHg (>= 3.0 mmHg)`,
        evidence: ev,
        explanation: `One-hour average ppCO₂ reached ${ppco2OneHourMean.toFixed(2)} mmHg, exceeding the 3.0 mmHg NASA-STD-3001 reference, with supporting cognitive slowing.`,
        suggestedActions: ["Run Air Check protocol", "Verify CO₂ scrubber and move to ventilated module"],
        protocolId: "air_check",
        timeToEffectSec: 180,
      });
    } else if (ppco2OneHourMean >= ENGINE_LIMITS.ppco2Class3MmHg.value - co2HystClass3) {
      const ev: AlertEvidenceItem[] = [
        {
          indicator: "ppco2",
          metric: "1-hour mean ppCO₂",
          observed: `${ppco2OneHourMean.toFixed(2)} mmHg (current ${ppco2.value.toFixed(2)} mmHg)`,
          threshold: `>= ${ENGINE_LIMITS.ppco2Class3MmHg.value.toFixed(1)} mmHg (80% of 3.0)`,
          basis: "Demo / [V2 6004]",
          t: ppco2.t,
        },
      ];
      if (rt && rt.value > store.profile.reactionTimeBaselineMs * 1.08) {
        ev.push({
          indicator: "reaction_time",
          metric: "Reaction time",
          observed: `${Math.round(rt.value)} ms`,
          threshold: `baseline ${store.profile.reactionTimeBaselineMs} ms`,
          basis: "Demo cognitive correlate",
          t: rt.t,
        });
      }
      candidates.push({
        detectorId: "env_ppco2_1h",
        class: 3,
        area: "environment",
        title: "RISING CO₂ LEVEL",
        whyLine: `1h avg ppCO₂ ${ppco2OneHourMean.toFixed(2)} mmHg (80% limit)`,
        evidence: ev,
        explanation: `One-hour average ppCO₂ is ${ppco2OneHourMean.toFixed(2)} mmHg (above 80% of the 3.0 mmHg limit) and rising.`,
        suggestedActions: ["Inspect scrubber and compartment airflow"],
        protocolId: "air_check",
        timeToEffectSec: 600,
      });
    }
  }

  if (pio2) {
    if (pio2.value < ENGINE_LIMITS.pio2Class1EmergencyMmHg.value) {
      candidates.push({
        detectorId: "env_pio2_low",
        class: 1,
        area: "environment",
        title: "SEVERE HYPOXIA RISK",
        whyLine: `PIO₂ ${pio2.value.toFixed(0)} mmHg (< 110 mmHg)`,
        evidence: [
          {
            indicator: "pio2",
            metric: "Inspired PIO₂",
            observed: `${pio2.value.toFixed(0)} mmHg`,
            threshold: `< ${ENGINE_LIMITS.pio2Class1EmergencyMmHg.value} mmHg`,
            basis: "Demo Class 1 / [V2 6003]",
            t: pio2.t,
          },
        ],
        explanation: `Measured PIO₂ dropped to ${pio2.value.toFixed(0)} mmHg, indicating risk of acute hypoxia.`,
        suggestedActions: ["Switch to secondary O₂ supply immediately", "Abort task and move to safe atmosphere"],
        protocolId: "air_check",
        timeToEffectSec: 30,
      });
    } else if (pio2.value < ENGINE_LIMITS.pio2MildHypoxiaMmHg.value) {
      candidates.push({
        detectorId: "env_pio2_low",
        class: 2,
        area: "environment",
        title: "LOW OXYGEN (PIO₂)",
        whyLine: `PIO₂ ${pio2.value.toFixed(0)} mmHg (< 127 mmHg hypoxia floor)`,
        evidence: [
          {
            indicator: "pio2",
            metric: "Inspired PIO₂",
            observed: `${pio2.value.toFixed(0)} mmHg`,
            threshold: `< ${ENGINE_LIMITS.pio2MildHypoxiaMmHg.value} mmHg`,
            basis: "[R16] / [V2 6003]",
            t: pio2.t,
          },
        ],
        explanation: `Measured PIO₂ is ${pio2.value.toFixed(0)} mmHg, below the 127 mmHg mild-hypoxia lower limit. Immediate O₂ supply check required.`,
        suggestedActions: ["Check O₂ regulator/supply", "Move to safe pressurized location and recheck"],
        protocolId: "air_check",
        timeToEffectSec: 90,
      });
    } else if (pio2.value < ENGINE_LIMITS.pio2NormoxiaLowMmHg.value) {
      candidates.push({
        detectorId: "env_pio2_low",
        class: 3,
        area: "environment",
        title: "PIO₂ BELOW NORMOXIA",
        whyLine: `PIO₂ ${pio2.value.toFixed(0)} mmHg (< 145 mmHg target)`,
        evidence: [
          {
            indicator: "pio2",
            metric: "Inspired PIO₂",
            observed: `${pio2.value.toFixed(0)} mmHg`,
            threshold: `${ENGINE_LIMITS.pio2NormoxiaLowMmHg.value}-${ENGINE_LIMITS.pio2NormoxiaHighMmHg.value} mmHg`,
            basis: "[V2 6003]",
            t: pio2.t,
          },
        ],
        explanation: `Measured PIO₂ is ${pio2.value.toFixed(0)} mmHg, below the 145–155 mmHg normoxia target.`,
        suggestedActions: ["Verify O₂ flow and pressure"],
        protocolId: "air_check",
        timeToEffectSec: 300,
      });
    }
  }

  const activePress = store.context.activity === "eva" ? suitPress : cabinPress;
  if (activePress) {
    const isEva = store.context.activity === "eva";
    const minP = isEva ? ENGINE_LIMITS.suitPressureMinKpa.value : ENGINE_LIMITS.cabinPressureMinKpa.value;
    const maxP = isEva ? ENGINE_LIMITS.suitPressureMaxKpa.value : ENGINE_LIMITS.cabinPressureMaxKpa.value;
    if (activePress.value < minP || activePress.value > maxP) {
      candidates.push({
        detectorId: "env_pressure_bounds",
        class: activePress.value < minP - 4 ? 1 : 2,
        area: "environment",
        title: isEva ? "SUIT PRESSURE OUT OF BOUNDS" : "CABIN PRESSURE OUT OF BOUNDS",
        whyLine: `${isEva ? "Suit" : "Cabin"} pressure ${activePress.value.toFixed(1)} kPa (limit ${minP}-${maxP})`,
        evidence: [
          {
            indicator: activePress.id,
            metric: INDICATOR_META[activePress.id].label,
            observed: `${activePress.value.toFixed(1)} kPa`,
            threshold: `${minP}-${maxP} kPa`,
            basis: isEva ? "Demo" : "[V2 6006] Rev F",
            t: activePress.t,
          },
        ],
        explanation: `Measured ${isEva ? "suit" : "cabin"} pressure is ${activePress.value.toFixed(1)} kPa, outside the ${minP}–${maxP} kPa safe window.`,
        suggestedActions: ["Verify suit/habitat seal and pressure regulator"],
        protocolId: "air_check",
        timeToEffectSec: 60,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. CARDIOVASCULAR & CONTEXT-ADJUSTED DETECTORS (ENG-CTX-002 / ENG-CTX-003)
  // ---------------------------------------------------------------------------
  if (hr) {
    const act = store.context.activity;
    const hrCfg = ENGINE_LIMITS.hrLimitByActivity[act];
    const activeHrAlert = store.activeAlerts.find((a) => a.detectorId === "cv_context_hr");
    const hrHyst = activeHrAlert ? ENGINE_LIMITS.hrHysteresisBpm.value : 0;
    const hrvLow = hrv ? hrv.value <= store.profile.hrvBaselineMs * ENGINE_LIMITS.hrvDropRatioClass3.value : false;
    const highO2 = o2Rate ? o2Rate.value >= 1.5 : false;

    if (hr.value > hrCfg.value - hrHyst) {
      const ev: AlertEvidenceItem[] = [
        {
          indicator: "heart_rate",
          metric: `Heart rate (${act} context)`,
          observed: `${Math.round(hr.value)} bpm`,
          threshold: `<= ${hrCfg.value} bpm for ${act}`,
          basis: hrCfg.basis,
          t: hr.t,
        },
      ];
      if (hrv && hrvLow) {
        ev.push({
          indicator: "hrv_rmssd",
          metric: "HRV (RMSSD)",
          observed: `${Math.round(hrv.value)} ms`,
          threshold: `baseline ${store.profile.hrvBaselineMs} ms`,
          basis: "Demo",
          t: hrv.t,
        });
      }
      if (o2Rate && highO2) {
        ev.push({
          indicator: "o2_consumption",
          metric: "Suit O₂ consumption",
          observed: `${o2Rate.value.toFixed(2)} L/min`,
          threshold: `< 1.50 L/min`,
          basis: "Demo",
          t: o2Rate.t,
        });
      }

      candidates.push({
        detectorId: "cv_context_hr",
        class: 3,
        area: "cardiovascular",
        title: act === "eva" ? "EVA EXERTION STRAIN" : "ELEVATED HEART RATE FOR CONTEXT",
        whyLine: `HR ${Math.round(hr.value)} bpm > ${hrCfg.value} bpm (${act})${hrvLow ? `, HRV ${Math.round(hrv!.value)} ms` : ""}`,
        evidence: ev,
        explanation:
          act === "eva"
            ? `Heart rate (${Math.round(hr.value)} bpm) exceeds the ${hrCfg.value} bpm EVA limit with reduced HRV recovery. Slow down and rest for two minutes.`
            : `Heart rate (${Math.round(hr.value)} bpm) is elevated above the ${hrCfg.value} bpm limit for ${act} context.`,
        suggestedActions:
          act === "eva"
            ? ["Pause EVA workload and rest 2 minutes", "Hydrate and monitor HR recovery"]
            : ["Rest and recheck heart rate and blood pressure"],
        protocolId: "exertion_recovery",
        timeToEffectSec: 240,
      });
    }
  }

  if (ortho && ortho.value >= ENGINE_LIMITS.orthostaticDropMmHg.value) {
    candidates.push({
      detectorId: "cv_orthostatic",
      class: 3,
      area: "cardiovascular",
      title: "ORTHOSTATIC PRESSURE DROP",
      whyLine: `Standing SBP drop ${Math.round(ortho.value)} mmHg (>= 20 mmHg)`,
      evidence: [
        {
          indicator: "orthostatic_drop",
          metric: "Standing SBP drop",
          observed: `${Math.round(ortho.value)} mmHg`,
          threshold: `>= ${ENGINE_LIMITS.orthostaticDropMmHg.value} mmHg`,
          basis: "Demo clinical criterion",
          t: ortho.t,
        },
      ],
      explanation: `Systolic pressure dropped ${Math.round(ortho.value)} mmHg on standing, consistent with orthostatic intolerance risk. Contact the flight surgeon (reply delay ~${delayMin} min) if symptoms persist.`,
      suggestedActions: ["Sit or lie down immediately", "Drink fluids and recheck after 5 minutes"],
      protocolId: "orthostatic_response",
      escalateToMedical: true,
      timeToEffectSec: 180,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. SLOW MULTI-DAY TRENDS (Sleep Debt, Missed Exercise, Immune, Mood, Vision)
  // ---------------------------------------------------------------------------
  const sleepDays = Object.keys(store.sleepHistoryByDay)
    .map(Number)
    .sort((a, b) => a - b);
  if (sleepDays.length >= ENGINE_LIMITS.sleepRollingWindowDays.value) {
    const last7 = sleepDays.slice(-7).map((d) => store.sleepHistoryByDay[d]);
    const mean7 = last7.reduce((a, b) => a + b, 0) / last7.length;
    const shortfall = store.profile.usualSleepHours - mean7;
    if (shortfall >= ENGINE_LIMITS.sleepRollingMeanShortfallHrs.value) {
      candidates.push({
        detectorId: "sleep_7night_debt",
        class: 3,
        area: "sleep_behaviour",
        title: "SLEEP DEBT TREND",
        whyLine: `7-night sleep avg ${mean7.toFixed(2)}h (${shortfall.toFixed(2)}h below baseline)`,
        evidence: [
          {
            indicator: "sleep_hours",
            metric: "7-night mean sleep",
            observed: `${mean7.toFixed(2)} h/night`,
            threshold: `>= ${(store.profile.usualSleepHours - 0.75).toFixed(2)} h/night`,
            basis: "Demo / NASA ref [R6]",
            t,
          },
          {
            indicator: "reaction_time",
            metric: "Reaction time",
            observed: `${Math.round(rt?.value ?? store.profile.reactionTimeBaselineMs)} ms`,
            threshold: `baseline ${store.profile.reactionTimeBaselineMs} ms`,
            basis: "Demo",
            t: rt?.t ?? t,
          },
        ],
        explanation: `Your 7-night sleep mean has fallen to ${mean7.toFixed(2)} hours/night (${shortfall.toFixed(2)} h under your ${store.profile.usualSleepHours.toFixed(1)} h baseline), contributing to slower reaction time.`,
        suggestedActions: ["Start Sleep Reset protocol", "Protect 8 h sleep block and dim cabin lighting"],
        protocolId: "sleep_reset",
        timeToEffectSec: 43200,
      });
    }
  }

  if (t >= ENGINE_LIMITS.missedExerciseAlertDays.value * 86400) {
    const sessions14d = store.getExerciseSessionsInTrailingDays(t, 14);
    if (sessions14d === 0) {
      const lumbar = store.getLatestSample("bone_loss_lumbar")?.value ?? 100;
      candidates.push({
        detectorId: "bone_missed_exercise",
        class: 3,
        area: "bone",
        title: "MISSED RESISTIVE EXERCISE",
        whyLine: `0 resistive sessions in 14 days (est. lumbar BMD ${lumbar.toFixed(2)}%)`,
        evidence: [
          {
            indicator: "exercise_sessions",
            metric: "Trailing 14-day resistive sessions",
            observed: `0 sessions`,
            threshold: `>= 1 session / 14 days`,
            basis: "Demo / [R7]",
            t,
          },
          {
            indicator: "bone_loss_lumbar",
            metric: "Estimated lumbar BMD",
            observed: `${lumbar.toFixed(2)}% of preflight`,
            threshold: `protective compliance c(t)=0`,
            basis: "NASA ref [R7] (DXA is measurement of record)",
            t,
          },
        ],
        explanation: `No resistive exercise sessions were logged over the past 14 days, reducing bone protection to zero (estimated lumbar BMD ${lumbar.toFixed(2)}% of preflight; DXA remains the measurement of record).`,
        suggestedActions: ["Schedule resistive countermeasure session"],
        protocolId: "resistive_exercise",
        timeToEffectSec: 86400 * 7,
      });
    }
  }

  if (immune && immune.value <= ENGINE_LIMITS.immuneClass3Threshold.value) {
    candidates.push({
      detectorId: "immune_composite",
      class: 3,
      area: "immune",
      title: "IMMUNE STRESS INDEX",
      whyLine: `Demonstration immune_index ${immune.value.toFixed(0)}/100 (<= 70)`,
      evidence: [
        {
          indicator: "immune_index",
          metric: "Demonstration immune_index",
          observed: `${immune.value.toFixed(0)} / 100`,
          threshold: `> 70 / 100`,
          basis: "Demo index [R8] (viral shedding risk)",
          t: immune.t,
        },
      ],
      explanation: `The demonstration immune index dropped to ${immune.value.toFixed(0)}/100 due to combined sleep debt, stress/cortisol trend, and cumulative dose—a pattern associated with increased latent herpesvirus shedding (e.g., VZV DNA detected in 15 of 23 ISS crewmembers in [R8], mostly asymptomatic).`,
      suggestedActions: ["Prioritize rest, sleep recovery, and symptom monitoring"],
      protocolId: "sleep_reset",
      timeToEffectSec: 86400,
    });
  }

  if (stress && stress.value >= ENGINE_LIMITS.stressHighThreshold.value) {
    candidates.push({
      detectorId: "behaviour_isolation_stress",
      class: 3,
      area: "sleep_behaviour",
      title: "ELEVATED ISOLATION STRESS",
      whyLine: `Self-reported stress_score ${Math.round(stress.value)}/100 (>= 68)`,
      evidence: [
        {
          indicator: "stress_score",
          metric: "Self-reported stress_score",
          observed: `${Math.round(stress.value)} / 100`,
          threshold: `< 68 / 100`,
          basis: "Demo (0-100, higher is worse)",
          t: stress.t,
        },
      ],
      explanation: `Self-reported stress reached ${Math.round(stress.value)}/100. Consider paced breathing and scheduling a check-in with crew or Earth (expected reply delay ~${delayMin} min).`,
      suggestedActions: ["Start Calm Breathing protocol", "Check in with crew or flight surgeon"],
      protocolId: "calm_breathing",
      timeToEffectSec: 21600,
    });
  }

  if (visionSym && visionSym.value >= 1) {
    const sansVal = sansRisk?.value ?? 0;
    candidates.push({
      detectorId: "vision_sans",
      class: 3,
      area: "vision",
      title: "VISION / SANS SYMPTOM",
      whyLine: `Self-reported blurred vision (SANS demo index ${sansVal.toFixed(0)}/100)`,
      evidence: [
        {
          indicator: "vision_symptom",
          metric: "Self-reported near-vision symptom",
          observed: `score ${visionSym.value}`,
          threshold: `0 (none)`,
          basis: "Demo / [R9, R19]",
          t: visionSym.t,
        },
      ],
      explanation: `Blurred near vision logged (SANS demonstration index ${sansVal.toFixed(0)}/100). About 66% of long-duration ISS astronauts show early SANS signs and 16–19% show clinically relevant optic disc edema [R9, R19]. Advise contacting the flight surgeon (expected reply delay ~${delayMin} min).`,
      suggestedActions: ["Contact crew medical officer / flight surgeon", "Perform visual acuity & Amsler grid check"],
      escalateToMedical: true,
      timeToEffectSec: 43200,
    });
  }

  // ---------------------------------------------------------------------------
  // 4b. CASCADE COMBINER (ENG-DET-005 / S-12): Rank multi-area coupled hazards
  // ---------------------------------------------------------------------------
  const distinctAreas = Array.from(new Set(candidates.map((c) => c.area)));
  if (distinctAreas.length >= 2) {
    const topClass = Math.min(...candidates.map((c) => c.class)) as 1 | 2 | 3;
    const minTte = Math.max(10, Math.min(...candidates.map((c) => c.timeToEffectSec)) - 1);
    const mergedEvidence = candidates.flatMap((c) => c.evidence).slice(0, 6);
    const primaryChild = [...candidates].sort((a, b) =>
      a.class !== b.class ? a.class - b.class : a.timeToEffectSec - b.timeToEffectSec
    )[0];
    const areaList = distinctAreas.map((a) => a.replace("_", " ")).join(" + ");

    candidates.push({
      detectorId: "cascade_coupled",
      class: topClass,
      area: primaryChild.area,
      title: "COUPLED HAZARD CASCADE",
      whyLine: `${distinctAreas.length} linked hazards (${areaList}): ${primaryChild.whyLine}`,
      evidence: mergedEvidence,
      explanation: `Coupled multi-system event across ${areaList}. Highest immediate priority: ${primaryChild.explanation}`,
      suggestedActions: Array.from(new Set(candidates.flatMap((c) => c.suggestedActions))).slice(0, 4),
      protocolId: primaryChild.protocolId,
      escalateToMedical: candidates.some((c) => c.escalateToMedical),
      timeToEffectSec: minTte,
    });
  }

  // ---------------------------------------------------------------------------
  // 5. RESOLVE CLEARED ALERTS & MERGE / RANK ACTIVE ALERTS (ENG-DET-006 / 007)
  // ---------------------------------------------------------------------------
  const candidateByDetector = new Map<string, CandidateAlert>();
  for (const c of candidates) {
    const existing = candidateByDetector.get(c.detectorId);
    if (!existing || c.class < existing.class) {
      candidateByDetector.set(c.detectorId, c);
    }
  }

  // Resolve active alerts whose detector condition cleared and apply post-clear cooldown
  const stillActive: AlertObject[] = [];
  for (const prev of store.activeAlerts) {
    if (candidateByDetector.has(prev.detectorId)) {
      stillActive.push(prev);
    } else {
      store.cooldownUntilByArea[prev.area] = t + ENGINE_LIMITS.cooldownSecondsByArea[prev.area];
      store.appendEvent(t, "alert_cleared", {
        alertId: prev.id,
        detectorId: prev.detectorId,
        area: prev.area,
        class: prev.class,
      });
    }
  }

  // Update existing or raise new alerts respecting post-clear per-area cooldown
  for (const cand of candidateByDetector.values()) {
    const existing = stillActive.find((a) => a.detectorId === cand.detectorId);
    if (existing) {
      existing.class = cand.class;
      existing.title = cand.title;
      existing.whyLine = cand.whyLine;
      existing.evidence = cand.evidence;
      existing.explanation = cand.explanation;
      existing.suggestedActions = cand.suggestedActions;
      existing.protocolId = cand.protocolId;
      existing.escalateToMedical = cand.escalateToMedical;
      existing.timeToEffectSec = cand.timeToEffectSec;
    } else {
      const cooldownUntil = store.cooldownUntilByArea[cand.area] ?? -1;
      // Class 1 and Class 2 emergencies/warnings bypass area cooldowns for safety
      if (cand.class === 3 && t < cooldownUntil) {
        continue;
      }
      const alert: AlertObject = {
        id: `alr-${cand.detectorId}-${Math.round(t)}`,
        detectorId: cand.detectorId,
        t,
        class: cand.class,
        area: cand.area,
        title: cand.title,
        whyLine: cand.whyLine,
        evidence: cand.evidence,
        explanation: cand.explanation,
        suggestedActions: cand.suggestedActions,
        protocolId: cand.protocolId,
        escalateToMedical: cand.escalateToMedical,
        state: "active",
        timeToEffectSec: cand.timeToEffectSec,
      };
      stillActive.push(alert);
      store.appendEvent(t, "alert_raised", {
        alertId: alert.id,
        detectorId: alert.detectorId,
        class: alert.class,
        area: alert.area,
        whyLine: alert.whyLine,
      });
    }
  }

  // Rank concurrent alerts: Class (1 before 2 before 3), then shortest timeToEffectSec (ENG-DET-007)
  stillActive.sort((a, b) => {
    if (a.class !== b.class) return a.class - b.class;
    return a.timeToEffectSec - b.timeToEffectSec;
  });

  store.activeAlerts = stillActive;
}
