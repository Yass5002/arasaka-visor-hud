import * as THREE from "three";
import type { AssistantCaptionState } from "../assistant/assistantController";
import { HUD_CONFIG, VISOR_GLASS_CONFIG } from "../config/visorConfig";
import type { AlertClass, LiveState } from "../engine/types";

/**
 * Dynamic holographic HUD rendered onto an offscreen canvas texture mapped onto
 * the 3D curved visor dome (CONOPS Section 4 & ARASAKA-SIM-001 SIM-HUD-001..005).
 *
 * Strictly driven by Engine `LiveState` + `AssistantCaptionState`:
 * - Center sightline remains unobstructed (no target reticle).
 * - NASA SUITS peripheral layout: radiation/air left, alert/protocol top-right,
 *   mission day/context top-left, suit/cabin pressure & vitals lower-left/center,
 *   voice caption bottom-center, pitch tape right.
 * - Slow modelled indicators (bone_loss_*, immune_index, cognitive_drift, sans_risk)
 *   are kept off the visor alert/gauge surfaces (SIM-HUD-001).
 */
export class HudCanvasRenderer {
  public readonly canvas: HTMLCanvasElement;
  public readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private lastDrawTime = -1;
  private readonly minFrameIntervalMs: number;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = HUD_CONFIG.canvasW;
    this.canvas.height = HUD_CONFIG.canvasH;
    this.ctx = this.canvas.getContext("2d")!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    this.minFrameIntervalMs = 1000 / VISOR_GLASS_CONFIG.hudTexture.updateFps;
  }

  private getAlertColors(alertClass: AlertClass): {
    stroke: string;
    glow: string;
    fill: string;
    text: string;
  } {
    switch (alertClass) {
      case 1:
        return {
          stroke: "#ff4828",
          glow: "rgba(255, 72, 40, 0.90)",
          fill: "rgba(221, 54, 28, 0.24)",
          text: "#ffb8ad",
        };
      case 2:
        return {
          stroke: "#ff4828",
          glow: "rgba(255, 72, 40, 0.72)",
          fill: "rgba(221, 54, 28, 0.16)",
          text: "#ffc4b8",
        };
      case 3:
        return {
          stroke: "#ffb84d",
          glow: "rgba(255, 184, 77, 0.70)",
          fill: "rgba(255, 184, 77, 0.14)",
          text: "#ffe2b0",
        };
      default:
        return {
          stroke: HUD_CONFIG.palette.hudCyan,
          glow: HUD_CONFIG.palette.hudCyanGlow,
          fill: "rgba(6, 31, 74, 0.34)",
          text: HUD_CONFIG.palette.hudTextWhite,
        };
    }
  }

  public update(
    nowMs: number,
    elapsedSec: number,
    gazePitchNorm: number,
    liveState: LiveState | null = null,
    captionState: AssistantCaptionState | null = null,
    audioLevels: { speech: number; mic: number } = { speech: 0, mic: 0 }
  ): void {
    if (this.lastDrawTime >= 0 && nowMs - this.lastDrawTime < this.minFrameIntervalMs) {
      return;
    }
    this.lastDrawTime = nowMs;

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const { timings } = HUD_CONFIG;

    ctx.clearRect(0, 0, W, H);

    const bootProgress = Math.min(1, elapsedSec / timings.frameBootSec);
    const breathAlpha = 0.92 + 0.08 * Math.sin(elapsedSec * 1.4);
    const overallClass: AlertClass = liveState?.overallClass ?? 0;
    const overallTheme = this.getAlertColors(overallClass);

    // 0. Subtle peripheral hazard cues (SPE cosmic-ray edge flecks / hypoxia-pressure vignette)
    this.drawPeripheralHazardFX(ctx, W, H, elapsedSec, liveState, captionState);

    // 1. Periodic curved wireframe visor scan sweep
    this.drawScanSweep(ctx, W, H, elapsedSec);

    // 2. Chamfered double-line perimeter brackets
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = overallClass >= 2 ? overallTheme.stroke : HUD_CONFIG.palette.hudCyan;
    ctx.shadowColor = overallClass >= 2 ? overallTheme.glow : HUD_CONFIG.palette.hudCyanGlow;
    ctx.shadowBlur = 7;

    for (const seg of HUD_CONFIG.perimeterPaths) {
      ctx.globalAlpha = seg.alpha * (0.35 + 0.65 * bootProgress) * breathAlpha;
      ctx.lineWidth = seg.lineWidth;
      ctx.beginPath();
      seg.points.forEach(([nx, ny], idx) => {
        const px = nx * W;
        const py = ny * H;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
    ctx.restore();

    // 3. Top-Left: Mission Day, Time, Context & SIMULATED DATA pill
    this.drawMissionHeaderBox(ctx, W, H, elapsedSec, bootProgress, liveState);

    // 4. Top-Right: Ranked Active Alert ("why" line), Queue badge & Unresponsive Beacon
    this.drawRankedAlertBox(ctx, W, H, elapsedSec, bootProgress, liveState, captionState);

    // 5. Left Peripheral Telemetry: Radiation & Atmospheric Readouts
    this.drawLeftEnvironmentalGauges(ctx, W, H, bootProgress, liveState);

    // 6. Lower-Left Peripheral Telemetry: Pressure, Cardio Vitals & Live BPM-synced ECG wave
    this.drawLowerLeftVitalsBox(ctx, W, H, elapsedSec, bootProgress, liveState);

    // 7. Bottom-Center Assistant Caption, Live Interim Transcript & Voice Waveform Strip
    this.drawAssistantCaptionStrip(ctx, W, H, elapsedSec, bootProgress, captionState, audioLevels);

    // 8. Right Pitch-Driven Vertical Elevation Tape
    this.drawAltitudeTape(ctx, W, H, elapsedSec, gazePitchNorm, bootProgress);

    this.texture.needsUpdate = true;
  }

  private drawScanSweep(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number
  ): void {
    const { timings, scanSweep, palette } = HUD_CONFIG;
    let sweepT = -1;
    let sweepAlpha = 0;

    if (
      elapsedSec >= timings.scanSweepStartSec &&
      elapsedSec <= timings.scanSweepStartSec + timings.scanSweepDurationSec
    ) {
      sweepT = (elapsedSec - timings.scanSweepStartSec) / timings.scanSweepDurationSec;
      sweepAlpha = Math.sin(sweepT * Math.PI) * scanSweep.maxAlphaBoot;
    } else {
      const mod = elapsedSec % timings.scanPeriodicIntervalSec;
      if (elapsedSec > 4 && mod < timings.scanSweepDurationSec) {
        sweepT = mod / timings.scanSweepDurationSec;
        sweepAlpha = Math.sin(sweepT * Math.PI) * scanSweep.maxAlphaPeriodic;
      }
    }

    if (sweepAlpha <= 0.01) return;

    const bandW = W * scanSweep.bandWidthRatio;
    const centerX = sweepT * (W + bandW * 2) - bandW;
    const { cols, rows, tiltFactor, lineWidth, bowAmplitudeRatio, verticalCurveRatio } =
      scanSweep;

    const pts: Array<Array<{ x: number; y: number }>> = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      const rowPts: Array<{ x: number; y: number }> = [];
      const bow =
        Math.sin(v * Math.PI) * (W * bowAmplitudeRatio) - (v - 0.5) * W * tiltFactor;
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const x = centerX + (u - 0.5) * bandW + bow;
        const y =
          H * (0.04 + 0.92 * v) +
          Math.sin(u * Math.PI) * (v - 0.5) * (H * verticalCurveRatio);
        rowPts.push({ x, y });
      }
      pts.push(rowPts);
    }

    ctx.save();
    ctx.lineWidth = lineWidth;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p00 = pts[r][c];
        const p10 = pts[r][c + 1];
        const p01 = pts[r + 1][c];
        const p11 = pts[r + 1][c + 1];
        const edgeFade = Math.sin(((c + 0.5) / cols) * Math.PI);
        const alpha = sweepAlpha * edgeFade * 0.72;
        if (alpha <= 0.01) continue;

        ctx.strokeStyle = `rgba(${palette.scanMeshCyanRgb}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.stroke();

        if ((r + c) % 2 === 0) {
          ctx.fillStyle = `rgba(${palette.scanMeshNodesRgb}, ${(alpha * 1.15).toFixed(3)})`;
          ctx.fillRect(p00.x - 1.5, p00.y - 1.5, 3, 3);
        }
      }
    }
    ctx.restore();
  }

  private drawChamferBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    chamfer = 10
  ): void {
    ctx.beginPath();
    ctx.moveTo(x, y + chamfer);
    ctx.lineTo(x + chamfer, y);
    ctx.lineTo(x + w - chamfer, y);
    ctx.lineTo(x + w, y + chamfer);
    ctx.lineTo(x + w - chamfer * 0.6, y + h);
    ctx.lineTo(x + chamfer * 0.6, y + h);
    ctx.closePath();
  }

  private formatClock(timeOfDaySec: number): string {
    const minsTotal = Math.floor(timeOfDaySec / 60);
    const hh = Math.floor(minsTotal / 60) % 24;
    const mm = minsTotal % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  private drawMissionHeaderBox(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number,
    bootProgress: number,
    liveState: LiveState | null
  ): void {
    const x = W * 0.145;
    const y = H * 0.088;
    const w = W * 0.255;
    const h = H * 0.095;
    const overallClass: AlertClass = liveState?.overallClass ?? 0;
    const theme = this.getAlertColors(overallClass);
    const flashMult =
      overallClass === 1 ? 0.62 + 0.38 * Math.sin(elapsedSec * 7.5) : 1;

    ctx.save();
    ctx.globalAlpha = (0.45 + 0.55 * bootProgress) * flashMult;
    this.drawChamferBox(ctx, x, y, w, h, w * 0.032);
    ctx.fillStyle = theme.fill;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = theme.stroke;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 8;
    ctx.stroke();

    const dayStr = liveState
      ? `SOL ${String(liveState.missionDay).padStart(3, "0")} / ${liveState.missionLengthDays}D`
      : "SOL 001 / 180D";
    const clockStr = liveState ? this.formatClock(liveState.timeOfDaySec) : "08:00";
    const ctxStr = liveState ? liveState.context.activity.toUpperCase() : "CABIN";
    const statusLabel =
      overallClass === 1
        ? "CLASS 1 EMERGENCY"
        : overallClass === 2
          ? "CLASS 2 WARNING"
          : overallClass === 3
            ? "CLASS 3 ADVISORY"
            : "NOMINAL";

    ctx.shadowBlur = 0;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = theme.text;
    ctx.font = `700 ${Math.round(H * 0.017)}px "DM Mono", ui-monospace, monospace`;
    ctx.fillText(`${dayStr}  ·  ${clockStr}  ·  ${ctxStr}`, x + w * 0.045, y + h * 0.34);

    // Sub-row: SIMULATED DATA badge + status
    ctx.fillStyle = HUD_CONFIG.palette.hudCyanBright;
    ctx.font = `700 ${Math.round(H * 0.0135)}px "DM Mono", ui-monospace, monospace`;
    ctx.fillText("SIMULATED DATA", x + w * 0.045, y + h * 0.72);

    ctx.textAlign = "right";
    ctx.fillStyle = overallClass === 0 ? "#8de8ff" : theme.stroke;
    ctx.fillText(statusLabel, x + w * 0.955, y + h * 0.72);
    ctx.restore();
  }

  private drawPeripheralHazardFX(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number,
    liveState: LiveState | null,
    captionState: AssistantCaptionState | null
  ): void {
    if (!liveState) return;
    const pio2 = liveState.indicators.pio2.value;
    const suitP = liveState.indicators.suit_pressure.value;
    const doseRate = liveState.indicators.dose_rate.value;
    const isUnresponsive = Boolean(captionState?.unresponsiveEscalated);

    // Hypoxia / Pressure Breach / Emergency red-amber peripheral edge glow (keeps center clear)
    if (pio2 < 132 || suitP < 31 || isUnresponsive) {
      const pulse = 0.38 + 0.3 * Math.sin(elapsedSec * (isUnresponsive ? 7.5 : 4.2));
      const grad = ctx.createRadialGradient(
        W * 0.5,
        H * 0.5,
        W * 0.34,
        W * 0.5,
        H * 0.5,
        W * 0.62
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(221, 54, 28, ${(0.28 * pulse).toFixed(3)})`);
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Subtle cosmic-ray peripheral edge speckles during elevated SPE radiation storm
    if (doseRate > 2.5) {
      const count = Math.min(28, Math.round(doseRate / 8) + 6);
      ctx.save();
      for (let i = 0; i < count; i++) {
        const seed = Math.floor(elapsedSec * 18) * 131 + i * 7919;
        const rx = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
        const ry = ((Math.sin(seed * 78.233) * 43758.5453) % 1 + 1) % 1;
        // Restrict strictly to outer 22% margin so center FOV stays spotless
        const inCenter = rx > 0.22 && rx < 0.78 && ry > 0.22 && ry < 0.78;
        if (inCenter) continue;
        ctx.fillStyle = "rgba(255, 224, 150, 0.55)";
        ctx.fillRect(rx * W, ry * H, 2 + (i % 3) * 2, 1.5);
      }
      ctx.restore();
    }
  }

  private drawRankedAlertBox(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number,
    bootProgress: number,
    liveState: LiveState | null,
    captionState: AssistantCaptionState | null
  ): void {
    const x = W * 0.565;
    const y = H * 0.088;
    const w = W * 0.295;
    const primary = liveState?.rankedPrimaryAlert ?? null;
    const protocol = liveState?.activeProtocol;
    const escalated = Boolean(captionState?.unresponsiveEscalated);
    const alertClass: AlertClass = escalated ? 1 : (primary?.class ?? 0);
    const theme = this.getAlertColors(alertClass);
    const h = primary || escalated ? H * 0.132 : H * 0.072;
    const pulse =
      alertClass === 1
        ? 0.52 + 0.48 * Math.sin(elapsedSec * 9.0)
        : alertClass === 2
          ? 0.78 + 0.22 * Math.sin(elapsedSec * 4.5)
          : 1;

    ctx.save();
    ctx.globalAlpha = (0.45 + 0.55 * bootProgress) * pulse;
    this.drawChamferBox(ctx, x, y, w, h, w * 0.028);
    ctx.fillStyle = theme.fill;
    ctx.fill();
    ctx.lineWidth = alertClass >= 2 || escalated ? 2.1 : 1.4;
    ctx.strokeStyle = theme.stroke;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = alertClass >= 2 || escalated ? 12 : 6;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    if (!primary && !escalated) {
      ctx.fillStyle = HUD_CONFIG.palette.hudCyanBright;
      ctx.font = `700 ${Math.round(H * 0.0155)}px "DM Mono", ui-monospace, monospace`;
      ctx.fillText("SYSTEM WATCH · NO ACTIVE ALERTS", x + w * 0.045, y + h * 0.5);
      ctx.restore();
      return;
    }

    // Line 1: Class badge & title + Queued count pill
    ctx.fillStyle = theme.stroke;
    ctx.font = `800 ${Math.round(H * 0.016)}px "DM Mono", ui-monospace, monospace`;
    const headStr = escalated
      ? "CREW UNRESPONSIVE · HAILING HABITAT"
      : `CLASS ${primary!.class} · ${primary!.title}`;
    ctx.fillText(this.truncateText(ctx, headStr, w * 0.68), x + w * 0.045, y + h * 0.23);

    const queuedCount = Math.max(
      liveState?.pausedProtocols?.length ?? 0,
      Math.max(0, (liveState?.activeAlerts.length ?? 1) - 1)
    );
    if (queuedCount > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffb84d";
      ctx.font = `700 ${Math.round(H * 0.0125)}px "DM Mono", ui-monospace, monospace`;
      ctx.fillText(`+${queuedCount} QUEUED`, x + w * 0.955, y + h * 0.23);
      ctx.textAlign = "left";
    }

    // Line 2: Mandatory "why" evidence line or escalation delay status
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${Math.round(H * 0.014)}px "Public Sans", sans-serif`;
    const whyText = escalated
      ? "No crew confirmation >75 s · Telemetry packet queued (~12 min delay)"
      : this.truncateText(ctx, primary!.whyLine, w * 0.90);
    ctx.fillText(whyText, x + w * 0.045, y + h * 0.53);

    // Line 3: Protocol step prompt (or AI-adapted Plan B) or top suggested action
    ctx.fillStyle = protocol?.contingencyTitle ? "#ffb84d" : theme.text;
    ctx.font = `600 ${Math.round(H * 0.0132)}px "DM Mono", ui-monospace, monospace`;
    const actionLine =
      protocol && !protocol.completed
        ? protocol.contingencyTitle
          ? `${protocol.contingencyTitle}: ${protocol.currentStep.instruction}`
          : `STEP ${protocol.currentStepIndex + 1}/${protocol.totalSteps}: ${protocol.currentStep.instruction}`
        : primary?.suggestedActions[0] ?? "Say CONFIRM or acknowledge immediately";
    ctx.fillText(this.truncateText(ctx, actionLine, w * 0.90), x + w * 0.045, y + h * 0.81);
    ctx.restore();
  }

  private drawLeftEnvironmentalGauges(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    bootProgress: number,
    liveState: LiveState | null
  ): void {
    const startX = W * 0.135;
    const startY = H * 0.255;
    const cardW = W * 0.165;
    const rowH = H * 0.064;
    const gap = H * 0.012;

    const doseRate = liveState?.indicators.dose_rate;
    const doseCum = liveState?.indicators.dose_cumulative;
    const ppco2 = liveState?.indicators.ppco2;
    const pio2 = liveState?.indicators.pio2;

    const rows: Array<{
      label: string;
      valStr: string;
      subStr: string;
      ratio: number;
      alertClass: AlertClass;
    }> = [
      {
        label: "DOSE RATE",
        valStr: `${(doseRate?.value ?? 0.6).toFixed(2)} mSv/d`,
        subStr: "REF 0.90 GCR",
        ratio: Math.min(1, (doseRate?.value ?? 0.6) / 3.0),
        alertClass: doseRate?.alertClass ?? 0,
      },
      {
        label: "CAREER DOSE",
        valStr: `${(liveState?.careerDosePercent ?? 25).toFixed(1)}%`,
        subStr: `${(doseCum?.value ?? 150).toFixed(1)} / 600 mSv`,
        ratio: Math.min(1, (liveState?.careerDosePercent ?? 25) / 100),
        alertClass: doseCum?.alertClass ?? 0,
      },
      {
        label: "ppCO₂",
        valStr: `${(ppco2?.value ?? 1.5).toFixed(2)} mmHg`,
        subStr: "1H LIMIT 3.0",
        ratio: Math.min(1, (ppco2?.value ?? 1.5) / 4.0),
        alertClass: ppco2?.alertClass ?? 0,
      },
      {
        label: "PIO₂",
        valStr: `${Math.round(pio2?.value ?? 150)} mmHg`,
        subStr: "TARGET 145–155",
        ratio: Math.min(1, (pio2?.value ?? 150) / 180),
        alertClass: pio2?.alertClass ?? 0,
      },
    ];

    ctx.save();
    ctx.globalAlpha = 0.4 + 0.6 * bootProgress;
    rows.forEach((row, idx) => {
      const y = startY + idx * (rowH + gap);
      const theme = this.getAlertColors(row.alertClass);

      this.drawChamferBox(ctx, startX, y, cardW, rowH, 7);
      ctx.fillStyle = row.alertClass > 0 ? theme.fill : "rgba(6, 20, 46, 0.44)";
      ctx.fill();
      ctx.lineWidth = row.alertClass > 0 ? 1.8 : 1.1;
      ctx.strokeStyle = theme.stroke;
      ctx.stroke();

      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillStyle = "#b9e6ff";
      ctx.font = `700 ${Math.round(H * 0.0125)}px "DM Mono", ui-monospace, monospace`;
      ctx.fillText(row.label, startX + cardW * 0.06, y + rowH * 0.28);

      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${Math.round(H * 0.0165)}px "DM Mono", ui-monospace, monospace`;
      ctx.fillText(row.valStr, startX + cardW * 0.94, y + rowH * 0.30);

      // Bar gauge
      const barX = startX + cardW * 0.06;
      const barY = y + rowH * 0.56;
      const barW = cardW * 0.88;
      const barH = Math.max(4, H * 0.0055);
      ctx.fillStyle = "rgba(150, 194, 255, 0.16)";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = row.alertClass > 0 ? theme.stroke : "#2ef2ff";
      ctx.fillRect(barX, barY, Math.max(3, barW * row.ratio), barH);

      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(200, 232, 255, 0.72)";
      ctx.font = `600 ${Math.round(H * 0.011)}px "DM Mono", ui-monospace, monospace`;
      ctx.fillText(row.subStr, startX + cardW * 0.06, y + rowH * 0.83);
    });
    ctx.restore();
  }

  private drawLowerLeftVitalsBox(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number,
    bootProgress: number,
    liveState: LiveState | null
  ): void {
    const x = W * 0.135;
    const y = H * 0.608;
    const w = W * 0.165;
    const h = H * 0.188;

    const isEva = liveState?.context.activity === "eva";
    const pressInd = isEva
      ? liveState?.indicators.suit_pressure
      : liveState?.indicators.cabin_pressure;
    const hrInd = liveState?.indicators.heart_rate;
    const hrvInd = liveState?.indicators.hrv_rmssd;
    const respInd = liveState?.indicators.respiration_rate;

    const maxClass = Math.max(
      pressInd?.alertClass ?? 0,
      hrInd?.alertClass ?? 0,
      hrvInd?.alertClass ?? 0
    ) as AlertClass;
    const theme = this.getAlertColors(maxClass);

    ctx.save();
    ctx.globalAlpha = 0.4 + 0.6 * bootProgress;
    this.drawChamferBox(ctx, x, y, w, h, 8);
    ctx.fillStyle = maxClass > 0 ? theme.fill : "rgba(6, 20, 46, 0.44)";
    ctx.fill();
    ctx.lineWidth = maxClass > 0 ? 1.8 : 1.1;
    ctx.strokeStyle = theme.stroke;
    ctx.stroke();

    const lines: Array<{ k: string; v: string; cls: AlertClass }> = [
      {
        k: isEva ? "SUIT PRESS" : "CABIN PRESS",
        v: `${(pressInd?.value ?? (isEva ? 43.0 : 70.0)).toFixed(1)} kPa`,
        cls: pressInd?.alertClass ?? 0,
      },
      {
        k: "HEART RATE",
        v: `${Math.round(hrInd?.value ?? 104)} bpm`,
        cls: hrInd?.alertClass ?? 0,
      },
      {
        k: "HRV (RMSSD)",
        v: `${Math.round(hrvInd?.value ?? 48)} ms`,
        cls: hrvInd?.alertClass ?? 0,
      },
      {
        k: "RESPIRATION",
        v: `${Math.round(respInd?.value ?? 20)} br/m`,
        cls: respInd?.alertClass ?? 0,
      },
    ];

    ctx.textBaseline = "middle";
    lines.forEach((line, i) => {
      const ly = y + h * (0.14 + i * 0.19);
      const tLine = this.getAlertColors(line.cls);
      ctx.textAlign = "left";
      ctx.fillStyle = "#96c2ff";
      ctx.font = `700 ${Math.round(H * 0.012)}px "DM Mono", ui-monospace, monospace`;
      ctx.fillText(line.k, x + w * 0.06, ly);

      ctx.textAlign = "right";
      ctx.fillStyle = line.cls > 0 ? tLine.stroke : "#ffffff";
      ctx.font = `700 ${Math.round(H * 0.015)}px "DM Mono", ui-monospace, monospace`;
      ctx.fillText(line.v, x + w * 0.94, ly);
    });

    // Live BPM-synchronized ECG QRS trace along bottom strip of vitals card
    const bpm = Math.max(45, Math.min(200, hrInd?.value ?? 104));
    const beatsPerSec = bpm / 60;
    const ecgX = x + w * 0.06;
    const ecgW = w * 0.88;
    const ecgMidY = y + h * 0.885;
    const ecgAmp = h * 0.07;

    ctx.strokeStyle = maxClass >= 2 ? theme.stroke : "#2ef2ff";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const samples = 44;
    for (let i = 0; i <= samples; i++) {
      const frac = i / samples;
      const phase = ((elapsedSec * beatsPerSec - (1 - frac) * 1.4) % 1 + 1) % 1;
      let wave = 0;
      if (phase > 0.12 && phase < 0.2) wave = 0.22 * Math.sin(((phase - 0.12) / 0.08) * Math.PI);
      else if (phase >= 0.25 && phase < 0.28) wave = -0.25;
      else if (phase >= 0.28 && phase < 0.32) wave = 1.0;
      else if (phase >= 0.32 && phase < 0.36) wave = -0.35;
      else if (phase >= 0.45 && phase < 0.58) wave = 0.26 * Math.sin(((phase - 0.45) / 0.13) * Math.PI);
      const px = ecgX + frac * ecgW;
      const py = ecgMidY - wave * ecgAmp;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawAssistantCaptionStrip(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number,
    bootProgress: number,
    captionState: AssistantCaptionState | null,
    audioLevels: { speech: number; mic: number }
  ): void {
    const x = W * 0.32;
    const y = H * 0.802;
    const w = W * 0.43;
    const h = H * 0.092;

    const voiceOn = captionState?.voiceConnected ?? false;
    const listening = captionState?.isListening ?? false;
    const speaking = captionState?.isSpeaking ?? false;
    const busy = captionState?.isBusy ?? false;
    const interim = captionState?.interimTranscript?.trim() ?? "";

    const captionText = interim
      ? `[CREW LIVE] “${interim}”`
      : captionState?.text ||
        "Monitoring EVA systems, Sir. Ask by voice or type below.";

    const borderColor = listening
      ? "#02bfe7"
      : (captionState?.alertClass ?? 0) >= 2
        ? "#ff4828"
        : HUD_CONFIG.palette.hudCyan;

    ctx.save();
    ctx.globalAlpha = 0.45 + 0.55 * bootProgress;
    this.drawChamferBox(ctx, x, y, w, h, 8);
    ctx.fillStyle = "rgba(6, 20, 46, 0.56)";
    ctx.fill();
    ctx.lineWidth = listening || speaking ? 2.0 : 1.2;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const statusDot = interim
      ? "CREW SPEAKING · LIVE"
      : speaking
        ? "TRANSMITTING AUDIO"
        : listening
          ? `OPEN MIC ACTIVE${".".repeat((Math.floor(elapsedSec * 3) % 3) + 1)}`
          : busy
            ? "PROCESSING..."
            : voiceOn
              ? "SUIT COMMS LIVE"
              : "COMMS MUTED · TEXT MODE";

    ctx.fillStyle = interim || listening ? "#02bfe7" : "#96c2ff";
    ctx.font = `700 ${Math.round(H * 0.0118)}px "DM Mono", ui-monospace, monospace`;
    ctx.fillText(
      `ARASAKA (${captionState?.speaker ?? "ASSISTANT"}) · ${statusDot}`,
      x + w * 0.035,
      y + h * 0.24
    );

    // Live audio visualizer bars on right side of caption header
    const bars = 12;
    const activeAmp = speaking
      ? Math.max(0.25, audioLevels.speech)
      : listening
        ? Math.max(0.12, audioLevels.mic)
        : 0.06;
    const barsW = w * 0.14;
    const barsStartX = x + w * 0.825;
    const barGap = barsW / bars;
    for (let b = 0; b < bars; b++) {
      const wave =
        0.35 + 0.65 * Math.abs(Math.sin(elapsedSec * (speaking ? 14 : 6) + b * 0.85));
      const bh = Math.max(2, activeAmp * wave * h * 0.22);
      ctx.fillStyle = speaking ? "#38ef7d" : listening ? "#02bfe7" : "rgba(150, 194, 255, 0.35)";
      ctx.fillRect(barsStartX + b * barGap, y + h * 0.24 - bh * 0.5, Math.max(2, barGap * 0.55), bh);
    }

    ctx.fillStyle = interim ? "#b9f4ff" : "#ffffff";
    ctx.font = `500 ${Math.round(H * 0.0145)}px "Public Sans", sans-serif`;
    const wrapped = this.wrapText(ctx, captionText, w * 0.93, 2);
    wrapped.forEach((line, idx) => {
      ctx.fillText(line, x + w * 0.035, y + h * (0.55 + idx * 0.26));
    });
    ctx.restore();
  }

  private drawAltitudeTape(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number,
    gazePitchNorm: number,
    bootProgress: number
  ): void {
    const { altitudeTape, palette } = HUD_CONFIG;
    const x = altitudeTape.x * W;
    const topY = altitudeTape.topY * H;
    const bottomY = altitudeTape.bottomY * H;
    const span = bottomY - topY;
    const midY = (topY + bottomY) * 0.5;

    const shiftPx =
      gazePitchNorm * (H * altitudeTape.pitchSensitivityPxRatio) +
      Math.sin(elapsedSec * altitudeTape.idleWaveFreqRad) * (H * altitudeTape.idleWaveAmpPxRatio);

    ctx.save();
    ctx.globalAlpha = 0.4 + 0.6 * bootProgress;
    ctx.strokeStyle = palette.hudCyan;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(x - W * 0.06, topY, W * 0.08, span);
    ctx.clip();

    const step = span / altitudeTape.tickCount;
    const fontPx = Math.round(H * altitudeTape.tickLabelFontRatio);
    ctx.font = `600 ${fontPx}px "DM Mono", ui-monospace, monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = -8; i <= altitudeTape.tickCount + 8; i++) {
      const ty = topY + i * step + shiftPx;
      if (ty < topY - step || ty > bottomY + step) continue;
      const major = i % 5 === 0;
      const tickLen = major ? W * 0.009 : W * 0.0045;

      ctx.strokeStyle = palette.hudCyanBright;
      ctx.globalAlpha = major ? 0.9 : 0.48;
      ctx.lineWidth = major ? 1.4 : 0.9;
      ctx.beginPath();
      ctx.moveTo(x - tickLen, ty);
      ctx.lineTo(x, ty);
      ctx.stroke();

      if (major) {
        const val = (
          altitudeTape.baseValue +
          (altitudeTape.tickCount / 2 - i) * altitudeTape.valueStepPerTick
        ).toFixed(2);
        ctx.fillStyle = palette.hudTextWhite;
        ctx.fillText(val, x - W * 0.013, ty);
      }
    }
    ctx.restore();

    const ptr = W * 0.006;
    ctx.fillStyle = palette.hudTextWhite;
    ctx.beginPath();
    ctx.moveTo(x + W * 0.003, midY);
    ctx.lineTo(x + W * 0.003 + ptr, midY - ptr * 0.55);
    ctx.lineTo(x + W * 0.003 + ptr, midY + ptr * 0.55);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private truncateText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let trimmed = text;
    while (trimmed.length > 4 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed}…`;
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number
  ): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";

    for (const w of words) {
      const next = current ? `${current} ${w}` : w;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = w;
        if (lines.length >= maxLines - 1) {
          break;
        }
      }
    }
    if (current && lines.length < maxLines) {
      lines.push(this.truncateText(ctx, current, maxWidth));
    }
    return lines;
  }

  public dispose(): void {
    this.texture.dispose();
  }
}
