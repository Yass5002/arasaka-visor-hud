import React, { useMemo } from "react";
import type { PreloadSnapshot } from "../services/assetPreloader";

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
  const sttSupported = useMemo(() => {
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  const loadingText = preload.ready
    ? preload.cloudHealth && !preload.cloudHealth.hasLlmKey
      ? "Ready to start (offline assistant active)."
      : "Everything is loaded and ready."
    : `Loading simulation assets (${Math.round(preload.progressPct)}%)...`;

  return (
    <div className="hds-briefing-backdrop" role="dialog" aria-modal="true" aria-label="Simulation setup">
      <div className="hds-briefing-card">
        <div className="hds-briefing-header">
          <span className="hds-eyebrow">NASA Horizon Simulation</span>
          <h1 className="hds-briefing-title">Spacesuit Health Assistant</h1>
          <p className="hds-briefing-subtitle">
            See through an astronaut&apos;s helmet on the Moon or Mars while an onboard assistant
            tracks suit vitals, spots trouble early, and guides you through emergencies one step at a time.
          </p>
        </div>

        <ul className="hds-simple-list">
          <li>
            <strong>Live helmet display</strong>
            <span>Check heart rate, pressure, oxygen, and radiation without looking away.</span>
          </li>
          <li>
            <strong>Calm step-by-step guidance</strong>
            <span>Get clear instructions during alerts, with backup plans if you get stuck.</span>
          </li>
          <li>
            <strong>Voice or text conversation</strong>
            <span>Ask questions naturally or confirm completed steps anytime.</span>
          </li>
        </ul>

        <div className="hds-loading-panel" aria-live="polite">
          <div className="hds-loading-row">
            <span className="hds-loading-label">{loadingText}</span>
            <span className="hds-loading-pct">{Math.round(preload.progressPct)}%</span>
          </div>
          <div className="hds-progress-track">
            <div
              className={`hds-progress-fill ${preload.ready ? "ready" : ""}`}
              style={{ width: `${Math.min(100, Math.max(4, preload.progressPct))}%` }}
            />
          </div>
        </div>

        {sttSupported && (
          <label className="hds-launch-toggle">
            <input
              type="checkbox"
              checked={openMicOnLaunch}
              onChange={(e) => onChangeOpenMicOnLaunch(e.target.checked)}
            />
            <span>Turn microphone on automatically when starting</span>
          </label>
        )}

        <button
          type="button"
          className="hds-launch-btn"
          disabled={!preload.ready}
          onClick={onLaunch}
        >
          {preload.ready ? "Start Simulation" : "Loading..."}
        </button>

        <p className="hds-briefing-note">
          Simulated training environment. Audio effects and spoken voice work best with sound on.
        </p>
      </div>
    </div>
  );
};
