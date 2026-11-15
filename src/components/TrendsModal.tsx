import React, { useEffect, useState } from "react";
import type { CrewHealthEngine } from "../engine/engine";
import type { EventLogEntry, IndicatorId, LiveState } from "../engine/types";

export interface TrendsModalProps {
  open: boolean;
  onClose: () => void;
  engine: CrewHealthEngine;
  liveState: LiveState;
}

const CHART_INDICATORS: Array<{
  id: IndicatorId;
  title: string;
  unit: string;
  color: string;
  refLine?: { value: number; label: string };
}> = [
  {
    id: "dose_cumulative",
    title: "Total Radiation Dose (Estimated)",
    unit: "mSv",
    color: "#ffb84d",
    refLine: { value: 600, label: "600 mSv career limit" },
  },
  {
    id: "bone_loss_lumbar",
    title: "Lower Spine Bone Strength (Estimated)",
    unit: "%",
    color: "#02bfe7",
  },
  {
    id: "bone_loss_femoral_neck",
    title: "Hip Bone Strength (Estimated)",
    unit: "%",
    color: "#5fa8ff",
  },
  {
    id: "immune_index",
    title: "Immune Score (Demo Estimate)",
    unit: "/100",
    color: "#2e8540",
  },
  {
    id: "cognitive_drift",
    title: "Reaction Speed Change (Measured)",
    unit: "ms",
    color: "#ff9b4d",
  },
  {
    id: "sans_risk",
    title: "Eye Fluid Risk Index (Estimated)",
    unit: "/100",
    color: "#a78bfa",
  },
];

