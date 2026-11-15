import React, { useEffect } from "react";
import { AZURE_VOICE_OPTIONS, type AzureVoiceId } from "../assistant/voiceService";
import { TERRAIN_SOURCES } from "../engine/config";
import type { CrewHealthEngine } from "../engine/engine";
import type { LiveState } from "../engine/types";

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  liveState: LiveState;
  engine: CrewHealthEngine;
  voiceConnected: boolean;
  onToggleVoice: (enabled: boolean) => void;
  selectedVoice: AzureVoiceId;
  onSelectVoice: (voice: AzureVoiceId) => void;
  onTestVoice: () => void;
  radioFilterEnabled: boolean;
  onToggleRadioFilter: (enabled: boolean) => void;
  sfxEnabled: boolean;
  onToggleSfx: (enabled: boolean) => void;
  cloudStatus: "ready" | "fallback" | "checking";
  onProbeCloud: () => void;
  proxyBaseUrl: string;
  sttSupported: boolean;
  terrainId: "mars" | "moon" | "orbit";
  onSelectTerrain: (id: "mars" | "moon" | "orbit") => void;
}

const MISSION_DURATIONS: Array<{ days: 180 | 1000; label: string }> = [
  { days: 180, label: "180 days (Short trip)" },
  { days: 1000, label: "1000 days (Mars trip)" },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  liveState,
  engine,
  voiceConnected,
  onToggleVoice,
  selectedVoice,
  onSelectVoice,
  onTestVoice,
  radioFilterEnabled,
  onToggleRadioFilter,
  sfxEnabled,
  onToggleSfx,
  cloudStatus,
  onProbeCloud,
  sttSupported,
  terrainId,
  onSelectTerrain,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const profile = liveState.profile;
  const cloudLabel =
    cloudStatus === "ready"
      ? "Connected"
      : cloudStatus === "checking"
      ? "Checking..."
      : "Offline backup";

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Audio and simulation setup"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card modal-card-md">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Audio &amp; Setup</h2>
            <p className="modal-subtitle">
              Adjust voice style, helmet audio effects, and astronaut baseline values.
            </p>
          </div>
          <button type="button" className="hds-btn hds-btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          {/* Voice & Audio */}
          <section className="hds-section">
            <h3 className="hds-section-title">Voice &amp; sound</h3>

            <div className="hds-setting-row">
              <div>
                <strong>Spoken voice replies</strong>
                <p className="hds-body-sm hds-muted">Have the assistant read alerts and answers out loud.</p>
              </div>
              <button
                type="button"
                className={`hds-btn hds-btn-sm ${voiceConnected ? "active" : ""}`}
                onClick={() => onToggleVoice(!voiceConnected)}
              >
                {voiceConnected ? "On" : "Off"}
              </button>
            </div>

            <div className="hds-setting-row">
              <div>
                <strong>Assistant voice</strong>
                <p className="hds-body-sm hds-muted">Choose the voice used for spoken guidance.</p>
              </div>
              <div className="hds-inline-controls">
                <select
                  className="hds-select"
                  value={selectedVoice}
                  onChange={(e) => onSelectVoice(e.target.value as AzureVoiceId)}
                  aria-label="Choose assistant voice"
                >
                  {AZURE_VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="hds-btn hds-btn-sm" onClick={onTestVoice}>
                  Test voice
                </button>
              </div>
            </div>

            <div className="hds-setting-row">
              <div>
                <strong>Spacesuit headset sound</strong>
                <p className="hds-body-sm hds-muted">Add subtle radio filtering so voice sounds like a real suit link.</p>
              </div>
              <button
                type="button"
                className={`hds-btn hds-btn-sm ${radioFilterEnabled ? "active" : ""}`}
                onClick={() => onToggleRadioFilter(!radioFilterEnabled)}
              >
                {radioFilterEnabled ? "On" : "Off"}
              </button>
            </div>

            <div className="hds-setting-row">
              <div>
                <strong>Alert tones</strong>
                <p className="hds-body-sm hds-muted">Play short audio chimes when new warnings appear or steps complete.</p>
              </div>
              <button
                type="button"
                className={`hds-btn hds-btn-sm ${sfxEnabled ? "active" : ""}`}
                onClick={() => onToggleSfx(!sfxEnabled)}
              >
                {sfxEnabled ? "On" : "Off"}
              </button>
            </div>
          </section>

          {/* AI & Microphone status */}
          <section className="hds-section">
            <h3 className="hds-section-title">Assistant connection</h3>
            <div className="hds-setting-row">
              <div>
                <strong>Voice AI service</strong>
                <p className="hds-body-sm hds-muted">
                  Status: <span className={`status-inline ${cloudStatus}`}>{cloudLabel}</span>
                  {" · "}
                  Microphone input: {sttSupported ? "Supported in this browser" : "Not supported here (use text)"}
                </p>
              </div>
              <button type="button" className="hds-btn hds-btn-sm" onClick={onProbeCloud}>
                Check connection
              </button>
            </div>
          </section>

          {/* Scene & Astronaut Profile */}
          <section className="hds-section">
            <h3 className="hds-section-title">Mission &amp; astronaut profile</h3>

            <div className="hds-setting-block">
              <span className="hds-field-label">Environment scene</span>
              <div className="chip-row">
                {TERRAIN_SOURCES.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    className={`chip-btn ${terrainId === tr.id ? "active" : ""}`}
                    onClick={() => onSelectTerrain(tr.id)}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="hds-setting-block">
              <span className="hds-field-label">Mission length</span>
              <div className="chip-row">
                {MISSION_DURATIONS.map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    className={`chip-btn hds-num ${
                      liveState.missionLengthDays === opt.days ? "active" : ""
                    }`}
                    onClick={() => engine.setMissionLengthDays(opt.days)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="hds-form-grid">
              <label className="hds-form-field">
                <span>Prior radiation dose (mSv)</span>
                <input
                  type="number"
                  className="hds-input hds-num"
                  min={0}
                  max={590}
                  value={profile.priorCareerDoseMsv}
                  onChange={(e) =>
                    engine.updateProfile({ priorCareerDoseMsv: Number(e.target.value) || 0 })
                  }
                />
              </label>

              <label className="hds-form-field">
                <span>Resting heart rate (bpm)</span>
                <input
                  type="number"
                  className="hds-input hds-num"
                  min={40}
                  max={100}
                  value={profile.restingHeartRate}
                  onChange={(e) =>
                    engine.updateProfile({ restingHeartRate: Number(e.target.value) || 58 })
                  }
                />
              </label>

              <label className="hds-form-field">
                <span>Usual sleep (hours/night)</span>
                <input
                  type="number"
                  className="hds-input hds-num"
                  step={0.5}
                  min={4}
                  max={10}
                  value={profile.usualSleepHours}
                  onChange={(e) =>
                    engine.updateProfile({ usualSleepHours: Number(e.target.value) || 7 })
                  }
                />
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
