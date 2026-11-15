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
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Safety guide and references"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card modal-card-md">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Safety Guide &amp; References</h2>
            <p className="modal-subtitle">
              How alert levels work and the published aerospace standards behind them.
            </p>
          </div>
          <button type="button" className="hds-btn hds-btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          <section className="hds-section">
            <h3 className="hds-section-title">How alerts are prioritized</h3>
            <p className="hds-body-sm hds-muted">
              Urgent physical dangers always come first with one clear step to do right now. Long-term trends like bone strength or sleep stay out of the way unless you ask about them.
            </p>
            <div className="hds-level-grid">
              <div className="hds-level-item">
                <span className="capri-status c0">
                  <span className="capri-dot" aria-hidden="true" />
                  <span>Normal</span>
                </span>
                <p>Suit and body readings are in a safe range.</p>
              </div>
              <div className="hds-level-item">
                <span className="capri-status c3">
                  <span className="capri-dot" aria-hidden="true" />
                  <span>Watch</span>
                </span>
                <p>Something is starting to drift and should be watched.</p>
              </div>
              <div className="hds-level-item">
                <span className="capri-status c2">
                  <span className="capri-dot" aria-hidden="true" />
                  <span>Warning</span>
                </span>
                <p>A limit was crossed. Action is needed soon.</p>
              </div>
              <div className="hds-level-item">
                <span className="capri-status c1">
                  <span className="capri-dot" aria-hidden="true" />
                  <span>Emergency</span>
                </span>
                <p>Immediate safety risk. Follow the step shown right away.</p>
              </div>
            </div>
          </section>

          <section className="hds-section">
            <h3 className="hds-section-title">Mars surface panorama</h3>
            <div className="hds-ref-list">
              {TERRAIN_SOURCES.map((tr) => (
                <div key={tr.id} className="hds-ref-item">
                  <strong>{tr.label}</strong>
                  <p className="hds-body-sm hds-muted">
                    Credit: {tr.credit}. {tr.licence}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="hds-section">
            <h3 className="hds-section-title">Standards and medical references</h3>
            <div className="hds-ref-list">
              {MASTER_REFERENCES.map((ref) => (
                <div key={ref.id} className="hds-ref-item">
                  <div className="hds-ref-head">
                    <strong>{ref.citation}</strong>
                    <span className="hds-pill">{ref.id}</span>
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