function formatMissionTime(tSec: number): string {
  const day = Math.floor(tSec / 86400) + 1;
  const hh = Math.floor((tSec % 86400) / 3600);
  const mm = Math.floor((tSec % 3600) / 60);
  return `Day ${day} · ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function describeEvent(e: EventLogEntry): { title: string; detail: string } {
  const p = e.payload ?? {};
  switch (e.type) {
    case "alert_raised":
      return {
        title: `Alert started: ${String(p.title ?? p.detectorId ?? "Safety warning")}`,
        detail: String(p.whyLine ?? ""),
      };
    case "alert_cleared":
      return {
        title: `Alert cleared: ${String(p.title ?? p.detectorId ?? "Condition normal")}`,
        detail: "Readings moved back into a safe range.",
      };
    case "step_completed":
      return {
        title: `Step confirmed: ${String(p.protocolId ?? "procedure")}`,
        detail: String(p.instruction ?? p.stepLabel ?? "Moved to next action step."),
      };
    case "preset_fired":
      return {
        title: `Event triggered: ${String(p.presetId ?? "scenario")}`,
        detail: p.mode === "stacked" ? "Added to active simulation." : "Started fresh scenario.",
      };
    case "unresponsive_crew_escalation":
      return {
        title: "Medical team updated",
        detail: String(p.reason ?? "No response after repeated check-ins."),
      };
    case "assistant_said":
      return {
        title: "Assistant message",
        detail: String(p.text ?? p.message ?? ""),
      };
    case "astronaut_asked":
      return {
        title: "Crew message",
        detail: String(p.question ?? p.text ?? ""),
      };
    case "exercise_session":
      return {
        title: "Exercise session logged",
        detail: "Workout recorded for long-term bone and heart tracking.",
      };
    default: {
      const cleanType = e.type.replace(/_/g, " ");
      const summary = Object.entries(p)
        .filter(([, v]) => typeof v === "string" || typeof v === "number")
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(", ");
      return {
        title: cleanType.charAt(0).toUpperCase() + cleanType.slice(1),
        detail: summary,
      };
    }
  }
}

const MiniTrendChart: React.FC<{
  title: string;
  unit: string;
  color: string;
  points: Array<{ t: number; value: number; min: number; max: number }>;
  refLine?: { value: number; label: string };
}> = ({ title, unit, color, points, refLine }) => {
  const width = 360;
  const height = 112;
  const padX = 12;
  const padY = 14;

  const vals = points.map((p) => p.value);
  if (refLine && vals.length > 0 && Math.max(...vals) > refLine.value * 0.7) {
    vals.push(refLine.value);
  }
  const minVal = vals.length > 0 ? Math.min(...vals) : 0;
  const maxVal = vals.length > 0 ? Math.max(...vals) : 100;
  const span = Math.max(0.01, maxVal - minVal);

  const mapX = (idx: number) =>
    points.length <= 1 ? padX : padX + (idx / (points.length - 1)) * (width - padX * 2);
  const mapY = (v: number) =>
    height - padY - ((v - minVal) / span) * (height - padY * 2);

  const linePath =
    points.length > 1
      ? points.map((p, i) => `${i === 0 ? "M" : "L"}${mapX(i).toFixed(1)},${mapY(p.value).toFixed(1)}`).join(" ")
      : "";

  const latest = points.length > 0 ? points[points.length - 1].value : null;

  return (
    <div className="hds-trend-card">
      <div className="hds-trend-head">
        <strong>{title}</strong>
        <span className="hds-num">
          {latest !== null ? `${latest.toFixed(1)} ${unit}` : "Waiting for data"}
        </span>
      </div>
      <svg className="hds-trend-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {refLine && refLine.value >= minVal && refLine.value <= maxVal && (
          <g>
            <line
              x1={padX}
              x2={width - padX}
              y1={mapY(refLine.value)}
              y2={mapY(refLine.value)}
              stroke="#dd361c"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x={width - padX} y={Math.max(12, mapY(refLine.value) - 4)} textAnchor="end" fill="#ff8f7d" fontSize="10">
              {refLine.label}
            </text>
          </g>
        )}
        {points.length > 1 ? (
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        ) : (
          <line x1={padX} x2={width - padX} y1={height / 2} y2={height / 2} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        )}
      </svg>
    </div>
  );
};

export const TrendsModal: React.FC<TrendsModalProps> = ({ open, onClose, engine, liveState }) => {
  const [resolution, setResolution] = useState<"hourly" | "daily">("daily");
  const [includeAllRuns, setIncludeAllRuns] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const events = engine.store.getEvents({ includeAbandonedRuns: includeAllRuns }).slice(-25).reverse();

  const handleExportJson = () => {
    const json = engine.store.exportAllJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suit-simulation-day-${liveState.missionDay}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Health trends and activity timeline"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card modal-card-lg">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Health Trends</h2>
            <p className="modal-subtitle">
              Track gradual changes across days and review recent suit actions.
            </p>
          </div>
          <button type="button" className="hds-btn hds-btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          {/* Controls bar */}
          <div className="hds-toolbar">
            <div className="chip-row">
              <button
                type="button"
                className={`chip-btn ${resolution === "daily" ? "active" : ""}`}
                onClick={() => setResolution("daily")}
              >
                Daily view
              </button>
              <button
                type="button"
                className={`chip-btn ${resolution === "hourly" ? "active" : ""}`}
                onClick={() => setResolution("hourly")}
              >
                Hourly view
              </button>
            </div>

            <div className="hds-inline-controls">
              <label className="hds-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeAllRuns}
                  onChange={(e) => setIncludeAllRuns(e.target.checked)}
                />
                <span>Include earlier runs</span>
              </label>
              <button type="button" className="hds-btn hds-btn-sm" onClick={handleExportJson}>
                Save data
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="hds-summary-strip">
            <div className="hds-summary-tile">
              <span>Current day</span>
              <strong className="hds-num">
                Day {liveState.missionDay} / {liveState.missionLengthDays}
              </strong>
            </div>
            <div className="hds-summary-tile">
              <span>Career radiation used</span>
              <strong className="hds-num">{liveState.careerDosePercent.toFixed(1)}%</strong>
            </div>
            <div className="hds-summary-tile">
              <span>Sleep last night</span>
              <strong className="hds-num">{liveState.indicators.sleep_hours.value.toFixed(1)} hrs</strong>
            </div>
            <div className="hds-summary-tile">
              <span>Estimated spine bone</span>
              <strong className="hds-num">{liveState.indicators.bone_loss_lumbar.value.toFixed(2)}%</strong>
            </div>
          </div>

          {/* Charts */}
          <section className="hds-section">
            <h3 className="hds-section-title">Over time</h3>
            <div className="hds-trends-grid">
              {CHART_INDICATORS.map((cfg) => {
                const series = engine.store.getRollupSeries(cfg.id, 0, liveState.t + 1, resolution);
                return (
                  <MiniTrendChart
                    key={cfg.id}
                    title={cfg.title}
                    unit={cfg.unit}
                    color={cfg.color}
                    points={series}
                    refLine={cfg.refLine}
                  />
                );
              })}
            </div>
          </section>

          {/* Plain human-readable event timeline (no JSON terminal log) */}
          <section className="hds-section">
            <h3 className="hds-section-title">Recent events</h3>
            {events.length === 0 ? (
              <p className="hds-body-sm hds-muted">
                No alerts or crew actions yet. Start a scenario from Events &amp; Controls to see how the timeline updates.
              </p>
            ) : (
              <div className="hds-event-feed">
                {events.map((ev) => {
                  const info = describeEvent(ev);
                  return (
                    <div key={ev.id} className="hds-event-row">
                      <span className="hds-event-time hds-num">{formatMissionTime(ev.t)}</span>
                      <div className="hds-event-content">
                        <strong>{info.title}</strong>
                        {info.detail && <p className="hds-body-sm hds-muted">{info.detail}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
