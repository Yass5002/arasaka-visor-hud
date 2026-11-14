/**
 * Central configuration for the first-person Mars EVA Helmet & Visor HUD.
 * Every color, dimension, position, animation speed, telemetry range, and
 * parallax/damping constant lives here so nothing is hardcoded in components.
 */

export interface VisorMotionConfig {
  /** Perspective camera vertical FOV (degrees) */
  fovDeg: number;
  /** Overscan factor preventing any panorama border exposure at hard limits */
  panoramaCoverScale: number;
  /** Source panorama aspect ratio (2400 / 1225) */
  panoramaAspect: number;
  /** Maximum horizontal camera translation (world units) */
  maxCameraShiftX: number;
  /** Maximum vertical camera translation (world units) */
  maxCameraShiftY: number;
  /** Maximum camera yaw (radians) */
  maxCameraYawRad: number;
  /** Maximum camera pitch (radians) */
  maxCameraPitchRad: number;
  /** Exponential damping for primary mouse look target */
  pointerDamping: number;
  /** Exponential damping for world camera layer (fastest response) */
  sceneDamping: number;
  /** Exponential damping for main holographic HUD layer (trails scene slightly) */
  hudTrailDamping: number;
  /** Exponential damping for floating center reticle (trails slightly behind HUD) */
  reticleTrailDamping: number;
  /** Exponential damping for near-eye interior helmet frame & booms */
  helmetDamping: number;
  /** Milliseconds of mouse stillness before view begins drifting back to center */
  idleReturnDelayMs: number;
  /** Exponential return-to-center decay speed (1/sec) once mouse is idle */
  idleReturnRate: number;
  /** Continuous multi-harmonic breathing sway amplitudes (never reaches zero) */
  breathing: {
    primaryFreqRad: number;
    primaryAmpY: number;
    secondaryFreqRad: number;
    secondaryAmpY: number;
    lateralFreqRad: number;
    lateralAmpX: number;
    microDriftFreqRad: number;
    microDriftAmpX: number;
  };
  /** Per-layer screen-space pixel translation multipliers at [-1, 1] look extremes */
  parallaxOffsets: {
    hudX: number;
    hudY: number;
    hudRotateDeg: number;
    reticleX: number;
    reticleY: number;
    helmetX: number;
    helmetY: number;
    helmetRotateDeg: number;
    domeReflectionsX: number;
    domeReflectionsY: number;
  };
}

export const MOTION_CONFIG: VisorMotionConfig = {
  fovDeg: 46,
  panoramaCoverScale: 1.18,
  panoramaAspect: 2400 / 1225,
  maxCameraShiftX: 0.42,
  maxCameraShiftY: 0.22,
  maxCameraYawRad: 0.024,
  maxCameraPitchRad: 0.016,
  pointerDamping: 4.4,
  sceneDamping: 3.2,
  hudTrailDamping: 2.05,
  reticleTrailDamping: 1.55,
  helmetDamping: 2.45,
  idleReturnDelayMs: 1350,
  idleReturnRate: 0.9,
  breathing: {
    primaryFreqRad: 1.18,
    primaryAmpY: 0.034,
    secondaryFreqRad: 0.51,
    secondaryAmpY: 0.015,
    lateralFreqRad: 0.67,
    lateralAmpX: 0.022,
    microDriftFreqRad: 0.31,
    microDriftAmpX: 0.011,
  },
  parallaxOffsets: {
    hudX: 20,
    hudY: 14,
    hudRotateDeg: 0.55,
    reticleX: 34,
    reticleY: 22,
    helmetX: -12,
    helmetY: -8,
    helmetRotateDeg: -0.45,
    domeReflectionsX: 16,
    domeReflectionsY: 9,
  },
};

export const PANORAMA_CONFIG = {
  nearDist: 22.0,
  farDist: 94.0,
  skyDist: 148.0,
  depthExponent: 0.9,
  meshSegmentsX: 240,
  meshSegmentsY: 120,
  horizonShimmerAmpX: 0.00055,
  horizonShimmerAmpY: 0.00035,
  shadowLiftBase: 0.025,
  shadowLiftBottom: 0.035,
  shadowLumThreshold: 0.32,
  shadowBottomRange: 0.42,
} as const;

