import React, { useEffect } from "react";
import { MASTER_REFERENCES, TERRAIN_SOURCES } from "../engine/config";

export interface SourcesPanelProps {
  open: boolean;
  onClose: () => void;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ open, onClose }) => {
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
      <div className="modal-center" role="dialog" aria-label="Standards, Sources, and Basis Legend">
        <div className="drawer-header">
          <div>
            <div className="drawer-title">STANDARDS, SCIENTIFIC REFERENCES & BASIS LEGEND</div>
            <div className="mono" style={{ fontSize: 10.5, color: "#96c2ff" }}>
              Appendix A Master References (R1–R19) · NASA-STD-3001 Vol 1/2 Rev F · Demo Disclosure
            </div>
          </div>
          <button type="button" className="hds-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="drawer-body">
          <section className="hds-card">
            <div className="hds-card-title">
              <span>Threshold Provenance & Color Encoding (SIM-DOC-003)</span>
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "#dbeafe", marginBottom: 8 }}>
              Every threshold is tagged explicitly with its source basis:
              {" "}<strong>[V1 / V2 ...]</strong> comes from <em>NASA-STD-3001 Vol 1 &amp; Vol 2 (Rev F update: cabin pressure lower bound 34.5 kPa)</em>;
              {" "}<strong>NASA ref</strong> reflects peer-reviewed NASA flight reports (Sibonga DXA bone rates, Crucian immune/viral reactivation, SANS OCT);
              {" "}<strong>Design</strong> marks software windows and hysteresis;
              {" "}<strong>Demo</strong> marks placeholder clinical/index bands awaiting flight-surgeon verification (<code>immune_index</code>, <code>cognitive_drift</code>, <code>sans_risk</code>).
            </p>
            <div className="chip-row" style={{ fontSize: 11.5 }}>
              <span className="chip-btn badge-class-0">Class 0: Cyan #96C2FF (Nominal)</span>
              <span className="chip-btn badge-class-3">Class 3: Amber #FFB84D (Advisory)</span>
              <span className="chip-btn badge-class-2">Class 2: Red #FF4828 (Warning)</span>
              <span className="chip-btn badge-class-1">Class 1: Flashing Red #FF4828 (Emergency)</span>
            </div>
            <p style={{ fontSize: 11.5, color: "#aeb0b5", marginTop: 8 }}>
              Color note: Red &amp; Amber are chosen for urgent HUD contrast against rusted Mars Perseverance terrain; all alert colors carry explicit Class labels and audio/text cues for color-vision deficiency safety.
            </p>
          </section>

          <section className="hds-card">
            <div className="hds-card-title">
              <span>3D Backdrop & Terrain Credits</span>
            </div>
            {TERRAIN_SOURCES.map((tr) => (
              <div key={tr.id} style={{ fontSize: 12, padding: "4px 0", color: "#cbd5e1" }}>
                <strong>{tr.label}</strong> ({tr.available ? "Active" : "Assets pending"}): {tr.credit} ·{" "}
                <span style={{ color: "#aeb0b5" }}>{tr.licence}</span>
              </div>
            ))}
          </section>

          <section className="hds-card">
            <div className="hds-card-title">
              <span>Master Reference Register (R1 – R19)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {MASTER_REFERENCES.map((ref) => (
                <div
                  key={ref.id}
                  style={{
                    fontSize: 12,
                    paddingBottom: 6,
                    borderBottom: "1px dashed rgba(150, 194, 255, 0.12)",
                  }}
                >
                  <div>
                    <strong className="mono" style={{ color: "#02bfe7" }}>
                      {ref.id}
                    </strong>{" "}
                    — <span>{ref.citation}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
