import { useEffect, useRef, useState } from "react";
import {
  AssistantController,
  type AssistantCaptionState,
} from "./assistant/assistantController";
import { AzureProxyClient } from "./assistant/azureClient";
import { VoiceService, type AzureVoiceId } from "./assistant/voiceService";
import { AssistantBar, type ChatHistoryItem } from "./components/AssistantBar";
import { SettingsModal } from "./components/SettingsModal";
import { SimulationPanel } from "./components/SimulationPanel";
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

  const { engine, simulator, assistant, client, voice } = refs.current;

  const [liveState, setLiveState] = useState<LiveState>(() => engine.getLiveState());
  const [captionState, setCaptionState] = useState<AssistantCaptionState>({
    speaker: "ASSISTANT",
    text: "All crew health systems nominal. Simulator ready on Sol 1.",
    timestampT: 0,
    alertClass: 0,
    isBusy: false,
    isListening: false,
    isSpeaking: false,
    voiceConnected: false,
    cloudStatus: "checking",
  });
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([
    {
      id: "welcome-0",
      speaker: "ASSISTANT",
      text: "Crew Health Assistant ready. Voice audio is muted until you click Audio On or Mic; ask about radiation, air, cardiovascular, or long-duration health anytime.",
      missionClock: "Sol 1 08:00",
    },
  ]);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<ClockSpeed>(1);
  const [selectedVoice, setSelectedVoice] = useState<AzureVoiceId>(voice.selectedVoice);
  const [terrainId, setTerrainId] = useState<"mars" | "moon" | "orbit">("mars");

  const [simulationOpen, setSimulationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const liveStateRef = useRef<LiveState | null>(liveState);
  const captionRef = useRef<AssistantCaptionState | null>(captionState);
  const lastLoggedMsgRef = useRef<string>("");

  useEffect(() => {
    simulator.playing = playing;
    simulator.speed = speed;
  }, [simulator, playing, speed]);

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

  return (
    <div className="screen-shell">
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
        onStopSpeaking={() => voice.stopSpeaking()}
        onConfirmStep={() => assistant.confirmCurrentProtocolStep()}
        onAcknowledgeAlert={(id) => engine.acknowledgeAlert(id)}
        onOpenSimulation={() => setSimulationOpen(true)}
        onOpenTrends={() => setTrendsOpen(true)}
        onOpenSources={() => setSourcesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Dedicated Mission Events & Simulation Studio */}
      <SimulationPanel
        open={simulationOpen}
        onClose={() => setSimulationOpen(false)}
        liveState={liveState}
        simulator={simulator}
        playing={playing}
        speed={speed}
        onTogglePlay={() => setPlaying((p) => !p)}
        onSetSpeed={(s) => setSpeed(s)}
      />

      {/* Dedicated Technical & Voice Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        liveState={liveState}
        engine={engine}
        voiceConnected={captionState.voiceConnected}
        onToggleVoice={(enabled) => assistant.setVoiceConnected(enabled)}
        selectedVoice={selectedVoice}
        onSelectVoice={(v) => {
          voice.selectedVoice = v;
          setSelectedVoice(v);
        }}
        onTestVoice={() => {
          voice.unlockAudio();
          assistant.setVoiceConnected(true);
          void voice.speak(
            "Arasaka Crew Health Assistant voice check nominal. Azure Neural Speech is active.",
            true
          );
        }}
        cloudStatus={captionState.cloudStatus}
        onProbeCloud={() => void assistant.probeCloud()}
        proxyBaseUrl={client.getBaseUrl()}
        sttSupported={voice.isSttSupported()}
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
