# Mars Suit Assistant (EVA Visor HUD and Health Engine)

Interactive Mars EVA spacesuit helmet simulation and autonomous crew health assistant built for **NASA Space Apps 2026** (Team Arasaka Corp).

- **Live Demo:** https://nasa.yssn.tech
- **Cloud Proxy:** https://nasa-api.yssn.tech (`worker/`)
- **Project Documents:**
  - [Concept of Operations](docs/Arasaka%20Crew%20Health%20Assistant%20Concept%20of%20Operations.pdf)
  - [Engine Specification](docs/Arasaka%20Crew%20Health%20Assistant%20Engine%20Specification.pdf)
  - [Simulation and Demonstration Plan](docs/Arasaka%20Crew%20Health%20Assistant%20Simulation%20and%20Demonstration%20Plan.pdf)
  - [1-Page Pitch Cheat Sheet](docs/Mars_Suit_Assistant_Pitch_Cheat_Sheet.pdf)

---

## Problem Statement

Crewed Mars missions operate under a one-way light-time communication delay of **3 to 22 minutes** (6 to 44 minutes round-trip). During an acute Extravehicular Activity (EVA) failure such as suit depressurization, CO2 scrubber degradation, hypoxia, or a solar particle event, an astronaut cannot wait for Earth-based Mission Control to diagnose telemetry and return instructions.

At the same time, continuous multi-month health monitoring on long-duration surface missions (180 to 1000 days) risks alarm fatigue if slow physiological trends or expected exertion spikes trigger urgent suit alerts.

## System Overview

Mars Suit Assistant separates deterministic safety monitoring from conversational voice interaction:

1. **Deterministic Health and Safety Engine (`src/engine/`):**
   All limit checks, rapid-rise detectors, context adjustments, hysteresis, cooldowns, and alert ranking run in TypeScript. The language model never decides safety thresholds or alert severity.
2. **Closed-Loop Assistant and Voice Interface (`src/assistant/`):**
   Queries live state, historical rollups, event logs, and alert evidence strictly through `AssistantEngineBridge` (`src/engine/assistantApi.ts`), without direct store access. Speaks one concrete action step at a time using Azure Neural TTS (`en-US-EmmaMultilingualNeural` default, with Web Speech API fallback), supports barge-in listening with echo protection, and adapts steps when the astronaut reports obstacles (Plan B/C contingencies).
3. **3D EVA Helmet Visor HUD (`src/components/`, `src/hud/`, `src/three/`):**
   Renders an internal helmet geometry, curved visor glass shader with 16-tap depth-of-field blur, and NASA Perseverance Jezero Crater sky and terrain parallax (`public/mars/`). Peripheral HUD telemetry stays out of the center field of view during nominal operations and surfaces evidence-backed alerts only when action is required.
4. **Telemetry Simulator (`src/sim/`):**
   Streams synthetic environmental, cardiopulmonary, behavioral, and multi-month drift data across 16 preset scenarios (`src/sim/presets.ts`), allowing repeatable testing of acute emergencies, context-filtered false alarms, and concurrent multi-hazard preemption.

---

## Clinical and Engineering Design Rules

- **Alert Priority and Anti-Fatigue:** Alerts are classified from `Class 1` (Emergency) through `Class 3` (Watch/Advisory), with `Class 0` kept silent. Concurrent alerts are sorted by class and shortest time to effect. `Class 1` and `Class 2` events bypass post-clear area cooldowns for safety, while `Class 3` alerts respect cooldown windows and slow modelled drifts remain off the active visor HUD.
- **Activity Context Filtering:** Heart rate limits adjust by activity (`100 bpm` resting/cabin vs `149 bpm` EVA/exercise). Scenario `S-13` (workout at `140 bpm`) stays silent during exercise, whereas `S-13b` fires immediately for the same `140 bpm` reading at rest inside the habitat.
- **Sensed vs. Modelled Transparency:** Every metric (`src/engine/types.ts`, `src/engine/config.ts`) is tagged by origin (`sensed`, `modelled`, `self_reported`, or `source_input`) and basis (`NASA-STD-3001` citation vs `Demo`). Estimated values such as 5-site bone mineral density loss (`BONE_LOSS_TABLE`) and composite indices expose explicit uncertainty bounds, while habitat DXA remains the clinical measurement of record.
- **Append-Only History and Offline Safety:** Samples and logged events persist in an append-only store (`src/engine/store.ts`) with full-resolution retention for recent history and long-term rollups across 180 to 1000-day missions. If cloud connectivity is unavailable, the assistant falls back to deterministic response templates and browser speech synthesis.

---

## Tracked Telemetry and Thresholds

Thresholds combine `NASA-STD-3001` (Volumes 1 and 2 Rev F) limits with labelled demonstration parameters in `src/engine/config.ts`:

