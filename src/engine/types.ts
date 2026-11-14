/**
 * Core domain types for the Arasaka Crew Health Assistant Engine (ARASAKA-ENG-001).
 * No UI or rendering logic lives here.
 */

export type SampleKind = "sensed" | "modelled" | "self_reported" | "source_input";
export type SampleSource = "simulator" | "manual" | "preset" | "sensor";
export type AlertClass = 0 | 1 | 2 | 3;
export type AlertState = "active" | "acknowledged" | "resolved";
export type HealthArea =
  | "radiation"
  | "environment"
  | "cardiovascular"
  | "sleep_behaviour"
  | "bone"
  | "immune"
  | "vision";

export type ActivityType = "eva" | "cabin" | "exercise" | "sleep" | "rest";
export type LocationType = "surface" | "habitat" | "transit";

export type IndicatorId =
  // Radiation & Environment
  | "dose_rate"
  | "dose_cumulative"
  | "spe_event_dose"
  | "ppco2"
  | "pio2"
  | "cabin_pressure"
  | "suit_pressure"
  | "cabin_temperature"
  | "cabin_humidity"
  | "solar_event_flag"
  // Physiology & Behaviour
  | "heart_rate"
  | "hrv_rmssd"
  | "respiration_rate"
  | "o2_consumption"
  | "blood_pressure"
  | "orthostatic_drop"
  | "sleep_hours"
  | "sleep_debt"
  | "circadian_drift"
  | "reaction_time"
  | "stress_score"
  | "vision_symptom"
  | "isolation_days"
  | "exercise_sessions"
  // Modelled indicators (ENG-001 Section 5)
  | "bone_loss_lumbar"
  | "bone_loss_femoral_neck"
  | "bone_loss_trochanter"
  | "bone_loss_pelvis"
  | "bone_loss_total"
  | "immune_index"
  | "cognitive_drift"
  | "sans_risk"
  | "cortisol_trend";

export interface IndicatorSample {
  id: IndicatorId;
  /** Mission time in seconds since mission start (t >= 0) */
  t: number;
  value: number;
  unit: string;
  kind: SampleKind;
  source: SampleSource;
  /** Confidence from 0 to 1 */
  quality: number;
}

export type EventLogType =
  | "activity_start"
  | "activity_end"
  | "exercise_session"
  | "sleep_start"
  | "sleep_end"
  | "meal"
  | "alert_raised"
  | "alert_cleared"
  | "assistant_said"
  | "astronaut_asked"
  | "step_completed"
  | "preset_fired"
  | "manual_override";

export interface EventLogEntry {
  id: string;
  t: number;
  runId: string;
  type: EventLogType;
  payload: Record<string, unknown>;
  links?: string[];
}

export interface MissionContext {
  activity: ActivityType;
  location: LocationType;
  missionDay: number;
  timeOfDaySec: number;
  scheduledActivity: ActivityType;
}

export interface CrewProfile {
  age: number;
  sex: "male" | "female";
  restingHeartRate: number;
  hrvBaselineMs: number;
  usualSleepHours: number;
  reactionTimeBaselineMs: number;
  priorCareerDoseMsv: number;
  exerciseSessionsPerWeek: number;
  exerciseSessionMinutes: number;
}

export interface UncertaintyRange {
  low: number;
  high: number;
  note: string;
}

export interface IndicatorLiveValue {
  id: IndicatorId;
  label: string;
  area: HealthArea;
  value: number;
  unit: string;
  t: number;
  kind: SampleKind;
  source: SampleSource;
  quality: number;
  alertClass: AlertClass;
  basis: string;
  uncertainty?: UncertaintyRange;
  demonstrationIndex?: boolean;
  visorVisible: boolean;
}

export interface AlertEvidenceItem {
  indicator?: IndicatorId;
  metric: string;
  observed: string;
  threshold: string;
  basis: string;
  t: number;
}

export interface AlertObject {
  id: string;
  detectorId: string;
  t: number;
  class: 1 | 2 | 3;
  area: HealthArea;
  title: string;
  /** Concise single-line evidence summary shown on visor HUD (SIM-HUD-004) */
  whyLine: string;
  evidence: AlertEvidenceItem[];
  explanation: string;
  suggestedActions: string[];
  protocolId?: ProtocolId;
  escalateToMedical?: boolean;
  state: AlertState;
  timeToEffectSec: number;
  /** True when the alert has been acknowledged */
  acknowledgedAt?: number;
}

export type ProtocolId =
  | "shelter"
  | "air_check"
  | "exertion_recovery"
  | "orthostatic_response"
  | "resistive_exercise"
  | "sleep_reset"
  | "calm_breathing";

export interface ProtocolStep {
  index: number;
  instruction: string;
  confirmationPrompt: string;
}

export interface ActiveProtocolState {
  id: ProtocolId;
  name: string;
  startedAt: number;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: ProtocolStep;
  completedSteps: number[];
  completed: boolean;
}

export interface LiveState {
  t: number;
  missionLengthDays: 180 | 1000;
  missionDay: number;
  timeOfDaySec: number;
  runId: string;
  context: MissionContext;
  profile: CrewProfile;
  overallClass: AlertClass;
  indicators: Record<IndicatorId, IndicatorLiveValue>;
  activeAlerts: AlertObject[];
  rankedPrimaryAlert: AlertObject | null;
  activeProtocol: ActiveProtocolState | null;
  /** Cumulative dose as % of 600 mSv NASA-STD-3001 career limit */
  careerDosePercent: number;
  /** Elapsed time in seconds since last SPE onset (0 if inactive) */
  speEventDoseMsv: number;
}

export interface EngineSnapshot {
  snapshotId: string;
  t: number;
  runId: string;
  label: string;
  context: MissionContext;
  profile: CrewProfile;
  missionLengthDays: 180 | 1000;
  samplesByIndicator: Record<IndicatorId, IndicatorSample[]>;
  hourlyRollups: Record<string, Array<{ bucketHour: number; min: number; max: number; mean: number; count: number }>>;
  dailyRollups: Record<string, Array<{ day: number; min: number; max: number; mean: number; count: number }>>;
  cumulativeDoseMsv: number;
  speEventDoseMsv: number;
  lastDoseSampleT: number;
  boneDensity: Record<BoneSiteKey, number>;
  lastBoneUpdateT: number;
  sleepHistoryByDay: Record<number, number>;
  activeAlerts: AlertObject[];
  cooldownUntilByArea: Partial<Record<HealthArea, number>>;
  activeProtocol: ActiveProtocolState | null;
}

export type BoneSiteKey = "lumbar" | "femoral_neck" | "trochanter" | "pelvis" | "total";

export interface IndicatorSummary {
  id: IndicatorId;
  unit: string;
  kind: SampleKind;
  windowMinutes: number;
  min: number;
  max: number;
  mean: number;
  latest: number;
  latestT: number;
  trendPerHour: number;
  sampleCount: number;
}
