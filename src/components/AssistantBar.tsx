import React, { useState } from "react";
import type { AssistantCaptionState } from "../assistant/assistantController";
import { ENGINE_LIMITS } from "../engine/config";
import type { LiveState } from "../engine/types";

export interface ChatHistoryItem {
  id: string;
  speaker: "ASSISTANT" | "CREW";
  text: string;
  missionClock: string;
}

export interface AssistantBarProps {
  liveState: LiveState;
  captionState: AssistantCaptionState;
  history: ChatHistoryItem[];
  onAsk: (question: string) => void;
  onToggleListening: () => void;
  onToggleVoice: () => void;
  onStopSpeaking: () => void;
  onConfirmStep: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onSilenceAlarms?: () => void;
  onOpenSimulation: () => void;
  onOpenTrends: () => void;
  onOpenSources: () => void;
  onOpenSettings: () => void;
}

export const AssistantBar: React.FC<AssistantBarProps> = ({
  liveState,
  captionState,
  history,
  onAsk,
  onToggleListening,
  onToggleVoice,
  onStopSpeaking,
  onConfirmStep,
  onAcknowledgeAlert,
  onSilenceAlarms,
  onOpenSimulation,
  onOpenTrends,
  onOpenSources,
  onOpenSettings,
}) => {
  const [input, setInput] = useState("");
  const primary = liveState.rankedPrimaryAlert;
  const proto = liveState.activeProtocol;

  const hh = Math.floor(liveState.timeOfDaySec / 3600) % 24;
  const mm = Math.floor(liveState.timeOfDaySec / 60) % 60;
  const clockStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

  const submitQuestion = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    onAsk(trimmed);
    setInput("");
  };

  return (
    <aside className="mission-dock" aria-label="Crew Health Console and Assistant">
      {/* Clean docked header toolbar — zero floating overlap */}
      <div className="dock-header">
        <div className="sim-pill" title="All health telemetry and mission scenarios are simulated">
          <span className="sim-pill-dot" />
          SIMULATED DATA
        </div>
        <div className="dock-nav-btns">
          <button
            type="button"
            className="hds-btn hds-btn-primary"
            onClick={onOpenSimulation}
            title="Open Simulation & Events Studio (Clock, Context, Events, Sliders)"
          >
            Events
          </button>
          <button type="button" className="hds-btn" onClick={onOpenTrends}>
            Trends
          </button>
          <button type="button" className="hds-btn" onClick={onOpenSources}>
            Sources
          </button>
          <button
            type="button"
            className="hds-btn hds-icon-btn"
            onClick={onOpenSettings}
            aria-label="Open Technical and Voice Settings"
            title="Technical & Voice Settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mission Status Readout */}
      <div className="hds-card">
        <div className="hds-card-title">
          <span>
            SOL {liveState.missionDay}/{liveState.missionLengthDays} · {clockStr}
          </span>
          <span className={`badge-class-${liveState.overallClass}`}>
            {liveState.context.activity.toUpperCase()} · CLASS {liveState.overallClass}
          </span>
        </div>

        <div className="grid-2 mono" style={{ fontSize: 11.5, color: "#dbeafe" }}>
          <div>Dose Rate: {liveState.indicators.dose_rate.value.toFixed(2)} mSv/d</div>
          <div>
            {liveState.context.activity === "eva"
              ? `Suit Press: ${liveState.indicators.suit_pressure.value.toFixed(1)} kPa`
              : `Career: ${liveState.careerDosePercent.toFixed(1)}% / 600`}
          </div>
          <div>ppCO₂: {liveState.indicators.ppco2.value.toFixed(2)} mmHg</div>
          <div>PIO₂: {Math.round(liveState.indicators.pio2.value)} mmHg</div>
        </div>
      </div>

      {/* Unresponsive Crew NASA Escalation Beacon */}
      {captionState.unresponsiveEscalated && (
        <div
          className="hds-card"
          style={{
            borderColor: "#ff4828",
            background: "rgba(221, 54, 28, 0.28)",
          }}
        >
          <div className="hds-card-title">
            <span className="badge-class-1">CREW UNRESPONSIVE · HAILING HABITAT</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#ffe4e0" }}>
            No response detected &gt;45 s. Autonomous telemetry packet queued for Flight Surgeon (~12 min delay).
          </div>
        </div>
      )}

      {/* Active Ranked Alert & Protocol Stepper */}
      {primary && (
        <div
          className="hds-card"
          style={{
            borderColor: primary.class <= 2 ? "#dd361c" : "#ffb84d",
            background:
              primary.class <= 2 ? "rgba(221, 54, 28, 0.14)" : "rgba(255, 184, 77, 0.10)",
          }}
        >
          <div className="hds-card-title">
            <span className={`badge-class-${primary.class}`}>
              CLASS {primary.class} · {primary.title}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {(liveState.pausedProtocols?.length ?? 0) > 0 && (
                <span className="mono" style={{ fontSize: 10.5, color: "#ffb84d" }}>
                  +{liveState.pausedProtocols.length} QUEUED
                </span>
              )}
              {primary.state === "active" && (
                <>
                  <button
                    type="button"
                    className="chip-btn"
                    onClick={() => onAcknowledgeAlert(primary.id)}
                  >
                    Ack
                  </button>
                  {onSilenceAlarms && (
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={onSilenceAlarms}
                      title="Mute repeating klaxon/caution horn"
                    >
                      Silence
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#f8fafc", marginBottom: 6 }}>{primary.whyLine}</div>
          {primary.escalateToMedical && (
            <div className="mono" style={{ fontSize: 10.5, color: "#ffb84d", marginBottom: 6 }}>
              Advise flight surgeon contact (Earth reply ~{ENGINE_LIMITS.earthReplyDelayMin.value} min).
            </div>
          )}

          {proto && !proto.completed && (
            <div
              style={{
                borderTop: "1px solid rgba(150,194,255,0.2)",
                paddingTop: 6,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: proto.contingencyTitle ? "#ffb84d" : "#02bfe7",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 6,
                }}
              >
                <span>
                  {proto.contingencyTitle
                    ? `${proto.contingencyTitle} (${proto.currentStepIndex + 1}/${proto.totalSteps})`
                    : `PROTOCOL: ${proto.name} (${proto.currentStepIndex + 1}/${proto.totalSteps})`}
                </span>
                {proto.contingencyTitle && <span>AI ADAPTED</span>}
              </div>
              {proto.contingencyReason && (
                <div style={{ fontSize: 10.5, color: "#cbd5e1" }}>
                  Pivot: {proto.contingencyReason}
                </div>
              )}
              <div style={{ fontSize: 12 }}>{proto.currentStep.instruction}</div>
              <button type="button" className="hds-btn hds-btn-primary" onClick={onConfirmStep}>
                Confirm Step Complete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Crew Assistant Voice & Chat Dock */}
      <div className="hds-card assistant-panel">
        <div className="hds-card-title">
          <span>Crew Health Assistant</span>
          <div style={{ display: "flex", gap: 4 }}>
            {captionState.isSpeaking && (
              <button
                type="button"
                className="chip-btn active"
                onClick={onStopSpeaking}
                title="Stop voice playback"
              >
                Speaking…
              </button>
            )}
            <button
              type="button"
              className={`chip-btn ${captionState.voiceConnected ? "active" : ""}`}
              onClick={onToggleVoice}
              title="Toggle Azure Neural Voice output"
            >
              {captionState.voiceConnected ? "Audio On" : "Muted"}
            </button>
            <button
              type="button"
              className={`chip-btn ${captionState.isListening ? "active" : ""}`}
              onClick={onToggleListening}
              title="Toggle continuous open duplex microphone (say 'mic off' anytime)"
            >
              {captionState.isListening ? "Mic Live" : "Open Mic"}
            </button>
          </div>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className="chip-btn"
            onClick={() => submitQuestion("Check my suit pressure and air")}
          >
            Suit &amp; Air
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => submitQuestion("What is my radiation dose?")}
          >
            Dose Check
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => submitQuestion("Status report")}
          >
            Status Report
          </button>
        </div>

        <div className="assistant-log">
          {captionState.interimTranscript && (
            <div className="chat-bubble crew" style={{ opacity: 0.78, borderStyle: "dashed" }}>
              <div className="chat-bubble-meta">CREW (LIVE MIC)</div>
              <div>{captionState.interimTranscript}…</div>
            </div>
          )}
          {history.map((item) => (
            <div
              key={item.id}
              className={`chat-bubble ${item.speaker === "CREW" ? "crew" : ""}`}
            >
              <div className="chat-bubble-meta">
                {item.speaker} · {item.missionClock}
              </div>
              <div>{item.text}</div>
            </div>
          ))}
        </div>

        <form
          className="assistant-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion(input);
          }}
        >
          <input
            type="text"
            className="hds-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              captionState.isBusy ? "Assistant thinking..." : "Ask assistant or confirm step..."
            }
          />
          <button
            type="submit"
            className="hds-btn hds-btn-primary"
            disabled={captionState.isBusy || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </aside>
  );
};
