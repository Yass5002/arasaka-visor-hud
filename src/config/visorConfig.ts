/**
 * Central configuration for the unified 3D first-person Mars EVA Helmet & Visor Scene.
 * Every dimension, color, coordinate, shader optic, PBR texture setting, animation timing,
 * and head/eye motion parameter lives here so nothing is hardcoded in scene or HUD modules.
 */

export const SCENE_CONFIG = {
  fovDeg: 46,
  nearPlane: 0.03,
  farPlane: 260,
  maxPixelRatio: 2,
  voidBg: "#030405",
  /**
   * Mars sun direction verified from Perseverance panorama (public/mars/mars-terrain-solid.webp):
   * upper-left sky glow casts rock shadows toward +X / +Z (lower-right).
   */
  marsSun: {
    direction: [-0.68, 0.50, -0.54] as readonly [number, number, number],
    color: "#ffd9b3",
    intensity: 2.35,
  },
  /** Warm rusty regolith bounce light illuminating the underside of chin/booms/cheeks */
  marsGroundBounce: {
    direction: [0.15, -0.92, -0.36] as readonly [number, number, number],
    color: "#b86b43",
    intensity: 0.72,
  },
  /** Soft dusty Martian sky fill vs dark interior floor */
  hemisphereLight: {
    skyColor: "#c89e74",
    groundColor: "#1b1412",
    intensity: 0.68,
  },
  /** Faint cool visor back-scatter fill inside cavity so dark carbon parts retain readable form */
  cavityFill: {
    direction: [0.45, 0.18, 0.87] as readonly [number, number, number],
    color: "#7e92b5",
    intensity: 0.34,
  },
} as const;

export const MOTION_CONFIG = {
  /** Base overscan ensuring panorama borders never appear across viewports & look limits */
  panoramaCoverScale: 1.25,
  panoramaAspect: 2400 / 1225,
  /** Angular margin kept between screen ray extremes and panorama image edge (radians) */
  edgeSafetyMarginRad: 0.012,
  /** Primary mouse target exponential damping */
  pointerDamping: 4.0,
  /** Milliseconds of mouse stillness before gaze drifts smoothly back to center */
  idleReturnDelayMs: 1450,
  /** Exponential return-to-center decay speed (1/sec) once idle */
  idleReturnRate: 0.72,
  /** Heavy rigid-body head movement (turns helmet + curved glass + HUD together) */
  head: {
    damping: 1.65,
    maxYawRad: 0.042,
    maxPitchRad: 0.028,
    rollPerYawRatio: -0.18,
    breathing: {
      pitchFreqRad: 1.08,
      pitchAmpRad: 0.0042,
      pitchHarmonicFreqRad: 0.47,
      pitchHarmonicAmpRad: 0.0018,
      yawFreqRad: 0.59,
      yawAmpRad: 0.0026,
      rollFreqRad: 0.53,
      rollAmpRad: 0.0024,
    },
  },
  /** Independent eye movement inside the helmet cavity (creates true 3D perspective shift) */
  eye: {
    damping: 3.1,
    maxYawRad: 0.032,
    maxPitchRad: 0.026,
    maxShiftX: 0.021,
    maxShiftY: 0.017,
    maxShiftZ: 0.005,
    /** Shifting camera slightly down when looking down brings close chin/booms naturally into view */
    shiftYPerLookY: -0.015,
    shiftZPerLookY: 0.004,
    breathing: {
      yawFreqRad: 0.71,
      yawAmpRad: 0.0016,
      pitchFreqRad: 1.24,
      pitchAmpRad: 0.0018,
      shiftXFreqRad: 0.43,
      shiftXAmp: 0.0018,
      shiftYFreqRad: 0.89,
      shiftYAmp: 0.0022,
    },
  },
} as const;

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

