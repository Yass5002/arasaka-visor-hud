import { useEffect, useRef, useState } from "react";
import {
  AssistantController,
  type AssistantCaptionState,
} from "./assistant/assistantController";
import { AzureProxyClient } from "./assistant/azureClient";
import { VoiceService, type AzureVoiceId } from "./assistant/voiceService";
import { AssistantBar, type ChatHistoryItem } from "./components/AssistantBar";
import { ControlPanel } from "./components/ControlPanel";
import { SourcesPanel } from "./components/SourcesPanel";
import { TrendsModal } from "./components/TrendsModal";
import { VisorScene } from "./components/VisorScene";
import { AssistantEngineBridge } from "./engine/assistantApi";
import { CrewHealthEngine } from "./engine/engine";
import type { LiveState } from "./engine/types";
import { MissionSimulator, type ClockSpeed } from "./sim/simulator";

function formatClock(day: number, todSec: number): string {
  const hh = Math.floor(todSec / 3600) % 24;
  const mm = Math.floor(todSec / 60) % 60;
  return `Sol ${day} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function App() {
  // Singleton mission simulation, engine, and Azure-backed Assistant instances
  const refs = useRef<{
    engine: CrewHealthEngine;
    simulator: MissionSimulator;
    bridge: AssistantEngineBridge;
    client: AzureProxyClient;
    voice: VoiceService;
    assistant: AssistantController;
  } | null>(null);

  if (!refs.current) {
    const engine = new CrewHealthEngine({ missionLengthDays: 180 });
    const simulator = new MissionSimulator(engine);
    const bridge = new AssistantEngineBridge(engine);
    const client = new AzureProxyClient();
    const voice = new VoiceService(client);
    const assistant = new AssistantController(bridge, client, voice);
    refs.current = { engine, simulator, bridge, client, voice, assistant };
  }

  const { engine, simulator, assistant, voice } = refs.current;

  const [liveState, setLiveState] = useState<LiveState>(() => engine.getLiveState());
  const [captionState, setCaptionState] = useState<AssistantCaptionState>({
    speaker: "ASSISTANT",
    text: "All crew health systems nominal. Simulator ready on Sol 1.",
    timestampT: 0,
    alertClass: 0,
    isBusy: false,
    isListening: false,
    voiceConnected: false,
    cloudStatus: "checking",
  });
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([
    {
      id: "welcome-0",
      speaker: "ASSISTANT",
      text: "Crew Health Assistant ready. Voice audio is muted until connected; ask about radiation, air, cardiovascular, or long-duration health anytime.",
      missionClock: "Sol 1 08:00",
    },
  ]);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<ClockSpeed>(1);
  const [selectedVoice, setSelectedVoice] = useState<AzureVoiceId>(voice.selectedVoice);
  const [terrainId, setTerrainId] = useState<"mars" | "moon" | "orbit">("mars");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [edgeIdle, setEdgeIdle] = useState(false);

  const liveStateRef = useRef<LiveState | null>(liveState);
  const captionRef = useRef<AssistantCaptionState | null>(captionState);
  const lastLoggedMsgRef = useRef<string>("");

  // Sync playing & clock speed into simulator
  useEffect(() => {
    simulator.playing = playing;
    simulator.speed = speed;
  }, [simulator, playing, speed]);

  // Subscribe to Engine LiveState updates + Assistant captions
  useEffect(() => {
    void assistant.probeCloud();

    const unsubEngine = engine.subscribe((next) => {
      liveStateRef.current = next;
      setLiveState(next);
      assistant.onAlertsUpdated(next.activeAlerts);
    });

    const unsubCaption = assistant.subscribe((cap) => {
      captionRef.current = cap;
      setCaptionState(cap);
      const dedupeKey = `${cap.speaker}:${cap.text}`;
      if (cap.text && dedupeKey !== lastLoggedMsgRef.current) {
        lastLoggedMsgRef.current = dedupeKey;
        const st = engine.getLiveState();
        setChatHistory((prev) => [
          ...prev.slice(-39),
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            speaker: cap.speaker,
            text: cap.text,
            missionClock: formatClock(st.missionDay, st.timeOfDaySec),
          },
        ]);
      }
    });

    return () => {
      unsubEngine();
      unsubCaption();
    };
  }, [engine, assistant]);

  // Mission clock loop (250ms tick -> simulator throttles internal writes cleanly)
  useEffect(() => {
    let lastTs = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - lastTs) / 1000);
      lastTs = now;
      if (simulator.playing) {
        simulator.tickRealTime(dt);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [simulator]);

  // Fade top-right edge Settings trigger after pointer inactivity (SIM-CTL-006)
  useEffect(() => {
    let timer = window.setTimeout(() => setEdgeIdle(true), 3500);
    const onMove = () => {
      setEdgeIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setEdgeIdle(true), 3500);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="screen-shell">
      {/* Subtle top-right edge Settings icon (outside 3D scene FOV, SIM-CTL-006) */}
      <button
        type="button"
        className={`edge-settings-trigger ${edgeIdle && !settingsOpen ? "idle-faded" : ""} ${settingsOpen ? "active" : ""}`}
        aria-label="Open Mission Settings and Simulator Controls"
        title="Mission Settings & Simulator Controls"
        onClick={() => setSettingsOpen((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Primary 1.417:1 Optical 3D Visor Stage */}
      <div className="visor-stage">
        <div className="visor-frame">
          <VisorScene
            liveStateRef={liveStateRef}
            captionRef={captionRef}
            terrainId={terrainId}
          />
        </div>
      </div>

      {/* Compact NASA HDS Mission Console & Crew Assistant Dock */}
      <AssistantBar
        liveState={liveState}
        captionState={captionState}
        history={chatHistory}
        onAsk={(q) => void assistant.ask(q)}
        onToggleListening={() => assistant.toggleListening()}
        onToggleVoice={() => assistant.setVoiceConnected(!captionState.voiceConnected)}
        onConfirmStep={() => assistant.confirmCurrentProtocolStep()}
        onAcknowledgeAlert={(id) => engine.acknowledgeAlert(id)}
        onOpenTrends={() => setTrendsOpen(true)}
        onOpenSources={() => setSourcesOpen(true)}
      />

      {/* Hidden/Edge Settings Dashboard & Simulator Controls */}
      <ControlPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        liveState={liveState}
        simulator={simulator}
        playing={playing}
        speed={speed}
        onTogglePlay={() => setPlaying((p) => !p)}
        onSetSpeed={(s) => setSpeed(s)}
        voiceConnected={captionState.voiceConnected}
        onToggleVoice={(enabled) => assistant.setVoiceConnected(enabled)}
        selectedVoice={selectedVoice}
        onSelectVoice={(v) => {
          voice.selectedVoice = v;
          setSelectedVoice(v);
        }}
        cloudStatus={captionState.cloudStatus}
        terrainId={terrainId}
        onSelectTerrain={(id) => setTerrainId(id)}
      />

      {/* Habitat / Wrist Slow Health Trends & Append-Only Event Log Modal */}
      <TrendsModal
        open={trendsOpen}
        onClose={() => setTrendsOpen(false)}
        engine={engine}
        liveState={liveState}
      />

      {/* Standards, Scientific Sources & Basis Legend Modal */}
      <SourcesPanel
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
      />
    </div>
  );
}

export default App;