export const PALETTE_CONFIG = {
  voidBg: "#030405",
  hudCyan: "#96c2ff",
  hudCyanBright: "#cfe4ff",
  hudCyanGlow: "rgba(142, 188, 255, 0.55)",
  hudIndigo: "#6154ff",
  hudIndigoLight: "#8a7dff",
  hudIndigoTrack: "rgba(96, 84, 255, 0.24)",
  hudTextWhite: "#f4f7ff",
  hudTextDim: "rgba(218, 232, 255, 0.78)",
  hudAlertRed: "#ff4626",
  hudAlertGlow: "rgba(255, 70, 38, 0.68)",
  scanMeshCyan: "rgba(145, 206, 255, 0.62)",
  scanMeshCyanRgb: "155, 212, 255",
  scanMeshNodes: "rgba(210, 238, 255, 0.85)",
  scanMeshNodesRgb: "218, 242, 255",
  cornerStreamFill: "rgba(128, 172, 245, 0.08)",
  helmetShellOuter: "#0b0b0e",
  helmetShellMid: "#1e1e24",
  helmetCheekLight: "#6f6e74",
  helmetCheekMid: "#47464b",
  helmetCheekShadow: "#252429",
  helmetChinCenter: "#3b3a3f",
  helmetChinRight: "#5a585f",
  helmetBoomDark: "#090a0c",
  helmetBoomBody: "#16171b",
  helmetBoomHighlight: "#2f3137",
} as const;

export const OPTICS_CONFIG = {
  vignette: {
    cx: "50%",
    cy: "50%",
    r: "68%",
    clearStop: "82%",
    midStop: "94%",
    midOpacity: 0.1,
    edgeOpacity: 0.24,
    color: "#040405",
  },
  domeReflections: {
    leftX: 268,
    leftY: 226,
    leftRx: 26,
    leftRy: 78,
    rightX: 1652,
    rightY: 226,
    rightRx: 26,
    rightRy: 78,
    opacity: 0.16,
    blurStdDev: 7,
  },
} as const;

export const HELMET_CONFIG = {
  viewBoxW: 1920,
  viewBoxH: 1080,
  /** Near-eye blur depths (px) matching out-of-focus foreground interior */
  shellBlurPx: 3.2,
  cheekBlurPx: 1.8,
  boomBlurPx: 2.8,
  boomTipBlurPx: 2.1,
  contactShadowWidth: 18,
  contactShadowOpacity: 0.34,
  contactShadowBlur: 14,
  /** Inner first-person helmet silhouette — open wide across sky/horizon/sides */
  aperturePath: `
    M 140,86
    C 420,12 1500,12 1780,86
    C 1882,120 1916,245 1916,520
    C 1916,748 1876,884 1766,954
    C 1620,1034 1280,1046 960,1046
    C 640,1046 300,1034 154,954
    C 44,884 4,748 4,520
    C 4,245 38,120 140,86 Z
  `,
  /** Left & right sloped cheek interior shells */
  leftCheekPath: "M 0,742 L 266,978 L 284,1080 L 0,1080 Z",
  rightCheekPath: "M 1920,742 L 1654,978 L 1636,1080 L 1920,1080 Z",
  /** Curved lower chin-lip cowling */
  lowerChinPath: "M 240,1080 C 490,1012 1430,1012 1680,1080 Z",
  lowerChinLipPath: "M 490,1044 C 780,1022 1140,1022 1430,1044 L 1445,1080 L 475,1080 Z",
  /** Left & right lower chin interior microphone / sensor booms */
  leftBoom: {
    armPath: "M 148,1080 L 664,894 L 732,934 L 316,1080 Z",
    ribPath: "M 228,1076 L 672,912 L 690,924 L 268,1080 Z",
    tipCx: 696,
    tipCy: 916,
    tipRx: 36,
    tipRy: 26,
    tipRotateDeg: -20,
  },
  rightBoom: {
    armPath: "M 1772,1080 L 1256,894 L 1188,934 L 1604,1080 Z",
    ribPath: "M 1692,1076 L 1248,912 L 1230,924 L 1652,1080 Z",
    tipCx: 1224,
    tipCy: 916,
    tipRx: 36,
    tipRy: 26,
    tipRotateDeg: 20,
  },
} as const;

