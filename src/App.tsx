import { useCallback, useEffect, useRef, useState } from "react";
import {
  AssistantController,
  type AssistantCaptionState,
} from "./assistant/assistantController";
import { AzureProxyClient } from "./assistant/azureClient";
import { VoiceService, type AzureVoiceId } from "./assistant/voiceService";
import { AssistantBar, type ChatHistoryItem } from "./components/AssistantBar";
import { PreLaunchBriefing } from "./components/PreLaunchBriefing";
import { SettingsModal } from "./components/SettingsModal";
import { SimulationPanel } from "./components/SimulationPanel";
import { SourcesPanel } from "./components/SourcesPanel";
import { TrendsModal } from "./components/TrendsModal";
import { VisorScene } from "./components/VisorScene";
import { AssistantEngineBridge } from "./engine/assistantApi";
import { CrewHealthEngine } from "./engine/engine";
import type { LiveState } from "./engine/types";
import { runMissionAssetPreload, type PreloadSnapshot } from "./services/assetPreloader";
import { MissionSimulator, type ClockSpeed } from "./sim/simulator";

function formatClock(day: number, todSec: number): string {
  const hh = Math.floor(todSec / 3600) % 24;
  const mm = Math.floor(todSec / 60) % 60;
  return `Day ${day} · ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
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
    engine.onStepMitigation = (protoId, stepIdx) => {
      simulator.applyMitigationForStep(protoId, stepIdx, false);
    };
    engine.onSuitAction = (action) => simulator.executeSuitAction(action);
    const bridge = new AssistantEngineBridge(engine);
    const client = new AzureProxyClient();
    const voice = new VoiceService(client);
    const assistant = new AssistantController(bridge, client, voice);
    refs.current = { engine, simulator, bridge, client, voice, assistant };
  }

  const { engine, simulator, assistant, client, voice } = refs.current;

  const [phase, setPhase] = useState<"briefing" | "live">("briefing");
  const [preload, setPreload] = useState<PreloadSnapshot>({
    progressPct: 0,
    ready: false,
    items: [],
    cloudHealth: null,
  });
  const [openMicOnLaunch, setOpenMicOnLaunch] = useState(true);

  const [liveState, setLiveState] = useState<LiveState>(() => engine.getLiveState());
  const [captionState, setCaptionState] = useState<AssistantCaptionState>(() => assistant.caption);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([
    {
      id: "welcome-0",
      speaker: "ASSISTANT",
      text: "All suit systems look good, Sir.",
      missionClock: "Day 1 · 08:00",
    },
  ]);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<ClockSpeed>(1);
  const [selectedVoice, setSelectedVoice] = useState<AzureVoiceId>(voice.selectedVoiceId);
  const [radioFilterEnabled, setRadioFilterEnabled] = useState<boolean>(voice.fx.radioFilterEnabled);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(voice.fx.sfxEnabled);
  const [terrainId] = useState<"mars">("mars");

  const [simulationOpen, setSimulationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const liveStateRef = useRef<LiveState | null>(liveState);
  const captionRef = useRef<AssistantCaptionState | null>(captionState);
  const lastLoggedMsgRef = useRef<string>("");

  // Preload all visual assets, fonts & cloud checks BEFORE showing scene or starting telemetry
  useEffect(() => {
    let cancelled = false;
    void runMissionAssetPreload(client, (snap) => {
      if (!cancelled) {
        setPreload(snap);
        if (snap.cloudHealth) {
          void assistant.probeCloud();
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, assistant]);

  useEffect(() => {
    simulator.playing = playing && phase === "live";
    simulator.speed = speed;
  }, [simulator, playing, speed, phase]);

  const syncAcousticTelemetry = useCallback(
    (st: LiveState) => {
      if (phase !== "live") return;
      voice.fx.syncTelemetryAudio({
        overallClass: st.overallClass,
        hasUnackedAlert: st.activeAlerts.some((a) => a.state === "active"),
        doseRateMsvDay: st.indicators.dose_rate.value,
        suitPressureKpa: st.indicators.suit_pressure.value,
        isEva: st.context.activity === "eva",
        heartRateBpm: st.indicators.heart_rate.value,
        pio2MmHg: st.indicators.pio2.value,
        isAiSpeaking: voice.busySpeaking || Boolean(captionRef.current?.isSpeaking),
      });
    },
    [phase, voice]
  );

  useEffect(() => {
    const unsubEngine = engine.subscribe((next) => {
      liveStateRef.current = next;
      setLiveState(next);
      if (phase === "live") {
        assistant.onAlertsUpdated(next.activeAlerts);
        syncAcousticTelemetry(next);
      }
    });

    const unsubCaption = assistant.subscribe((cap) => {
      captionRef.current = cap;
      setCaptionState(cap);
      if (liveStateRef.current) {
        syncAcousticTelemetry(liveStateRef.current);
      }
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
  }, [engine, assistant, phase, syncAcousticTelemetry]);

  useEffect(() => {
    if (phase !== "live") return;
    let lastTs = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - lastTs) / 1000);
      lastTs = now;
      if (simulator.playing) {
        simulator.tickRealTime(dt);
      }
      syncAcousticTelemetry(engine.getLiveState());
    }, 250);
    return () => window.clearInterval(timer);
  }, [simulator, engine, phase, syncAcousticTelemetry]);

  useEffect(() => {
    return () => {
      assistant.dispose();
    };
  }, [assistant]);

  const handleLaunchEva = useCallback(() => {
    if (!preload.ready) return;
    simulator.enterEvaSurface();
    voice.unlockAudio();
    assistant.setVoiceConnected(true);
    setPhase("live");
    assistant.enterSuitSilent(openMicOnLaunch);
  }, [preload.ready, assistant, simulator, voice, openMicOnLaunch]);

  const handleTriggerEvent = useCallback(
    (presetId: string) => {
      voice.unlockAudio();
      const res = simulator.triggerLiveEvent(presetId);
      setPlaying(true);
      if (res.suggestedSpeed !== undefined) {
        setSpeed(res.suggestedSpeed);
      }
      syncAcousticTelemetry(engine.getLiveState());
    },
    [simulator, engine, voice, syncAcousticTelemetry]
  );

  const sampleAudioLevels = useCallback(() => {
    return {
      speech: voice.fx.sampleSpeechLevel(),
      mic: voice.fx.sampleMicLevel(),
    };
  }, [voice]);

  // Do NOT mount the 3D scene, HUD, or telemetry dock until all assets are loaded and user launches EVA
  if (phase === "briefing") {
    return (
      <PreLaunchBriefing
        preload={preload}
        openMicOnLaunch={openMicOnLaunch}
        onChangeOpenMicOnLaunch={setOpenMicOnLaunch}
        onLaunch={handleLaunchEva}
      />
    );
  }

  return (
    <div className="screen-shell">
      {/* Primary Optical 3D Visor Stage */}
      <div className="visor-stage">
        <div className="visor-frame">
          <VisorScene
            liveStateRef={liveStateRef}
            captionRef={captionRef}
            sampleAudioLevels={sampleAudioLevels}
            terrainId={terrainId}
          />
        </div>
      </div>

      {/* Mars EVA Mission Console & Crew Assistant Dock */}
      <AssistantBar
        liveState={liveState}
        captionState={captionState}
        history={chatHistory}
        onAsk={(q) => void assistant.ask(q)}
        onToggleListening={() => assistant.toggleListening()}
        onToggleVoice={() => assistant.setVoiceConnected(!captionState.voiceConnected)}
        onStopSpeaking={() => voice.stopSpeech()}
        onConfirmStep={() => assistant.confirmCurrentProtocolStep()}
        onAcknowledgeAlert={(id) => engine.acknowledgeAlert(id)}
        onSilenceAlarms={() => {
          voice.stopSpeech();
          engine.silenceAllAlerts();
        }}
        onOpenSimulation={() => setSimulationOpen(true)}
        onOpenTrends={() => setTrendsOpen(true)}
        onOpenSources={() => setSourcesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Dedicated EVA Surface Events & Simulation Studio */}
      <SimulationPanel
        open={simulationOpen}
        onClose={() => setSimulationOpen(false)}
        liveState={liveState}
        simulator={simulator}
        playing={playing}
        speed={speed}
        onTogglePlay={() => setPlaying((p) => !p)}
        onSetSpeed={(s) => setSpeed(s)}
        onTriggerEvent={handleTriggerEvent}
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
          voice.setVoiceById(v);
          setSelectedVoice(v);
        }}
        onTestVoice={() => {
          voice.unlockAudio();
          assistant.setVoiceConnected(true);
          void voice.speak("Suit voice check sounds clear, Sir.", "nominal", true);
        }}
        radioFilterEnabled={radioFilterEnabled}
        onToggleRadioFilter={(enabled) => {
          voice.fx.setRadioFilterEnabled(enabled);
          setRadioFilterEnabled(enabled);
        }}
        sfxEnabled={sfxEnabled}
        onToggleSfx={(enabled) => {
          voice.fx.sfxEnabled = enabled;
          setSfxEnabled(enabled);
        }}
        cloudStatus={captionState.cloudStatus}
        onProbeCloud={() => void assistant.probeCloud()}
        proxyBaseUrl={client.getBaseUrl()}
        sttSupported={voice.supportsSpeechRecognition}
        terrainId={terrainId}
      />

      {/* Slow Health Trends & Append-Only Event Log Modal */}
      <TrendsModal
        open={trendsOpen}
        onClose={() => setTrendsOpen(false)}
        engine={engine}
        liveState={liveState}
      />

      {/* Authoritative Sources & Evidence Matrix */}
      <SourcesPanel open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </div>
  );
}

export default App;
