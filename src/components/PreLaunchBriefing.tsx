import React from "react";
import type { PreloadSnapshot } from "../services/assetPreloader";

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const RadioIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </svg>
);

const LoaderIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="hds-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const ShieldAlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const MicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const VolumeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

interface PreLaunchBriefingProps {
  preload: PreloadSnapshot;
  openMicOnLaunch: boolean;
  onChangeOpenMicOnLaunch: (enabled: boolean) => void;
  onLaunch: () => void;
}

export const PreLaunchBriefing: React.FC<PreLaunchBriefingProps> = ({
  preload,
  openMicOnLaunch,
  onChangeOpenMicOnLaunch,
  onLaunch,
}) => {
  const micSupported =
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition
    );

  return (
    <div className="hds-briefing-backdrop" role="dialog" aria-modal="true" aria-label="EVA Mission Preflight">
      <div className="hds-briefing-card">
        <div className="hds-briefing-header">
          <div>
            <div className="hds-briefing-eyebrow">
              ARASAKA EVA SUIT TELEMETRY // JEZERO CRATER SURFACE SECTOR
            </div>
            <h1 className="hds-briefing-title">Crew Health Assistant — Surface EVA Demonstration</h1>
          </div>
          <span className="hds-sim-pill">SIMULATED DATA</span>
        </div>

        <p className="hds-briefing-lead">
          Autonomous helmet-visor crew health monitoring and Earth-independent suit anomaly guidance for
          outside-habitat Mars EVA (~12-minute communication delay).
        </p>

        <div className="hds-briefing-info-grid">
          <div className="hds-briefing-info-box">
            <div className="hds-briefing-info-label">OPERATIONAL ENVIRONMENT</div>
            <div className="hds-briefing-info-val">Outside Habitat — Mars Surface EVA</div>
            <div className="hds-briefing-info-sub">
              Jezero Crater panorama with optical helmet HUD monitoring suit pressure (43.0 kPa), PIO₂, ppCO₂,
              heart rate, and solar radiation.
            </div>
          </div>

          <div className="hds-briefing-info-box">
            <div className="hds-briefing-info-label">STANDARDS &amp; TRUTHFULNESS</div>
            <div className="hds-briefing-info-val">NASA-STD-3001 Vol 2 Rev F</div>
            <div className="hds-briefing-info-sub">
              Class 1–3 hazard ranking, guided mitigation protocols, and strict non-diagnostic telemetry
              grounding.
            </div>
          </div>

          <div className="hds-briefing-info-box">
            <div className="hds-briefing-info-label">VOICE &amp; AUDIO COMMS</div>
            <div className="hds-briefing-info-val">Tactical Suit Comms Ready</div>
            <div className="hds-briefing-info-sub">
              Quiet under nominal conditions; speaks immediately on hazard triggers, two-way voice queries, or
              crew non-response escalation.
            </div>
          </div>
        </div>

        <div className="hds-briefing-notice">
          <ShieldAlertIcon />
          <span>
            <strong>Demonstration Notice:</strong> All biomedical, radiation, and suit atmosphere streams are
            simulated for technical demonstration. Suit audio &amp; comms unlock cleanly when you enter the visor.
          </span>
        </div>

        {micSupported && (
          <div className="hds-briefing-prefs">
            <label className="hds-briefing-pref-toggle">
              <input
                type="checkbox"
                checked={openMicOnLaunch}
                onChange={(e) => onChangeOpenMicOnLaunch(e.target.checked)}
              />
              <MicIcon />
              <span>Keep Live Duplex Microphone Open on Entry</span>
            </label>
          </div>
        )}

        {/* Asset & System Preload Progress */}
        <div className="hds-preload-panel">
          <div className="hds-preload-top">
            <span className="hds-preload-title">
              {preload.ready ? "PREFLIGHT ASSETS LOADED" : "LOADING EVA VISUAL & AUDIO SYSTEMS..."}
            </span>
            <span className="hds-preload-pct">{preload.progressPct}%</span>
          </div>

          <div className="hds-progress-track">
            <div className="hds-progress-fill" style={{ width: `${preload.progressPct}%` }} />
          </div>

          <ul className="hds-preload-list">
            {preload.items.map((item) => (
              <li key={item.id} className={`is-${item.status}`}>
                <span className="hds-preload-icon">
                  {item.status === "ready" ? (
                    <CheckIcon />
                  ) : item.status === "degraded" ? (
                    <RadioIcon />
                  ) : (
                    <LoaderIcon />
                  )}
                </span>
                <span className="hds-preload-label">{item.label}</span>
                {item.detail && <span className="hds-preload-detail">{item.detail}</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="hds-briefing-actions">
          <button
            type="button"
            className="hds-launch-btn"
            disabled={!preload.ready}
            onClick={onLaunch}
          >
            <VolumeIcon />
            {preload.ready
              ? "ENTER EVA SUIT — LAUNCH SIMULATION"
              : `PREPARING SUIT ASSETS (${preload.progressPct}%)`}
          </button>
        </div>
      </div>
    </div>
  );
};
