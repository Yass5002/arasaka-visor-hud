import React from "react";
import { DASHBOARD_CONFIG } from "../config/visorConfig";
import { SimEventId, SimulationControls } from "../simulation/types";

export interface EventLauncherDockProps {
  controls: SimulationControls;
  activeEvents: SimEventId[];
  onLaunchEvent: (eventId: SimEventId) => void;
  onStabilizeAll: () => void;
  onUpdateControl: <K extends keyof SimulationControls>(
    key: K,
    value: SimulationControls[K]
  ) => void;
}

const EVENT_BUTTONS: ReadonlyArray<{
  id: SimEventId;
  label: string;
  hint: string;
  tone: "critical" | "warn" | "amber" | "cyan";
}> = [
  {
    id: "radiation_burst",
    label: "Radiation Burst",
    hint: "Solar particle spike · 12s",
    tone: "critical",
  },
  {
    id: "o2_leak",
    label: "O₂ Seal Leak",
    hint: "Mix drawdown + rapid breathing",
    tone: "warn",
  },
  {
    id: "pressure_surge",
    label: "Pressure Surge",
    hint: "Regulator spike + tremor",
    tone: "amber",
  },
  {
    id: "terrain_scan",
    label: "Terrain Scan",
    hint: "Curved visor mesh sweep",
    tone: "cyan",
  },
];

export const EventLauncherDock: React.FC<EventLauncherDockProps> = ({
  controls,
  activeEvents,
  onLaunchEvent,
  onStabilizeAll,
  onUpdateControl,
}) => {
  const { bounds } = DASHBOARD_CONFIG;

  return (
    <section className="event-dock" aria-label="Simulation Event Launcher and Parameters">
      <div className="dock-row dock-row--events">
        <div className="dock-heading">
          <span className="eyebrow">SIMULATION INJECTOR</span>
          <span className="dock-sub">Launch live anomalies into EVA-04 visor</span>
        </div>

        <div className="event-buttons">
          {EVENT_BUTTONS.map((btn) => {
            const isActive = activeEvents.includes(btn.id);
            return (
              <button
                key={btn.id}
                type="button"
                className={`event-btn event-btn--${btn.tone} ${isActive ? "is-active" : ""}`}
                onClick={() => onLaunchEvent(btn.id)}
              >
                <span className="event-btn-top">
                  <span className="event-dot" />
                  <span className="event-label">{btn.label}</span>
                </span>
                <span className="event-hint">{isActive ? "ACTIVE ON VISOR" : btn.hint}</span>
              </button>
            );
          })}

          <button
            type="button"
            className="event-btn event-btn--reset"
            onClick={onStabilizeAll}
          >
            <span className="event-btn-top">
              <span className="event-label">Stabilize Suit</span>
            </span>
            <span className="event-hint">Clear faults &amp; baseline</span>
          </button>
        </div>
      </div>

      <div className="dock-row dock-row--params">
        <label className="fader-card">
          <div className="fader-top">
            <span className="fader-name">O₂ MIX</span>
            <span className="fader-readout">{controls.o2BaselinePct.toFixed(3)}%</span>
          </div>
          <input
            type="range"
            min={bounds.o2Min}
            max={bounds.o2Max}
            step={bounds.o2Step}
            value={controls.o2BaselinePct}
            onChange={(e) => onUpdateControl("o2BaselinePct", Number(e.target.value))}
          />
        </label>

        <label className="fader-card">
          <div className="fader-top">
            <span className="fader-name">CABIN ATM</span>
            <span className="fader-readout">{controls.atmBaselineMb.toFixed(1)} mb</span>
          </div>
          <input
            type="range"
            min={bounds.atmMin}
            max={bounds.atmMax}
            step={bounds.atmStep}
            value={controls.atmBaselineMb}
            onChange={(e) => onUpdateControl("atmBaselineMb", Number(e.target.value))}
          />
        </label>

        <label className="fader-card">
          <div className="fader-top">
            <span className="fader-name">EXERTION</span>
            <span className="fader-readout">{controls.exertionMultiplier.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={bounds.exertionMin}
            max={bounds.exertionMax}
            step={bounds.exertionStep}
            value={controls.exertionMultiplier}
            onChange={(e) => onUpdateControl("exertionMultiplier", Number(e.target.value))}
          />
        </label>

        <label className="fader-card">
          <div className="fader-top">
            <span className="fader-name">GAZE GAIN</span>
            <span className="fader-readout">{controls.trackingGain.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={bounds.trackingGainMin}
            max={bounds.trackingGainMax}
            step={bounds.trackingGainStep}
            value={controls.trackingGain}
            onChange={(e) => onUpdateControl("trackingGain", Number(e.target.value))}
          />
        </label>

        <div className="toggle-group">
          <button
            type="button"
            className={`toggle-pill ${controls.globalCursorTracking ? "is-on" : ""}`}
            onClick={() =>
              onUpdateControl("globalCursorTracking", !controls.globalCursorTracking)
            }
            aria-pressed={controls.globalCursorTracking}
          >
            Global Look: {controls.globalCursorTracking ? "ON" : "LOCK"}
          </button>
          <button
            type="button"
            className={`toggle-pill ${controls.idleReturnEnabled ? "is-on" : ""}`}
            onClick={() => onUpdateControl("idleReturnEnabled", !controls.idleReturnEnabled)}
            aria-pressed={controls.idleReturnEnabled}
          >
            Idle Drift: {controls.idleReturnEnabled ? "ON" : "HOLD"}
          </button>
        </div>
      </div>
    </section>
  );
};