| Area | Inputs Monitored | Key Limits / Basis | Source Type |
| :--- | :--- | :--- | :--- |
| **Radiation** | Dose rate (`mSv/day`), SPE flag, cumulative dose | Surface GCR design `< 0.9 mSv/day` (`V1 4033`), SPE trigger `>= 1.8 / 2.0 mSv/day` (`V2 6164`), career limit `600 mSv` (`V1 4030`) | `sensed`, `modelled`, `source_input` |
| **Suit and Cabin Air** | `ppCO2`, `PIO2`, cabin/suit pressure (`kPa`), temp, `%RH` | `ppCO2 <= 3.0 mmHg` (`V2 6004`), `PIO2` `145 to 155 mmHg` (`< 127` mild hypoxia, `< 110` Class 1 demo), EVA suit `29.6 to 56.5 kPa` | `sensed` |
| **Biometrics** | Heart rate, HRV (RMSSD), respiration, O2 rate, BP, ortho drop | HR `<= 100 bpm` rest / `<= 149 bpm` EVA/exercise, HRV `40%` drop watch, standing SBP drop `>= 20 mmHg` | `sensed` |
| **Sleep and Cognition** | Sleep hours, sleep debt, circadian drift, PVT reaction time, stress | 7-day rolling sleep shortfall `>= 0.75 h` (`R6`), stress score `>= 68` | `sensed` |
| **Long-Term Risks** | 5-site bone loss, immune index, cognitive drift, SANS risk, cortisol | Monthly DXA bone loss tables (`1.06% to 1.56%/month`, `R7`) and weighted composite scores with uncertainty ranges | `modelled` |

---

## Tech Stack and Repository Layout

- **Frontend:** React 19, TypeScript 5.7, Vite 6, Three.js 0.174
- **Testing:** Vitest 5.1 (`npm test` runs verification and stress suites)
- **Cloud AI and Voice Proxy:** Cloudflare Worker (`worker/`) forwarding to Azure OpenAI (`gpt-5-4-mini`) and Azure AI Speech (`switzerlandnorth`) so API keys remain server-side
- **Hosting:** Static build deployed to GitHub Pages via `.github/workflows/deploy.yml`

```text
.
├── .github/workflows/deploy.yml   # GitHub Pages build and deploy pipeline
├── docs/                          # ConOps, Engine Spec, Simulation Plan, 1-page Pitch Cheat Sheet
├── public/
│   ├── helmet/                    # Helmet interior texture maps
│   └── mars/                      # Jezero Crater sky, terrain, and depth parallax maps
├── src/
│   ├── assistant/                 # LLM orchestrator, Azure client, voice synthesis/recognition, flight manual
│   ├── components/                # React UI, 3D visor scene, preflight briefing, simulation controls, trends
│   ├── config/                    # Visor shader and optical parameters
│   ├── engine/                    # Deterministic health engine, config, detectors, models, store, tests
│   ├── hud/                       # 2D canvas HUD texture renderer projected onto visor glass
│   ├── services/                  # Startup asset and cloud health preloader
│   ├── sim/                       # 16 scenario presets and multi-timescale Mars telemetry simulator
│   └── three/                     # Three.js helmet geometry, visor optics shader, and DoF composite
└── worker/                        # Cloudflare Worker proxy (wrangler.toml + src/index.ts)
```

---

## Local Development

### Prerequisites

- Node.js 22+ and npm

### Setup and Run

```bash
npm install
npm run dev
```

By default, local development builds proxy requests through `https://nasa-api.yssn.tech` (`vite.config.ts`) or use deterministic offline fallback responses if the proxy is unreachable. To point the frontend at a custom worker URL, set `VITE_PROXY_URL` before building or running:

```bash
VITE_PROXY_URL=http://localhost:8787 npm run dev
```

### Verification and Build

```bash
npm test       # Runs Vitest verification and stress test suites
npm run build  # Type-checks (tsc -b) and builds static bundle into dist/
```

### Optional Cloud Worker Proxy (`worker/`)

To host your own proxy endpoint, configure `worker/wrangler.toml` and set the required Cloudflare Worker secrets:

- `AZURE_OPENAI_KEY`
- `AZURE_SPEECH_KEY`

---

## References and Disclosures

- **Technical Standards:** NASA-STD-3001 Volumes 1 and 2 (incl. Rev F), OCHMO-TB-002, OCHMO-TB-003, OCHMO-TB-004, OCHMO-TB-020, OCHMO-TB-041, NASA ExMC Earth-Independent Medical Operations (EIMO) ConOps. Full citation list is maintained in `src/engine/config.ts` (`MASTER_REFERENCES`).
- **Imagery Credit:** Mars Jezero Crater panorama textures derived from Perseverance rover imagery (`NASA/JPL-Caltech/ASU/MSSS`, Public Domain).
- **Disclaimer:** This software is a student concept demonstrator built for educational and hackathon purposes. All displayed telemetry is simulated. It is not a certified flight system, not a medical device, not for diagnostic or clinical use, and implies no endorsement by NASA.