export const HUD_CONFIG = {
  viewBoxW: 1920,
  viewBoxH: 1080,
  /** Boot timing (seconds) matching the 11.5s sequence, then looping telemetry */
  timings: {
    frameBootSec: 0.65,
    scanSweepStartSec: 0.15,
    scanSweepDurationSec: 1.55,
    scanPeriodicIntervalSec: 14.0,
    topBoxesFadeStartSec: 0.55,
    radAlertDelaySec: 1.65,
    radPulseFreqHz: 1.25,
    barsRiseDurationSec: 1.35,
    vitalsRampDurationSec: 1.65,
    reticleSpinOuterDegPerSec: 16,
    reticleSpinInnerDegPerSec: -24,
    reticleSpinDashDegPerSec: 9,
    reticlePulseIntervalSec: 4.8,
    telemetryTickMs: 110,
    hexCycleMs: 620,
    codeScrollSpeedPxPerSec: 28,
  },
  /** Hexadecimal addresses cycled in the upper-left header tab */
  hexAddresses: [
    "0x0D55291C",
    "0x2DF960DD",
    "0x72290E19",
    "0x6D6E551E",
    "0x0CCB517D",
    "0x14CC21A2",
    "0x7C22589F",
    "0x548904F6",
    "0x460958D3",
    "0x42790408",
    "0x201C3030",
    "0x30882064",
    "0x3400186D",
    "0x028B3D28",
  ],
  /** Outer chamfered holographic perimeter bracket contours */
  perimeterPaths: [
    { d: "M 28,272 L 268,62 L 456,62 L 486,38 L 788,38 L 814,62 L 856,62", strokeWidth: 2.4, strokeOpacity: 1 },
    { d: "M 42,292 L 274,80 L 452,80 L 482,56 L 784,56", strokeWidth: 1.2, strokeOpacity: 0.6 },
    { d: "M 1064,62 L 1106,62 L 1132,38 L 1434,38 L 1464,62 L 1652,62 L 1892,272", strokeWidth: 2.4, strokeOpacity: 1 },
    { d: "M 1136,56 L 1438,56 L 1468,80 L 1646,80 L 1878,292", strokeWidth: 1.2, strokeOpacity: 0.6 },
    { d: "M 28,272 L 28,314 L 84,352 L 84,598 L 40,636 L 40,736 L 234,826 L 278,808", strokeWidth: 2.2, strokeOpacity: 1 },
    { d: "M 26,650 L 216,742 L 284,798", strokeWidth: 1.3, strokeOpacity: 0.55 },
    { d: "M 280,956 L 234,992 L 142,1022 L 44,986 L 26,888", strokeWidth: 1.9, strokeOpacity: 0.72 },
    { d: "M 1892,272 L 1892,314 L 1836,352 L 1836,598 L 1880,636 L 1880,736 L 1686,826 L 1642,808", strokeWidth: 2.2, strokeOpacity: 1 },
    { d: "M 1894,650 L 1704,742 L 1636,798", strokeWidth: 1.3, strokeOpacity: 0.55 },
    { d: "M 1640,956 L 1686,992 L 1778,1022 L 1876,986 L 1894,888", strokeWidth: 1.9, strokeOpacity: 0.72 },
  ],
  topLeftBox: {
    x: 526,
    y: 44,
    w: 256,
    h: 126,
    fontSize: 14,
  },
  topRightAlert: {
    x: 1146,
    y: 44,
    w: 256,
    h: 126,
    line1: "HIGH RAD",
    line2: "DETECTED",
    fontSize: 31,
  },
  leftBars: {
    originX: 84,
    originY: 344,
    skewDeg: -3.2,
    axisX: 44,
    barStartX: 48,
    labelX: 34,
    labelFontSize: 13.5,
    barHeight: 19,
    barGap: 41,
    maxBarWidth: 368,
    yearBaseX: 64,
    yearStepX: 82,
    yearFontSize: 11.5,
    axisYears: ["2016", "2017", "2018", "2019", "2020"],
    rows: [
      { basePct: 72.4, ampPct: 14.5, freq: 0.42, phase: 0.0 },
      { basePct: 68.2, ampPct: 12.8, freq: 0.55, phase: 1.1 },
      { basePct: 43.6, ampPct: 11.4, freq: 0.48, phase: 2.3 },
      { basePct: 62.8, ampPct: 13.6, freq: 0.39, phase: 3.4 },
      { basePct: 79.5, ampPct: 11.2, freq: 0.51, phase: 4.6 },
    ],
  },
  unitBlock: {
    x: 294,
    y: 740,
    skewDeg: -4,
    hashCount: 18,
    hashSpacing: 13,
    unitFontSize: 19,
    coordFontSize: 11.5,
    footerFontSize: 10,
    units: ["UNIT 01", "UNIT 02", "UNIT 03"],
    unitOscillators: [
      { baseA: 320, baseB: 440, baseC: 510, ampA: 42, ampB: 31, ampC: 27, freqA: 1.2, freqB: 0.9, freqC: 1.5, init: "531.18/443.41/535.43" },
      { baseA: 435, baseB: 528, baseC: 575, ampA: 42, ampB: 31, ampC: 27, freqA: 1.6, freqB: 1.2, freqC: 1.75, init: "264.11/558.42/678.52" },
      { baseA: 550, baseB: 616, baseC: 640, ampA: 42, ampB: 31, ampC: 27, freqA: 2.0, freqB: 1.5, freqC: 2.0, init: "183.43/624.83/546.87" },
    ],
    footerSeed: ["32359904.442", "2595602.5", "394.2", "9582.249", "0.1", "384.05"],
    footerOscillators: [
      { base: 32359904.4, amp: 14.2, freq: 0.7, mode: "sin", decimals: 3 },
      { base: 2595602.5, amp: 8.4, freq: 1.1, mode: "cos", decimals: 1 },
      { base: 394.2, amp: 6.5, freq: 1.4, mode: "sin", decimals: 1 },
      { base: 9582.2, amp: 12.1, freq: 0.9, mode: "cos", decimals: 3 },
      { base: 0.1, amp: 0.4, freq: 0.6, mode: "abssin", decimals: 1 },
      { base: 384.05, amp: 4.2, freq: 1.3, mode: "sin", decimals: 2 },
    ],
    tetherAnchorOffsetX: 140,
    tetherAnchorOffsetY: 16,
  },
  vitals: {
    x: 726,
    y: 774,
    barWidth: 392,
    barHeight: 25,
    rowGap: 46,
    o2LabelFontSize: 24,
    atmLabelFontSize: 22,
    valueFontSize: 20,
    o2ValueX: 84,
    atmValueX: 128,
    tetherAnchorOffsetX: 190,
    tetherAnchorOffsetY: 0,
    o2: { label: "O", sub: "2", base: 0.129, amp: 0.006, freq: 0.62, max: 0.22, unit: "%" },
    atm: { label: "ATM", base: 7.4, amp: 0.65, freq: 0.44, max: 12.0, unit: "mb" },
  },
  altitudeTape: {
    x: 1712,
    topY: 198,
    bottomY: 822,
    skewDeg: 3.2,
    tickCount: 38,
    valueStepPerTick: 0.12,
    tickLabelFontSize: 11,
    pitchSensitivityPx: 54,
    idleWaveAmpPx: 5,
    idleWaveFreqRad: 0.8,
    baseValue: 14.2,
  },
  reticle: {
    baseCx: 912,
    baseCy: 556,
    outerRadius: 94,
    innerRadius: 56,
    dashHaloOffset: 24,
    dotRadius: 4,
    crosshairGap: 7,
    crosshairLen: 18,
    pulseThreshold: 0.28,
  },
  cornerStreams: {
    left: { x: 46, y: 804, w: 214, h: 204, skewDeg: 14, rotateYDeg: 22 },
    right: { x: 1656, y: 804, w: 214, h: 204, skewDeg: -14, rotateYDeg: -22 },
    lineCount: 36,
    cycleHeightPx: 180,
    lineStepY: 5,
    lineHeightPx: 2.2,
  },
  scanSweep: {
    canvasWidth: 960,
    canvasHeight: 540,
    cols: 7,
    rows: 13,
    bandWidthRatio: 0.22,
    tiltFactor: 0.08,
    lineWidth: 1.15,
    bowAmplitudePx: 34,
    verticalCurvePx: 18,
    maxAlphaBoot: 0.95,
    maxAlphaPeriodic: 0.55,
  },
} as const;
