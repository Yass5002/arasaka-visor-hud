import React, { useEffect, useRef, useState } from "react";
import { INDICATOR_META } from "../engine/config";
import type { ActivityType, HealthArea, IndicatorId, LiveState } from "../engine/types";
import { PRESET_CATALOGUE, type PresetDefinition } from "../sim/presets";
import type { ClockSpeed, MissionSimulator } from "../sim/simulator";

export interface SimulationPanelProps {
  open: boolean;
  onClose: () => void;
  liveState: LiveState;
  simulator: MissionSimulator;
  playing: boolean;
  speed: ClockSpeed;
  onTogglePlay: () => void;
  onSetSpeed: (speed: ClockSpeed) => void;
}

const AREA_LABELS: Record<HealthArea, string> = {
  radiation: "Radiation",
  environment: "Environment",
  cardiovascular: "Cardiovascular",
  sleep_behaviour: "Sleep & Behaviour",
  bone: "Bone Density",
  immune: "Immune Index",
  vision: "Vision / SANS",
};

const ACTIVITY_OPTIONS: ActivityType[] = ["eva", "cabin", "exercise", "sleep", "rest"];
const SPEED_OPTIONS: ClockSpeed[] = [1, 60, 3600, 86400];

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  open,
  onClose,
  liveState,
  simulator,
  playing,
  speed,
  onTogglePlay,
  onSetSpeed,
}) => {
  const [selectedArea, setSelectedArea] = useState<HealthArea>("environment");
  const [sliderDrafts, setSliderDrafts] = useState<Partial<Record<IndicatorId, number>>>({});
  const [customName, setCustomName] = useState("My Custom Scenario");
  const debounceRef = useRef<Partial<Record<IndicatorId, ReturnType<typeof setTimeout>>>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const timers = debounceRef.current;
    return () => {
      for (const k of Object.keys(timers) as IndicatorId[]) {
        if (timers[k]) clearTimeout(timers[k]);
      }
    };
  }, []);

  if (!open) return null;

  const activePresetIds = simulator.getActivePresetIds();
  const customPresets = simulator.getCustomPresets();

  const handleSliderChange = (id: IndicatorId, nextVal: number) => {
    setSliderDrafts((prev) => ({ ...prev, [id]: nextVal }));
    if (debounceRef.current[id]) {
      clearTimeout(debounceRef.current[id]);
    }
    debounceRef.current[id] = setTimeout(() => {
      simulator.setManualOverride(id, nextVal);
      setSliderDrafts((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }, 500);
  };

  const renderPresetCard = (p: PresetDefinition) => {
    const isActive = activePresetIds.includes(p.id);
    return (
      <div key={p.id} className="preset-row">
        <div className="preset-row-head">
          <div>
            <span className="preset-code">{p.code}</span>{" "}
            <strong style={{ fontSize: 12.5 }}>{p.name}</strong>
          </div>
          <span className="mono" style={{ fontSize: 10, color: "#aeb0b5" }}>
            {p.basis}
          </span>
        </div>
        <p style={{ fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.35 }}>{p.summary}</p>
        <div className="chip-row">
          <button
            type="button"
            className={`hds-btn ${isActive ? "hds-btn-primary" : ""}`}
            onClick={() => simulator.firePreset(p.id, "forward")}
          >
            {isActive ? "Active · Re-run Forward" : "Run Forward"}
          </button>
          {p.supportsScenarioStart && (
            <button
              type="button"
              className="hds-btn"
              onClick={() => simulator.firePreset(p.id, "scenario_start")}
            >
              Scenario Start (Day {p.scenarioStartDays ?? 14})
            </button>
          )}
        </div>
      </div>
    );
  };

  const fastPresets = PRESET_CATALOGUE.filter((p) => p.group === "fast_event");
  const slowPresets = PRESET_CATALOGUE.filter((p) => p.group === "slow_drift");
  const smartPresets = PRESET_CATALOGUE.filter((p) => p.group === "smart_case");

  const areaIndicators = (Object.keys(INDICATOR_META) as IndicatorId[])
    .map((id) => INDICATOR_META[id])
    .filter((m) => m.area === selectedArea);

  return (
    <div
      className="overlay-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="settings-drawer" aria-label="Mission Events and Simulation Studio">
        <div className="drawer-header">
          <div>
            <div className="drawer-title">SIMULATION &amp; EVENTS STUDIO</div>
            <div className="mono" style={{ fontSize: 10.5, color: "#96c2ff" }}>
              Clock · Context · Scenario Presets (S-01..S-13b) · Manual Sliders
            </div>
          </div>
          <button type="button" className="hds-btn" onClick={onClose}>
            Close (Esc)
          </button>
        </div>

        <div className="drawer-body">
          {/* Mission Clock & Time Travel */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Mission Clock &amp; Time Travel</span>
              <span>
                Sol {liveState.missionDay} / {liveState.missionLengthDays}
              </span>
            </div>

            <div className="chip-row" style={{ marginBottom: 8 }}>
              <button
                type="button"
                className={`hds-btn ${playing ? "hds-btn-primary" : ""}`}
                onClick={onTogglePlay}
              >
                {playing ? "Pause Clock" : "Play Clock"}
              </button>
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  className={`chip-btn ${speed === spd ? "active" : ""}`}
                  onClick={() => onSetSpeed(spd)}
                >
                  {spd}×
                </button>
              ))}
            </div>

            <div className="chip-row" style={{ marginBottom: 8 }}>
              <button type="button" className="hds-btn" onClick={() => simulator.jumpForward(3600)}>
                +1 Hour
              </button>
              <button type="button" className="hds-btn" onClick={() => simulator.jumpForward(86400)}>
                +1 Day
              </button>
              <button
                type="button"
                className="hds-btn"
                onClick={() => simulator.jumpForward(7 * 86400)}
              >
                +7 Days
              </button>
              <button
                type="button"
                className="hds-btn"
                onClick={() => simulator.jumpForward(14 * 86400)}
              >
                +14 Days
              </button>
            </div>

            <div className="chip-row">
              <button type="button" className="hds-btn" onClick={() => simulator.jumpBackward()}>
                ← Back Snapshot
              </button>
              <button type="button" className="hds-btn" onClick={() => simulator.clearPresets()}>
                Clear Active Presets
              </button>
              <button
                type="button"
                className="hds-btn hds-btn-danger"
                onClick={() => simulator.resetAll()}
              >
                Reset Mission
              </button>
            </div>
          </section>

          {/* Activity Context Selector */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Current Activity Context</span>
              <span>{liveState.context.location.toUpperCase()}</span>
            </div>
            <div className="chip-row">
              {ACTIVITY_OPTIONS.map((act) => (
                <button
                  key={act}
                  type="button"
                  className={`chip-btn ${liveState.context.activity === act ? "active" : ""}`}
                  onClick={() => simulator.setManualContext(act)}
                >
                  {act.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          {/* Preset Events */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Fast Events (S-01 .. S-05)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {fastPresets.map(renderPresetCard)}
            </div>
          </section>

          <section className="hds-card">
            <div className="hds-card-title">
              <span>Slow Drifts (S-06 .. S-11)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {slowPresets.map(renderPresetCard)}
            </div>
          </section>

          <section className="hds-card">
            <div className="hds-card-title">
              <span>Smart Cases (S-12, S-13, S-13b)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {smartPresets.map(renderPresetCard)}
            </div>
          </section>

          {/* Custom Scenarios */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Custom Scenarios</span>
            </div>
            <div className="assistant-input-row" style={{ marginBottom: 8 }}>
              <input
                type="text"
                className="hds-input"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Custom preset name..."
              />
              <button
                type="button"
                className="hds-btn hds-btn-primary"
                onClick={() => {
                  simulator.saveCustomPreset(customName);
                  setCustomName("Saved Preset");
                }}
              >
                Save Current State
              </button>
            </div>
            {customPresets.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {customPresets.map(renderPresetCard)}
              </div>
            )}
          </section>

          {/* Direct Indicator Overrides */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Manual Indicator Sliders (500 ms debounce)</span>
            </div>
            <div className="chip-row" style={{ marginBottom: 8 }}>
              {(Object.keys(AREA_LABELS) as HealthArea[]).map((area) => (
                <button
                  key={area}
                  type="button"
                  className={`chip-btn ${selectedArea === area ? "active" : ""}`}
                  onClick={() => setSelectedArea(area)}
                >
                  {AREA_LABELS[area]}
                </button>
              ))}
            </div>

            {areaIndicators.map((meta) => {
              const liveVal = liveState.indicators[meta.id]?.value ?? meta.defaultValue;
              const displayedVal = sliderDrafts[meta.id] ?? liveVal;
              return (
                <div key={meta.id} className="slider-row">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>
                      {meta.label}{" "}
                      <span className="mono" style={{ fontSize: 10, color: "#aeb0b5" }}>
                        [{meta.basis}]
                      </span>
                    </span>
                    <strong className="mono" style={{ color: "#02bfe7" }}>
                      {displayedVal.toFixed(meta.decimals)} {meta.unit}
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={meta.sliderMin}
                    max={meta.sliderMax}
                    step={meta.sliderStep}
                    value={Math.min(meta.sliderMax, Math.max(meta.sliderMin, displayedVal))}
                    onChange={(e) => handleSliderChange(meta.id, Number(e.target.value))}
                  />
                </div>
              );
            })}
          </section>
        </div>
      </aside>
    </div>
  );
};