export const HELMET_GEO_CONFIG = {
  /** Superellipse outer helmet aperture opening (1:1.42 ratio) at visor glass seal depth */
  aperture: {
    sealZ: -0.285,
    innerRimZ: -0.225,
    browCheekZ: -0.135,
    backWallZ: 0.08,
    halfWidth: 0.226,
    halfHeight: 0.159,
    superellipsePower: 2.85,
    radialSteps: 84,
    ringFlareOutward: 0.065,
    gasketTubeRadius: 0.011,
  },
  /** Sloped matte ballistic-grey inner cheek cowls */
  cheeks: {
    offsetX: 0.154,
    offsetY: -0.084,
    offsetZ: -0.196,
    width: 0.168,
    height: 0.062,
    depth: 0.036,
    bevelSize: 0.007,
    tiltZDeg: 25,
    yawInDeg: 24,
    pitchUpDeg: -14,
  },
  /** Lower chin cowling bar & inner rubber gasket lip */
  chin: {
    centerY: -0.088,
    centerZ: -0.192,
    arcRadiusX: 0.215,
    arcRadiusZ: 0.092,
    arcSpanDeg: 102,
    barThicknessY: 0.034,
    barDepthZ: 0.044,
    lipTubeRadius: 0.0075,
    bridgeWidth: 0.088,
    bridgeHeight: 0.022,
  },
  /** Single right-side articulated microphone boom mounted flush into the right cheek housing */
  rightBoom: {
    /** Anchor embedded inside the right cheek/chin joint */
    mountX: 0.122,
    mountY: -0.078,
    mountZ: -0.200,
    /** Articulated gooseneck spine curving along chin contour toward mouth-right */
    elbowX: 0.088,
    elbowY: -0.072,
    elbowZ: -0.184,
    neckX: 0.058,
    neckY: -0.063,
    neckZ: -0.174,
    tipX: 0.036,
    tipY: -0.056,
    tipZ: -0.169,
    mountPlateWidth: 0.034,
    mountPlateHeight: 0.026,
    mountSocketRadius: 0.014,
    flexRibCount: 6,
    armBaseRadius: 0.0072,
    armTipRadius: 0.0052,
    capsuleRadius: 0.0096,
    capsuleLength: 0.020,
    capsuleTiltXDeg: -22,
    capsuleTiltYDeg: 28,
  },
  /** Interior padding bolsters, braided conduit cables, and machined hex bolts */
  details: {
    paddingCornerX: 0.186,
    paddingCornerY: 0.112,
    paddingCornerZ: -0.215,
    cableRadius: 0.0046,
    boltRadius: 0.0038,
  },
  /** Procedural PBR surface textures & material appearance */
  pbr: {
    texSize: 512,
    shellColor: "#1a1b20",
    shellRoughness: 0.64,
    shellMetalness: 0.12,
    shellBumpScale: 0.0024,
    gasketColor: "#101114",
    gasketRoughness: 0.86,
    gasketBumpScale: 0.0018,
    cheekColor: "#636268",
    cheekRoughness: 0.56,
    cheekMetalness: 0.16,
    cheekBumpScale: 0.0016,
    chinColor: "#3d3c42",
    chinRoughness: 0.58,
    chinMetalness: 0.14,
    paddingColor: "#24252b",
    paddingRoughness: 0.88,
    paddingBumpScale: 0.0032,
    boomColor: "#191a1f",
    boomRoughness: 0.44,
    boomMetalness: 0.50,
    boomRimColor: "#52555e",
    socketDarkColor: "#090a0d",
    windscreenColor: "#141519",
    windscreenRoughness: 0.94,
    metalFastenerColor: "#7a7d86",
    metalFastenerRoughness: 0.32,
    metalFastenerMetalness: 0.84,
    cableColor: "#1b1c22",
    cableRoughness: 0.68,
  },
  /** Optical Depth-of-Field settings for near-eye foreground helmet parts (Mars untouched) */
  dof: {
    /** World distance (meters) from eye where helmet blur fades completely to crisp */
    nearFullFocusDist: 0.33,
    /** Distance (meters) from eye where foreground bokeh reaches maxBlurPx */
    nearMaxBlurDist: 0.145,
    /** Maximum foreground bokeh blur radius (pixels at 1080p reference height) */
    maxBlurPx: 7.5,
    /** Bokeh circular tap count in composite shader */
    sampleCount: 16,
    /** Alpha boost smoothness on silhouette edges */
    alphaFeatherGamma: 0.92,
  },
} as const;

