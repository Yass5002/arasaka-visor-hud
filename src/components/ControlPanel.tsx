import React, { useEffect, useRef, useState } from "react";
import { AZURE_VOICES, type AzureVoiceId } from "../assistant/voiceService";
import { INDICATOR_META, TERRAIN_SOURCES } from "../engine/config";
import type { ActivityType, HealthArea, IndicatorId, LiveState } from "../engine/types";
import { PRESET_CATALOGUE, type PresetDefinition } from "../sim/presets";
import type { ClockSpeed, MissionSimulator } from "../sim/simulator";

export interface ControlPanelProps {
  open: boolean;
  onClose: () => void;
  liveState: LiveState;
  simulator: MissionSimulator;
  playing: boolean;
  speed: ClockSpeed;
  onTogglePlay: () => void;
  onSetSpeed: (speed: ClockSpeed) => void;
  voiceConnected: boolean;
  onToggleVoice: (enabled: boolean) => void;
  selectedVoice: AzureVoiceId;
  onSelectVoice: (voice: AzureVoiceId) => void;
  cloudStatus: "ready" | "fallback" | "checking";
  terrainId: "mars" | "moon" | "orbit";
  onSelectTerrain: (id: "mars" | "moon" | "orbit") => void;
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

export const ControlPanel: React.FC<ControlPanelProps> = ({
  open,
  onClose,
  liveState,
  simulator,
  playing,
  speed,
  onTogglePlay,
  onSetSpeed,
  voiceConnected,
  onToggleVoice,
  selectedVoice,
  onSelectVoice,
  cloudStatus,
  terrainId,
  onSelectTerrain,
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
    // 500 ms debounce on manual slider release/change (SIM-CTL-002 / V-03)
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
      <aside className="settings-drawer" aria-label="Mission Settings & Simulation Control Panel">
        <div className="drawer-header">
          <div>
            <div className="drawer-title">MISSION CONTROL & SETTINGS</div>
            <div className="mono" style={{ fontSize: 10.5, color: "#96c2ff" }}>
              ARASAKA-SIM-001 · NASA-STD-3001 REV F
            </div>
          </div>
          <button type="button" className="hds-btn" onClick={onClose}>
            Close (Esc)
          </button>
        </div>

        <div className="drawer-body">
          {/* Mission Configuration & Voice Settings */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Mission & Assistant Voice Settings</span>
              <span className="mono" style={{ color: cloudStatus === "ready" ? "#2e8540" : "#ffb84d" }}>
                {cloudStatus === "ready" ? "AZURE FOUNDRY ONLINE" : "LOCAL FALLBACK"}
              </span>
            </div>

            <div className="grid-2" style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: "#aeb0b5", marginBottom: 4 }}>Mission Length</div>
                <div className="chip-row">
                  {([180, 1000] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={`chip-btn ${liveState.missionLengthDays === days ? "active" : ""}`}
                      onClick={() => simulator.engine.setMissionLengthDays(days)}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#aeb0b5", marginBottom: 4 }}>
                  Assistant Voice Audio (SIM-HUD-005)
                </div>
                <button
                  type="button"
                  className={`hds-btn ${voiceConnected ? "hds-btn-primary" : ""}`}
                  style={{ width: "100%" }}
                  onClick={() => onToggleVoice(!voiceConnected)}
                >
                  {voiceConnected ? "Voice Connected (Audio On)" : "Voice Muted (Click to Enable)"}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="azure-voice-select"
                style={{ display: "block", fontSize: 11, color: "#aeb0b5", marginBottom: 4 }}
              >
                Azure Neural Voice Model
              </label>
              <select
                id="azure-voice-select"
                className="hds-select"
                style={{ width: "100%" }}
                value={selectedVoice}
                onChange={(e) => onSelectVoice(e.target.value as AzureVoiceId)}
              >
                {AZURE_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.id})
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Terrain Switcher (SIM-CTL-007) */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Outside Terrain Backdrop (SIM-CTL-007)</span>
            </div>
            <div className="chip-row">
              {TERRAIN_SOURCES.map((tr) => (
                <button
                  key={tr.id}
                  type="button"
                  disabled={!tr.available}
                  className={`chip-btn ${terrainId === tr.id ? "active" : ""}`}
                  onClick={() => {
                    if (tr.available) onSelectTerrain(tr.id);
                  }}
                  title={`${tr.credit} (${tr.licence})`}
                >
                  {tr.label} {!tr.available ? "(Assets pending)" : ""}
                </button>
              ))}
            </div>
          </section>

          {/* Mission Clock & Snapshots (SIM-CLK-001..005) */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Mission Clock & Time Travel</span>
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
              <button
                type="button"
                className="hds-btn"
                onClick={() => simulator.clearPresets()}
              >
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

          {/* Activity Context Selector (ENG-CTX-001) */}
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

          {/* Preset Catalogues */}
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

          {/* Custom Presets (SIM-CTL-005) */}
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

          {/* Direct Indicator Overrides (500ms debounced, 7 areas) */}
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

          {/* Crew Baseline Profile Editor */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Crewmember Baseline Profile</span>
            </div>
            <div className="grid-3">
              <div>
                <div style={{ fontSize: 10.5, color: "#aeb0b5" }}>Prior Dose (mSv)</div>
                <input
                  type="number"
                  className="hds-input"
                  style={{ width: "100%" }}
                  value={liveState.profile.priorCareerDoseMsv}
                  onChange={(e) =>
                    simulator.engine.updateProfile({ priorCareerDoseMsv: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: "#aeb0b5" }}>Resting HR (bpm)</div>
                <input
                  type="number"
                  className="hds-input"
                  style={{ width: "100%" }}
                  value={liveState.profile.restingHeartRate}
                  onChange={(e) =>
                    simulator.engine.updateProfile({ restingHeartRate: Number(e.target.value) || 58 })
                  }
                />
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: "#aeb0b5" }}>Usual Sleep (h)</div>
                <input
                  type="number"
                  step="0.5"
                  className="hds-input"
                  style={{ width: "100%" }}
                  value={liveState.profile.usualSleepHours}
                  onChange={(e) =>
                    simulator.engine.updateProfile({ usualSleepHours: Number(e.target.value) || 7 })
                  }
                />
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
};
