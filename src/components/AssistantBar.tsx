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
  onConfirmStep: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onOpenTrends: () => void;
  onOpenSources: () => void;
}

export const AssistantBar: React.FC<AssistantBarProps> = ({
  liveState,
  captionState,
  history,
  onAsk,
  onToggleListening,
  onToggleVoice,
  onConfirmStep,
  onAcknowledgeAlert,
  onOpenTrends,
  onOpenSources,
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
      <div className="dock-header">
        <div className="sim-pill" title="All health telemetry and mission scenarios are simulated">
          <span className="sim-pill-dot" />
          SIMULATED DATA
        </div>
        <div className="dock-nav-btns">
          <button type="button" className="hds-btn" onClick={onOpenTrends}>
            Trends
          </button>
          <button type="button" className="hds-btn" onClick={onOpenSources}>
            Sources
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
          <div>Career: {liveState.careerDosePercent.toFixed(1)}% / 600</div>
          <div>ppCO₂: {liveState.indicators.ppco2.value.toFixed(2)} mmHg</div>
          <div>PIO₂: {Math.round(liveState.indicators.pio2.value)} mmHg</div>
        </div>
      </div>

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
            {primary.state === "active" && (
              <button
                type="button"
                className="chip-btn"
                onClick={() => onAcknowledgeAlert(primary.id)}
              >
                Ack
              </button>
            )}
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
              <div className="mono" style={{ fontSize: 11, color: "#02bfe7" }}>
                PROTOCOL: {proto.name} ({proto.currentStepIndex + 1}/{proto.totalSteps})
              </div>
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
              title="Voice speech recognition"
            >
              {captionState.isListening ? "Listening..." : "Mic"}
            </button>
          </div>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className="chip-btn"
            onClick={() => submitQuestion("How is my health?")}
          >
            How is my health?
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => submitQuestion("What is my radiation dose?")}
          >
            Dose check
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => submitQuestion("Bone density and sleep summary?")}
          >
            Bone &amp; sleep
          </button>
        </div>

        <div className="assistant-log">
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
