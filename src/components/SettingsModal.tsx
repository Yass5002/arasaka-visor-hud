import React, { useEffect } from "react";
import { AZURE_VOICES, type AzureVoiceId } from "../assistant/voiceService";
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
  cloudStatus: "ready" | "fallback" | "checking";
  onProbeCloud: () => void;
  proxyBaseUrl: string;
  sttSupported: boolean;
  terrainId: "mars" | "moon" | "orbit";
  onSelectTerrain: (id: "mars" | "moon" | "orbit") => void;
}

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
  cloudStatus,
  onProbeCloud,
  proxyBaseUrl,
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

  return (
    <div
      className="overlay-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-center" style={{ maxWidth: 640 }} role="dialog" aria-label="Technical System Settings">
        <div className="drawer-header">
          <div>
            <div className="drawer-title">SYSTEM &amp; VOICE SETTINGS</div>
            <div className="mono" style={{ fontSize: 10.5, color: "#96c2ff" }}>
              Audio / Azure Speech · Cloud LLM Proxy · Mission Parameters · Terrain
            </div>
          </div>
          <button type="button" className="hds-btn" onClick={onClose}>
            Close (Esc)
          </button>
        </div>

        <div className="drawer-body">
          {/* Voice & Speech Audio Settings */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Voice Synthesis &amp; Speech Audio</span>
              <span className="mono" style={{ color: voiceConnected ? "#2e8540" : "#aeb0b5" }}>
                {voiceConnected ? "AUDIO ENABLED" : "MUTED (SIM-HUD-005)"}
              </span>
            </div>

            <div className="grid-2" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className={`hds-btn ${voiceConnected ? "hds-btn-primary" : ""}`}
                onClick={() => onToggleVoice(!voiceConnected)}
              >
                {voiceConnected ? "Disable Voice Output" : "Enable Voice Output"}
              </button>
              <button
                type="button"
                className="hds-btn"
                onClick={onTestVoice}
              >
                Test Azure Voice Audio
              </button>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label
                htmlFor="azure-voice-select"
                style={{ display: "block", fontSize: 11.5, color: "#aeb0b5", marginBottom: 4 }}
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

            <div className="mono" style={{ fontSize: 11, color: "#aeb0b5" }}>
              Browser Speech-to-Text (Mic): {sttSupported ? "Supported" : "Unavailable in this browser"}
            </div>
          </section>

          {/* Azure AI Foundry & Cloudflare Worker Status */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Azure AI Foundry Proxy</span>
              <span
                className="mono"
                style={{
                  color:
                    cloudStatus === "ready"
                      ? "#2e8540"
                      : cloudStatus === "checking"
                        ? "#02bfe7"
                        : "#ffb84d",
                }}
              >
                {cloudStatus === "ready"
                  ? "CONNECTED (gpt-5-4-mini)"
                  : cloudStatus === "checking"
                    ? "CHECKING..."
                    : "OFFLINE / FALLBACK"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span className="mono" style={{ fontSize: 11.5, color: "#cbd5e1" }}>
                Endpoint: {proxyBaseUrl}
              </span>
              <button type="button" className="hds-btn" onClick={onProbeCloud}>
                Re-test Connection
              </button>
            </div>
          </section>

          {/* Mission Length & Crew Baseline Profile */}
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Mission Configuration &amp; Crew Baseline Profile</span>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, color: "#aeb0b5", marginBottom: 4 }}>
                Planned Mission Duration
              </div>
              <div className="chip-row">
                {([180, 1000] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={`chip-btn ${liveState.missionLengthDays === days ? "active" : ""}`}
                    onClick={() => engine.setMissionLengthDays(days)}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>

            <div className="grid-3">
              <div>
                <div style={{ fontSize: 11, color: "#aeb0b5", marginBottom: 2 }}>Prior Dose (mSv)</div>
                <input
                  type="number"
                  className="hds-input"
                  style={{ width: "100%" }}
                  value={liveState.profile.priorCareerDoseMsv}
                  onChange={(e) =>
                    engine.updateProfile({ priorCareerDoseMsv: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#aeb0b5", marginBottom: 2 }}>Resting HR (bpm)</div>
                <input
                  type="number"
                  className="hds-input"
                  style={{ width: "100%" }}
                  value={liveState.profile.restingHeartRate}
                  onChange={(e) =>
                    engine.updateProfile({ restingHeartRate: Number(e.target.value) || 58 })
                  }
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#aeb0b5", marginBottom: 2 }}>Usual Sleep (h)</div>
                <input
                  type="number"
                  step="0.5"
                  className="hds-input"
                  style={{ width: "100%" }}
                  value={liveState.profile.usualSleepHours}
                  onChange={(e) =>
                    engine.updateProfile({ usualSleepHours: Number(e.target.value) || 7 })
                  }
                />
              </div>
            </div>
          </section>

          {/* Outside 3D Terrain Switcher (SIM-CTL-007) */}
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
        </div>
      </div>
    </div>
  );
};
