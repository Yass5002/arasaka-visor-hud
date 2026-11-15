/**
 * Operations Manual & NASA-STD-3001 Reference Knowledge Base
 * Distilled from ARASAKA-CONOPS-001, ARASAKA-ENG-001, and ARASAKA-SIM-001.
 */

export const MANUAL_CORE_BRIEF = `=== FLIGHT OPERATIONS & NASA-STD-3001 MANUAL (CORE) ===
MISSION PROFILE:
- Mars surface mission with surface walks, habitat living, and transit (up to 1000 days).
- Earth radio delay is 3 to 22 minutes one way (about 12 minutes in this simulation), with blackouts and no emergency evacuation. On-board crew health guidance must stand on its own.

ALERT LEVELS (ISS Caution & Warning System [R12]):
- Class 0 (Normal): Within safe limits. Stay quiet unless the crew talks to you.
- Class 3 (Watch): Nearing a limit or slow trend. Give one calm heads-up.
- Class 2 (Warning): Limit crossed or harmful trend. Tell the crew what to fix right away.
- Class 1 (Emergency): Immediate danger. Give the critical survival step first, one step at a time.

HARD DATA & SAFETY RULES (ARASAKA-ENG-001):
1. NEVER diagnose clinically. Use plain observational wording ("readings point to" or "numbers are consistent with"), never "you have".
2. ALWAYS call live engine tools before quoting numbers. Never guess or invent data.
3. When quoting numbers in Q&A, state whether they are measured or estimated, include uncertainty for modelled items, and give mission clock time if helpful.
4. Keep slow long-term trends (bone density, immune score, focus drift, vision risk) off emergency alerts unless asked or directly relevant.
5. Bone scans (DXA) remain the official clinical record; modelled numbers are mission estimates.
6. Suggest messaging the medical team (12-minute Earth delay) ONLY when escalation triggers apply (career radiation >= 90%, blurry vision symptom, persistent standing blood pressure drop, unresponsive crew, or unrecovered suit/oxygen emergency).`;

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
  radiation_spe: `RADIATION & SOLAR STORM PLAYBOOK [V1 4030, V1 4031, V2 6164, R2]:
- Thresholds: Mars surface normal background < 0.9 mSv/day (Demo baseline ~0.35 to 0.6 mSv/d). Solar storm triggers >= 1.2 mSv/day or solar flag active. Event design goal < 250 mSv. Career limit: 600 mSv total (Watch at 75%, Warning & medical call at 90%).
- Plan A (Standard): Stop outdoor work and head straight inside the habitat shelter, seal airlock, monitor until storm fades.
- Plan B (Cannot reach habitat in time):
  1. Call 'execute_suit_action("engage_terrain_shield")' and 'update_action_plan'.
  2. Tell the crew to drop behind the nearest crater cliff wall, rock overhang, boulder shadow, trench, or rover body within seconds.
  3. Orient the water-filled suit backpack (PLSS) toward the Sun while staying low against rock mass to block particle flux (~80% drop).
- Plan C (Flat open ground, no rocks or rover): Dig a shallow depression or mound surface regolith beside the body, lie flat behind the backpack facing the Sun, and hold still until radiation drops.`,

  suit_depressurization: `SUIT DEPRESSURIZATION & SEAL LEAK PLAYBOOK [V2 6006, S-14]:
- Thresholds: Normal EVA suit pressure ~43.0 kPa; safety floor 29.6 kPa (Class 2 below 29.6 kPa; Class 1 emergency below 25.6 kPa). Lower suit pressure drops inspired oxygen sharply.
- Plan A (Standard): Check glove wrist rings, neck latch, and air hose locks, tighten loose latches, and head inside.
- Plan B (Active leak or far from airlock):
  1. Call 'execute_suit_action("switch_secondary_o2")' if oxygen dips, and guide crew to clamp or press gloved hand/patch firmly over leak or stuck purge valve.
  2. Invoke 'execute_suit_action("seal_suit_breach")' once clamped and update plan via 'update_action_plan'.
- Plan C (Patch failing or large rip): Switch to backup oxygen, pinch off/isolate the torn cuff if safe, freeze movement to conserve gas, and call habitat pickup.`,

  co2_scrubber: `CO2 BUILDUP & SCRUBBER PLAYBOOK [V2 6004, R4]:
- Thresholds: 1-hour average carbon dioxide limit <= 3.0 mmHg (Watch at 2.4 mmHg, Warning at 3.0 mmHg). Elevated CO2 slows thinking and reaction time.
- Plan A (Standard): Check CO2 scrubber loop, fan airflow, and switch to fresh air or backup loop.
- Plan B (Jammed scrubber outdoors):
  1. Tell crew to stop hard physical effort immediately (cuts CO2 output).
  2. Invoke 'execute_suit_action("open_loop_o2_purge")' to flush the helmet with fresh oxygen and update HUD via 'update_action_plan'.`,

  hypoxia_pio2: `OXYGEN DROP / HYPOXIA PLAYBOOK [V2 6003, R16]:
- Thresholds: Normal breathing oxygen 145 to 155 mmHg; Watch < 145 mmHg; Mild low-oxygen floor < 127 mmHg; Emergency < 110 mmHg.
- Immediate Action: Call 'execute_suit_action("switch_secondary_o2")' as the crew switches to the backup oxygen bottle, stop walking hard, check helmet seal, and update HUD via 'update_action_plan'.`,

  exertion_cardio: `HEART RATE & EFFORT PLAYBOOK [ENG-CTX-001..003]:
- Expected heart rate limits (45-year-old baseline resting 58 bpm): Sleep/Rest/Cabin <= 100 bpm; Exercise/EVA walk <= 149 bpm. 140 bpm during exercise or 138 bpm climbing outside stays quiet because effort is expected.
- Overexertion: If HR > 149 bpm on EVA, stop moving, rest two minutes, sip water from the helmet drink tube, and call 'execute_suit_action("rest_recovery_mode")'.`,

  orthostatic: `DIZZINESS / BLOOD PRESSURE DROP PLAYBOOK [S-05]:
- Trigger: Standing blood pressure drop >= 20 mmHg after a spacewalk or weeks of lower gravity.
- Action: Sit or lie down right away so you do not faint, drink electrolyte fluids, rest 5 minutes, and recheck. Message the medical team if dizziness keeps returning.`,

  sleep_circadian: `SLEEP LOSS PLAYBOOK [S-06, R6]:
- Basis: Crew baseline 7.0 hours/night (Watch triggers if 7-night average drops >= 0.75 hours short).
- Action: Dim habitat lights 90 minutes before bed, protect a full 8-hour sleep block tonight, and avoid late caffeine.`,

  bone_exercise: `BONE DENSITY & WORKOUT PLAYBOOK [ENG 5.1, R7]:
- Reference rates (Sibonga DXA data): Spine loses ~1.06%/mo unmitigated; hip ~1.15%/mo. Strength training cuts loss roughly in half.
- Note: Hospital/habitat DXA scans remain the official measurement of record; model outputs carry uncertainty ranges.`,

  immune_sans: `IMMUNE & VISION PLAYBOOK [ENG 5.2, R8, R9, R19]:
- Immune score (0 to 100): Tracks combined sleep debt, stress, cortisol, and radiation. Alerts at <= 70. Prioritize rest and sleep recovery.
- Vision (SANS): Fluid shifts in low gravity can flatten the back of the eye over months (~66% show early signs on ISS; 16 to 19% optic disc swelling [R9, R19]). Log blurry near vision, run a simple chart test, and send a note to the medical team.`,

  all_limits: `NASA-STD-3001 & SUIT LIMITS SUMMARY:
- Career radiation limit: 600 mSv (Watch 75%, Warning 90%).
- Solar storm alert: >= 1.2 mSv/day (Design event cap 250 mSv).
- Carbon dioxide (1-hour average): <= 3.0 mmHg (Watch 2.4 mmHg).
- Breathing oxygen (PIO2): Normal 145 to 155 mmHg; Low < 127 mmHg; Emergency < 110 mmHg.
- Pressure: Cabin 26.2 to 103 kPa (nominal 70 kPa); Suit 29.6 to 45 kPa (nominal 43 kPa, Emergency < 25.6 kPa).
- Heart rate limit: 100 bpm resting inside, 149 bpm during exercise or spacewalk.`,
};

export function lookupManualTopic(topic: string): string {
  const key = topic.trim().toLowerCase() as ManualTopic;
  if (key in MANUAL_PLAYBOOKS) {
    return MANUAL_PLAYBOOKS[key];
  }
  return MANUAL_PLAYBOOKS.all_limits;
}
