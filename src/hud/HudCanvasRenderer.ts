import * as THREE from "three";
import { HUD_CONFIG, VISOR_GLASS_CONFIG } from "../config/visorConfig";

interface StreamLineSpec {
  wRatio: number;
  indentRatio: number;
  bright: boolean;
}

/**
 * Renders the complete dynamic holographic HUD onto an offscreen canvas texture
 * mapped rigidly onto the 3D curved visor glass dome.
 * - No center target reticle/aim
 * - All telemetry, bars, hex tabs, alert pulses, streams, altitude tape, and scan mesh
 *   are animated every tick and driven solely by HUD_CONFIG.
 */
export class HudCanvasRenderer {
  public readonly canvas: HTMLCanvasElement;
  public readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly streamLines: StreamLineSpec[];
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

    const { lineCount } = HUD_CONFIG.cornerStreams;
    this.streamLines = [];
    for (let i = 0; i < lineCount; i++) {
      const seed = Math.sin(i * 12.9898) * 43758.5453;
      const frac = seed - Math.floor(seed);
      this.streamLines.push({
        wRatio: 0.24 + frac * 0.56,
        indentRatio: i % 5 === 0 ? 0 : 0.06 + (i % 3) * 0.045,
        bright: i % 4 === 0,
      });
    }
  }

  public update(nowMs: number, elapsedSec: number, gazePitchNorm: number): void {
    if (this.lastDrawTime >= 0 && nowMs - this.lastDrawTime < this.minFrameIntervalMs) {
      return;
    }
    this.lastDrawTime = nowMs;

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const { palette, timings } = HUD_CONFIG;

    ctx.clearRect(0, 0, W, H);

    const bootProgress = Math.min(1, elapsedSec / timings.frameBootSec);
    const breathAlpha = 0.92 + 0.08 * Math.sin(elapsedSec * 1.4);

    // 1. Periodic sweeping curved triangulated wireframe scan mesh
    this.drawScanSweep(ctx, W, H, elapsedSec);

    // 2. Chamfered double-line perimeter brackets
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = palette.hudCyan;
    ctx.shadowColor = palette.hudCyanGlow;
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

    // 3. Top-left Hex Address Telemetry Tab
    this.drawTopLeftHexBox(ctx, W, H, nowMs, bootProgress);

    // 4. Top-right HIGH RAD DETECTED Warning Tab
    this.drawTopRightAlertBox(ctx, W, H, elapsedSec, bootProgress);

    // 5. Left Dynamic 5-Bar Oscillating Histogram + Timeline Axis
    this.drawLeftHistogram(ctx, W, H, elapsedSec);

    // 6. Left-bottom UNIT 01 / 02 / 03 Coordinates & Numeric Telemetry Stack
    this.drawUnitBlock(ctx, W, H, elapsedSec, bootProgress);

    // 7. Bottom-left & Bottom-right Angled Scrolling Code-Stream Panels
    this.drawCornerStreams(ctx, W, H, elapsedSec, bootProgress);

    // 8. Bottom-center O2 & ATM Life-Support Bars
    this.drawVitals(ctx, W, H, elapsedSec);

    // 9. Right Pitch-Driven Vertical Elevation / Altitude Tape
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
        const y = H * (0.04 + 0.92 * v) + Math.sin(u * Math.PI) * (v - 0.5) * (H * verticalCurveRatio);
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

  private drawTopLeftHexBox(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    nowMs: number,
    bootProgress: number
  ): void {
    const { topLeftBox, hexAddresses, timings, palette } = HUD_CONFIG;
    const x = topLeftBox.x * W;
    const y = topLeftBox.y * H;
    const w = topLeftBox.w * W;
    const h = topLeftBox.h * H;
    const hexIndex = Math.floor(nowMs / timings.hexCycleMs) % hexAddresses.length;

    ctx.save();
    ctx.globalAlpha = 0.42 + 0.58 * bootProgress;
    this.drawChamferBox(ctx, x, y, w, h, w * 0.055);
    ctx.fillStyle = palette.hudIndigoTrack;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = palette.hudCyan;
    ctx.stroke();

    // Header gradient trapezoid
    const headerGrad = ctx.createLinearGradient(x, y, x + w, y);
    headerGrad.addColorStop(0, "rgba(97, 84, 255, 0.52)");
    headerGrad.addColorStop(0.5, "rgba(138, 125, 255, 0.30)");
    headerGrad.addColorStop(1, "rgba(97, 84, 255, 0.52)");
    ctx.fillStyle = headerGrad;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.06, y + 2);
    ctx.lineTo(x + w * 0.94, y + 2);
    ctx.lineTo(x + w * 0.90, y + h * 0.28);
    ctx.lineTo(x + w * 0.10, y + h * 0.28);
    ctx.closePath();
    ctx.fill();

    // Animated bottom indigo progress pulse bar
    const fillRatio = 0.35 + 0.5 * ((hexIndex % 5) / 4);
    ctx.fillStyle = palette.hudIndigo;
    ctx.fillRect(x + w * 0.10, y + h * 0.80, (w * 0.80) * fillRatio, h * 0.09);

    ctx.fillStyle = palette.hudTextWhite;
    ctx.font = `700 ${Math.round(H * topLeftBox.fontSizeRatio)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 0;
    ctx.fillText(hexAddresses[hexIndex], x + w * 0.5, y + h * 0.63);
    ctx.restore();
  }

  private drawTopRightAlertBox(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number,
    bootProgress: number
  ): void {
    const { topRightAlert, timings, palette } = HUD_CONFIG;
    const x = topRightAlert.x * W;
    const y = topRightAlert.y * H;
    const w = topRightAlert.w * W;
    const h = topRightAlert.h * H;

    const radActive = elapsedSec >= timings.radAlertDelaySec;
    const pulse = radActive
      ? 0.60 + 0.40 * (0.5 + 0.5 * Math.sin(elapsedSec * timings.radPulseFreqHz * Math.PI * 2))
      : 0;

    ctx.save();
    ctx.globalAlpha = 0.42 + 0.58 * bootProgress;
    this.drawChamferBox(ctx, x, y, w, h, w * 0.055);
    ctx.fillStyle = palette.hudIndigoTrack;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = radActive ? palette.hudAlertRed : palette.hudCyan;
    ctx.stroke();

    // Bottom anchor trim
    ctx.fillStyle = palette.hudIndigoLight;
    ctx.globalAlpha *= 0.72;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.08, y + h * 0.87);
    ctx.lineTo(x + w * 0.92, y + h * 0.87);
    ctx.lineTo(x + w * 0.95, y + h * 0.97);
    ctx.lineTo(x + w * 0.05, y + h * 0.97);
    ctx.closePath();
    ctx.fill();

    if (radActive) {
      ctx.globalAlpha = pulse;
      ctx.fillStyle = palette.hudAlertRed;
      ctx.shadowColor = palette.hudAlertGlow;
      ctx.shadowBlur = 2;
      ctx.font = `800 ${Math.round(H * topRightAlert.fontSizeRatio)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(topRightAlert.line1, x + w * 0.5, y + h * 0.36);
      ctx.fillText(topRightAlert.line2, x + w * 0.5, y + h * 0.65);
    }
    ctx.restore();
  }

  private drawLeftHistogram(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number
  ): void {
    const { leftBars, timings, palette } = HUD_CONFIG;
    const ox = leftBars.originX * W;
    const oy = leftBars.originY * H;
    const barH = leftBars.barHeight * H;
    const barGap = leftBars.barGap * H;
    const maxW = leftBars.maxBarWidth * W;
    const axisX = W * 0.046;
    const barStartX = W * 0.050;
    const axisBottomY = leftBars.rows.length * barGap + H * 0.012;

    const barRamp = Math.min(1, Math.max(0, (elapsedSec - 0.25) / timings.barsRiseDurationSec));

    ctx.save();
    ctx.translate(ox, oy);

    // Axis L-frame
    ctx.strokeStyle = palette.hudCyan;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(axisX, -H * 0.012);
    ctx.lineTo(axisX, axisBottomY);
    ctx.lineTo(barStartX + maxW + W * 0.01, axisBottomY);
    ctx.stroke();

    const barGrad = ctx.createLinearGradient(barStartX, 0, barStartX + maxW, 0);
    barGrad.addColorStop(0, palette.hudIndigo);
    barGrad.addColorStop(0.74, palette.hudIndigoLight);
    barGrad.addColorStop(1, palette.hudCyanBright);

    const trackGrad = ctx.createLinearGradient(barStartX, 0, barStartX + maxW, 0);
    trackGrad.addColorStop(0, "rgba(97, 84, 255, 0.34)");
    trackGrad.addColorStop(1, "rgba(97, 84, 255, 0.06)");

    ctx.font = `700 ${Math.round(H * leftBars.labelFontRatio)}px ui-monospace, monospace`;
    ctx.textBaseline = "middle";

    leftBars.rows.forEach((row, idx) => {
      const liveVal =
        row.basePct + row.ampPct * Math.sin(elapsedSec * row.freq * Math.PI + row.phase);
      const pct = Math.max(8, Math.min(96, liveVal * barRamp));
      const y = idx * barGap;
      const bw = Math.max(2, (pct / 100) * maxW);

      ctx.globalAlpha = 0.9;
      ctx.fillStyle = palette.hudTextWhite;
      ctx.textAlign = "right";
      ctx.shadowBlur = 0;
      ctx.fillText(`${pct.toFixed(1)} %`, axisX - W * 0.005, y + barH * 0.55);

      ctx.fillStyle = trackGrad;
      ctx.fillRect(barStartX, y, maxW, barH);

      ctx.shadowColor = palette.hudCyanGlow;
      ctx.shadowBlur = 6;
      ctx.fillStyle = barGrad;
      ctx.fillRect(barStartX, y, bw, barH);
    });

    // Timeline year ticks
    ctx.shadowBlur = 0;
    ctx.font = `600 ${Math.round(H * leftBars.yearFontRatio)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    leftBars.axisYears.forEach((yr, idx) => {
      const tx = barStartX + W * 0.012 + idx * (maxW * 0.22);
      ctx.strokeStyle = palette.hudCyan;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(tx, axisBottomY);
      ctx.lineTo(tx, axisBottomY + H * 0.006);
      ctx.stroke();

      ctx.fillStyle = palette.hudTextWhite;
      ctx.globalAlpha = 0.85;
      ctx.fillText(yr, tx, axisBottomY + H * 0.009);
    });

    ctx.restore();
  }

  private drawUnitBlock(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number,
    bootProgress: number
  ): void {
    const { unitBlock, palette } = HUD_CONFIG;
    const x = unitBlock.x * W;
    const y = unitBlock.y * H;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.35 + 0.65 * bootProgress;

    // Slanted diagonal hash header
    ctx.strokeStyle = palette.hudIndigoLight;
    ctx.lineWidth = 2.0;
    const hashStep = unitBlock.hashSpacing * W;
    ctx.beginPath();
    for (let i = 0; i < unitBlock.hashCount; i++) {
      const sx = i * hashStep;
      ctx.moveTo(sx, H * 0.012);
      ctx.lineTo(sx + W * 0.0045, 0);
    }
    ctx.stroke();

    ctx.strokeStyle = palette.hudCyan;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.016);
    ctx.lineTo(W * 0.145, H * 0.016);
    ctx.stroke();

    const unitFontPx = Math.round(H * unitBlock.unitFontRatio);
    const coordFontPx = Math.round(H * unitBlock.coordFontRatio);
    const footerFontPx = Math.round(H * unitBlock.footerFontRatio);

    unitBlock.units.forEach((name, idx) => {
      const ry = H * (0.036 + idx * 0.023);
      const uOsc = unitBlock.unitOscillators[idx];
      const a = (uOsc.baseA + Math.sin(elapsedSec * uOsc.freqA) * uOsc.ampA).toFixed(2);
      const b = (uOsc.baseB + Math.cos(elapsedSec * uOsc.freqB) * uOsc.ampB).toFixed(2);
      const c = (uOsc.baseC + Math.sin(elapsedSec * uOsc.freqC) * uOsc.ampC).toFixed(2);

      ctx.fillStyle = palette.hudTextWhite;
      ctx.font = `800 ${unitFontPx}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(name, W * 0.002, ry);

      ctx.fillStyle = palette.hudTextDim;
      ctx.font = `600 ${coordFontPx}px ui-monospace, monospace`;
      ctx.fillText(`${a}/${b}/${c}`, W * 0.056, ry - H * 0.002);

      ctx.strokeStyle = "rgba(150, 194, 255, 0.28)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(W * 0.056, ry + H * 0.003);
      ctx.lineTo(W * 0.142, ry + H * 0.003);
      ctx.stroke();
    });

    // Micro numeric stack underneath
    ctx.fillStyle = palette.hudTextDim;
    ctx.font = `600 ${footerFontPx}px ui-monospace, monospace`;
    unitBlock.footerOscillators.forEach((f, idx) => {
      const wave =
        f.mode === "cos"
          ? Math.cos(elapsedSec * f.freq)
          : f.mode === "abssin"
            ? Math.abs(Math.sin(elapsedSec * f.freq))
            : Math.sin(elapsedSec * f.freq);
      const val = (f.base + wave * f.amp).toFixed(f.decimals);
      ctx.fillText(val, W * 0.020, H * (0.105 + idx * 0.012));
    });

    ctx.restore();
  }

  private drawCornerStreams(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number,
    bootProgress: number
  ): void {
    const { cornerStreams, timings, palette } = HUD_CONFIG;
    const cycleH = cornerStreams.cycleHeightRatio * H;
    const stepY = cornerStreams.lineStepRatio * H;
    const lineH = cornerStreams.lineHeightRatio * H;
    const scrollBase = elapsedSec * timings.codeScrollSpeedPxPerSec;

    [cornerStreams.left, cornerStreams.right].forEach((box, idx) => {
      const x = box.x * W;
      const y = box.y * H;
      const w = box.w * W;
      const h = box.h * H;
      const scroll = ((scrollBase * (idx === 0 ? 1 : 1.15)) % cycleH);

      ctx.save();
      ctx.globalAlpha = 0.38 + 0.62 * bootProgress;
      this.drawChamferBox(ctx, x, y, w, h, w * 0.06);
      ctx.fillStyle = palette.cornerStreamFill;
      ctx.fill();
      ctx.strokeStyle = palette.hudCyan;
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.clip();
      const padX = w * 0.09;
      for (let dup = 0; dup < 2; dup++) {
        this.streamLines.forEach((ln, lIdx) => {
          const ly = y + H * 0.015 + dup * cycleH + lIdx * stepY - scroll;
          const lw = Math.min(w - padX * 2 - ln.indentRatio * w, ln.wRatio * w);
          if (lw <= 2) return;
          ctx.fillStyle = ln.bright ? palette.hudTextWhite : palette.hudCyan;
          ctx.globalAlpha = ln.bright ? 0.78 : 0.42;
          ctx.fillRect(x + padX + ln.indentRatio * w, ly, lw, lineH);
        });
      }
      ctx.restore();
    });
  }

  private drawVitals(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    elapsedSec: number
  ): void {
    const { vitals, timings, palette } = HUD_CONFIG;
    const x = vitals.x * W;
    const y = vitals.y * H;
    const barW = vitals.barWidth * W;
    const barH = vitals.barHeight * H;
    const rowGap = vitals.rowGap * H;

    const ramp = Math.min(1, Math.max(0, (elapsedSec - 0.15) / timings.vitalsRampDurationSec));
    const o2Val = Math.max(
      0,
      (vitals.o2.base + vitals.o2.amp * Math.sin(elapsedSec * vitals.o2.freq * Math.PI)) * ramp
    );
    const atmVal = Math.max(
      0,
      (vitals.atm.base + vitals.atm.amp * Math.cos(elapsedSec * vitals.atm.freq * Math.PI)) * ramp
    );

    const o2Ratio = Math.min(1, o2Val / vitals.o2.max);
    const atmRatio = Math.min(1, atmVal / vitals.atm.max);

    const barGrad = ctx.createLinearGradient(x, 0, x + barW, 0);
    barGrad.addColorStop(0, palette.hudIndigo);
    barGrad.addColorStop(0.72, palette.hudIndigoLight);
    barGrad.addColorStop(1, palette.hudCyanBright);

    const trackGrad = ctx.createLinearGradient(x, 0, x + barW, 0);
    trackGrad.addColorStop(0, "rgba(97, 84, 255, 0.34)");
    trackGrad.addColorStop(1, "rgba(97, 84, 255, 0.06)");

    const labelPx = Math.round(H * vitals.labelFontRatio);
    const valPx = Math.round(H * vitals.valueFontRatio);

    ctx.save();
    ctx.textBaseline = "middle";

    // O2 Row
    ctx.fillStyle = palette.hudTextWhite;
    ctx.textAlign = "right";
    ctx.font = `800 ${labelPx}px ui-monospace, monospace`;
    ctx.fillText(vitals.o2.label, x - W * 0.022, y + barH * 0.45);
    ctx.font = `800 ${Math.round(labelPx * 0.64)}px ui-monospace, monospace`;
    ctx.fillText(vitals.o2.sub, x - W * 0.015, y + barH * 0.72);

    ctx.fillStyle = trackGrad;
    ctx.fillRect(x, y, barW, barH);
    ctx.shadowColor = palette.hudCyanGlow;
    ctx.shadowBlur = 7;
    ctx.fillStyle = barGrad;
    ctx.fillRect(x, y, Math.max(3, barW * o2Ratio), barH);

    ctx.shadowBlur = 0;
    ctx.fillStyle = palette.hudTextWhite;
    ctx.textAlign = "left";
    ctx.font = `700 ${valPx}px ui-monospace, monospace`;
    ctx.fillText(`${o2Val.toFixed(3)} ${vitals.o2.unit}`, x + barW * 0.21, y + barH * 0.54);

    // ATM Row
    const y2 = y + rowGap;
    ctx.shadowBlur = 0;
    ctx.textAlign = "right";
    ctx.font = `800 ${labelPx}px ui-monospace, monospace`;
    ctx.fillText(vitals.atm.label, x - W * 0.015, y2 + barH * 0.54);

    ctx.fillStyle = trackGrad;
    ctx.fillRect(x, y2, barW, barH);
    ctx.shadowColor = palette.hudCyanGlow;
    ctx.shadowBlur = 4;
    ctx.fillStyle = barGrad;
    ctx.fillRect(x, y2, Math.max(3, barW * atmRatio), barH);

    ctx.shadowBlur = 0;
    ctx.fillStyle = palette.hudTextWhite;
    ctx.textAlign = "left";
    ctx.font = `700 ${valPx}px ui-monospace, monospace`;
    ctx.fillText(`${atmVal.toFixed(1)} ${vitals.atm.unit}`, x + barW * 0.31, y2 + barH * 0.54);

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

    // Clip tick scroll region cleanly
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - W * 0.06, topY, W * 0.08, span);
    ctx.clip();

    const step = span / altitudeTape.tickCount;
    const fontPx = Math.round(H * altitudeTape.tickLabelFontRatio);
    ctx.font = `600 ${fontPx}px ui-monospace, monospace`;
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

    // Pointer triangle on right side of ruler
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

  public dispose(): void {
    this.texture.dispose();
  }
}
