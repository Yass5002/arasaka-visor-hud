import { describe, expect, it, vi } from "vitest";
import { AssistantController } from "../../assistant/assistantController";
import { AzureProxyClient } from "../../assistant/azureClient";
import { lookupManualTopic } from "../../assistant/flightManual";
import { VoiceService } from "../../assistant/voiceService";
import { AssistantEngineBridge } from "../assistantApi";
import { BONE_LOSS_TABLE, ENGINE_LIMITS, INDICATOR_META } from "../config";
import { CrewHealthEngine } from "../engine";
import { stepBoneDensity } from "../models";
import type { IndicatorId } from "../types";
import { PRESET_CATALOGUE } from "../../sim/presets";
import { MissionSimulator } from "../../sim/simulator";

describe("ARASAKA Engine & Simulation Verification (V-01 .. V-10)", () => {
  it("V-01: all 14 preset scenarios (S-01..S-13b) trigger expected alert classes and protocol metadata", () => {
    const verifyPreset = (
      setup: (sim: MissionSimulator, eng: CrewHealthEngine) => void,
      check: (live: ReturnType<CrewHealthEngine["getLiveState"]>) => void
    ) => {
      const eng = new CrewHealthEngine();
      const sim = new MissionSimulator(eng);
      setup(sim, eng);
      check(eng.getLiveState());
    };

    // S-01 Solar Particle Event -> Class 2 SPE alert + shelter protocol
    verifyPreset(
      (sim) => {
        sim.firePreset("S-01", "forward");
        sim.jumpForward(30 * 60);
      },
      (live) => {
        const spe = live.activeAlerts.find((a) => a.detectorId === "rad_spe_rate");
        expect(spe).toBeDefined();
        expect(spe?.class).toBe(2);
        expect(spe?.protocolId).toBe("shelter");
      }
    );

    // S-02 CO2 Buildup -> Class 2 after 60m + air_check protocol
    verifyPreset(
      (sim) => {
        sim.firePreset("S-02", "forward");
        sim.jumpForward(60 * 60);
      },
      (live) => {
        const co2 = live.activeAlerts.find((a) => a.detectorId === "env_ppco2_1h");
        expect(co2).toBeDefined();
        expect(co2?.class).toBe(2);
        expect(co2?.protocolId).toBe("air_check");
      }
    );

    // S-03 Oxygen Drop -> Class 2 hypoxia alert + air_check protocol
    verifyPreset(
      (sim) => {
        sim.firePreset("S-03", "forward");
        sim.jumpForward(15 * 60);
      },
      (live) => {
        const oxy = live.activeAlerts.find((a) => a.detectorId === "env_pio2_low");
        expect(oxy).toBeDefined();
        expect(oxy?.class).toBe(2);
        expect(oxy?.protocolId).toBe("air_check");
      }
    );

    // S-04 EVA Exertion Strain -> Class 3 exertion alert + exertion_recovery protocol
    verifyPreset(
      (sim) => {
        sim.firePreset("S-04", "forward");
      },
      (live) => {
        const eva = live.activeAlerts.find((a) => a.detectorId === "cv_context_hr");
        expect(eva).toBeDefined();
        expect(eva?.class).toBe(3);
        expect(eva?.protocolId).toBe("exertion_recovery");
      }
    );

    // S-05 Orthostatic Dizziness -> orthostatic alert + orthostatic_response protocol
    verifyPreset(
      (sim) => {
        sim.firePreset("S-05", "forward");
      },
      (live) => {
        const ortho = live.activeAlerts.find((a) => a.detectorId === "cv_orthostatic");
        expect(ortho).toBeDefined();
        expect(ortho?.protocolId).toBe("orthostatic_response");
      }
    );

    // S-06 Sleep Debt & Circadian Drift (Scenario Start / 10d)
    verifyPreset(
      (sim) => {
        sim.firePreset("S-06", "scenario_start");
      },
      (live) => {
        expect(live.activeAlerts.some((a) => a.detectorId === "sleep_7night_debt" && a.class === 3)).toBe(true);
      }
    );

    // S-07 Missed Resistive Exercise -> Bone loss alert
    verifyPreset(
      (sim) => {
        sim.firePreset("S-07", "scenario_start");
      },
      (live) => {
        expect(live.activeAlerts.some((a) => a.detectorId === "bone_missed_exercise" && a.class === 3)).toBe(true);
      }
    );

    // S-08 Immune Stress
    verifyPreset(
      (sim) => {
        sim.firePreset("S-08", "scenario_start");
      },
      (live) => {
        expect(live.activeAlerts.some((a) => a.detectorId === "immune_composite" && a.class === 3)).toBe(true);
      }
    );

    // S-09 Isolation & Mood Decline
    verifyPreset(
      (sim) => {
        sim.firePreset("S-09", "scenario_start");
      },
      (live) => {
        expect(live.activeAlerts.some((a) => a.detectorId === "behaviour_isolation_stress" && a.class === 3)).toBe(true);
      }
    );

    // S-10 Fluid Shift & Vision Change -> SANS risk alert
    verifyPreset(
      (sim) => {
        sim.firePreset("S-10", "scenario_start");
      },
      (live) => {
        expect(live.activeAlerts.some((a) => a.detectorId === "vision_sans" && a.class === 3)).toBe(true);
      }
    );

    // S-11 Career Dose Limit Drift -> >= 75% Class 3 or Class 2
    verifyPreset(
      (sim) => {
        sim.firePreset("S-11", "scenario_start");
      },
      (live) => {
        expect(live.careerDosePercent).toBeGreaterThanOrEqual(75);
        expect(live.activeAlerts.some((a) => a.detectorId === "rad_career_limit" && a.class <= 3)).toBe(true);
      }
    );

    // S-14 EVA Suit Pressure Seal Leak -> env_pressure_bounds Class 1/2 + air_check
    verifyPreset(
      (sim) => {
        sim.firePreset("S-14", "forward");
        sim.jumpForward(15 * 60);
      },
      (live) => {
        const leak = live.activeAlerts.find((a) => a.detectorId === "env_pressure_bounds");
        expect(leak).toBeDefined();
        expect(leak?.class).toBe(1);
        expect(leak?.protocolId).toBe("air_check");
      }
    );

    // S-15 EVA Nominal Traverse -> 0 alerts (138 bpm within 149 bpm EVA threshold)
    verifyPreset(
      (sim) => {
        sim.firePreset("S-15", "forward");
      },
      (live) => {
        expect(live.activeAlerts.some((a) => a.detectorId === "cv_context_hr")).toBe(false);
      }
    );

    expect(PRESET_CATALOGUE.length).toBe(16);
  }, 15000);

  it("V-02: Engine rules are source-independent across simulator, manual, and sensor feeds", () => {
    const sources = ["simulator", "manual", "sensor"] as const;
    const snapshots = sources.map((source) => {
      const eng = new CrewHealthEngine();
      eng.setContext({ activity: "cabin", location: "habitat" }, false);
      for (let m = 0; m <= 60; m += 5) {
        eng.ingestSample(
          {
            id: "ppco2",
            t: m * 60,
            value: 3.2,
            unit: "mmHg",
            kind: "sensed",
            source,
            quality: 0.99,
          },
          m === 60
        );
      }
      return eng.getLiveState().activeAlerts.map((a) => `${a.detectorId}:${a.class}`).sort();
    });

    expect(snapshots[0]).toEqual(snapshots[1]);
    expect(snapshots[1]).toEqual(snapshots[2]);
    expect(snapshots[0]).toContain("env_ppco2_1h:2");
  });

  it("V-03: 500 ms slider debounce pattern writes manual_override and updates engine state once after release", () => {
    vi.useFakeTimers();
    const eng = new CrewHealthEngine();
    const sim = new MissionSimulator(eng);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleManualSlider = (id: IndicatorId, val: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => sim.setManualOverride(id, val), 500);
    };

    scheduleManualSlider("pio2", 130);
    vi.advanceTimersByTime(200);
    scheduleManualSlider("pio2", 122);
    vi.advanceTimersByTime(499);
    expect(eng.getLiveState().indicators.pio2.value).not.toBe(122);

    vi.advanceTimersByTime(1);
    expect(eng.getLiveState().indicators.pio2.value).toBe(122);
    expect(eng.store.getEvents({ type: "manual_override" })).toHaveLength(1);
    vi.useRealTimers();
  });

  it("V-04: Forward +14d jump and backward snapshot restore leave bone density and cumulative dose monotonic & consistent", () => {
    const eng = new CrewHealthEngine();
    const sim = new MissionSimulator(eng);
    const doseAtDay1 = eng.getLiveState().indicators.dose_cumulative.value;
    const boneAtDay1 = eng.getLiveState().indicators.bone_loss_lumbar.value;

    sim.jumpForward(14 * 86400);
    const day15Dose = eng.getLiveState().indicators.dose_cumulative.value;
    const day15Bone = eng.getLiveState().indicators.bone_loss_lumbar.value;
    expect(day15Dose).toBeGreaterThan(doseAtDay1);
    expect(day15Bone).toBeLessThanOrEqual(boneAtDay1);

    expect(sim.jumpBackward()).toBe(true);
    expect(eng.getTime()).toBeLessThan(14 * 86400);
    expect(eng.getLiveState().indicators.dose_cumulative.value).toBeLessThan(day15Dose);
  });

  it("V-05: Bone density model reproduces Sibonga Table 1 rates exactly (c=0, c=1 eps=0.5, femoral neck)", () => {
    // 1 month, c=0, lumbar r_0 = 0.0106 -> 1 - 0.0106 = 0.9894
    expect(stepBoneDensity(1.0, BONE_LOSS_TABLE.lumbar.monthlyLossRate, 0, 1)).toBeCloseTo(0.9894, 4);
    // 3 months sequentially, c=0, lumbar -> (1 - 0.0106)^3 = 0.9685
    let b3 = 1.0;
    for (let m = 0; m < 3; m++) {
      b3 = stepBoneDensity(b3, BONE_LOSS_TABLE.lumbar.monthlyLossRate, 0, 1);
    }
    expect(b3).toBeCloseTo(0.9685, 4);

    // 3 months sequentially, c=1, eps=0.5, lumbar -> (1 - 0.0053)^3 = 0.9842
    let b3Ex = 1.0;
    for (let m = 0; m < 3; m++) {
      b3Ex = stepBoneDensity(b3Ex, BONE_LOSS_TABLE.lumbar.monthlyLossRate, 1, 1, 0.5);
    }
    expect(b3Ex).toBeCloseTo(0.9842, 4);

    // 3 months sequentially, c=0, femoral neck -> (1 - 0.0115)^3 = 0.9659
    let b3Fem = 1.0;
    for (let m = 0; m < 3; m++) {
      b3Fem = stepBoneDensity(b3Fem, BONE_LOSS_TABLE.femoral_neck.monthlyLossRate, 0, 1);
    }
    expect(b3Fem).toBeCloseTo(0.9659, 4);
  });

  it("V-06: CO2 buildup hits Class 3 at ~47 min and Class 2 at 60 min at both 60s live steps and 15m jump steps", () => {
    const runAfterOneHourBaseline = (stepSec: number) => {
      const eng = new CrewHealthEngine();
      const sim = new MissionSimulator(eng);
      // Run 60 minutes of nominal baseline first so the 1-hr trailing window is populated at 1.5 mmHg
      sim.advanceTo(3600, stepSec);
      sim.firePreset("S-02", "forward");
      let firstClass3Min: number | null = null;
      let firstClass2Min: number | null = null;
      for (let dt = stepSec; dt <= 75 * 60; dt += stepSec) {
        sim.advanceTo(3600 + dt, stepSec);
        const co2Alert = eng.getLiveState().activeAlerts.find((a) => a.detectorId === "env_ppco2_1h");
        if (co2Alert?.class === 3 && firstClass3Min === null) firstClass3Min = dt / 60;
        if (co2Alert?.class === 2 && firstClass2Min === null) firstClass2Min = dt / 60;
      }
      return { firstClass3Min, firstClass2Min };
    };

    const live = runAfterOneHourBaseline(60);
    const jump = runAfterOneHourBaseline(900);
    expect(live.firstClass3Min).not.toBeNull();
    expect(live.firstClass3Min!).toBeGreaterThanOrEqual(45);
    expect(live.firstClass3Min!).toBeLessThanOrEqual(48);
    expect(live.firstClass2Min).toBe(60);
    expect(jump.firstClass2Min).toBe(60);
  });

  it("V-07: S-01 SPE dose integral matches trapezoidal integral of dose_rate within 1%", () => {
    const eng = new CrewHealthEngine();
    const sim = new MissionSimulator(eng);
    const initialDose = eng.getLiveState().indicators.dose_cumulative.value;
    sim.firePreset("S-01", "forward");
    sim.advanceTo(6 * 3600, 60);
    const finalDose = eng.getLiveState().indicators.dose_cumulative.value;
    const accumulatedDelta = finalDose - initialDose;

    const meanRateMsvDay = eng.store.getTimeWeightedMean("dose_rate", 6 * 3600, 6 * 3600);
    expect(meanRateMsvDay).not.toBeNull();
    const analyticIntegral = meanRateMsvDay! * 0.25;
    expect(Math.abs(accumulatedDelta - analyticIntegral) / analyticIntegral).toBeLessThan(0.01);
    expect(accumulatedDelta).toBeGreaterThan(30);
    expect(accumulatedDelta).toBeLessThan(48);
  });

  it("V-08: 100 runs of S-13 (exercise context) produce 0 alerts; S-13b (cabin context) raises an immediate alert", () => {
    for (let run = 0; run < 100; run++) {
      const eng = new CrewHealthEngine();
      const sim = new MissionSimulator(eng);
      sim.firePreset("S-13", "forward");
      sim.advanceTo(180, 60);
      expect(eng.getLiveState().activeAlerts).toHaveLength(0);
    }

    const engCtrl = new CrewHealthEngine();
    const simCtrl = new MissionSimulator(engCtrl);
    simCtrl.firePreset("S-13b", "forward");
    expect(engCtrl.getLiveState().activeAlerts.some((a) => a.detectorId === "cv_context_hr")).toBe(true);
  });

  it("V-09: S-12 cascade scenario produces a single ranked primary alert with >= 2 linked contributing factors", () => {
    const eng = new CrewHealthEngine();
    const sim = new MissionSimulator(eng);
    sim.firePreset("S-12", "forward");
    sim.advanceTo(30 * 60, 60);
    const live = eng.getLiveState();
    const primary = live.rankedPrimaryAlert;
    expect(primary).not.toBeNull();
    expect(primary!.detectorId).toBe("cascade_coupled");
    expect(primary!.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it("V-10 & AssistantEngineBridge: query & action calls work, complete protocols, and preserve append-only eventLog across resets", () => {
    const eng = new CrewHealthEngine();
    const bridge = new AssistantEngineBridge(eng);
    const sim = new MissionSimulator(eng);
    sim.firePreset("S-01", "forward");

    const state = bridge.get_state();
    expect(state.overallClass).toBe(2);
    expect(bridge.get_alerts("active").length).toBeGreaterThan(0);
    const primaryId = state.rankedPrimaryAlert!.id;
    const explained = bridge.explain(primaryId);
    expect(explained?.expectedReplyDelayMin).toBe(ENGINE_LIMITS.earthReplyDelayMin.value);

    const compared = bridge.compare_to_plan("dose_cumulative");
    expect(compared.limit).toBe(600);
    const summary = bridge.summarise("dose_rate", 60);
    expect(summary).not.toBeNull();

    const started = bridge.start_protocol("shelter");
    expect(started.id).toBe("shelter");
    const stepRes = bridge.complete_step("shelter", 0);
    expect(stepRes?.completedSteps).toContain(0);

    const allEventsBefore = eng.store.getEvents({ includeAbandonedRuns: true }).length;
    expect(allEventsBefore).toBeGreaterThan(0);

    sim.resetAll();
    const allEventsAfter = eng.store.getEvents({ includeAbandonedRuns: true }).length;
    expect(allEventsAfter).toBeGreaterThanOrEqual(allEventsBefore);
    expect(Object.keys(INDICATOR_META).length).toBeGreaterThanOrEqual(25);
  });

  it("V-11 & V-12: Assistant gives grounded non-diagnostic answers without Voice audio leak & slow modelled indices stay off-visor", async () => {
    const eng = new CrewHealthEngine();
    const sim = new MissionSimulator(eng);
    const bridge = new AssistantEngineBridge(eng);
    const client = new AzureProxyClient("http://127.0.0.1:0"); // forces deterministic fallback cleanly
    const voice = new VoiceService(client);
    const controller = new AssistantController(bridge, client, voice);

    expect(voice.enabled).toBe(false);
    sim.firePreset("S-01", "forward");
    const live = eng.getLiveState();
    controller.onAlertsUpdated(live.activeAlerts);
    expect(eng.getLiveState().activeProtocol?.id).toBe("shelter");

    const radReply = await controller.ask("What is my radiation dose?");
    expect(radReply).toMatch(/mSv\/day|600 mSv/);
    expect(radReply.toLowerCase()).not.toContain("you have");

    const boneReply = await controller.ask("What about bone density and immune index?");
    expect(boneReply).toMatch(/estimated lumbar BMD/i);
    expect(boneReply).toMatch(/DXA is record/i);

    // V-12: Slow modelled indices never exposed on visor gauges (SIM-HUD-001)
    expect(live.indicators.bone_loss_lumbar.visorVisible).toBe(false);
    expect(live.indicators.immune_index.visorVisible).toBe(false);
    expect(live.indicators.cognitive_drift.visorVisible).toBe(false);
    expect(live.indicators.sans_risk.visorVisible).toBe(false);
  });

  it("V-13: Class 1 protocol preemption stack, EVA mitigation recovery, and unresponsive escalation log", () => {
    const eng = new CrewHealthEngine();
    const sim = new MissionSimulator(eng);
    const bridge = new AssistantEngineBridge(eng);
    sim.enterEvaSurface();

    // Start exertion recovery (Class 3), then preempt with Class 1 Suit Pressure Leak (air_check)
    bridge.start_protocol("exertion_recovery");
    expect(eng.getLiveState().activeProtocol?.id).toBe("exertion_recovery");

    sim.firePreset("S-14", "forward");
    sim.jumpForward(15 * 60);
    const preempted = bridge.start_protocol("air_check");
    expect(preempted.id).toBe("air_check");
    expect(eng.getLiveState().pausedProtocols.some((p) => p.id === "exertion_recovery")).toBe(true);

    // Completing air_check steps + EVA mitigation stabilizes suit pressure & resumes queued exertion_recovery
    const total = eng.getLiveState().activeProtocol!.totalSteps;
    for (let s = 0; s < total; s++) {
      bridge.complete_step("air_check", s);
      sim.applyMitigationForStep("air_check", s);
    }
    expect(eng.getLiveState().indicators.suit_pressure.value).toBeGreaterThan(35);
    expect(eng.getLiveState().activeProtocol?.id).toBe("exertion_recovery");

    // Unresponsive escalation records append-only log event cleanly
    bridge.log_escalation("shelter", 3, "Crew unresponsive >45s during SPE");
    expect(bridge.get_events("unresponsive_crew_escalation").length).toBe(1);
  });

  it("V-14: Concurrent events (S-01 + S-14 and S-02 CO2 purge) fully resolve with zero ghost re-triggers", () => {
    const eng = new CrewHealthEngine();
    const sim = new MissionSimulator(eng);
    eng.onStepMitigation = (p, s) => sim.applyMitigationForStep(p, s, false);
    const bridge = new AssistantEngineBridge(eng);
    const client = new AzureProxyClient("http://127.0.0.1:0");
    const voice = new VoiceService(client);
    const controller = new AssistantController(bridge, client, voice);
    sim.enterEvaSurface();

    // Wire live alert listener like App.tsx does
    eng.subscribe((next) => controller.onAlertsUpdated(next.activeAlerts));

    // Fire BOTH S-01 (shelter) and S-14 (air_check) concurrently
    sim.firePreset("S-01", "forward");
    sim.firePreset("S-14", "forward");
    sim.jumpForward(15 * 60);

    const stateAfterDual = eng.getLiveState();
    expect(stateAfterDual.activeProtocol?.id).toBe("air_check");
    expect(stateAfterDual.pausedProtocols.some((p) => p.id === "shelter")).toBe(true);

    // Complete all steps of air_check (3 steps)
    for (let i = 0; i < 3; i++) {
      controller.confirmCurrentProtocolStep();
    }

    // Should now seamlessly promote shelter with air cleared and S-14 marked solved
    expect(eng.getLiveState().activeProtocol?.id).toBe("shelter");
    expect(sim.getActivePresetIds()).not.toContain("S-14");

    // Complete all steps of shelter (3 steps)
    for (let i = 0; i < 3; i++) {
      controller.confirmCurrentProtocolStep();
    }

    // Both events must now be completely solved and stay solved across subsequent ticks
    expect(sim.getActivePresetIds()).toHaveLength(0);
    expect(eng.getLiveState().activeAlerts).toHaveLength(0);
    sim.jumpForward(5 * 60);
    expect(eng.getLiveState().activeAlerts).toHaveLength(0);

    // Verify S-02 CO2 1-hr rolling buffer purge also stays cleared after finishing air_check
    sim.firePreset("S-02", "forward");
    sim.jumpForward(60 * 60);
    expect(eng.getLiveState().activeProtocol?.id).toBe("air_check");
    for (let i = 0; i < 3; i++) {
      controller.confirmCurrentProtocolStep();
    }
    expect(eng.getLiveState().activeAlerts).toHaveLength(0);
    sim.jumpForward(5 * 60);
    expect(eng.getLiveState().activeAlerts).toHaveLength(0);
  });

  it("V-15: Assistant never self-interrupts or re-spams alerts across concurrent triggers & cascade clear", () => {
    const eng = new CrewHealthEngine();
    const sim = new MissionSimulator(eng);
    eng.onStepMitigation = (p, s) => sim.applyMitigationForStep(p, s, false);
    const bridge = new AssistantEngineBridge(eng);
    const client = new AzureProxyClient("http://127.0.0.1:0");
    const voice = new VoiceService(client);
    voice.enabled = true;
    const spokenCalls: Array<{ text: string; interrupt: boolean }> = [];
    voice.speak = async (text: string, _urgency, interrupt = false) => {
      spokenCalls.push({ text, interrupt });
    };
    const controller = new AssistantController(bridge, client, voice);
    sim.enterEvaSurface();

    eng.subscribe((next) => controller.onAlertsUpdated(next.activeAlerts));

    // Nominal ticks produce zero speech calls
    sim.advanceTo(eng.getTime() + 60, 15);
    expect(spokenCalls).toHaveLength(0);

    // Fire S-01 (shelter), advance multiple ticks -> 1 alert announcement, interrupt = false
    sim.firePreset("S-01", "forward");
    sim.advanceTo(eng.getTime() + 2 * 60, 15);
    const afterS01Count = spokenCalls.length;
    expect(afterS01Count).toBe(1);
    expect(spokenCalls.every((c) => c.interrupt === false)).toBe(true);

    // Fire S-14 concurrently -> cascade_coupled announces once with interrupt = false
    sim.firePreset("S-14", "forward");
    sim.advanceTo(eng.getTime() + 10 * 60, 30);
    expect(spokenCalls.length).toBeLessThanOrEqual(3);
    expect(spokenCalls.every((c) => c.interrupt === false)).toBe(true);

    // Confirming shelter steps resolves S-01 & cascade_coupled WITHOUT re-announcing env_pressure_bounds
    const callsBeforeStep = spokenCalls.length;
    controller.confirmCurrentProtocolStep(); // shelter/air_check step 0
    // Only the step confirmation message should speak (1 call, interrupt = false)
    expect(spokenCalls.length - callsBeforeStep).toBe(1);
    expect(spokenCalls[spokenCalls.length - 1].interrupt).toBe(false);
  });

  it("V-16: Contingency improvisation pivots Plan A -> Plan B terrain shielding and silence_alarm works", async () => {
    const eng = new CrewHealthEngine();
    const sim = new MissionSimulator(eng);
    eng.onStepMitigation = (p, s) => sim.applyMitigationForStep(p, s, false);
    eng.onSuitAction = (act) => sim.executeSuitAction(act);
    const bridge = new AssistantEngineBridge(eng);
    const client = new AzureProxyClient("http://127.0.0.1:0");
    const voice = new VoiceService(client);
    const controller = new AssistantController(bridge, client, voice);
    sim.enterEvaSurface();
    eng.subscribe((next) => controller.onAlertsUpdated(next.activeAlerts));

    sim.triggerLiveEvent("S-01");
    sim.advanceTo(eng.getTime() + 60, 15);
    const beforeDose = eng.getLiveState().indicators.dose_rate.value;
    expect(beforeDose).toBeGreaterThan(2.0);
    expect(eng.getLiveState().activeProtocol?.id).toBe("shelter");

    // Crew rejects Plan A ("I can't make it back to the habitat in time!")
    const reply = await controller.ask("I can't make it back to the habitat in time!");
    expect(reply.toLowerCase()).toMatch(/plan b|crater|shield/);
    const afterProto = eng.getLiveState().activeProtocol;
    expect(afterProto?.contingencyTitle).toContain("PLAN B");
    expect(afterProto?.currentStep.instruction.toLowerCase()).toMatch(/crater|rover|plss/);

    // Terrain shielding physically attenuates SPE dose rate during subsequent ticks
    sim.advanceTo(eng.getTime() + 15, 5);
    expect(eng.getLiveState().indicators.dose_rate.value).toBeLessThan(beforeDose * 0.65);

    // Voice silence command marks active alert acknowledged/silenced
    await controller.ask("Mute alarm");
    expect(eng.getLiveState().activeAlerts.every((a) => a.state === "acknowledged")).toBe(true);
  });

  it("V-17: triggerLiveEvent produces immediate hazard onset across S-02, S-03, S-14, S-06 & catalogue lists >=14 scenarios", () => {
    expect(PRESET_CATALOGUE.length).toBeGreaterThanOrEqual(14);
    expect(PRESET_CATALOGUE.some((p) => p.code === "S-03" && !p.name.toLowerCase().includes("preset"))).toBe(true);

    for (const id of ["S-02", "S-03", "S-14", "S-06"]) {
      const eng = new CrewHealthEngine();
      const sim = new MissionSimulator(eng);
      sim.enterEvaSurface();
      sim.triggerLiveEvent(id);
      sim.advanceTo(eng.getTime() + 2, 1);
      expect(eng.getLiveState().activeAlerts.length).toBeGreaterThan(0);
    }
  });

  it("V-18: Operations manual lookup covers NASA-STD-3001 limits and Plan B contingency topics", () => {
    for (const topic of [
      "radiation_spe",
      "suit_depressurization",
      "co2_scrubber",
      "hypoxia_pio2",
      "exertion_cardio",
      "all_limits",
    ]) {
      const doc = lookupManualTopic(topic);
      expect(doc.length).toBeGreaterThan(40);
    }
  });
});
