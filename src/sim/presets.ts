import type { ActivityType, IndicatorId, LocationType } from "../engine/types";

export type PresetGroup = "fast_event" | "slow_drift" | "smart_case" | "custom";
export type PresetScope = "eva_surface" | "mission_long";

export interface PresetDefinition {
  id: string;
  code: string;
  name: string;
  group: PresetGroup;
  scope?: PresetScope;
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
  // 7.1 Fast events (ARASAKA-SIM-001 Section 7.1 + EVA Suit Seal Leak)
  {
    id: "S-01",
    code: "S-01",
    name: "Solar Storm Radiation Surge",
    group: "fast_event",
    scope: "eva_surface",
    summary: "Solar flare drives surface radiation >5× baseline within 5 min; heart rate and stress spike.",
    basis: "[V1 4031], [V1 4030], [V2 6164], R2",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-02",
    code: "S-02",
    name: "CO₂ Scrubber Failure & Air Buildup",
    group: "fast_event",
    scope: "eva_surface",
    summary: "CO₂ scrubber degrades; 1-hr ppCO₂ climbs past 2.4 mmHg (Class 3) and 3.0 mmHg (Class 2) with reaction slowing.",
    basis: "[V2 6004], R4",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-03",
    code: "S-03",
    name: "Suit Oxygen Supply Drop",
    group: "fast_event",
    scope: "eva_surface",
    summary: "Primary O₂ feed loses pressure; inspired PIO₂ falls from 150 toward 120 mmHg (hypoxia risk).",
    basis: "[V2 6003], R16",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-04",
    code: "S-04",
    name: "EVA Overexertion Strain",
    group: "fast_event",
    scope: "eva_surface",
    summary: "Traverse heart rate spikes to 158 bpm (> 149 bpm EVA limit), HRV drops 40%, O₂ consumption elevated.",
    basis: "Demo",
    recommendedSpeed: 1,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-14",
    code: "EVA-P1",
    name: "Suit Seal Depressurization",
    group: "fast_event",
    scope: "eva_surface",
    summary: "Suit pressure seal breach drops pressure below 29.6 kPa EVA floor (Class 1 emergency < 25.6 kPa).",
    basis: "[V2 6006] / Demo",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-05",
    code: "S-05",
    name: "Post-EVA Orthostatic Drop",
    group: "fast_event",
    scope: "mission_long",
    summary: "Standing systolic blood pressure falls >= 20 mmHg with compensatory heart rate spike.",
    basis: "Demo",
    recommendedSpeed: 1,
    targetContext: { activity: "cabin", location: "habitat" },
  },

  // 7.2 Slow drifts
  {
    id: "S-06",
    code: "S-06",
    name: "Chronic Sleep Deprivation & Drift",
    group: "slow_drift",
    summary: "Nightly sleep drops 7.0 h → 5.5 h over 14 days; reaction time slows and triggers Class 3 around Day 10.",
    basis: "Demo, R6",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 12,
  },
  {
    id: "S-07",
    code: "S-07",
    name: "Missed Exercise Bone Loss",
    group: "slow_drift",
    summary: "Resistive workouts drop to zero for weeks; protective compliance falls to 0 and bone loss accelerates.",
    basis: "R7, ENG-001 5.1",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 15,
  },
  {
    id: "S-08",
    code: "S-08",
    name: "Immune Suppression & Shedding Risk",
    group: "slow_drift",
    summary: "Combined sleep debt, cortisol stress, and radiation drive demonstration immune_index <= 70 ([R8]).",
    basis: "R8",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 14,
  },
  {
    id: "S-09",
    code: "S-09",
    name: "Isolation & Burnout Mood Decline",
    group: "slow_drift",
    summary: "Self-reported stress climbs (>= 68/100) and activity drops across 4–6 weeks of confinement.",
    basis: "Demo, R10",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 28,
  },
  {
    id: "S-10",
    code: "S-10",
    name: "Fluid Shift & Blurred Vision (SANS)",
    group: "slow_drift",
    summary: "Crewmember logs blurred near vision while fluid-shift SANS risk index climbs across mission days.",
    basis: "R9, R19",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 30,
  },
  {
    id: "S-11",
    code: "S-11",
    name: "Career Radiation Ceiling Approach",
    group: "slow_drift",
    scope: "eva_surface",
    summary: "Cumulative EVA radiation approaches the 600 mSv career limit (Class 3 at 75%, Class 2 at 90%).",
    basis: "[V1 4030]",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 60,
    targetContext: { activity: "eva", location: "surface" },
  },

  // 7.3 Smart cases
  {
    id: "S-12",
    code: "S-12",
    name: "Multi-System Emergency Cascade",
    group: "smart_case",
    scope: "eva_surface",
    summary: "Radiation surge + sleep/cognitive debt + isolation stress couple simultaneously; single ranked triage.",
    basis: "ENG-DET-005, ENG-DET-007, R3",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-13",
    code: "S-13",
    name: "Workout Heart Rate (Silent Context Check)",
    group: "smart_case",
    scope: "mission_long",
    summary: "140 bpm during scheduled resistive exercise stays completely silent because activity context expects exertion.",
    basis: "ENG-CTX-003",
    recommendedSpeed: 1,
    targetContext: { activity: "exercise", location: "habitat" },
  },
  {
    id: "S-13b",
    code: "S-13b",
    name: "Resting Tachycardia (Negative Control)",
    group: "smart_case",
    scope: "mission_long",
    summary: "Same 140 bpm while resting in cabin fires an immediate context alert (proves S-13 isn't muted).",
    basis: "ENG-CTX-002",
    recommendedSpeed: 1,
    targetContext: { activity: "cabin", location: "habitat" },
  },
  {
    id: "S-15",
    code: "EVA-CTX",
    name: "Hard EVA Traverse (Silent Context Check)",
    group: "smart_case",
    scope: "eva_surface",
    summary: "138 bpm during active surface climb stays silent beneath the 149 bpm EVA threshold.",
    basis: "ENG-CTX-001",
    recommendedSpeed: 1,
    targetContext: { activity: "eva", location: "surface" },
  },
];
