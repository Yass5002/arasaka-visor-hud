export type SimEventId =
  | "radiation_burst"
  | "o2_leak"
  | "pressure_surge"
  | "terrain_scan";

export interface SimulationControls {
  /** Global window cursor tracking (user-requested: astronaut keeps moving while using dashboard) */
  globalCursorTracking: boolean;
  /** Idle return drift back toward center when cursor is stationary */
  idleReturnEnabled: boolean;
  /** Pointer sensitivity multiplier */
  trackingGain: number;
  /** Baseline target O2 fraction (%) */
  o2BaselinePct: number;
  /** Baseline target suit pressure (mb) */
  atmBaselineMb: number;
  /** Breathing cadence & subtle exertion amplitude multiplier */
  exertionMultiplier: number;
  /** Active event expiration timestamps (performance.now() ms) */
  radiationBurstUntilMs: number;
  o2LeakUntilMs: number;
  pressureSurgeUntilMs: number;
  /** Monotonic counter incremented when operator fires a visor scan sweep */
  manualScanNonce: number;
  /** Active timed trigger timestamp for terrain scan highlight */
  terrainScanUntilMs: number;
}

export interface TelemetrySnapshot {
  timestampMs: number;
  o2Pct: number;
  atmMb: number;
  radMsvH: number;
  radAlertActive: boolean;
  altitudeKm: number;
  headYawDeg: number;
  headPitchDeg: number;
  eyeYawDeg: number;
  eyePitchDeg: number;
  bpmEstimate: number;
  activeEvents: SimEventId[];
}

export interface ConsoleLogEntry {
  id: string;
  timeLabel: string;
  source: "SIM" | "EVENT" | "AI" | "OP";
  severity: "info" | "warn" | "critical" | "ok";
  title: string;
  detail: string;
}

export const DEFAULT_SIM_CONTROLS: SimulationControls = {
  globalCursorTracking: true,
  idleReturnEnabled: true,
  trackingGain: 1.0,
  o2BaselinePct: 0.129,
  atmBaselineMb: 7.4,
  exertionMultiplier: 1.0,
  radiationBurstUntilMs: 0,
  o2LeakUntilMs: 0,
  pressureSurgeUntilMs: 0,
  manualScanNonce: 0,
  terrainScanUntilMs: 0,
};