export const VISOR_GLASS_CONFIG = {
  /** Spherical curved visor dome (120° vertical by 170° horizontal, ~1:1.42 ratio) rigidly in headGroup */
  dome: {
    centerX: 0,
    centerY: 0,
    centerZ: 0.02,
    radiusX: 0.345,
    radiusY: 0.345,
    radiusZ: 0.345,
    arcYawDeg: 170,
    arcPitchDeg: 120,
    segmentsW: 72,
    segmentsH: 52,
  },
  /** Unstretched 1:1.42 angular HUD projection window inside the 170°x120° curved dome */
  hudWindowUv: {
    uMin: 0.3475,
    uMax: 0.6525,
    vMin: 0.348,
    vMax: 0.652,
  },
  /** Offscreen HUD texture matching exact 1:1.42 aspect so nothing stretches across the curved glass */
  hudTexture: {
    width: 1136,
    height: 800,
    updateFps: 30,
  },
  /** Projected optical light & glass thickness properties (strictly additive over Mars) */
  optics: {
    /** Overall see-through projected light intensity */
    hudIntensity: 0.92,
    /** Optical focus softness radius (in HUD UV texel units) */
    softBlurRadiusTexels: 1.55,
    /** Optical bloom halo strength & wide spread */
    bloomStrength: 0.44,
    bloomSpreadTexels: 5.8,
    /** Faint ghost double image from outer/inner thick curved visor reflections */
    ghostOffsetUv: [0.0058, -0.0046] as readonly [number, number],
    ghostViewParallax: 0.012,
    ghostOpacity: 0.24,
    /** Subtle RGB chromatic aberration increasing radially toward curved glass edges */
    chromaticEdgeStrength: 0.0044,
    chromaticPower: 1.65,
    /** Very faint additive curved dome specular sheen from Martian sun & grazing Fresnel */
    domeSpecularOpacity: 0.065,
    domeSpecularColor: "#ffe4c8",
    domeFresnelOpacity: 0.032,
    domeFresnelPower: 3.4,
    domeFresnelColor: "#9dc5ff",
  },
} as const;

