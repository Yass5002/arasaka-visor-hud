import * as THREE from "three";
import { HELMET_GEO_CONFIG, VISOR_GLASS_CONFIG } from "../config/visorConfig";

export interface PbrTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export interface HelmetTextures {
  shell: PbrTextureSet;
  cheek: PbrTextureSet;
  padding: PbrTextureSet;
  cable: PbrTextureSet;
  grille: PbrTextureSet;
  dispose: () => void;
}

function hash2d(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function smoothNoise2d(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2d(xi, yi);
  const b = hash2d(xi + 1, yi);
  const c = hash2d(xi, yi + 1);
  const d = hash2d(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm2d(x: number, y: number): number {
  return (
    smoothNoise2d(x, y) * 0.56 +
    smoothNoise2d(x * 2.03 + 11.4, y * 2.03 + 7.1) * 0.3 +
    smoothNoise2d(x * 4.11 + 23.7, y * 4.11 + 19.3) * 0.14
  );
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function generateGrainSet(
  size: number,
  baseRgb: [number, number, number],
  grainAmp: number,
  streakAmp: number,
  roughBase: number,
  roughSpread: number,
  repeat: number
): PbrTextureSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cBump, ctxBump] = makeCanvas(size);
  const [cRough, ctxRough] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgBump = ctxBump.createImageData(size, size);
  const imgRough = ctxRough.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const rowStreak = (hash2d(y * 0.25, 19.3) - 0.5) * streakAmp;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const fine = (hash2d(x * 0.9, y * 0.9) - 0.5) * grainAmp;
      const med =
        (hash2d(Math.floor(x / 3), Math.floor(y / 3)) - 0.5) * (grainAmp * 0.65);
      const weave =
        Math.sin((x + y) * 0.42) * Math.sin((x - y) * 0.42) * (streakAmp * 0.35);

      const delta = fine + med + rowStreak + weave;

      imgCol.data[idx] = Math.max(0, Math.min(255, baseRgb[0] + delta));
      imgCol.data[idx + 1] = Math.max(0, Math.min(255, baseRgb[1] + delta));
      imgCol.data[idx + 2] = Math.max(0, Math.min(255, baseRgb[2] + delta));
      imgCol.data[idx + 3] = 255;

      const bumpVal = Math.max(0, Math.min(255, 128 + delta * 2.2));
      imgBump.data[idx] = bumpVal;
      imgBump.data[idx + 1] = bumpVal;
      imgBump.data[idx + 2] = bumpVal;
      imgBump.data[idx + 3] = 255;

      const rVal = Math.max(
        0,
        Math.min(255, (roughBase + (fine / Math.max(1, grainAmp)) * roughSpread) * 255)
      );
      imgRough.data[idx] = rVal;
      imgRough.data[idx + 1] = rVal;
      imgRough.data[idx + 2] = rVal;
      imgRough.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxBump.putImageData(imgBump, 0, 0);
  ctxRough.putImageData(imgRough, 0, 0);

  return {
    map: finalizeTexture(cCol, true, repeat, repeat),
    bumpMap: finalizeTexture(cBump, false, repeat, repeat),
    roughnessMap: finalizeTexture(cRough, false, repeat, repeat),
  };
}

function generatePaddingSet(size: number, baseRgb: [number, number, number]): PbrTextureSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cBump, ctxBump] = makeCanvas(size);
  const [cRough, ctxRough] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgBump = ctxBump.createImageData(size, size);
  const imgRough = ctxRough.createImageData(size, size);

  const cell = 32;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const u = ((x + y) % cell) / cell;
      const v = (((x - y) % cell) + cell) % cell / cell;
      const seam = Math.min(u, 1 - u, v, 1 - v);
      const puff = Math.pow(Math.min(1, seam * 5.2), 0.65);
      const weave = (Math.sin(x * 1.4) + Math.cos(y * 1.4)) * 3.5;
      const micro = (hash2d(x, y) - 0.5) * 8;

      const shade = puff * 18 - 10 + weave + micro;
      imgCol.data[idx] = Math.max(0, Math.min(255, baseRgb[0] + shade));
      imgCol.data[idx + 1] = Math.max(0, Math.min(255, baseRgb[1] + shade));
      imgCol.data[idx + 2] = Math.max(0, Math.min(255, baseRgb[2] + shade));
      imgCol.data[idx + 3] = 255;

      const bVal = Math.max(0, Math.min(255, 65 + puff * 175 + weave * 2));
      imgBump.data[idx] = bVal;
      imgBump.data[idx + 1] = bVal;
      imgBump.data[idx + 2] = bVal;
      imgBump.data[idx + 3] = 255;

      const rVal = Math.max(0, Math.min(255, (0.86 - puff * 0.14) * 255));
      imgRough.data[idx] = rVal;
      imgRough.data[idx + 1] = rVal;
      imgRough.data[idx + 2] = rVal;
      imgRough.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxBump.putImageData(imgBump, 0, 0);
  ctxRough.putImageData(imgRough, 0, 0);

  return {
    map: finalizeTexture(cCol, true, 3, 3),
    bumpMap: finalizeTexture(cBump, false, 3, 3),
    roughnessMap: finalizeTexture(cRough, false, 3, 3),
  };
}

