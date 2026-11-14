import React, { useState } from "react";
import { ConsoleLogEntry, TelemetrySnapshot } from "../simulation/types";

export interface AiCopilotPanelProps {
  telemetry: TelemetrySnapshot;
  logs: ConsoleLogEntry[];
  onAskAi: (prompt: string) => void;
}

const QUICK_PROMPTS = [
  "Analyze gaze sector",
  "Audit life support",
  "Radiation risk check",
] as const;

export const AiCopilotPanel: React.FC<AiCopilotPanelProps> = ({
  telemetry,
  logs,
  onAskAi,
}) => {
  const [draft, setDraft] = useState("");

  const hasCriticalEvent =
    telemetry.activeEvents.includes("radiation_burst") ||
    telemetry.activeEvents.includes("o2_leak");
  const hasWarnEvent =
    telemetry.activeEvents.includes("pressure_surge") ||
    telemetry.activeEvents.includes("terrain_scan");

  const statusText = hasCriticalEvent
    ? "HAZARD ACTIVE"
    : hasWarnEvent
      ? "EVENT RUNNING"
      : "NOMINAL WATCH";

  const statusClass = hasCriticalEvent
    ? "badge badge--critical"
    : hasWarnEvent
      ? "badge badge--amber"
      : "badge badge--ok";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAskAi(trimmed);
    setDraft("");
  };

  const o2Warn = telemetry.o2Pct < 0.1;
  const atmWarn = telemetry.atmMb > 9.2 || telemetry.atmMb < 5.0;
  const radWarn = telemetry.radMsvH > 2.5;

  return (
    <aside className="copilot-panel" aria-label="AI Copilot and Suit Diagnostics">
      <header className="panel-header">
        <div className="panel-title-group">
          <span className="eyebrow">FLIGHT DIRECTOR // AI COPILOT</span>
          <h2 className="panel-title">AEGIS-04 TELEMETRY CORE</h2>
        </div>
        <span className={statusClass}>{statusText}</span>
      </header>

      <section className="sensor-grid" aria-label="Live Suit Telemetry">
        <div className={`sensor-cell ${o2Warn ? "sensor-cell--warn" : ""}`}>
          <span className="sensor-label">O₂ PARTIAL</span>
          <span className="sensor-value">{telemetry.o2Pct.toFixed(3)}%</span>
          <span className="sensor-sub">TARGET 0.129%</span>
        </div>
        <div className={`sensor-cell ${atmWarn ? "sensor-cell--amber" : ""}`}>
          <span className="sensor-label">SUIT PRESS</span>
          <span className="sensor-value">{telemetry.atmMb.toFixed(1)} mb</span>
          <span className="sensor-sub">AMBIENT 7.4 mb</span>
        </div>
        <div className={`sensor-cell ${radWarn ? "sensor-cell--critical" : ""}`}>
          <span className="sensor-label">RAD FLUX</span>
          <span className="sensor-value">{telemetry.radMsvH.toFixed(2)} mSv/h</span>
          <span className="sensor-sub">
            {telemetry.radAlertActive ? "VISOR ALERT ARMED" : "THRESHOLD 2.50"}
          </span>
        </div>
        <div className="sensor-cell">
          <span className="sensor-label">HELMET GAZE</span>
          <span className="sensor-value">
            {telemetry.headYawDeg >= 0 ? "+" : ""}
            {telemetry.headYawDeg.toFixed(1)}° /{" "}
            {telemetry.headPitchDeg >= 0 ? "+" : ""}
            {telemetry.headPitchDeg.toFixed(1)}°
          </span>
          <span className="sensor-sub">
            BIO {telemetry.bpmEstimate} BPM · ALT {telemetry.altitudeKm.toFixed(2)}
          </span>
        </div>
      </section>

      <section className="ai-section" aria-label="AI Situation Stream">
        <div className="section-bar">
          <span className="section-label">LIVE EVENT &amp; AI STREAM</span>
          <span className="section-meta">{logs.length} ENTRIES</span>
        </div>

        <div className="log-stream">
          {logs.map((entry) => (
            <article key={entry.id} className={`log-item log-item--${entry.severity}`}>
              <div className="log-meta">
                <span className={`log-source log-source--${entry.source.toLowerCase()}`}>
                  {entry.source}
                </span>
                <span className="log-title">{entry.title}</span>
                <span className="log-time">{entry.timeLabel}</span>
              </div>
              <p className="log-detail">{entry.detail}</p>
            </article>
          ))}
        </div>

        <div className="quick-prompts">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              className="prompt-chip"
              onClick={() => onAskAi(q)}
            >
              {q}
            </button>
          ))}
        </div>

        <form className="ai-input-row" onSubmit={handleSubmit}>
          <input
            type="text"
            className="ai-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Query AEGIS-04 on suit state, Mars sector, or events..."
            aria-label="Ask AEGIS-04 AI Copilot"
          />
          <button type="submit" className="ai-send-btn">
            Ask AI
          </button>
        </form>
      </section>
    </aside>
  );
};