export const HUD_CONFIG = {
  canvasW: 1136,
  canvasH: 800,
  palette: {
    hudCyan: "#96c2ff",
    hudCyanBright: "#cfe4ff",
    hudCyanGlow: "rgba(142, 188, 255, 0.72)",
    hudIndigo: "#6154ff",
    hudIndigoLight: "#8a7dff",
    hudIndigoTrack: "rgba(96, 84, 255, 0.28)",
    hudTextWhite: "#f2f6ff",
    hudTextDim: "rgba(218, 232, 255, 0.80)",
    hudAlertRed: "#ff4828",
    hudAlertGlow: "rgba(255, 72, 40, 0.82)",
    scanMeshCyanRgb: "155, 212, 255",
    scanMeshNodesRgb: "222, 244, 255",
    cornerStreamFill: "rgba(128, 172, 245, 0.09)",
  },
  timings: {
    frameBootSec: 0.75,
    scanSweepStartSec: 0.15,
    scanSweepDurationSec: 1.65,
    scanPeriodicIntervalSec: 13.5,
    radAlertDelaySec: 1.65,
    radPulseFreqHz: 1.22,
    barsRiseDurationSec: 1.45,
    vitalsRampDurationSec: 1.75,
    telemetryTickMs: 110,
    hexCycleMs: 620,
    codeScrollSpeedPxPerSec: 18,
  },
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
  /** Normalized [0..1] polyline paths inside the HUD canvas for chamfered double-line perimeter brackets */
  perimeterPaths: [
    {
      points: [
        [0.015, 0.252],
        [0.140, 0.057],
        [0.238, 0.057],
        [0.253, 0.035],
        [0.410, 0.035],
        [0.424, 0.057],
        [0.446, 0.057],
      ],
      lineWidth: 1.8,
      alpha: 0.92,
    },
    {
      points: [
        [0.022, 0.270],
        [0.143, 0.074],
        [0.235, 0.074],
        [0.251, 0.052],
        [0.408, 0.052],
      ],
      lineWidth: 0.95,
      alpha: 0.56,
    },
    {
      points: [
        [0.554, 0.057],
        [0.576, 0.057],
        [0.590, 0.035],
        [0.747, 0.035],
        [0.762, 0.057],
        [0.860, 0.057],
        [0.985, 0.252],
      ],
      lineWidth: 1.8,
      alpha: 0.92,
    },
    {
      points: [
        [0.592, 0.052],
        [0.749, 0.052],
        [0.765, 0.074],
        [0.857, 0.074],
        [0.978, 0.270],
      ],
      lineWidth: 0.95,
      alpha: 0.56,
    },
    {
      points: [
        [0.015, 0.252],
        [0.015, 0.291],
        [0.044, 0.326],
        [0.044, 0.554],
        [0.021, 0.589],
        [0.021, 0.681],
        [0.122, 0.765],
        [0.145, 0.748],
      ],
      lineWidth: 1.65,
      alpha: 0.9,
    },
    {
      points: [
        [0.014, 0.602],
        [0.112, 0.687],
        [0.148, 0.739],
      ],
      lineWidth: 1.0,
      alpha: 0.54,
    },
    {
      points: [
        [0.146, 0.885],
        [0.122, 0.918],
        [0.074, 0.946],
        [0.023, 0.913],
        [0.014, 0.822],
      ],
      lineWidth: 1.4,
      alpha: 0.7,
    },
    {
      points: [
        [0.985, 0.252],
        [0.985, 0.291],
        [0.956, 0.326],
        [0.956, 0.554],
        [0.979, 0.589],
        [0.979, 0.681],
        [0.878, 0.765],
        [0.855, 0.748],
      ],
      lineWidth: 1.65,
      alpha: 0.9,
    },
    {
      points: [
        [0.986, 0.602],
        [0.888, 0.687],
        [0.852, 0.739],
      ],
      lineWidth: 1.0,
      alpha: 0.54,
    },
    {
      points: [
        [0.854, 0.885],
        [0.878, 0.918],
        [0.926, 0.946],
        [0.977, 0.913],
        [0.986, 0.822],
      ],
      lineWidth: 1.4,
      alpha: 0.7,
    },
  ],
  topLeftBox: {
    x: 0.264,
    y: 0.041,
    w: 0.155,
    h: 0.117,
    fontSizeRatio: 0.0155,
  },
  topRightAlert: {
    x: 0.581,
    y: 0.041,
    w: 0.155,
    h: 0.117,
    line1: "HIGH RAD",
    line2: "DETECTED",
    fontSizeRatio: 0.0285,
  },
  leftBars: {
    originX: 0.052,
    originY: 0.322,
    barHeight: 0.018,
    barGap: 0.038,
    maxBarWidth: 0.186,
    labelFontRatio: 0.0135,
    yearFontRatio: 0.0115,
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
    x: 0.156,
    y: 0.688,
    hashCount: 16,
    hashSpacing: 0.0072,
    unitFontRatio: 0.0185,
    coordFontRatio: 0.0115,
    footerFontRatio: 0.010,
    units: ["UNIT 01", "UNIT 02", "UNIT 03"],
    unitOscillators: [
      { baseA: 320, baseB: 440, baseC: 510, ampA: 42, ampB: 31, ampC: 27, freqA: 1.2, freqB: 0.9, freqC: 1.5 },
      { baseA: 435, baseB: 528, baseC: 575, ampA: 42, ampB: 31, ampC: 27, freqA: 1.6, freqB: 1.2, freqC: 1.75 },
      { baseA: 550, baseB: 616, baseC: 640, ampA: 42, ampB: 31, ampC: 27, freqA: 2.0, freqB: 1.5, freqC: 2.0 },
    ],
    footerOscillators: [
      { base: 32359904.4, amp: 14.2, freq: 0.7, mode: "sin", decimals: 3 },
      { base: 2595602.5, amp: 8.4, freq: 1.1, mode: "cos", decimals: 1 },
      { base: 394.2, amp: 6.5, freq: 1.4, mode: "sin", decimals: 1 },
      { base: 9582.2, amp: 12.1, freq: 0.9, mode: "cos", decimals: 3 },
      { base: 0.1, amp: 0.4, freq: 0.6, mode: "abssin", decimals: 1 },
      { base: 384.05, amp: 4.2, freq: 1.3, mode: "sin", decimals: 2 },
    ],
  },
  vitals: {
    x: 0.392,
    y: 0.728,
    barWidth: 0.215,
    barHeight: 0.023,
    rowGap: 0.043,
    labelFontRatio: 0.022,
    valueFontRatio: 0.019,
    o2: { label: "O", sub: "2", base: 0.129, amp: 0.006, freq: 0.62, max: 0.22, unit: "%" },
    atm: { label: "ATM", base: 7.4, amp: 0.65, freq: 0.44, max: 12.0, unit: "mb" },
  },
  altitudeTape: {
    x: 0.892,
    topY: 0.185,
    bottomY: 0.762,
    tickCount: 38,
    valueStepPerTick: 0.12,
    tickLabelFontRatio: 0.0105,
    pitchSensitivityPxRatio: 0.095,
    idleWaveAmpPxRatio: 0.0045,
    idleWaveFreqRad: 0.8,
    baseValue: 14.2,
  },
  cornerStreams: {
    left: { x: 0.024, y: 0.746, w: 0.112, h: 0.190 },
    right: { x: 0.864, y: 0.746, w: 0.112, h: 0.190 },
    lineCount: 34,
    cycleHeightRatio: 0.168,
    lineStepRatio: 0.0048,
    lineHeightRatio: 0.0022,
  },
  scanSweep: {
    cols: 8,
    rows: 14,
    bandWidthRatio: 0.22,
    tiltFactor: 0.08,
    lineWidth: 1.05,
    bowAmplitudeRatio: 0.028,
    verticalCurveRatio: 0.016,
    maxAlphaBoot: 0.92,
    maxAlphaPeriodic: 0.52,
  },
} as const;