function generateCableSet(size: number, baseRgb: [number, number, number]): PbrTextureSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cBump, ctxBump] = makeCanvas(size);
  const [cRough, ctxRough] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgBump = ctxBump.createImageData(size, size);
  const imgRough = ctxRough.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const braidA = Math.sin((x + y * 1.4) * 0.35);
      const braidB = Math.sin((x - y * 1.4) * 0.35);
      const ridge = Math.max(braidA, braidB);
      const micro = (hash2d(x, y) - 0.5) * 6;

      const shade = ridge * 14 + micro;
      imgCol.data[idx] = Math.max(0, Math.min(255, baseRgb[0] + shade));
      imgCol.data[idx + 1] = Math.max(0, Math.min(255, baseRgb[1] + shade));
      imgCol.data[idx + 2] = Math.max(0, Math.min(255, baseRgb[2] + shade));
      imgCol.data[idx + 3] = 255;

      const bVal = Math.max(0, Math.min(255, 128 + ridge * 95));
      imgBump.data[idx] = bVal;
      imgBump.data[idx + 1] = bVal;
      imgBump.data[idx + 2] = bVal;
      imgBump.data[idx + 3] = 255;

      const rVal = Math.max(0, Math.min(255, (0.65 - ridge * 0.16) * 255));
      imgRough.data[idx] = rVal;
      imgRough.data[idx + 1] = rVal;
      imgRough.data[idx + 2] = rVal;
      imgRough.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxBump.putImageData(imgBump, 0, 0);
  ctxRough.putImageData(imgRough, 0, 0);

  return {
    map: finalizeTexture(cCol, true, 6, 1),
    bumpMap: finalizeTexture(cBump, false, 6, 1),
    roughnessMap: finalizeTexture(cRough, false, 6, 1),
  };
}

function generateAcousticGrilleSet(size: number): PbrTextureSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cBump, ctxBump] = makeCanvas(size);
  const [cRough, ctxRough] = makeCanvas(size);

  ctxCol.fillStyle = "#2b2d33";
  ctxCol.fillRect(0, 0, size, size);
  ctxBump.fillStyle = "#d0d0d0";
  ctxBump.fillRect(0, 0, size, size);
  ctxRough.fillStyle = "#707070";
  ctxRough.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Machined concentric bezel groove
  ctxCol.strokeStyle = "#484b54";
  ctxCol.lineWidth = size * 0.035;
  ctxCol.beginPath();
  ctxCol.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctxCol.stroke();

  ctxBump.strokeStyle = "#ffffff";
  ctxBump.lineWidth = size * 0.03;
  ctxBump.beginPath();
  ctxBump.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctxBump.stroke();

  // Hexagonal lattice of perforated microphone ports
  const spacing = size * 0.135;
  const holeR = size * 0.044;
  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      const px = cx + (col + (row % 2 === 0 ? 0 : 0.5)) * spacing;
      const py = cy + row * spacing * 0.866;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist > size * 0.34) continue;

      ctxCol.fillStyle = "#060709";
      ctxCol.beginPath();
      ctxCol.arc(px, py, holeR, 0, Math.PI * 2);
      ctxCol.fill();

      ctxBump.fillStyle = "#121212";
      ctxBump.beginPath();
      ctxBump.arc(px, py, holeR, 0, Math.PI * 2);
      ctxBump.fill();

      ctxRough.fillStyle = "#e8e8e8";
      ctxRough.beginPath();
      ctxRough.arc(px, py, holeR, 0, Math.PI * 2);
      ctxRough.fill();
    }
  }

  return {
    map: finalizeTexture(cCol, true, 1, 1),
    bumpMap: finalizeTexture(cBump, false, 1, 1),
    roughnessMap: finalizeTexture(cRough, false, 1, 1),
  };
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

