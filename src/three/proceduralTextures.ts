import * as THREE from "three";
import { HELMET_GEO_CONFIG } from "../config/visorConfig";

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
