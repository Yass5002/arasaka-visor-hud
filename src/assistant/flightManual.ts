/**
 * Authoritative Operations Manual & NASA-STD-3001 Reference Knowledge Base
 * distilled directly from:
 * - ARASAKA-CONOPS-001 (Concept of Operations v0.2)
 * - ARASAKA-ENG-001 (Engine Specification v0.2)
 * - ARASAKA-SIM-001 (Simulation and Demonstration Plan v0.3)
 */

export const MANUAL_CORE_BRIEF = `=== ARASAKA FLIGHT OPERATIONS & NASA-STD-3001 MANUAL (CORE) ===
MISSION PROFILE:
- Long-duration Earth-independent Mars mission (surface EVA + habitat + transit; up to 1000 days).
- Earth one-way light delay: 3 to 22 minutes (nominal demo: 12 min [R15, R17]); periodic blackouts occur. Zero emergency evacuation or sample return [R7, R8]. Crew health autonomy is paramount.

ALERT SYSTEM (ISS Caution & Warning Classes [R12]):
- Class 0 (Nominal): Within limits. Silent unless crew asks.
- Class 3 (Advisory): Approaching limit / slow trend — single calm notice.
- Class 2 (Caution & Warning): Limit exceeded or harmful trend — immediate corrective action.
- Class 1 (Emergency): Immediate life threat — immediate survival action, step by step.

HARD DATA & SAFETY RULES (ARASAKA-ENG-001):
1. NEVER diagnose clinically. Use observational/risk wording ("readings are consistent with", "indicates risk of") — never say "you have".
2. ALWAYS call live engine tools before citing numbers. Never invent metrics.
3. When citing numeric values in Q&A, note whether measured (sensed) or estimated (modelled), include uncertainty for modelled items, and cite mission clock if relevant.
4. Keep slow modelled indices (bone loss, immune_index, cognitive_drift, sans_risk) off emergency visor alarms unless asked or directly pertinent.
5. DXA / QCT scans are the measurement of record for bone mineral density; engine values are trajectory estimates.
6. Advise contacting Habitat CMO or Flight Surgeon (~12 min one-way delay) ONLY when escalation criteria apply (career dose >=90%, SANS vision symptom, orthostatic drop persisting, unresponsive crew, severe unrecovered hypoxia/breach).`;

export type ManualTopic =
  | "radiation_spe"
  | "suit_depressurization"
  | "co2_scrubber"
  | "hypoxia_pio2"
  | "exertion_cardio"
  | "orthostatic"
  | "sleep_circadian"
  | "bone_exercise"
  | "immune_sans"
  | "all_limits";