export function createHelmetTextures(): HelmetTextures {
  const { pbr } = HELMET_GEO_CONFIG;
  const size = pbr.texSize;

  const shell = generateGrainSet(size, hexToRgbTuple(pbr.shellColor), 18, 8, pbr.shellRoughness, 0.14, 4);
  const cheek = generateGrainSet(size, hexToRgbTuple(pbr.cheekColor), 14, 12, pbr.cheekRoughness, 0.12, 2);
  const padding = generatePaddingSet(size, hexToRgbTuple(pbr.paddingColor));
  const cable = generateCableSet(size, hexToRgbTuple(pbr.cableColor));
  const grille = generateAcousticGrilleSet(256);

  return {
    shell,
    cheek,
    padding,
    cable,
    grille,
    dispose: () => {
      for (const set of [shell, cheek, padding, cable, grille]) {
        set.map.dispose();
        set.bumpMap.dispose();
        set.roughnessMap.dispose();
      }
    },
  };
}

/**
 * Generates an RGBA packed polycarbonate surface map mapped strictly over the visible visor window:
 * - R: Perimeter Martian regolith dust density (clumped mist + crisp pinpoint mineral specks)
 * - G: Micro-scratches & cloth wipe swirl arcs (for anisotropic specular glints)
 * - B: Thermoformed polycarbonate optical mold wave & coating variation
 * - A: Lower-corner anti-fog edge haze near the chin/cheek rubber seal
 */
