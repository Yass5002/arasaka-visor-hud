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
  terrainId: "mars";
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
  proxyBaseUrl: _proxyBaseUrl,
  sttSupported,
  terrainId: _terrainId,
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
            <h3 className="hds-section-title">Voice &amp; audio</h3>

            <label className="hds-setting-row">
              <div>
                <strong>Spoken voice replies</strong>
                <p className="hds-body-sm hds-muted">Read alerts and answers aloud in helmet.</p>
              </div>
              <input
                type="checkbox"
                className="hds-switch"
                checked={voiceConnected}
                onChange={(e) => onToggleVoice(e.target.checked)}
              />
            </label>

            <div className="hds-setting-row">
              <div>
                <strong>Assistant voice</strong>
                <p className="hds-body-sm hds-muted">Voice profile for spoken replies.</p>
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
                  Test
                </button>
              </div>
            </div>

            <label className="hds-setting-row">
              <div>
                <strong>Suit radio filter</strong>
                <p className="hds-body-sm hds-muted">Apply light headset filtering instead of clean dry audio.</p>
              </div>
              <input
                type="checkbox"
                className="hds-switch"
                checked={radioFilterEnabled}
                onChange={(e) => onToggleRadioFilter(e.target.checked)}
              />
            </label>

            <label className="hds-setting-row">
              <div>
                <strong>Alert chimes</strong>
                <p className="hds-body-sm hds-muted">Soft chime when warnings start or steps complete.</p>
              </div>
              <input
                type="checkbox"
                className="hds-switch"
                checked={sfxEnabled}
                onChange={(e) => onToggleSfx(e.target.checked)}
              />
            </label>
          </section>

          {/* AI & Microphone status */}
          <section className="hds-section">
            <h3 className="hds-section-title">Connection</h3>
            <div className="hds-setting-row">
              <div>
                <strong>Voice AI link</strong>
                <p className="hds-body-sm hds-muted">
                  Status: <span className={`status-inline ${cloudStatus}`}>{cloudLabel}</span>
                  {" · "}
                  Mic: {sttSupported ? "Supported" : "Unsupported (text input)"}
                </p>
              </div>
              <button type="button" className="hds-btn hds-btn-sm" onClick={onProbeCloud}>
                Check
              </button>
            </div>
          </section>

          {/* Mission & Astronaut Profile */}
          <section className="hds-section">
            <h3 className="hds-section-title">Mars mission &amp; crew profile</h3>

            <div className="hds-setting-row">
              <div>
                <strong>Environment</strong>
                <p className="hds-body-sm hds-muted">{TERRAIN_SOURCES[0].label}</p>
              </div>
              <span className="hds-pill">Mars</span>
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
