import type { ActivityType, IndicatorId, LocationType } from "../engine/types";

export type PresetGroup = "fast_event" | "slow_drift" | "smart_case" | "custom";

export interface PresetDefinition {
  id: string;
  code: string;
  name: string;
  group: PresetGroup;
  summary: string;
  basis: string;
  recommendedSpeed?: 1 | 60 | 3600 | 86400;
  supportsScenarioStart?: boolean;
  scenarioStartDays?: number;
  targetContext?: { activity: ActivityType; location: LocationType };
  /** Immediate overrides applied when preset fires */
  immediateSamples?: Partial<Record<IndicatorId, number>>;
  /** Optional custom slider overrides (used for SIM-CTL-005 custom presets) */
  customOverrides?: Partial<Record<IndicatorId, number>>;
}

export const PRESET_CATALOGUE: PresetDefinition[] = [
  // 7.1 Fast events
  {
    id: "S-01",
    code: "S-01",
    name: "Solar Particle Event",
    group: "fast_event",
    summary: "Dose rate steps to 5× baseline within 5 min (integrating to ~40 mSv over 6 h); HR +25 bpm, stress +20.",
    basis: "[V1 4031], [V1 4030], [V2 6164], R2",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-02",
    code: "S-02",
    name: "CO₂ Buildup",
    group: "fast_event",
    summary: "ppCO₂ rises +0.05 mmHg/min from 1.5 mmHg; 1-hr mean hits 2.4 mmHg (~47 min, Class 3) and 3.0 mmHg (60 min, Class 2).",
    basis: "[V2 6004], R4",
    recommendedSpeed: 60,
    targetContext: { activity: "cabin", location: "habitat" },
  },
  {
    id: "S-03",
    code: "S-03",
    name: "Oxygen Drop (PIO₂)",
    group: "fast_event",
    summary: "PIO₂ falls from 150 to 120 mmHg over 10 min; HR +20 bpm (Class 3 < 145, Class 2 < 127 mmHg).",
    basis: "[V2 6003], R16",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-04",
    code: "S-04",
    name: "EVA Exertion Strain",
    group: "fast_event",
    summary: "HR climbs above 149 bpm EVA limit, HRV drops 40% under baseline, O₂ consumption high.",
    basis: "Demo",
    recommendedSpeed: 1,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-05",
    code: "S-05",
    name: "Orthostatic Dizziness",
    group: "fast_event",
    summary: "Standing systolic blood pressure falls >= 20 mmHg with compensatory HR jump.",
    basis: "Demo",
    recommendedSpeed: 1,
    targetContext: { activity: "cabin", location: "habitat" },
  },

  // 7.2 Slow drifts
  {
    id: "S-06",
    code: "S-06",
    name: "Sleep Debt & Circadian Drift",
    group: "slow_drift",
    summary: "Nightly sleep drops linearly 7.0 h → 5.5 h over 14 days; triggers Class 3 alert on day 10.",
    basis: "Demo, R6",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 12,
  },
  {
    id: "S-07",
    code: "S-07",
    name: "Missed Resistive Exercise",
    group: "slow_drift",
    summary: "Resistive sessions drop to 0 for 6 weeks; c(t) → 0 and Class 3 bone alert triggers after 2 weeks.",
    basis: "R7, ENG-001 5.1",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 15,
  },
  {
    id: "S-08",
    code: "S-08",
    name: "Immune Stress",
    group: "slow_drift",
    summary: "Sleep debt, cortisol trend, and rising dose drive immune_index <= 70 (Demo).",
    basis: "R8",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 14,
  },
  {
    id: "S-09",
    code: "S-09",
    name: "Isolation & Mood Decline",
    group: "slow_drift",
    summary: "Self-reported stress rises and activity falls over 4–6 weeks.",
    basis: "Demo, R10",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 28,
  },
  {
    id: "S-10",
    code: "S-10",
    name: "Fluid Shift & Vision Change",
    group: "slow_drift",
    summary: "Blurred near vision reported while sans_risk climbs with mission days.",
    basis: "R9, R19",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 30,
  },
  {
    id: "S-11",
    code: "S-11",
    name: "Career Dose Limit Drift",
    group: "slow_drift",
    summary: "Cumulative dose climbs from prior career baseline toward 600 mSv (Class 3 at 75%, Class 2 at 90%).",
    basis: "[V1 4030]",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 60,
  },

  // 7.3 Smart cases
  {
    id: "S-12",
    code: "S-12",
    name: "Cascade (Coupled Hazards)",
    group: "smart_case",
    summary: "Sleep debt + solar dose rate rise + isolation stress active together; ranked single explanation.",
    basis: "ENG-DET-005, ENG-DET-007, R3",
    recommendedSpeed: 60,
  },
  {
    id: "S-13",
    code: "S-13",
    name: "False Alarm (Exercise Context)",
    group: "smart_case",
    summary: "HR 140 bpm during scheduled resistive exercise: zero alerts, silent assistant (ENG-CTX-003).",
    basis: "ENG-CTX-003",
    recommendedSpeed: 1,
    targetContext: { activity: "exercise", location: "habitat" },
  },
  {
    id: "S-13b",
    code: "S-13b",
    name: "Negative Control (Cabin Context)",
    group: "smart_case",
    summary: "Same 140 bpm HR with context set to cabin: alert raises immediately (ENG-CTX-002).",
    basis: "ENG-CTX-002",
    recommendedSpeed: 1,
    targetContext: { activity: "cabin", location: "habitat" },
  },
];
