import React, { useEffect, useState } from "react";
import type { CrewHealthEngine } from "../engine/engine";
import type { IndicatorId, LiveState } from "../engine/types";

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
    title: "Cumulative Effective Dose (Modelled)",
    unit: "mSv",
    color: "#ffb84d",
    refLine: { value: 600, label: "600 mSv [V1 4030]" },
  },
  {
    id: "bone_loss_lumbar",
    title: "Lumbar Spine BMD Estimate (DXA Modelled, c(t) Compliance)",
    unit: "%",
    color: "#02bfe7",
  },
  {
    id: "bone_loss_femoral_neck",
    title: "Femoral Neck BMD Estimate (DXA Modelled)",
    unit: "%",
    color: "#38bdf8",
  },
  {
    id: "immune_index",
    title: "Demonstration Immune Index (Composite)",
    unit: "/100",
    color: "#a78bfa",
    refLine: { value: 70, label: "70 Watch Threshold (Demo)" },
  },
  {
    id: "cognitive_drift",
    title: "Cognitive Drift Index (Composite Demo)",
    unit: "/100",
    color: "#f472b6",
  },
  {
    id: "sans_risk",
    title: "SANS Risk Demonstration Index",
    unit: "/100",
    color: "#fb923c",
  },
];

function MiniTrendChart({
  title,
  unit,
  color,
  series,
  uncertainty,
  refLine,
}: {
  title: string;
  unit: string;
  color: string;
  series: Array<{ t: number; value: number; min: number; max: number }>;
  uncertainty?: { low: number; high: number; note: string };
  refLine?: { value: number; label: string };
}) {
  const W = 380;
  const H = 105;
  const padX = 10;
  const padY = 12;

  const vals = series.map((p) => p.value);
  if (refLine) vals.push(refLine.value);
  if (vals.length === 0) vals.push(0, 1);

  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = Math.max(0.01, maxV - minV);

  const toX = (idx: number) =>
    series.length <= 1 ? padX : padX + (idx / (series.length - 1)) * (W - padX * 2);
  const toY = (v: number) => H - padY - ((v - minV) / span) * (H - padY * 2);

  const polyPoints = series.map((p, i) => `${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(" ");
  const latest = series[series.length - 1]?.value;

  return (
    <div className="hds-card">
      <div className="hds-card-title">
        <span>{title}</span>
        <strong className="mono" style={{ color }}>
          {latest !== undefined ? `${latest.toFixed(2)} ${unit}` : "No data"}
        </strong>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 96, display: "block" }}>
        {refLine && (
          <>
            <line
              x1={padX}
              x2={W - padX}
              y1={toY(refLine.value)}
              y2={toY(refLine.value)}
              stroke="#dd361c"
              strokeDasharray="4 4"
              strokeWidth="1.2"
            />
            <text
              x={W - padX - 4}
              y={Math.max(12, toY(refLine.value) - 4)}
              textAnchor="end"
              fill="#ffb8ad"
              fontSize="9"
              fontFamily="DM Mono, monospace"
            >
              {refLine.label}
            </text>
          </>
        )}
        {series.length >= 2 && (
          <polyline fill="none" stroke={color} strokeWidth="2.2" points={polyPoints} />
        )}
        {series.length > 0 && (
          <circle
            cx={toX(series.length - 1)}
            cy={toY(series[series.length - 1].value)}
            r="3.5"
            fill={color}
          />
        )}
      </svg>
      {uncertainty && (
        <div className="mono" style={{ fontSize: 10, color: "#aeb0b5", marginTop: 4 }}>
          Uncertainty band: {uncertainty.low}–{uncertainty.high} {unit} · {uncertainty.note}
        </div>
      )}
    </div>
  );
}

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

  const events = engine.store.getEvents({ includeAbandonedRuns: includeAllRuns }).slice(-40).reverse();

  const handleExportJson = () => {
    const json = engine.store.exportAllJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arasaka-health-export-sol${liveState.missionDay}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="overlay-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-center" role="dialog" aria-label="Habitat & Wrist Slow Trends and Record">
        <div className="drawer-header">
          <div>
            <div className="drawer-title">HABITAT REVIEW & SLOW HEALTH TRENDS (OFF-VISOR)</div>
            <div className="mono" style={{ fontSize: 10.5, color: "#96c2ff" }}>
              CONOPS §4.3 · SIM-HUD-001 · Append-Only Crew Health Record & Export (ENG-SAF-004)
            </div>
          </div>
          <div className="chip-row">
            <button type="button" className="hds-btn hds-btn-primary" onClick={handleExportJson}>
              Export JSON Record
            </button>
            <button type="button" className="hds-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="drawer-body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="chip-row">
              {(["daily", "hourly"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`chip-btn ${resolution === r ? "active" : ""}`}
                  onClick={() => setResolution(r)}
                >
                  {r.toUpperCase()} ROLLUP
                </button>
              ))}
            </div>
            <span className="mono" style={{ fontSize: 11, color: "#aeb0b5" }}>
              Run: {liveState.runId} · Sleep Debt (14d): {liveState.indicators.sleep_debt.value.toFixed(1)} h ·
              Exercise (7d): {liveState.indicators.exercise_sessions.value} sessions
            </span>
          </div>

          <div className="grid-2">
            {CHART_INDICATORS.map((cfg) => {
              const series = engine.store.getRollupSeries(cfg.id, 0, liveState.t + 1, resolution);
              const liveInd = liveState.indicators[cfg.id];
              return (
                <MiniTrendChart
                  key={cfg.id}
                  title={cfg.title}
                  unit={cfg.unit}
                  color={cfg.color}
                  series={series}
                  uncertainty={liveInd?.uncertainty}
                  refLine={cfg.refLine}
                />
              );
            })}
          </div>

          <div className="hds-card">
            <div className="hds-card-title">
              <span>Append-Only Event Log ({events.length} shown)</span>
              <button
                type="button"
                className={`chip-btn ${includeAllRuns ? "active" : ""}`}
                onClick={() => setIncludeAllRuns((v) => !v)}
              >
                {includeAllRuns ? "Showing All Runs (Incl. Restores)" : "Current Run Only"}
              </button>
            </div>
            <div style={{ maxHeight: 190, overflowY: "auto", fontSize: 11.5 }} className="mono">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: "4px 0",
                    borderBottom: "1px dashed rgba(150, 194, 255, 0.1)",
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <span style={{ color: "#02bfe7", flexShrink: 0 }}>
                    Sol {Math.floor(ev.t / 86400) + 1} ({ev.t}s)
                  </span>
                  <span style={{ color: "#ffb84d", flexShrink: 0 }}>{ev.type}</span>
                  <span style={{ color: "#cbd5e1", wordBreak: "break-word" }}>
                    {JSON.stringify(ev.payload)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
