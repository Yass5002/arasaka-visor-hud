import React, { useState } from "react";
import type { AssistantCaptionState } from "../assistant/assistantController";
import type { ActivityType, LiveState } from "../engine/types";

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

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  eva: "Outside EVA",
  cabin: "Inside Habitat",
  exercise: "Workout",
  sleep: "Sleep",
  rest: "Rest",
};

function classBadgeText(c: number): string {
  if (c === 1) return "Emergency";
  if (c === 2) return "Warning";
  if (c === 3) return "Watch";
  return "Normal";
}

function classTone(c: number): string {
  if (c === 1) return "c1";
  if (c === 2) return "c2";
  if (c === 3) return "c3";
  return "c0";
}

function formatMissionClock(day: number, todSec: number): string {
  const hh = Math.floor(todSec / 3600) % 24;
  const mm = Math.floor(todSec / 60) % 60;
  return `Day ${day} · ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
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
  const primaryAlert = liveState.rankedPrimaryAlert;
  const activeProtocol = liveState.activeProtocol;
  const queuedCount = liveState.pausedProtocols?.length ?? 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    onAsk(q);
    setInput("");
  };

  return (
    <aside className="mission-dock" aria-label="Spacesuit assistant controls">
      {/* Header */}
      <header className="dock-header">
        <div className="dock-brand-block">
          <div className="dock-title-row">
            <h1 className="dock-wordmark">SUIT ASSISTANT</h1>
            <span className={`capri-status ${classTone(liveState.overallClass)}`}>
              <span className="capri-dot" aria-hidden="true" />
              <span>{classBadgeText(liveState.overallClass)}</span>
            </span>
          </div>
          <div className="dock-meta-row">
            <span className="hds-num">{formatMissionClock(liveState.missionDay, liveState.timeOfDaySec)}</span>
            <span className="dock-sep" aria-hidden="true">·</span>
            <span>Mars · {ACTIVITY_LABELS[liveState.context.activity] ?? "Outside EVA"}</span>
          </div>
        </div>

        <div className="dock-header-actions">
          <button
            type="button"
            className={`hds-btn hds-btn-sm ${captionState.isListening ? "active" : ""}`}
            onClick={onToggleListening}
            title="Turn microphone listening on or off"
          >
            {captionState.isListening ? "Mic On" : "Mic"}
          </button>
          <button
            type="button"
            className={`hds-btn hds-btn-sm ${captionState.voiceConnected ? "active" : ""}`}
            onClick={onToggleVoice}
            title="Turn spoken voice replies on or off"
          >
            {captionState.voiceConnected ? "Voice" : "Muted"}
          </button>
          {captionState.isSpeaking && (
            <button
              type="button"
              className="hds-btn hds-btn-sm hds-btn-warn"
              onClick={onStopSpeaking}
            >
              Stop
            </button>
          )}
        </div>
      </header>

      {/* Unresponsive crew notice */}
      {captionState.unresponsiveEscalated && (
        <section className="hds-card hds-alert-banner c1" role="alert">
          <div className="hds-alert-top">
            <strong>No reply received</strong>
            <span className="hds-pill">Medical notified</span>
          </div>
          <p className="hds-body-sm">
            Sent an emergency update to the medical team (12-minute signal delay). Let me know once you are okay.
          </p>
          <button type="button" className="hds-btn hds-btn-primary hds-btn-sm" onClick={onConfirmStep}>
            I am okay
          </button>
        </section>
      )}

      {/* Active alert and single next step */}
      {(activeProtocol || primaryAlert) && (
        <section
          className={`hds-card hds-protocol-card ${classTone(
            primaryAlert?.class ?? (activeProtocol ? 2 : 0)
          )}`}
          aria-live="polite"
        >
          <div className="hds-alert-top">
            <h2 className="hds-card-heading">
              {activeProtocol ? activeProtocol.name : primaryAlert?.title}
            </h2>
            <div className="hds-pill-group">
              {activeProtocol?.contingencyTitle && (
                <span className="hds-pill info">Backup plan</span>
              )}
              {queuedCount > 0 && (
                <span className="hds-pill">{queuedCount} waiting</span>
              )}
            </div>
          </div>

          {primaryAlert?.whyLine && (
            <p className="hds-body-sm hds-muted">{primaryAlert.whyLine}</p>
          )}

          {activeProtocol && !activeProtocol.completed && (
            <div className="hds-next-step">
              <span className="hds-step-eyebrow">
                {activeProtocol.contingencyTitle ? activeProtocol.contingencyTitle : "Next step"}
              </span>
              <p className="hds-step-text">{activeProtocol.currentStep.instruction}</p>
            </div>
          )}

          <div className="hds-action-row">
            {activeProtocol && !activeProtocol.completed && (
              <button
                type="button"
                className="hds-btn hds-btn-primary"
                onClick={onConfirmStep}
              >
                Done
              </button>
            )}
            {!activeProtocol && primaryAlert && primaryAlert.state !== "acknowledged" && (
              <button
                type="button"
                className="hds-btn hds-btn-primary"
                onClick={() => onAcknowledgeAlert(primaryAlert.id)}
              >
                Got it
              </button>
            )}
            {onSilenceAlarms && liveState.activeAlerts.length > 0 && (
              <button type="button" className="hds-btn" onClick={onSilenceAlarms}>
                Quiet alarm
              </button>
            )}
          </div>
        </section>
      )}

      {/* Conversation feed */}
      <section className="hds-chat-card" aria-label="Conversation">
        <div className="hds-chat-scroll">
          {history.map((item) => (
            <div
              key={item.id}
              className={`hds-chat-msg ${item.speaker === "CREW" ? "crew" : "assistant"}`}
            >
              <div className="hds-chat-meta">
                <span>{item.speaker === "CREW" ? "You" : "Assistant"}</span>
                <span className="hds-num">{item.missionClock}</span>
              </div>
              <p className="hds-chat-text">{item.text}</p>
            </div>
          ))}
          {captionState.isListening && captionState.interimTranscript && (
            <div className="hds-chat-msg crew interim">
              <div className="hds-chat-meta">
                <span>Hearing you...</span>
              </div>
              <p className="hds-chat-text">{captionState.interimTranscript}</p>
            </div>
          )}
          {captionState.isBusy && (
            <div className="hds-chat-busy">Thinking...</div>
          )}
        </div>

        {/* Input box */}
        <form className="hds-ask-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="hds-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or type Done..."
            aria-label="Message assistant"
          />
          <button type="submit" className="hds-btn hds-btn-primary">
            Send
          </button>
        </form>
      </section>

      {/* Panel navigation */}
      <nav className="hds-nav-grid" aria-label="Simulation panels">
        <button type="button" className="hds-nav-btn" onClick={onOpenSimulation}>
          Events
        </button>
        <button type="button" className="hds-nav-btn" onClick={onOpenTrends}>
          Trends
        </button>
        <button type="button" className="hds-nav-btn" onClick={onOpenSources}>
          Guide
        </button>
        <button type="button" className="hds-nav-btn" onClick={onOpenSettings}>
          Setup
        </button>
      </nav>
    </aside>
  );
};