export function createVisorSurfaceTexture(): THREE.CanvasTexture {
  const size = VISOR_GLASS_CONFIG.surface.texSize;

  const [, ctxScratch] = makeCanvas(size);
  ctxScratch.fillStyle = "#000000";
  ctxScratch.fillRect(0, 0, size, size);
  ctxScratch.lineCap = "round";

  // Seeded wipe arcs & tiny field micro-scratches mostly outside the central reading sweet spot
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 210; i++) {
    const angle = rand() * Math.PI * 2;
    const rad = (0.28 + Math.pow(rand(), 0.72) * 0.68) * (size * 0.5);
    const sx = size * 0.5 + Math.cos(angle) * rad * 1.08;
    const sy = size * 0.5 + Math.sin(angle) * rad * 0.88;
    const dir = rand() * Math.PI * 2;
    const len = size * (0.018 + rand() * 0.068);
    const ex = sx + Math.cos(dir) * len;
    const ey = sy + Math.sin(dir) * len;
    const bend = (rand() - 0.5) * len * 0.42;
    const cx = (sx + ex) * 0.5 - Math.sin(dir) * bend;
    const cy = (sy + ey) * 0.5 + Math.cos(dir) * bend;

    const alpha = 0.06 + rand() * 0.24;
    ctxScratch.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    ctxScratch.lineWidth = 0.55 + rand() * 0.65;
    ctxScratch.beginPath();
    ctxScratch.moveTo(sx, sy);
    ctxScratch.quadraticCurveTo(cx, cy, ex, ey);
    ctxScratch.stroke();
  }

  // Concentric soft microfiber cloth wipe arcs around peripheral zones
  for (let i = 0; i < 36; i++) {
    const centerR = size * (0.36 + rand() * 0.25);
    const a0 = rand() * Math.PI * 2;
    const arcLen = 0.22 + rand() * 0.45;
    const cx = size * 0.5 + (rand() - 0.5) * size * 0.22;
    const cy = size * 0.5 + (rand() - 0.5) * size * 0.22;
    const alpha = 0.04 + rand() * 0.09;
    ctxScratch.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    ctxScratch.lineWidth = 0.75 + rand() * 0.55;
    ctxScratch.beginPath();
    ctxScratch.arc(cx, cy, centerR, a0, a0 + arcLen);
    ctxScratch.stroke();
  }

  const [, ctxDust] = makeCanvas(size);
  ctxDust.fillStyle = "#000000";
  ctxDust.fillRect(0, 0, size, size);
  for (let i = 0; i < 1600; i++) {
    const angle = rand() * Math.PI * 2;
    const edgeBias = 0.42 + Math.pow(rand(), 0.48) * 0.58;
    const px = size * 0.5 + Math.cos(angle) * edgeBias * size * 0.54;
    const py = size * 0.5 + Math.sin(angle) * edgeBias * size * 0.52;
    const r = 0.45 + Math.pow(rand(), 2.2) * 1.75;
    const bright = 0.14 + rand() * 0.78;
    ctxDust.fillStyle = `rgba(255, 255, 255, ${bright.toFixed(3)})`;
    ctxDust.beginPath();
    ctxDust.arc(px, py, r, 0, Math.PI * 2);
    ctxDust.fill();
  }

  const [cOut, ctxOut] = makeCanvas(size);
  const scratchData = ctxScratch.getImageData(0, 0, size, size).data;
  const dustSpecks = ctxDust.getImageData(0, 0, size, size).data;
  const outImg = ctxOut.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    const dv = (v - 0.5) * 2.0;
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const du = (u - 0.5) * 2.0;
      const idx = (y * size + x) * 4;

      // Elliptical sightline clearance mask (preserves central optical window crystal clarity)
      const rEllip = Math.hypot(du * 1.02, dv * 1.18);
      const centerClearMask = smoothstep(0.36, 0.86, rEllip);
      const perimeterMask = smoothstep(0.44, 0.96, rEllip);
      const borderGuard = smoothstep(0.0, 0.015, Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v)));

      // R: Fine perimeter Martian regolith haze + pinpoint dust particles
      const dustNoise = fbm2d(u * 9.5 + 3.1, v * 9.5 + 5.7);
      const mistDust = Math.pow(Math.max(0, dustNoise - 0.28) / 0.72, 1.45) * 0.48 * perimeterMask;
      const speckDust = (dustSpecks[idx] / 255) * (0.08 + 0.92 * centerClearMask);
      const dustVal = Math.min(255, Math.round((mistDust + speckDust) * borderGuard * 255));

      // G: Micro-scratches & wipe swirls muted tightly in central sightline
      const scratchRaw = scratchData[idx] / 255;
      const scratchMask = (0.12 + 0.88 * smoothstep(0.24, 0.78, rEllip)) * borderGuard;
      const scratchVal = Math.min(255, Math.round(scratchRaw * scratchMask * 255));

      // B: Organic thermoformed polycarbonate mold wave & thin-film variation
      const wave = fbm2d(u * 4.2 + 17.3, v * 4.2 + 9.8);
      const waveVal = Math.max(0, Math.min(255, Math.round(wave * 255)));

      // A: Faint lower-chin & corner anti-fog rim haze (canvas y bottom -> UV v bottom after flipY)
      const lowerWeight = smoothstep(0.45, 0.98, v) * smoothstep(0.35, 0.92, Math.abs(du));
      const fogNoise = fbm2d(u * 6.0 + 21.0, v * 6.0 + 13.0);
      const fogVal = Math.min(255, Math.round(lowerWeight * (0.4 + 0.6 * fogNoise) * 255));

      outImg.data[idx] = dustVal;
      outImg.data[idx + 1] = scratchVal;
      outImg.data[idx + 2] = waveVal;
      outImg.data[idx + 3] = fogVal;
    }
  }

  ctxOut.putImageData(outImg, 0, 0);
  const tex = new THREE.CanvasTexture(cOut);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
