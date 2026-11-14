import React, { useEffect, useMemo, useRef, useState } from "react";
import { HUD_CONFIG, MOTION_CONFIG, PALETTE_CONFIG } from "../config/visorConfig";

interface HudLiveState {
  bootProgress: number;
  radActive: boolean;
  radPulseAlpha: number;
  hexIndex: number;
  barPcts: number[];
  o2Pct: number;
  atmMb: number;
  unitCoords: string[];
  footerVals: string[];
}

function drawScanMeshFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sweepCenterNorm: number,
  opacity: number
) {
  ctx.clearRect(0, 0, w, h);
  if (opacity <= 0.01) return;

  const {
    cols,
    rows,
    bandWidthRatio,
    tiltFactor,
    lineWidth,
    bowAmplitudePx,
    verticalCurvePx,
  } = HUD_CONFIG.scanSweep;
  const bandW = w * bandWidthRatio;
  const centerX = sweepCenterNorm * (w + bandW * 2) - bandW;

  ctx.save();
  ctx.lineWidth = lineWidth;

  const points: Array<Array<{ x: number; y: number }>> = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const rowPts: Array<{ x: number; y: number }> = [];
    // Subtle curved barrel warp across vertical visor height
    const bowOffset = Math.sin(v * Math.PI) * bowAmplitudePx - (v - 0.5) * w * tiltFactor;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const x = centerX + (u - 0.5) * bandW + bowOffset;
      const y =
        h * (0.04 + 0.92 * v) + Math.sin(u * Math.PI) * (v - 0.5) * verticalCurvePx;
      rowPts.push({ x, y });
    }
    points.push(rowPts);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p00 = points[r][c];
      const p10 = points[r][c + 1];
      const p01 = points[r + 1][c];
      const p11 = points[r + 1][c + 1];

      const uMid = (c + 0.5) / cols;
      const edgeFade = Math.sin(uMid * Math.PI);
      const cellAlpha = opacity * edgeFade * 0.72;
      if (cellAlpha <= 0.01) continue;

      ctx.strokeStyle = `rgba(${PALETTE_CONFIG.scanMeshCyanRgb}, ${cellAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      // Triangulated diagonal cross-rib
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.stroke();

      // Glowing grid node dot
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = `rgba(${PALETTE_CONFIG.scanMeshNodesRgb}, ${(cellAlpha * 1.15).toFixed(3)})`;
        ctx.fillRect(p00.x - 1.5, p00.y - 1.5, 3, 3);
      }
    }
  }
  ctx.restore();
}

/**
 * Live curved holographic visor HUD replicated from the first-person reference:
 * - Double-line geometric visor perimeter brackets
 * - Periodic sweeping curved wireframe scan mesh
 * - Top-left cycling hex tab & top-right pulsing HIGH RAD DETECTED alert
 * - Left dynamic 5-bar histogram + timeline axis + UNIT 01/02/03 diagnostic readout
 * - Dual bottom angled telemetry log streams
 * - Bottom-center live O2 / ATM bars
 * - Right pitch-responsive vertical elevation tape
 * - Trailing floating holographic center gyro reticle with counter-rotating rings
 */
export const VisorHud: React.FC = () => {
  const {
    viewBoxW,
    viewBoxH,
    timings,
    hexAddresses,
    perimeterPaths,
    topLeftBox,
    topRightAlert,
    leftBars,
    unitBlock,
    vitals,
    altitudeTape,
    reticle,
    cornerStreams,
    scanSweep,
  } = HUD_CONFIG;

  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const reticleOuterRef = useRef<SVGGElement | null>(null);
  const reticleInnerRef = useRef<SVGGElement | null>(null);
  const reticleDashRef = useRef<SVGGElement | null>(null);
  const reticlePulseRef = useRef<SVGCircleElement | null>(null);
  const tetherUnitRef = useRef<SVGLineElement | null>(null);
  const tetherO2Ref = useRef<SVGLineElement | null>(null);
  const altitudeGroupRef = useRef<SVGGElement | null>(null);
  const leftStreamRef = useRef<SVGGElement | null>(null);
  const rightStreamRef = useRef<SVGGElement | null>(null);

  const [live, setLive] = useState<HudLiveState>(() => ({
    bootProgress: 0,
    radActive: false,
    radPulseAlpha: 0,
    hexIndex: 0,
    barPcts: leftBars.rows.map(() => 0),
    o2Pct: 0,
    atmMb: 0,
    unitCoords: unitBlock.unitOscillators.map((u) => u.init),
    footerVals: [...unitBlock.footerSeed],
  }));

  // Deterministic micro-code lines for lower-left and lower-right angled telemetry streams
  const streamLines = useMemo(() => {
    const items: Array<{ w: number; indent: number; bright: boolean }> = [];
    for (let i = 0; i < cornerStreams.lineCount; i++) {
      const seed = Math.sin(i * 12.9898) * 43758.5453;
      const frac = seed - Math.floor(seed);
      items.push({
        w: 36 + Math.floor(frac * 112),
        indent: i % 5 === 0 ? 0 : 10 + (i % 3) * 8,
        bright: i % 4 === 0,
      });
    }
    return items;
  }, [cornerStreams.lineCount]);

  const altitudeTicks = useMemo(() => {
    const list: Array<{ idx: number; y: number; major: boolean; label: string }> = [];
    const span = altitudeTape.bottomY - altitudeTape.topY;
    const step = span / altitudeTape.tickCount;
    for (let i = -6; i <= altitudeTape.tickCount + 6; i++) {
      const major = i % 5 === 0;
      const val = (
        altitudeTape.baseValue +
        (altitudeTape.tickCount / 2 - i) * altitudeTape.valueStepPerTick
      ).toFixed(2);
      list.push({
        idx: i,
        y: altitudeTape.topY + i * step,
        major,
        label: val,
      });
    }
    return list;
  }, [altitudeTape]);

  useEffect(() => {
    const startTime = performance.now();
    let lastUiTick = 0;
    let animId = 0;

    const stageEl = () =>
      document.querySelector(".visor-stage") as HTMLElement | null;

    const frame = (now: number) => {
      const elapsedSec = (now - startTime) / 1000;

      // 1. 60 FPS continuous reticle ring counter-rotation & focus pulse
      if (reticleOuterRef.current) {
        const deg = (elapsedSec * timings.reticleSpinOuterDegPerSec) % 360;
        reticleOuterRef.current.setAttribute("transform", `rotate(${deg.toFixed(2)})`);
      }
      if (reticleInnerRef.current) {
        const deg = (elapsedSec * timings.reticleSpinInnerDegPerSec) % 360;
        reticleInnerRef.current.setAttribute("transform", `rotate(${deg.toFixed(2)})`);
      }
      if (reticleDashRef.current) {
        const deg = (elapsedSec * timings.reticleSpinDashDegPerSec) % 360;
        reticleDashRef.current.setAttribute("transform", `rotate(${deg.toFixed(2)})`);
      }
      if (reticlePulseRef.current) {
        const cycle = (elapsedSec % timings.reticlePulseIntervalSec) / timings.reticlePulseIntervalSec;
        const active = cycle < reticle.pulseThreshold ? cycle / reticle.pulseThreshold : 0;
        const pulseR = reticle.outerRadius * (0.85 + active * 0.52);
        const pulseOpacity = active > 0 ? (1 - active) * 0.55 : 0;
        reticlePulseRef.current.setAttribute("r", pulseR.toFixed(1));
        reticlePulseRef.current.setAttribute("stroke-opacity", pulseOpacity.toFixed(3));
      }

      // 2. Smooth 60 FPS tether alignment + pitch-driven altitude tape & scrolling corner logs
      const root = stageEl();
      const hudYVar = root ? parseFloat(root.style.getPropertyValue("--hud-y") || "0") : 0;
      const retXVar = root ? parseFloat(root.style.getPropertyValue("--reticle-x") || "0") : 0;
      const retYVar = root ? parseFloat(root.style.getPropertyValue("--reticle-y") || "0") : 0;
      const hudXVar = root ? parseFloat(root.style.getPropertyValue("--hud-x") || "0") : 0;

      if (altitudeGroupRef.current) {
        const shiftY =
          hudYVar * altitudeTape.pitchSensitivityPx +
          Math.sin(elapsedSec * altitudeTape.idleWaveFreqRad) * altitudeTape.idleWaveAmpPx;
        altitudeGroupRef.current.setAttribute("transform", `translate(0, ${shiftY.toFixed(2)})`);
      }

      // Tether endpoints convert screen-space reticle vs HUD delta back into viewBox units
      const vw = window.innerWidth || viewBoxW;
      const vh = window.innerHeight || viewBoxH;
      const deltaPxX =
        retXVar * MOTION_CONFIG.parallaxOffsets.reticleX -
        hudXVar * MOTION_CONFIG.parallaxOffsets.hudX;
      const deltaPxY =
        retYVar * MOTION_CONFIG.parallaxOffsets.reticleY -
        hudYVar * MOTION_CONFIG.parallaxOffsets.hudY;
      const relRetX = reticle.baseCx + deltaPxX * (viewBoxW / vw);
      const relRetY = reticle.baseCy + deltaPxY * (viewBoxH / vh);
      if (tetherUnitRef.current) {
        tetherUnitRef.current.setAttribute("x1", relRetX.toFixed(1));
        tetherUnitRef.current.setAttribute("y1", relRetY.toFixed(1));
      }
      if (tetherO2Ref.current) {
        tetherO2Ref.current.setAttribute("x1", relRetX.toFixed(1));
        tetherO2Ref.current.setAttribute("y1", relRetY.toFixed(1));
      }

      const scrollPx = (elapsedSec * timings.codeScrollSpeedPxPerSec) % cornerStreams.cycleHeightPx;
      if (leftStreamRef.current) {
        leftStreamRef.current.setAttribute("transform", `translate(0, ${(-scrollPx).toFixed(1)})`);
      }
      if (rightStreamRef.current) {
        rightStreamRef.current.setAttribute(
          "transform",
          `translate(0, ${(-((scrollPx * 1.15) % cornerStreams.cycleHeightPx)).toFixed(1)})`
        );
      }

      // 3. Sweeping 3D curved scan wireframe mesh (boot sweep + gentle periodic re-scan)
      const canvas = scanCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
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
          drawScanMeshFrame(ctx, canvas.width, canvas.height, Math.max(0, sweepT), sweepAlpha);
        }
      }

      // 4. Throttled React telemetry updates (~9 Hz for crisp readable digits & bars)
      if (now - lastUiTick >= timings.telemetryTickMs) {
        lastUiTick = now;

        const bootProgress = Math.min(1, elapsedSec / timings.frameBootSec);
        const barRamp = Math.min(1, Math.max(0, (elapsedSec - 0.3) / timings.barsRiseDurationSec));
        const vitalsRamp = Math.min(1, Math.max(0, (elapsedSec - 0.15) / timings.vitalsRampDurationSec));

        const radActive = elapsedSec >= timings.radAlertDelaySec;
        const radPulseAlpha = radActive
          ? 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(elapsedSec * timings.radPulseFreqHz * Math.PI * 2))
          : 0;

        const hexIndex = Math.floor(now / timings.hexCycleMs) % hexAddresses.length;

        const barPcts = leftBars.rows.map((row) => {
          const liveVal = row.basePct + row.ampPct * Math.sin(elapsedSec * row.freq * Math.PI + row.phase);
          return Math.max(8, Math.min(96, liveVal * barRamp));
        });

        const o2Raw =
          vitals.o2.base + vitals.o2.amp * Math.sin(elapsedSec * vitals.o2.freq * Math.PI);
        const atmRaw =
          vitals.atm.base + vitals.atm.amp * Math.cos(elapsedSec * vitals.atm.freq * Math.PI);

        const o2Pct = Math.max(0, o2Raw * vitalsRamp);
        const atmMb = Math.max(0, atmRaw * vitalsRamp);

        const unitCoords = unitBlock.unitOscillators.map((u) => {
          const a = (u.baseA + Math.sin(elapsedSec * u.freqA) * u.ampA).toFixed(2);
          const b = (u.baseB + Math.cos(elapsedSec * u.freqB) * u.ampB).toFixed(2);
          const c = (u.baseC + Math.sin(elapsedSec * u.freqC) * u.ampC).toFixed(2);
          return `${a}/${b}/${c}`;
        });

        const footerVals = unitBlock.footerOscillators.map((f) => {
          const wave =
            f.mode === "cos"
              ? Math.cos(elapsedSec * f.freq)
              : f.mode === "abssin"
                ? Math.abs(Math.sin(elapsedSec * f.freq))
                : Math.sin(elapsedSec * f.freq);
          return (f.base + wave * f.amp).toFixed(f.decimals);
        });

        setLive({
          bootProgress,
          radActive,
          radPulseAlpha,
          hexIndex,
          barPcts,
          o2Pct,
          atmMb,
          unitCoords,
          footerVals,
        });
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [
    altitudeTape.idleWaveAmpPx,
    altitudeTape.idleWaveFreqRad,
    altitudeTape.pitchSensitivityPx,
    cornerStreams.cycleHeightPx,
    hexAddresses.length,
    leftBars.rows,
    reticle.baseCx,
    reticle.baseCy,
    reticle.outerRadius,
    reticle.pulseThreshold,
    scanSweep.maxAlphaBoot,
    scanSweep.maxAlphaPeriodic,
    timings,
    unitBlock.footerOscillators,
    unitBlock.unitOscillators,
    viewBoxH,
    viewBoxW,
    vitals.atm.amp,
    vitals.atm.base,
    vitals.atm.freq,
    vitals.o2.amp,
    vitals.o2.base,
    vitals.o2.freq,
  ]);

  const o2Ratio = Math.min(1, live.o2Pct / vitals.o2.max);
  const atmRatio = Math.min(1, live.atmMb / vitals.atm.max);

  return (
    <div className="visor-hud-layer" aria-hidden="true">
      {/* Live curved wireframe terrain scan sweep */}
      <canvas
        ref={scanCanvasRef}
        className="visor-scan-canvas"
        width={scanSweep.canvasWidth}
        height={scanSweep.canvasHeight}
      />

      {/* Curved holographic HUD layer */}
      <svg
        className="visor-hud-svg"
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="hudGlowSoft" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="hudAlertGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="hudBarGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PALETTE_CONFIG.hudIndigo} stopOpacity="0.92" />
            <stop offset="72%" stopColor={PALETTE_CONFIG.hudIndigoLight} stopOpacity="0.88" />
            <stop offset="100%" stopColor={PALETTE_CONFIG.hudCyanBright} stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id="hudTrackGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PALETTE_CONFIG.hudIndigo} stopOpacity="0.34" />
            <stop offset="100%" stopColor={PALETTE_CONFIG.hudIndigo} stopOpacity="0.06" />
          </linearGradient>

          <linearGradient id="hudBoxHeaderGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PALETTE_CONFIG.hudIndigo} stopOpacity="0.45" />
            <stop offset="50%" stopColor={PALETTE_CONFIG.hudIndigoLight} stopOpacity="0.28" />
            <stop offset="100%" stopColor={PALETTE_CONFIG.hudIndigo} stopOpacity="0.45" />
          </linearGradient>

          <clipPath id="altitudeTapeClip">
            <rect
              x={altitudeTape.x - 90}
              y={altitudeTape.topY}
              width="140"
              height={altitudeTape.bottomY - altitudeTape.topY}
            />
          </clipPath>

          <clipPath id="leftStreamClip">
            <rect
              x={cornerStreams.left.x + 12}
              y={cornerStreams.left.y + 16}
              width={cornerStreams.left.w - 24}
              height={cornerStreams.left.h - 32}
            />
          </clipPath>

          <clipPath id="rightStreamClip">
            <rect
              x={cornerStreams.right.x + 12}
              y={cornerStreams.right.y + 16}
              width={cornerStreams.right.w - 24}
              height={cornerStreams.right.h - 32}
            />
          </clipPath>
        </defs>

        {/* ============================================================
            1. PERIMETER CHAMFERED GEOMETRIC VISOR HUD FRAME
           ============================================================ */}
        <g
          fill="none"
          stroke={PALETTE_CONFIG.hudCyan}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.35 + 0.55 * live.bootProgress}
          filter="url(#hudGlowSoft)"
        >
          {perimeterPaths.map((seg, idx) => (
            <path
              key={idx}
              d={seg.d}
              strokeWidth={seg.strokeWidth}
              strokeOpacity={seg.strokeOpacity}
            />
          ))}
        </g>

        {/* ============================================================
            2. TOP-LEFT HEX ADDRESS TELEMETRY WIDGET
           ============================================================ */}
        <g
          transform={`translate(${topLeftBox.x} ${topLeftBox.y})`}
          opacity={0.45 + 0.55 * live.bootProgress}
        >
          <path
            d={`M 0,10 L 14,0 L ${topLeftBox.w - 14},0 L ${topLeftBox.w},10 L ${topLeftBox.w - 8},${topLeftBox.h} L 8,${topLeftBox.h} Z`}
            fill={PALETTE_CONFIG.hudIndigoTrack}
            fillOpacity="0.55"
            stroke={PALETTE_CONFIG.hudCyan}
            strokeOpacity="0.62"
            strokeWidth="1.6"
          />
          <path
            d={`M 14,2 L ${topLeftBox.w - 14},2 L ${topLeftBox.w - 22},32 L 22,32 Z`}
            fill="url(#hudBoxHeaderGrad)"
          />
          {/* Animated hex bar & readout */}
          <rect
            x="24"
            y={topLeftBox.h - 22}
            width={Math.round((topLeftBox.w - 48) * (0.35 + 0.5 * ((live.hexIndex % 5) / 4)))}
            height="10"
            rx="2"
            fill={PALETTE_CONFIG.hudIndigo}
            opacity="0.78"
          />
          <text
            x={topLeftBox.w / 2}
            y={topLeftBox.h - 28}
            textAnchor="middle"
            fill={PALETTE_CONFIG.hudTextWhite}
            fontSize={topLeftBox.fontSize}
            fontWeight="600"
            letterSpacing="1.2"
          >
            {hexAddresses[live.hexIndex]}
          </text>
        </g>

        {/* ============================================================
            3. TOP-RIGHT RADIATION ALERT TAB (HIGH RAD DETECTED)
           ============================================================ */}
        <g
          transform={`translate(${topRightAlert.x} ${topRightAlert.y})`}
          opacity={0.45 + 0.55 * live.bootProgress}
        >
          <path
            d={`M 0,10 L 14,0 L ${topRightAlert.w - 14},0 L ${topRightAlert.w},10 L ${topRightAlert.w - 8},${topRightAlert.h} L 8,${topRightAlert.h} Z`}
            fill={PALETTE_CONFIG.hudIndigoTrack}
            fillOpacity="0.58"
            stroke={live.radActive ? PALETTE_CONFIG.hudAlertRed : PALETTE_CONFIG.hudCyan}
            strokeOpacity={live.radActive ? 0.45 + 0.4 * live.radPulseAlpha : 0.62}
            strokeWidth="1.7"
          />
          <path
            d={`M 18,${topRightAlert.h - 14} L ${topRightAlert.w - 18},${topRightAlert.h - 14} L ${topRightAlert.w - 10},${topRightAlert.h - 2} L 10,${topRightAlert.h - 2} Z`}
            fill={PALETTE_CONFIG.hudIndigoLight}
            opacity="0.72"
          />
          {live.radActive && (
            <g opacity={live.radPulseAlpha} filter="url(#hudAlertGlow)">
              <text
                x={topRightAlert.w / 2}
                y={58}
                textAnchor="middle"
                fill={PALETTE_CONFIG.hudAlertRed}
                fontSize={topRightAlert.fontSize}
                fontWeight="800"
                letterSpacing="1.5"
              >
                {topRightAlert.line1}
              </text>
              <text
                x={topRightAlert.w / 2}
                y={94}
                textAnchor="middle"
                fill={PALETTE_CONFIG.hudAlertRed}
                fontSize={topRightAlert.fontSize}
                fontWeight="800"
                letterSpacing="1.5"
              >
                {topRightAlert.line2}
              </text>
            </g>
          )}
        </g>

        {/* ============================================================
            4. LEFT VERTICAL MULTI-BAR TELEMETRY HISTOGRAM
           ============================================================ */}
        <g transform={`translate(${leftBars.originX} ${leftBars.originY}) skewY(${leftBars.skewDeg})`}>
          {/* Axis frame */}
          <line
            x1={leftBars.axisX}
            y1="-14"
            x2={leftBars.axisX}
            y2={leftBars.rows.length * leftBars.barGap + 18}
            stroke={PALETTE_CONFIG.hudCyan}
            strokeOpacity="0.55"
            strokeWidth="1.3"
          />
          <line
            x1={leftBars.axisX}
            y1={leftBars.rows.length * leftBars.barGap + 18}
            x2={leftBars.maxBarWidth + leftBars.barStartX + 6}
            y2={leftBars.rows.length * leftBars.barGap + 18}
            stroke={PALETTE_CONFIG.hudCyan}
            strokeOpacity="0.55"
            strokeWidth="1.3"
          />

          {leftBars.rows.map((_, idx) => {
            const pct = live.barPcts[idx] ?? 0;
            const y = idx * leftBars.barGap;
            const barW = (pct / 100) * leftBars.maxBarWidth;
            return (
              <g key={idx}>
                <text
                  x={leftBars.labelX}
                  y={y + 14}
                  textAnchor="end"
                  fill={PALETTE_CONFIG.hudTextWhite}
                  fontSize={leftBars.labelFontSize}
                  fontWeight="700"
                >
                  {pct.toFixed(2)} %
                </text>
                <rect
                  x={leftBars.barStartX}
                  y={y}
                  width={leftBars.maxBarWidth}
                  height={leftBars.barHeight}
                  fill="url(#hudTrackGrad)"
                />
                <rect
                  x={leftBars.barStartX}
                  y={y}
                  width={Math.max(2, barW)}
                  height={leftBars.barHeight}
                  fill="url(#hudBarGrad)"
                  filter="url(#hudGlowSoft)"
                />
              </g>
            );
          })}

          {/* Timeline year ticks */}
          {leftBars.axisYears.map((yr, idx) => {
            const tx = leftBars.yearBaseX + idx * leftBars.yearStepX;
            const axisY = leftBars.rows.length * leftBars.barGap + 18;
            return (
              <g key={yr}>
                <line
                  x1={tx}
                  y1={axisY}
                  x2={tx}
                  y2={axisY + 6}
                  stroke={PALETTE_CONFIG.hudCyan}
                  strokeWidth="1.2"
                />
                <text
                  x={tx}
                  y={axisY + 21}
                  textAnchor="middle"
                  fill={PALETTE_CONFIG.hudTextWhite}
                  fontSize={leftBars.yearFontSize}
                  fontWeight="600"
                >
                  {yr}
                </text>
              </g>
            );
          })}
        </g>

        {/* ============================================================
            5. LEFT-BOTTOM UNIT 01 / 02 / 03 DIAGNOSTIC STATUS MODULE
           ============================================================ */}
        <g transform={`translate(${unitBlock.x} ${unitBlock.y}) skewY(${unitBlock.skewDeg})`}>
          {/* Slanted diagonal hash bar */}
          <g stroke={PALETTE_CONFIG.hudIndigoLight} strokeWidth="2.4" opacity="0.88">
            {Array.from({ length: unitBlock.hashCount }).map((_, i) => {
              const sx = i * unitBlock.hashSpacing;
              return <line key={i} x1={sx} y1="12" x2={sx + 8} y2="0" />;
            })}
          </g>
          <line
            x1="0"
            y1="16"
            x2="262"
            y2="16"
            stroke={PALETTE_CONFIG.hudCyan}
            strokeOpacity="0.65"
            strokeWidth="1.4"
          />

          {unitBlock.units.map((unitName, idx) => {
            const ry = 38 + idx * 24;
            return (
              <g key={unitName}>
                <text
                  x="4"
                  y={ry}
                  fill={PALETTE_CONFIG.hudTextWhite}
                  fontSize={unitBlock.unitFontSize}
                  fontWeight="800"
                  letterSpacing="0.8"
                >
                  {unitName}
                </text>
                <text
                  x="96"
                  y={ry - 2}
                  fill={PALETTE_CONFIG.hudTextDim}
                  fontSize={unitBlock.coordFontSize}
                  fontWeight="600"
                >
                  {live.unitCoords[idx]}
                </text>
                <line
                  x1="96"
                  y1={ry + 3}
                  x2="256"
                  y2={ry + 3}
                  stroke={PALETTE_CONFIG.hudCyan}
                  strokeOpacity="0.28"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {/* Micro telemetry numeric stack underneath */}
          <g fill={PALETTE_CONFIG.hudTextDim} fontSize={unitBlock.footerFontSize} fontWeight="600">
            {live.footerVals.map((val, idx) => (
              <text key={idx} x="36" y={108 + idx * 12}>
                {val}
              </text>
            ))}
          </g>
        </g>

        {/* ============================================================
            6. EXTREME BOTTOM-LEFT & BOTTOM-RIGHT ANGLED LOG STREAMS
           ============================================================ */}
        {[cornerStreams.left, cornerStreams.right].map((box, idx) => {
          const isLeft = idx === 0;
          const clipId = isLeft ? "leftStreamClip" : "rightStreamClip";
          const streamRef = isLeft ? leftStreamRef : rightStreamRef;
          return (
            <g
              key={idx}
              transform={`skewY(${box.skewDeg})`}
              style={{ transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px` }}
            >
              <path
                d={`M ${box.x},${box.y + 12} L ${box.x + 12},${box.y} L ${box.x + box.w - 12},${box.y} L ${box.x + box.w},${box.y + 12} L ${box.x + box.w - 8},${box.y + box.h} L ${box.x + 8},${box.y + box.h} Z`}
                fill={PALETTE_CONFIG.cornerStreamFill}
                stroke={PALETTE_CONFIG.hudCyan}
                strokeOpacity="0.62"
                strokeWidth="1.6"
              />
              <g clipPath={`url(#${clipId})`}>
                <g ref={streamRef}>
                  {[0, 1].map((dup) =>
                    streamLines.map((ln, lIdx) => (
                      <rect
                        key={`${dup}-${lIdx}`}
                        x={box.x + 18 + ln.indent}
                        y={box.y + 16 + dup * cornerStreams.cycleHeightPx + lIdx * cornerStreams.lineStepY}
                        width={Math.min(box.w - 42 - ln.indent, ln.w)}
                        height={cornerStreams.lineHeightPx}
                        rx="1"
                        fill={
                          ln.bright
                            ? PALETTE_CONFIG.hudTextWhite
                            : PALETTE_CONFIG.hudCyan
                        }
                        opacity={ln.bright ? 0.78 : 0.42}
                      />
                    ))
                  )}
                </g>
              </g>
            </g>
          );
        })}

        {/* ============================================================
            7. BOTTOM-CENTER O2 & ATM LIFE-SUPPORT TELEMETRY BARS
           ============================================================ */}
        <g transform={`translate(${vitals.x} ${vitals.y})`}>
          {/* O2 Row */}
          <text
            x="-30"
            y="18"
            textAnchor="end"
            fill={PALETTE_CONFIG.hudTextWhite}
            fontSize={vitals.o2LabelFontSize}
            fontWeight="800"
          >
            {vitals.o2.label}
            <tspan dy="6" fontSize={vitals.o2LabelFontSize * 0.625}>
              {vitals.o2.sub}
            </tspan>
          </text>
          <rect
            x="0"
            y="0"
            width={vitals.barWidth}
            height={vitals.barHeight}
            rx="2"
            fill="url(#hudTrackGrad)"
          />
          <rect
            x="0"
            y="0"
            width={Math.max(4, vitals.barWidth * o2Ratio)}
            height={vitals.barHeight}
            rx="2"
            fill="url(#hudBarGrad)"
            filter="url(#hudGlowSoft)"
          />
          <text
            x={vitals.o2ValueX}
            y="19"
            fill={PALETTE_CONFIG.hudTextWhite}
            fontSize={vitals.valueFontSize}
            fontWeight="700"
          >
            {live.o2Pct.toFixed(3)} {vitals.o2.unit}
          </text>

          {/* ATM Row */}
          <g transform={`translate(0 ${vitals.rowGap})`}>
            <text
              x="-30"
              y="18"
              textAnchor="end"
              fill={PALETTE_CONFIG.hudTextWhite}
              fontSize={vitals.atmLabelFontSize}
              fontWeight="800"
            >
              {vitals.atm.label}
            </text>
            <rect
              x="0"
              y="0"
              width={vitals.barWidth}
              height={vitals.barHeight}
              rx="2"
              fill="url(#hudTrackGrad)"
            />
            <rect
              x="0"
              y="0"
              width={Math.max(4, vitals.barWidth * atmRatio)}
              height={vitals.barHeight}
              rx="2"
              fill="url(#hudBarGrad)"
              filter="url(#hudGlowSoft)"
            />
            <text
              x={vitals.atmValueX}
              y="19"
              fill={PALETTE_CONFIG.hudTextWhite}
              fontSize={vitals.valueFontSize}
              fontWeight="700"
            >
              {live.atmMb.toFixed(1)} {vitals.atm.unit}
            </text>
          </g>
        </g>

        {/* ============================================================
            8. RIGHT VERTICAL ALTITUDE / PITCH ELEVATION RULER TAPE
           ============================================================ */}
        <g transform={`skewY(${altitudeTape.skewDeg})`}>
          <line
            x1={altitudeTape.x}
            y1={altitudeTape.topY}
            x2={altitudeTape.x}
            y2={altitudeTape.bottomY}
            stroke={PALETTE_CONFIG.hudCyan}
            strokeOpacity="0.65"
            strokeWidth="1.5"
          />
          <g clipPath="url(#altitudeTapeClip)">
            <g ref={altitudeGroupRef}>
              {altitudeTicks.map((t) => (
                <g key={t.idx}>
                  <line
                    x1={t.major ? altitudeTape.x - 16 : altitudeTape.x - 8}
                    y1={t.y}
                    x2={altitudeTape.x}
                    y2={t.y}
                    stroke={PALETTE_CONFIG.hudCyanBright}
                    strokeOpacity={t.major ? 0.9 : 0.5}
                    strokeWidth={t.major ? "1.6" : "1"}
                  />
                  {t.major && (
                    <text
                      x={altitudeTape.x - 24}
                      y={t.y + 4}
                      textAnchor="end"
                      fill={PALETTE_CONFIG.hudTextWhite}
                      fontSize={altitudeTape.tickLabelFontSize}
                      fontWeight="600"
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              ))}
            </g>
          </g>
          {/* Fixed right-edge pitch carrot indicator */}
          <polygon
            points={`${altitudeTape.x + 6},${(altitudeTape.topY + altitudeTape.bottomY) / 2} ${altitudeTape.x + 17},${(altitudeTape.topY + altitudeTape.bottomY) / 2 - 6} ${altitudeTape.x + 17},${(altitudeTape.topY + altitudeTape.bottomY) / 2 + 6}`}
            fill={PALETTE_CONFIG.hudTextWhite}
          />
        </g>

        {/* Dynamic hairline tethers linking reticle to UNIT & O2 widgets */}
        <g stroke={PALETTE_CONFIG.hudIndigoLight} strokeOpacity="0.32" strokeWidth="1.3">
          <line
            ref={tetherUnitRef}
            x1={reticle.baseCx}
            y1={reticle.baseCy}
            x2={unitBlock.x + unitBlock.tetherAnchorOffsetX}
            y2={unitBlock.y + unitBlock.tetherAnchorOffsetY}
          />
          <line
            ref={tetherO2Ref}
            x1={reticle.baseCx}
            y1={reticle.baseCy}
            x2={vitals.x + vitals.tetherAnchorOffsetX}
            y2={vitals.y + vitals.tetherAnchorOffsetY}
          />
        </g>
      </svg>

      {/* ============================================================
          9. TRAILING FLOATING CENTER GYRO / GEAR RETICLE LAYER
             (moves with --reticle-x / --reticle-y slightly slower than HUD)
         ============================================================ */}
      <svg
        className="visor-reticle-svg"
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="reticleGlowSoft" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g
          transform={`translate(${reticle.baseCx} ${reticle.baseCy})`}
          opacity={0.3 + 0.62 * live.bootProgress}
          filter="url(#reticleGlowSoft)"
        >
          {/* Periodic soft radial lock pulse */}
          <circle
            ref={reticlePulseRef}
            cx="0"
            cy="0"
            r={reticle.outerRadius}
            fill="none"
            stroke={PALETTE_CONFIG.hudCyanBright}
            strokeWidth="2.4"
            strokeOpacity="0"
          />

          {/* Outer notched gear cog ring */}
          <g ref={reticleOuterRef}>
            <circle
              cx="0"
              cy="0"
              r={reticle.outerRadius - 10}
              fill="none"
              stroke={PALETTE_CONFIG.hudCyan}
              strokeWidth="12"
              strokeOpacity="0.48"
              strokeDasharray="24 14"
            />
            <circle
              cx="0"
              cy="0"
              r={reticle.outerRadius}
              fill="none"
              stroke={PALETTE_CONFIG.hudCyanBright}
              strokeWidth="2.2"
              strokeOpacity="0.72"
              strokeDasharray="44 16 12 16"
            />
          </g>

          {/* Counter-rotating middle segmented ring */}
          <g ref={reticleInnerRef}>
            <circle
              cx="0"
              cy="0"
              r={reticle.innerRadius}
              fill="none"
              stroke={PALETTE_CONFIG.hudCyanBright}
              strokeWidth="5.5"
              strokeOpacity="0.78"
              strokeDasharray="28 16 10 14"
            />
            <circle
              cx="0"
              cy="0"
              r={reticle.innerRadius - 14}
              fill="none"
              stroke={PALETTE_CONFIG.hudIndigoLight}
              strokeWidth="2.2"
              strokeOpacity="0.7"
              strokeDasharray="16 20"
            />
          </g>

          {/* Fine compass tick halo */}
          <g ref={reticleDashRef}>
            <circle
              cx="0"
              cy="0"
              r={reticle.outerRadius + reticle.dashHaloOffset}
              fill="none"
              stroke={PALETTE_CONFIG.hudCyan}
              strokeWidth="1.2"
              strokeOpacity="0.45"
              strokeDasharray="2 7"
            />
          </g>

          {/* Center glowing optical crosshair dot */}
          <circle
            cx="0"
            cy="0"
            r={reticle.dotRadius}
            fill={PALETTE_CONFIG.hudIndigoLight}
            opacity="0.92"
          />
          <line
            x1={-reticle.crosshairLen}
            y1="0"
            x2={-reticle.crosshairGap}
            y2="0"
            stroke={PALETTE_CONFIG.hudCyanBright}
            strokeWidth="1.4"
          />
          <line
            x1={reticle.crosshairGap}
            y1="0"
            x2={reticle.crosshairLen}
            y2="0"
            stroke={PALETTE_CONFIG.hudCyanBright}
            strokeWidth="1.4"
          />
          <line
            x1="0"
            y1={-reticle.crosshairLen}
            x2="0"
            y2={-reticle.crosshairGap}
            stroke={PALETTE_CONFIG.hudCyanBright}
            strokeWidth="1.4"
          />
          <line
            x1="0"
            y1={reticle.crosshairGap}
            x2="0"
            y2={reticle.crosshairLen}
            stroke={PALETTE_CONFIG.hudCyanBright}
            strokeWidth="1.4"
          />
        </g>
      </svg>
    </div>
  );
};
