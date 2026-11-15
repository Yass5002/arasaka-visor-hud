import React, { useEffect, useRef, useState } from "react";
import { INDICATOR_META } from "../engine/config";
import type { ActivityType, IndicatorId, LiveState } from "../engine/types";
import { PRESET_CATALOGUE, type PresetDefinition, type PresetGroup } from "../sim/presets";
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
  onTriggerEvent?: (presetId: string) => void;
}

const GROUP_LABELS: Record<PresetGroup, string> = {
  fast_event: "Emergency",
  slow_drift: "Gradual",
  smart_case: "Combined",
  custom: "Saved",
};

const ACTIVITY_OPTIONS: Array<{ id: ActivityType; label: string }> = [
  { id: "eva", label: "Outside EVA" },
  { id: "cabin", label: "Inside Habitat" },
  { id: "exercise", label: "Workout" },
  { id: "rest", label: "Rest" },
  { id: "sleep", label: "Sleep" },
];

const SPEED_OPTIONS: Array<{ speed: ClockSpeed; label: string }> = [
  { speed: 1, label: "Real time" },
  { speed: 60, label: "1 min/s" },
  { speed: 3600, label: "1 hr/s" },
  { speed: 86400, label: "1 day/s" },
];

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  open,
  onClose,
  liveState,
  simulator,
  playing,
  speed,
  onTogglePlay,
  onSetSpeed,
  onTriggerEvent,
}) => {
  const [sliderDrafts, setSliderDrafts] = useState<Partial<Record<IndicatorId, number>>>({});
  const [customName, setCustomName] = useState("");
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
      Object.values(timers).forEach((tm) => tm && clearTimeout(tm));
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
    }, 60);
  };

  const renderScenarioCard = (p: PresetDefinition) => {
    const isActive = activePresetIds.includes(p.id);
    return (
      <div key={p.id} className={`hds-scenario-card ${isActive ? "active" : ""}`}>
        <div className="hds-scenario-info">
          <div className="hds-scenario-head">
            <strong>{p.name}</strong>
            <span className="hds-pill">{GROUP_LABELS[p.group] ?? "Event"}</span>
          </div>
          <p className="hds-body-sm hds-muted">{p.summary}</p>
        </div>
        <div className="hds-scenario-actions">
          <button
            type="button"
            className={`hds-btn hds-btn-sm ${isActive ? "active" : "hds-btn-primary"}`}
            onClick={() => {
              if (onTriggerEvent) {
                onTriggerEvent(p.id);
              } else {
                simulator.triggerLiveEvent(p.id);
              }
            }}
          >
            {isActive ? "Active" : "Trigger now"}
          </button>
          <button
            type="button"
            className="hds-btn hds-btn-sm"
            onClick={() => simulator.firePreset(p.id, "scenario_start")}
            title="Restart the simulation directly inside this scenario"
          >
            Start fresh
          </button>
        </div>
      </div>
    );
  };

  const fastPresets = PRESET_CATALOGUE.filter((p) => p.group === "fast_event");
  const slowPresets = PRESET_CATALOGUE.filter((p) => p.group === "slow_drift");
  const smartPresets = PRESET_CATALOGUE.filter((p) => p.group === "smart_case");
  const sliderSpecs = Object.values(INDICATOR_META);

  return (
    <div
      className="drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Events and simulation controls"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-card">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Events &amp; Controls</h2>
            <p className="modal-subtitle">
              Test emergency situations, change your activity, or fast-forward mission time.
            </p>
          </div>
          <button type="button" className="hds-btn hds-btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          {/* Time & Playback */}
          <section className="hds-section">
            <div className="hds-section-row">
              <h3 className="hds-section-title">Mission clock &amp; speed</h3>
              <button
                type="button"
                className={`hds-btn hds-btn-sm ${playing ? "active" : "hds-btn-primary"}`}
                onClick={onTogglePlay}
              >
                {playing ? "Pause clock" : "Resume clock"}
              </button>
            </div>

            <div className="chip-row">
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt.speed}
                  type="button"
                  className={`chip-btn ${speed === opt.speed ? "active" : ""}`}
                  onClick={() => onSetSpeed(opt.speed)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="hds-action-wrap">
              <button type="button" className="hds-btn hds-btn-sm" onClick={() => simulator.jumpForward(3600)}>
                +1 hour
              </button>
              <button type="button" className="hds-btn hds-btn-sm" onClick={() => simulator.jumpForward(86400)}>
                +1 day
              </button>
              <button type="button" className="hds-btn hds-btn-sm" onClick={() => simulator.jumpForward(7 * 86400)}>
                +7 days
              </button>
              <button type="button" className="hds-btn hds-btn-sm" onClick={() => simulator.jumpForward(14 * 86400)}>
                +14 days
              </button>
              <button type="button" className="hds-btn hds-btn-sm" onClick={() => simulator.jumpBackward()}>
                Step back
              </button>
              <button type="button" className="hds-btn hds-btn-sm" onClick={() => simulator.clearPresets()}>
                Clear events
              </button>
              <button type="button" className="hds-btn hds-btn-sm hds-btn-warn" onClick={() => simulator.resetAll()}>
                Reset all
              </button>
            </div>
          </section>

          {/* Crew Activity */}
          <section className="hds-section">
            <h3 className="hds-section-title">Current astronaut activity</h3>
            <div className="chip-row">
              {ACTIVITY_OPTIONS.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  className={`chip-btn ${liveState.context.activity === act.id ? "active" : ""}`}
                  onClick={() => simulator.setManualContext(act.id)}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </section>

          {/* Scenarios */}
          <section className="hds-section">
            <h3 className="hds-section-title">Sudden emergencies</h3>
            <p className="hds-body-sm hds-muted">
              Click Trigger now to start an event while staying inside your current suit view, or stack multiple events together.
            </p>
            <div className="hds-scenario-list">{fastPresets.map(renderScenarioCard)}</div>
          </section>

          <section className="hds-section">
            <h3 className="hds-section-title">Slow health changes</h3>
            <div className="hds-scenario-list">{slowPresets.map(renderScenarioCard)}</div>
          </section>

          <section className="hds-section">
            <h3 className="hds-section-title">Multi-factor test cases</h3>
            <div className="hds-scenario-list">{smartPresets.map(renderScenarioCard)}</div>
          </section>

          {customPresets.length > 0 && (
            <section className="hds-section">
              <h3 className="hds-section-title">Saved custom states</h3>
              <div className="hds-scenario-list">{customPresets.map(renderScenarioCard)}</div>
            </section>
          )}

          {/* Optional Fine Sensor Tuning */}
          <details className="hds-details">
            <summary className="hds-details-summary">
              Advanced: Adjust individual sensor readings or save a snapshot
            </summary>

            <div className="hds-details-body">
              <div className="hds-save-row">
                <input
                  type="text"
                  className="hds-input"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Name for this snapshot..."
                />
                <button
                  type="button"
                  className="hds-btn hds-btn-sm"
                  onClick={() => {
                    if (!customName.trim()) return;
                    simulator.saveCustomPreset(customName);
                    setCustomName("");
                  }}
                >
                  Save state
                </button>
              </div>

              <div className="hds-sliders-list">
                {sliderSpecs.map((meta) => {
                  const displayedVal = sliderDrafts[meta.id] ?? liveState.indicators[meta.id].value;
                  return (
                    <div key={meta.id} className="hds-slider-row">
                      <div className="hds-slider-head">
                        <span>{meta.label}</span>
                        <strong className="hds-num">
                          {displayedVal.toFixed(meta.decimals)} {meta.unit}
                        </strong>
                      </div>
                      <input
                        type="range"
                        className="hds-range"
                        min={meta.sliderMin}
                        max={meta.sliderMax}
                        step={meta.sliderStep}
                        value={Math.min(meta.sliderMax, Math.max(meta.sliderMin, displayedVal))}
                        onChange={(e) => handleSliderChange(meta.id, Number(e.target.value))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