export const MANUAL_PLAYBOOKS: Record<ManualTopic, string> = {
  radiation_spe: `RADIATION & SOLAR PARTICLE EVENT (SPE) PLAYBOOK [V1 4030, V1 4031, V1 4033, V2 6164, R2]:
- Thresholds: Mars surface galactic baseline design < 0.9 mSv/day (Demo baseline 0.6 mSv/d; ISS observed 0.2-0.5 mSv/d). SPE alert fires >= 1.2 mSv/day (2x baseline) or > 0.9 mSv/d with solar_event_flag. Design reference SPE: stay below 250 mSv effective dose. Career limit (all ages/sexes): < 600 mSv (Class 3 at 75%, Class 2 at 90% -> escalate to Flight Surgeon).
- Plan A (Standard): Terminate EVA immediately, move inside shielded habitat core, seal airlock, monitor dosimetry until flare decays (~40 mSv over 6h unshielded curve). Real-time alert dosimetry protects EVA crews when terminated < 2h and shielding is accessible.
- Plan B (Stranded / Cannot reach habitat in time):
  1. Immediately invoke 'execute_suit_action("engage_terrain_shield")' and 'update_action_plan' once Sir confirms cover.
  2. Direct crew to the nearest high-mass terrain shielding within seconds: crater cliff wall, basalt boulder overhang, lava tube entrance, trench/regolith berm, or pressurized/unpressurized rover shadow.
  3. Instruct crew to orient PLSS life-support backpack (water tank & batteries) toward the sun/flare vector while crouching low against rock mass to maximize hydrogenous/rock attenuation (~80% dose reduction).
  4. Never keep repeating habitat return once Sir is pinned or too far — stabilize in field cover until flux drops.`,

  suit_depressurization: `SUIT DEPRESSURIZATION / SEAL BREACH PLAYBOOK [V2 6006, EVA-P1]:
- Thresholds: EVA suit nominal pressure ~43.0 kPa; EVA safety floor 29.6 kPa (Class 2 below 29.6 or < 34.5 warning; Class 1 emergency below 25.6 kPa). Cabin indefinite floor > 26.2 kPa (max 103 kPa; nominal 70 kPa). Note: Dropping suit barometric pressure sharply lowers inspired PIO2 = (P_mmHg - 47) * F_O2.
- Plan A (Standard): Inspect glove wrist disconnects, neck ring latch, and PLSS Umbilical; tighten/reseat locking collar; abort EVA to airlock.
- Plan B (Active Leak / Far from Airlock):
  1. Call 'execute_suit_action("switch_secondary_o2")' to maintain partial O2 pressure if PIO2 dips, and guide crew to press gloved hand/thigh/patch tightly over suspected breach or check purge valve stuck open.
  2. Once crew identifies/seals or clamps bypass valve, invoke 'execute_suit_action("seal_suit_breach")' and update plan via 'update_action_plan'.
  3. Order crew to freeze excess motion (lowers O2 burn), keep comms minimal, and return carefully if pressure holds >= 35 kPa.`,

  co2_scrubber: `CO2 BUILDUP / SCRUBBER SATURATION PLAYBOOK [V2 6004, R4]:
- Thresholds: Habitable volume 1-hour time-weighted average ppCO2 limit <= 3.0 mmHg (Class 3 advisory at 2.4 mmHg [80% of limit], Class 2 caution at 3.0 mmHg). Cognitive slowing (reaction time +15%) accompanies rising ppCO2.
- Plan A (Standard): Verify LiOH / regenerable CO2 scrubber cartridge & fan airflow; switch to ventilated module or backup loop.
- Plan B (EVA Jammed Scrubber / Far from Habitat):
  1. Immediately order crew to STOP strenuous work (minimizes CO2 production).
  2. Invoke 'execute_suit_action("open_loop_o2_purge")' to flush helmet loop with fresh O2 when Sir switches to purge/bypass valve, and update HUD plan via 'update_action_plan'.`,

  hypoxia_pio2: `HYPOXIA / INSPIRED OXYGEN (PIO2) PLAYBOOK [V2 6003, R16]:
- Thresholds: Normoxia target 145-155 mmHg; Class 3 < 145 mmHg; Class 2 mild hypoxia floor < 127 mmHg [R16, max 1 week acceptable duration]; Class 1 severe acute hypoxia < 110 mmHg; Indefinite hyperoxia ceiling 356 mmHg.
- Immediate Action: Call 'execute_suit_action("switch_secondary_o2")' as Sir switches to backup O2 bottle/manifold, halt exertion, verify helmet seal & regulator pressure, and update HUD via 'update_action_plan'.`,

  exertion_cardio: `CARDIOVASCULAR & CONTEXT-AWARE STRAIN PLAYBOOK [ENG-CTX-001..003]:
- Context HR Limits (Demo, 45yo baseline resting 58 bpm): Sleep/Cabin/Rest <= 100 bpm; Exercise/EVA <= 149 bpm (85% age max). HR 140 bpm during scheduled exercise or 138 bpm during EVA climb is EXPECTED and must NOT raise false alarms.
- EVA Overexertion: If HR > 149 bpm with HRV drop (>= 40% under baseline) & high O2 burn, call 'execute_suit_action("rest_recovery_mode")' once crew halts work & hydrates from in-suit drink bag.`,

  orthostatic: `ORTHOSTATIC HYPOTENSION PLAYBOOK [S-05]:
- Trigger: Standing SBP drop >= 20 mmHg post-EVA or post-deconditioning.
- Action: Sit or lie supine immediately to restore cerebral perfusion, ingest 300 mL electrolyte fluid, rest 5 min, recheck. Escalate to Flight Surgeon if persistent.`,

  sleep_circadian: `SLEEP DEBT & CIRCADIAN DRIFT PLAYBOOK [S-06, R6]:
- Basis: Crew baseline 7.0 h/night (NASA ISS actigraphy 6.0-6.5 h average; alert triggers against crewmember's own baseline if 7-night mean shortfall >= 0.75 h).
- Action: Schedule protected 8h sleep block, dim habitat blue light before sleep, avoid heavy EVA during nadir, update sleep reset plan.`,

  bone_exercise: `BONE MINERAL DENSITY & RESISTIVE EXERCISE PLAYBOOK [ENG 5.1, R7]:
- Reference rates (Sibonga DXA, n=16-18): Lumbar 1.06%/mo (SD 0.63), Femoral neck 1.15%/mo (SD 0.84), Trochanter 1.56%/mo (SD 0.99), Pelvis 1.35%/mo (SD 0.54), Total body 0.35%/mo (SD 0.25). Model: B(t+dt) = B(t)*[1 - r*(1 - eps*c(t))*dt], eps=0.5 Demo, c(t) 14-day ARED compliance.
- Critical disclosure: DXA/QCT scans are the measurement of record; model carries uncertainty bands and bisphosphonate co-therapy is not modelled.`,

  immune_sans: `IMMUNE STRESS & SANS PLAYBOOK [ENG 5.2, R8, R9, R19]:
- Immune index (0-100 Demo): Driven by sleep debt, stress, cortisol, cumulative dose. Alerts <= 70. Basis: Latent herpesvirus shedding increased in long flight — VZV DNA in saliva of 15/23 ISS crew (65%), EBV 22/23 (96%), CMV 14/23 (61%), mostly asymptomatic [R8].
- SANS (S-10): About 66% of ISS crew show early SANS signs; 16-19% clinically relevant optic disc edema [R9, R19]. Escalate blurred near vision to Flight Surgeon (~12 min delay), log symptom & visual acuity check.`,

  all_limits: `FULL NASA-STD-3001 & DEMO LIMIT QUICK TABLE:
- Career effective dose: < 600 mSv [V1 4030] (Class 3 @ 75%, Class 2 @ 90%).
- Design SPE event: < 250 mSv [V1 4031]; SPE trigger: >= 1.2 mSv/day [V2 6164 / V1 4033].
- CO2 (ppCO2 1h mean): <= 3.0 mmHg [V2 6004] (Class 3 >= 2.4, Class 2 >= 3.0).
- Inspired O2 (PIO2): Normoxia 145-155 mmHg [V2 6003]; Class 3 < 145; Mild hypoxia < 127 [R16]; Class 1 < 110; Hyperoxia ceiling 356 mmHg.
- Pressure: Cabin 26.2-103 kPa [V2 6006]; EVA suit 29.6-45 kPa (Class 1 < 25.6 kPa).
- Thermal/RH [V2 6012/6013]: 18-27 C, 25-75% RH (performance 20-25 C, 30-60% RH).
- Context HR: 100 bpm (sleep/cabin/rest), 149 bpm (EVA/exercise).`,
};

export function lookupManualTopic(topic: string): string {
  const key = topic.trim().toLowerCase() as ManualTopic;
  if (key in MANUAL_PLAYBOOKS) {
    return MANUAL_PLAYBOOKS[key];
  }
  return MANUAL_PLAYBOOKS.all_limits;
}
