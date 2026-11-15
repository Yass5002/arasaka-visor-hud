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
  /** Immediate overrides applied when scenario fires */
  immediateSamples?: Partial<Record<IndicatorId, number>>;
  /** Optional custom slider overrides (used for saved custom scenarios) */
  customOverrides?: Partial<Record<IndicatorId, number>>;
}

export const PRESET_CATALOGUE: PresetDefinition[] = [
  // Fast emergency and warning events
  {
    id: "S-01",
    code: "S-01",
    name: "Solar Storm Radiation Surge",
    group: "fast_event",
    scope: "eva_surface",
    summary: "A solar flare spikes outside radiation over 5x normal levels within minutes.",
    basis: "NASA-STD-3001 Vol 1/2",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-02",
    code: "S-02",
    name: "Suit Air Scrubber Failure",
    group: "fast_event",
    scope: "eva_surface",
    summary: "Carbon dioxide builds up inside the suit because the air filter slows down.",
    basis: "NASA-STD-3001 V2 6004",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-03",
    code: "S-03",
    name: "Oxygen Supply Drop",
    group: "fast_event",
    scope: "eva_surface",
    summary: "Your suit oxygen flow drops down to unsafe breathing levels.",
    basis: "NASA-STD-3001 V2 6003",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-04",
    code: "S-04",
    name: "Heavy Walking Strain",
    group: "fast_event",
    scope: "eva_surface",
    summary: "Heart rate climbs above your safe outdoor walking limit during heavy effort.",
    basis: "Suit Safety Limit",
    recommendedSpeed: 1,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-14",
    code: "S-14",
    name: "Suit Air Pressure Leak",
    group: "fast_event",
    scope: "eva_surface",
    summary: "A seal leak drops air pressure inside the spacesuit toward emergency levels.",
    basis: "NASA-STD-3001 V2 6006",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-05",
    code: "S-05",
    name: "Post-Walk Dizziness",
    group: "fast_event",
    scope: "mission_long",
    summary: "Standing blood pressure drops right after returning inside from a spacewalk.",
    basis: "Clinical Safety Rule",
    recommendedSpeed: 1,
    targetContext: { activity: "cabin", location: "habitat" },
  },

  // Slow multi-day health changes
  {
    id: "S-06",
    code: "S-06",
    name: "Week of Lost Sleep",
    group: "slow_drift",
    summary: "Nightly sleep drops from 7 hours to 5.5 hours, slowing your reaction time.",
    basis: "NASA-STD-3001 R6",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 12,
  },
  {
    id: "S-07",
    code: "S-07",
    name: "Missed Strength Workouts",
    group: "slow_drift",
    summary: "Skipping strength training for two weeks weakens bone density protection.",
    basis: "NASA Bone Study R7",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 15,
  },
  {
    id: "S-08",
    code: "S-08",
    name: "Lowered Immune Strength",
    group: "slow_drift",
    summary: "Lost sleep, stress, and radiation slowly weaken immune defenses.",
    basis: "NASA Immune Study R8",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 14,
  },
  {
    id: "S-09",
    code: "S-09",
    name: "High Isolation Stress",
    group: "slow_drift",
    summary: "Weeks inside a small habitat raise stress and lower daily movement.",
    basis: "Crew Wellness R10",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 28,
  },
  {
    id: "S-10",
    code: "S-10",
    name: "Blurry Near Vision",
    group: "slow_drift",
    summary: "Fluid shifts in low gravity cause blurry up-close reading vision.",
    basis: "NASA Vision Study R9",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 30,
  },
  {
    id: "S-11",
    code: "S-11",
    name: "High Lifetime Radiation",
    group: "slow_drift",
    scope: "eva_surface",
    summary: "Total radiation across the mission approaches the career safety limit.",
    basis: "NASA-STD-3001 V1 4030",
    recommendedSpeed: 86400,
    supportsScenarioStart: true,
    scenarioStartDays: 60,
    targetContext: { activity: "eva", location: "surface" },
  },

  // Combined hazards and smart context checks
  {
    id: "S-12",
    code: "S-12",
    name: "Multiple Hazards at Once",
    group: "smart_case",
    scope: "eva_surface",
    summary: "A solar flare hits while you are already short on sleep and feeling stressed.",
    basis: "Multi-Alert Ranking",
    recommendedSpeed: 60,
    targetContext: { activity: "eva", location: "surface" },
  },
  {
    id: "S-13",
    code: "S-13",
    name: "Normal Workout Check (Stays Quiet)",
    group: "smart_case",
    scope: "mission_long",
    summary: "Heart rate hits 140 bpm during a workout and stays quiet because exercise is expected.",
    basis: "Activity Context Check",
    recommendedSpeed: 1,
    targetContext: { activity: "exercise", location: "habitat" },
  },
  {
    id: "S-13b",
    code: "S-13b",
    name: "Resting High Heart Rate (Fires Alert)",
    group: "smart_case",
    scope: "mission_long",
    summary: "The same 140 bpm while sitting inside triggers an alert right away.",
    basis: "Activity Context Check",
    recommendedSpeed: 1,
    targetContext: { activity: "cabin", location: "habitat" },
  },
  {
    id: "S-15",
    code: "S-15",
    name: "Steep Crater Climb (Stays Quiet)",
    group: "smart_case",
    scope: "eva_surface",
    summary: "Heart rate reaches 138 bpm during an active outdoor climb and stays quiet under the safe limit.",
    basis: "Activity Context Check",
    recommendedSpeed: 1,
    targetContext: { activity: "eva", location: "surface" },
  },
];
