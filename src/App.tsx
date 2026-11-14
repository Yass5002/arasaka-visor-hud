import { useCallback, useRef, useState } from "react";
import { VisorScene } from "./components/VisorScene";
import { AiCopilotPanel } from "./components/AiCopilotPanel";
import { EventLauncherDock } from "./components/EventLauncherDock";
import { DASHBOARD_CONFIG, HUD_CONFIG } from "./config/visorConfig";
import {
  ConsoleLogEntry,
  DEFAULT_SIM_CONTROLS,
  SimEventId,
  SimulationControls,
  TelemetrySnapshot,
} from "./simulation/types";

function formatClock(msSinceLoad: number): string {
  const totalSec = Math.max(0, Math.floor(msSinceLoad / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `T+${mm}:${ss}`;
}

function createInitialLogs(): ConsoleLogEntry[] {
  return [
    {
      id: "boot-1",
      timeLabel: "T+00:00",
      source: "SIM",
      severity: "ok",
      title: "Optical bay locked 1.42:1",
      detail: "170° H × 120° V curved visor dome active. Global gaze tracking enabled.",
    },
    {
      id: "boot-2",
      timeLabel: "T+00:01",
      source: "AI",
      severity: "info",
      title: "AEGIS-04 telemetry link nominal",
      detail:
        "Jezero West rim sector illuminated from upper-left solar azimuth (-0.68, +0.50). Ready for event injection.",
    },
  ];
}

function buildAiReply(prompt: string, telemetry: TelemetrySnapshot): string {
  const q = prompt.toLowerCase();
  const dirH =
    telemetry.headYawDeg > 1.2
      ? "port (left)"
      : telemetry.headYawDeg < -1.2
        ? "starboard (right)"
        : "centerline";
  const dirV =
    telemetry.headPitchDeg > 0.9
      ? "skyward"
      : telemetry.headPitchDeg < -0.9
        ? "regolith foreground"
        : "horizon level";

  if (q.includes("gaze") || q.includes("sector") || q.includes("terrain") || q.includes("look")) {
    return `Astronaut gaze tracking ${dirH}, ${dirV} (${telemetry.headYawDeg.toFixed(
      1
    )}° yaw / ${telemetry.headPitchDeg.toFixed(1)}° pitch). Basalt boulder field shows sharp sunlit west-facing edges; elevation readout ${telemetry.altitudeKm.toFixed(
      2
    )} km.`;
  }

  if (q.includes("rad") || q.includes("solar") || q.includes("flare")) {
    return telemetry.activeEvents.includes("radiation_burst")
      ? `Elevated solar proton flux at ${telemetry.radMsvH.toFixed(
          2
        )} mSv/h. Visor polycarbonate warning active; recommend angled terrain shelter within 45s if peak holds.`
      : `Current ambient flux ${telemetry.radMsvH.toFixed(
          2
        )} mSv/h (threshold 2.50). Visor upper-right warning stays armed for test pulses.`;
  }

  if (q.includes("life") || q.includes("o2") || q.includes("audit") || q.includes("press")) {
    const reserveNote =
      telemetry.o2Pct < 0.1
        ? "O₂ partial pressure depleted below 0.100% nominal margin — check seal integrity."
        : "O₂ partial mix and suit pressure remain inside safe EVA envelope.";
    return `Suit audit: O₂ ${telemetry.o2Pct.toFixed(3)}%, Pressure ${telemetry.atmMb.toFixed(
      1
    )} mb, Respiration ~${telemetry.bpmEstimate} BPM. ${reserveNote}`;
  }

  const activeLabel =
    telemetry.activeEvents.length > 0 ? telemetry.activeEvents.join(", ") : "none";
  return `AEGIS-04 telemetry snapshot — O₂ ${telemetry.o2Pct.toFixed(
    3
  )}%, ${telemetry.atmMb.toFixed(1)} mb, Rad ${telemetry.radMsvH.toFixed(
    2
  )} mSv/h, Gaze ${telemetry.headYawDeg.toFixed(1)}°/${telemetry.headPitchDeg.toFixed(
    1
  )}°. Active faults: ${activeLabel}.`;
}

export function App() {
  const simRef = useRef<SimulationControls>({ ...DEFAULT_SIM_CONTROLS });
  const loadStartMsRef = useRef<number>(performance.now());
  const logCounterRef = useRef<number>(10);

  const [controls, setControls] = useState<SimulationControls>(() => ({ ...DEFAULT_SIM_CONTROLS }));
  const [visorExpanded, setVisorExpanded] = useState(false);
  const [logs, setLogs] = useState<ConsoleLogEntry[]>(createInitialLogs);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(() => ({
    timestampMs: 0,
    o2Pct: DEFAULT_SIM_CONTROLS.o2BaselinePct,
    atmMb: DEFAULT_SIM_CONTROLS.atmBaselineMb,
    radMsvH: 1.42,
    radAlertActive: false,
    altitudeKm: HUD_CONFIG.altitudeTape.baseValue,
    headYawDeg: 0,
    headPitchDeg: 0,
    eyeYawDeg: 0,
    eyePitchDeg: 0,
    bpmEstimate: 74,
    activeEvents: [],
  }));

  const pushLog = useCallback(
    (entry: Omit<ConsoleLogEntry, "id" | "timeLabel">) => {
      const id = `log-${++logCounterRef.current}`;
      const timeLabel = formatClock(performance.now() - loadStartMsRef.current);
      setLogs((prev) => [{ ...entry, id, timeLabel }, ...prev].slice(0, 28));
    },
    []
  );

  const handleTelemetrySample = useCallback((sample: TelemetrySnapshot) => {
    setTelemetry(sample);
  }, []);

  const handleUpdateControl = useCallback(
    <K extends keyof SimulationControls>(key: K, value: SimulationControls[K]) => {
      simRef.current[key] = value;
      setControls({ ...simRef.current });
    },
    []
  );

  const handleLaunchEvent = useCallback(
    (eventId: SimEventId) => {
      const now = performance.now();
      const { events } = DASHBOARD_CONFIG;

      if (eventId === "radiation_burst") {
        simRef.current.radiationBurstUntilMs = now + events.radiationBurstDurationMs;
        pushLog({
          source: "EVENT",
          severity: "critical",
          title: "Solar Radiation Burst injected",
          detail: "Upper-right visor alert pulsed; ionizing flux elevated for 12s.",
        });
        pushLog({
          source: "AI",
          severity: "critical",
          title: "AEGIS-04 Hazard Advisory",
          detail:
            "Proton spike detected across curved dome sensors. Recommend minimizing open-ridge exposure.",
        });
      } else if (eventId === "o2_leak") {
        simRef.current.o2LeakUntilMs = now + events.o2LeakDurationMs;
        pushLog({
          source: "EVENT",
          severity: "warn",
          title: "O₂ Micro-Leak simulated",
          detail: "O₂ baseline dipping & breathing cadence ramped 1.45× for 12s.",
        });
        pushLog({
          source: "AI",
          severity: "warn",
          title: "AEGIS-04 Life-Support Note",
          detail:
            "Partial O₂ slope dropping. Scrubbers compensating; monitor helmet respiration rate.",
        });
      } else if (eventId === "pressure_surge") {
        simRef.current.pressureSurgeUntilMs = now + events.pressureSurgeDurationMs;
        pushLog({
          source: "EVENT",
          severity: "warn",
          title: "Suit Pressure Surge triggered",
          detail: "Cabin mb spiked +2.6 mb with structural micro-vibration across shell.",
        });
        pushLog({
          source: "AI",
          severity: "info",
          title: "AEGIS-04 Regulator Check",
          detail:
            "Relief valve cycling normally; acoustic boom & neck ring shock load within tolerances.",
        });
      } else if (eventId === "terrain_scan") {
        simRef.current.manualScanNonce += 1;
        simRef.current.terrainScanUntilMs = now + events.terrainScanDurationMs;
        pushLog({
          source: "EVENT",
          severity: "info",
          title: "Visor Wireframe Terrain Scan",
          detail: `Curved optical mesh sweep launched across current look vector (${telemetry.headYawDeg.toFixed(
            1
          )}° yaw).`,
        });
        pushLog({
          source: "AI",
          severity: "ok",
          title: "AEGIS-04 Surface Readout",
          detail:
            "Scan complete: fractured basalt float & fine iron-oxide regolith. Traverse footing stable.",
        });
      }

      setControls({ ...simRef.current });
    },
    [pushLog, telemetry.headYawDeg]
  );

  const handleStabilizeAll = useCallback(() => {
    simRef.current.radiationBurstUntilMs = 0;
    simRef.current.o2LeakUntilMs = 0;
    simRef.current.pressureSurgeUntilMs = 0;
    simRef.current.terrainScanUntilMs = 0;
    simRef.current.o2BaselinePct = DEFAULT_SIM_CONTROLS.o2BaselinePct;
    simRef.current.atmBaselineMb = DEFAULT_SIM_CONTROLS.atmBaselineMb;
    simRef.current.exertionMultiplier = DEFAULT_SIM_CONTROLS.exertionMultiplier;
    setControls({ ...simRef.current });

    pushLog({
      source: "SIM",
      severity: "ok",
      title: "Suit baselines stabilized",
      detail: "Active anomalies cleared and life-support returned to nominal EVA parameters.",
    });
  }, [pushLog]);

  const handleAskAi = useCallback(
    (prompt: string) => {
      pushLog({
        source: "OP",
        severity: "info",
        title: "Operator query",
        detail: prompt,
      });
      const reply = buildAiReply(prompt, telemetry);
      pushLog({
        source: "AI",
        severity: "ok",
        title: "AEGIS-04 Response",
        detail: reply,
      });
    },
    [pushLog, telemetry]
  );

  return (
    <div className={`console-shell ${visorExpanded ? "is-visor-expanded" : ""}`}>
      <div className="workstation-grid">
        <div className="left-column">
          <section className="visor-bay" aria-label="Primary 1:1.42 Astronaut Visor Feed">
            <div className="visor-bezel">
              <div className="bezel-left">
                <span className="live-indicator" />
                <span className="bezel-title">EVA-04 // OPTICAL BAY</span>
                <span className="bezel-ratio">170°H × 120°V · 1.42:1 LOCK</span>
              </div>
              <div className="bezel-right">
                <span className="bezel-coords">
                  YAW {telemetry.headYawDeg >= 0 ? "+" : ""}
                  {telemetry.headYawDeg.toFixed(1)}° · PITCH{" "}
                  {telemetry.headPitchDeg >= 0 ? "+" : ""}
                  {telemetry.headPitchDeg.toFixed(1)}°
                </span>
                <button
                  type="button"
                  className="bezel-btn"
                  onClick={() => setVisorExpanded((v) => !v)}
                >
                  {visorExpanded ? "Exit Focus" : "Expand Visor"}
                </button>
              </div>
            </div>

            <div className="visor-stage">
              <VisorScene simRef={simRef} onTelemetrySample={handleTelemetrySample} />
            </div>
          </section>

          {!visorExpanded && (
            <EventLauncherDock
              controls={controls}
              activeEvents={telemetry.activeEvents}
              onLaunchEvent={handleLaunchEvent}
              onStabilizeAll={handleStabilizeAll}
              onUpdateControl={handleUpdateControl}
            />
          )}
        </div>

        {!visorExpanded && (
          <AiCopilotPanel telemetry={telemetry} logs={logs} onAskAi={handleAskAi} />
        )}
      </div>
    </div>
  );
}

export default App;
