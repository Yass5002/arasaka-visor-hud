import * as THREE from "three";
import { HELMET_GEO_CONFIG } from "../config/visorConfig";
import { HelmetTextures } from "./proceduralTextures";

function superellipsePoint(
  t: number,
  halfW: number,
  halfH: number,
  power: number
): [number, number] {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const exp = 2 / power;
  const x = Math.sign(c) * Math.pow(Math.abs(c), exp) * halfW;
  const y = Math.sign(s) * Math.pow(Math.abs(s), exp) * halfH;
  return [x, y];
}

function buildApertureTunnelGeometry(): THREE.BufferGeometry {
  const {
    sealZ,
    innerRimZ,
    browCheekZ,
    backWallZ,
    halfWidth,
    halfHeight,
    superellipsePower,
    radialSteps,
    ringFlareOutward,
  } = HELMET_GEO_CONFIG.aperture;

  // Profile rings moving from front visor seal back past the wearer's head
  const rings = [
    { z: sealZ - 0.025, scaleW: 1.01, scaleH: 1.01 },
    { z: sealZ, scaleW: 1.0, scaleH: 1.0 },
    { z: innerRimZ, scaleW: 1.0 + ringFlareOutward * 0.45, scaleH: 1.0 + ringFlareOutward * 0.52 },
    { z: browCheekZ, scaleW: 1.0 + ringFlareOutward * 1.15, scaleH: 1.0 + ringFlareOutward * 1.28 },
    { z: backWallZ, scaleW: 1.0 + ringFlareOutward * 2.1, scaleH: 1.0 + ringFlareOutward * 2.2 },
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const v = r / (rings.length - 1);
    for (let s = 0; s <= radialSteps; s++) {
      const u = s / radialSteps;
      const theta = u * Math.PI * 2;
      const [px, py] = superellipsePoint(
        theta,
        halfWidth * ring.scaleW,
        halfHeight * ring.scaleH,
        superellipsePower
      );
      // Slight backward sweep on sides like a wrap-around visor cowl
      const sideCurveZ = Math.pow(Math.abs(px) / Math.max(0.01, halfWidth), 1.6) * 0.032;
      positions.push(px, py, ring.z + sideCurveZ);
      uvs.push(u * 4, v * 1.5);
    }
  }

  const stride = radialSteps + 1;
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < radialSteps; s++) {
      const a = r * stride + s;
      const b = a + 1;
      const c = (r + 1) * stride + s;
      const d = c + 1;
      // Inward-facing winding toward camera inside tunnel
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

function buildChinArcGeometry(): THREE.BufferGeometry {
  const { centerY, centerZ, arcRadiusX, arcRadiusZ, arcSpanDeg, barThicknessY, barDepthZ } =
    HELMET_GEO_CONFIG.chin;
  const halfSpan = THREE.MathUtils.degToRad(arcSpanDeg * 0.5);
  const segs = 36;

  // Sweep a beveled cross-section around the chin arc
  const profile = [
    [-barDepthZ * 0.45, -barThicknessY * 0.65],
    [barDepthZ * 0.45, -barThicknessY * 0.65],
    [barDepthZ * 0.52, 0.0],
    [barDepthZ * 0.36, barThicknessY * 0.5],
    [-barDepthZ * 0.12, barThicknessY * 0.52],
    [-barDepthZ * 0.45, barThicknessY * 0.25],
    [-barDepthZ * 0.45, -barThicknessY * 0.65],
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const ang = -halfSpan + u * halfSpan * 2;
    const sinA = Math.sin(ang);
    const cosA = Math.cos(ang);

    // Center point along horizontal chin arc (curves closer on sides)
    const cx = sinA * arcRadiusX;
    const cz = centerZ - (cosA - 1) * arcRadiusZ;
    // Slight upward rise toward cheeks
    const cy = centerY + (1 - cosA) * 0.028;

    for (let p = 0; p < profile.length; p++) {
      const [localZ, localY] = profile[p];
      const v = p / (profile.length - 1);
      // Orient profile radially outward/inward along arc normal
      const px = cx + sinA * localZ;
      const pz = cz + cosA * localZ;
      const py = cy + localY;
      positions.push(px, py, pz);
      uvs.push(u * 2.5, v);
    }
  }

  const pCount = profile.length;
  for (let i = 0; i < segs; i++) {
    for (let p = 0; p < pCount - 1; p++) {
      const a = i * pCount + p;
      const b = (i + 1) * pCount + p;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}


export function buildHelmetGroup(textures: HelmetTextures): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = "helmetInteriorGroup";

  const disposables: Array<{ dispose: () => void }> = [];
  const { pbr, aperture, cheeks, chin, details } = HELMET_GEO_CONFIG;

  // Materials driven by procedural PBR maps
  const shellMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: textures.shell.map,
    bumpMap: textures.shell.bumpMap,
    bumpScale: pbr.shellBumpScale,
    roughnessMap: textures.shell.roughnessMap,
    roughness: pbr.shellRoughness,
    metalness: pbr.shellMetalness,
    side: THREE.DoubleSide,
  });

  const gasketMat = new THREE.MeshStandardMaterial({
    color: pbr.gasketColor,
    bumpMap: textures.shell.bumpMap,
    bumpScale: pbr.gasketBumpScale,
    roughness: pbr.gasketRoughness,
    metalness: 0.04,
  });

  const cheekMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: textures.cheek.map,
    bumpMap: textures.cheek.bumpMap,
    bumpScale: pbr.cheekBumpScale,
    roughnessMap: textures.cheek.roughnessMap,
    roughness: pbr.cheekRoughness,
    metalness: pbr.cheekMetalness,
  });

  const chinMat = new THREE.MeshStandardMaterial({
    color: pbr.chinColor,
    bumpMap: textures.cheek.bumpMap,
    bumpScale: pbr.cheekBumpScale,
    roughness: pbr.chinRoughness,
    metalness: pbr.chinMetalness,
    side: THREE.DoubleSide,
  });

  const paddingMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: textures.padding.map,
    bumpMap: textures.padding.bumpMap,
    bumpScale: pbr.paddingBumpScale,
    roughnessMap: textures.padding.roughnessMap,
    roughness: pbr.paddingRoughness,
    metalness: 0.02,
  });

  const cableMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: textures.cable.map,
    bumpMap: textures.cable.bumpMap,
    bumpScale: 0.0022,
    roughnessMap: textures.cable.roughnessMap,
    roughness: pbr.cableRoughness,
    metalness: 0.15,
  });

  const boomBodyMat = new THREE.MeshStandardMaterial({
    color: pbr.boomColor,
    bumpMap: textures.shell.bumpMap,
    bumpScale: 0.001,
    roughness: pbr.boomRoughness,
    metalness: pbr.boomMetalness,
  });

  const boomRimMat = new THREE.MeshStandardMaterial({
    color: pbr.boomRimColor,
    roughness: pbr.metalFastenerRoughness,
    metalness: pbr.metalFastenerMetalness,
  });

  const socketDarkMat = new THREE.MeshStandardMaterial({
    color: pbr.socketDarkColor,
    roughness: 0.92,
    metalness: 0.05,
  });

  const windscreenMat = new THREE.MeshStandardMaterial({
    color: pbr.windscreenColor,
    bumpMap: textures.padding.bumpMap,
    bumpScale: 0.0024,
    roughness: pbr.windscreenRoughness,
    metalness: 0.02,
  });

  const grilleMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: textures.grille.map,
    bumpMap: textures.grille.bumpMap,
    bumpScale: 0.0038,
    roughnessMap: textures.grille.roughnessMap,
    roughness: 0.48,
    metalness: 0.45,
  });

  const fastenerMat = new THREE.MeshStandardMaterial({
    color: pbr.metalFastenerColor,
    roughness: pbr.metalFastenerRoughness,
    metalness: pbr.metalFastenerMetalness,
  });

  const valveMat = new THREE.MeshStandardMaterial({
    color: pbr.valveColor,
    roughness: pbr.valveRoughness,
    metalness: pbr.valveMetalness,
  });

  const ledMat = new THREE.MeshBasicMaterial({
    color: 0x44dd88,
  });

  const opticalGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0c1a2e,
    roughness: 0.08,
    metalness: 0.35,
  });

  const projectorLedMat = new THREE.MeshBasicMaterial({
    color: 0x66aaff,
  });

  disposables.push(
    shellMat,
    gasketMat,
    cheekMat,
    chinMat,
    paddingMat,
    cableMat,
    boomBodyMat,
    boomRimMat,
    socketDarkMat,
    windscreenMat,
    grilleMat,
    fastenerMat,
    valveMat,
    ledMat,
    opticalGlassMat,
    projectorLedMat
  );

  // 1. Outer Helmet Cavity Tunnel
  const tunnelGeo = buildApertureTunnelGeometry();
  const tunnelMesh = new THREE.Mesh(tunnelGeo, shellMat);
  tunnelMesh.name = "helmetTunnel";
  group.add(tunnelMesh);
  disposables.push(tunnelGeo);

  // 2. Visor Seal Elastomer Gasket Ring along the superellipse seam
  const gasketPts: THREE.Vector3[] = [];
  for (let s = 0; s < aperture.radialSteps; s++) {
    const theta = (s / aperture.radialSteps) * Math.PI * 2;
    const [gx, gy] = superellipsePoint(
      theta,
      aperture.halfWidth * 1.005,
      aperture.halfHeight * 1.005,
      aperture.superellipsePower
    );
    const sideZ = Math.pow(Math.abs(gx) / aperture.halfWidth, 1.6) * 0.032;
    gasketPts.push(new THREE.Vector3(gx, gy, aperture.sealZ + sideZ));
  }
  const gasketCurve = new THREE.CatmullRomCurve3(gasketPts, true);
  const gasketGeo = new THREE.TubeGeometry(
    gasketCurve,
    96,
    aperture.gasketTubeRadius,
    12,
    true
  );
  const gasketMesh = new THREE.Mesh(gasketGeo, gasketMat);
  group.add(gasketMesh);
  disposables.push(gasketGeo);

  // 3. Sculpted Inner Padding Bolsters in upper-left, upper-right, and lower temple corners
  const padGeo = new THREE.CapsuleGeometry(0.022, 0.078, 8, 16);
  disposables.push(padGeo);
  for (const side of [-1, 1] as const) {
    const pad = new THREE.Mesh(padGeo, paddingMat);
    pad.position.set(
      side * details.paddingCornerX,
      details.paddingCornerY,
      details.paddingCornerZ
    );
    pad.rotation.set(0.28, -side * 0.38, side * 0.88);
    pad.scale.set(1.0, 1.0, 0.72);
    group.add(pad);
  }

  // 4. Angled Sloped Matte-Grey Interior Cheek Armor Plates + Hex Fasteners
  const cheekShape = buildRoundedRectShape(cheeks.width, cheeks.height, 0.016);
  const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
    depth: cheeks.depth,
    bevelEnabled: true,
    bevelThickness: cheeks.bevelSize,
    bevelSize: cheeks.bevelSize,
    bevelSegments: 3,
    curveSegments: 12,
  });
  cheekGeo.center();
  disposables.push(cheekGeo);

  const boltGeo = new THREE.CylinderGeometry(
    details.boltRadius,
    details.boltRadius,
    0.004,
    6
  );
  disposables.push(boltGeo);

  for (const side of [-1, 1] as const) {
    const cheekGroup = new THREE.Group();
    cheekGroup.position.set(side * cheeks.offsetX, cheeks.offsetY, cheeks.offsetZ);
    cheekGroup.rotation.set(
      THREE.MathUtils.degToRad(cheeks.pitchUpDeg),
      -side * THREE.MathUtils.degToRad(cheeks.yawInDeg),
      side * THREE.MathUtils.degToRad(cheeks.tiltZDeg)
    );

    const cheekMesh = new THREE.Mesh(cheekGeo, cheekMat);
    cheekGroup.add(cheekMesh);

    // Dual recessed hex bolts securing cheek armor plate
    for (const bx of [-0.036, 0.032]) {
      const bolt = new THREE.Mesh(boltGeo, fastenerMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(bx, 0.022, cheeks.depth * 0.5 + cheeks.bevelSize * 0.65);
      cheekGroup.add(bolt);
    }

    group.add(cheekGroup);
  }

  // 5. Curved Lower Chin Cowling, Stepped Center Bridge, Lip Seal, and Braided Conduit Cables
  const chinArcGeo = buildChinArcGeometry();
  const chinMesh = new THREE.Mesh(chinArcGeo, chinMat);
  group.add(chinMesh);
  disposables.push(chinArcGeo);

  // Center raised chin bridge plate
  const bridgeShape = buildRoundedRectShape(chin.bridgeWidth, chin.bridgeHeight, 0.006);
  const bridgeGeo = new THREE.ExtrudeGeometry(bridgeShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  bridgeGeo.center();
  const bridgeMesh = new THREE.Mesh(bridgeGeo, shellMat);
  bridgeMesh.position.set(0, chin.centerY + 0.009, chin.centerZ + 0.015);
  bridgeMesh.rotation.x = -0.22;
  group.add(bridgeMesh);
  disposables.push(bridgeGeo);

  // Upper chin rubber gasket lip
  const lipPts: THREE.Vector3[] = [];
  const halfChinAng = THREE.MathUtils.degToRad(chin.arcSpanDeg * 0.46);
  for (let i = 0; i <= 24; i++) {
    const t = -halfChinAng + (i / 24) * halfChinAng * 2;
    const x = Math.sin(t) * chin.arcRadiusX;
    const z = chin.centerZ - (Math.cos(t) - 1) * chin.arcRadiusZ + 0.008;
    const y = chin.centerY + chin.barThicknessY * 0.52 + (1 - Math.cos(t)) * 0.026;
    lipPts.push(new THREE.Vector3(x, y, z));
  }
  const lipGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPts), 40, chin.lipTubeRadius, 10, false);
  group.add(new THREE.Mesh(lipGeo, gasketMat));
  disposables.push(lipGeo);

  // Visor bubble perimeter mounting bolts along the lower lip curve (as seen in ref_helmet.jpg)
  const visorScrewGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 0.003, 6);
  disposables.push(visorScrewGeo);
  for (let i = 2; i <= 22; i += 2) {
    const t = -halfChinAng + (i / 24) * halfChinAng * 2;
    const x = Math.sin(t) * chin.arcRadiusX;
    const z = chin.centerZ - (Math.cos(t) - 1) * chin.arcRadiusZ + 0.006;
    const y = chin.centerY + chin.barThicknessY * 0.52 + (1 - Math.cos(t)) * 0.026 + 0.003;
    const screw = new THREE.Mesh(visorScrewGeo, fastenerMat);
    screw.position.set(x, y, z);
    screw.rotation.x = 0.28;
    group.add(screw);
  }

  // Central Ergonomic Chin Rest / Impact Bumper (inspired by central bracket in ref_helmet.jpg)
  const bumperShape = buildRoundedRectShape(0.052, 0.022, 0.004);
  const bumperGeo = new THREE.ExtrudeGeometry(bumperShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.0025,
    bevelSegments: 2,
  });
  bumperGeo.center();
  const bumperMesh = new THREE.Mesh(bumperGeo, paddingMat);
  bumperMesh.position.set(0, chin.centerY + 0.012, chin.centerZ + 0.022);
  bumperMesh.rotation.x = -0.20;
  group.add(bumperMesh);
  disposables.push(bumperGeo);

  // Dual Atmospheric / Pressure Regulator Valve Ports (inspired by prominent cylindrical ports in ref_helmet.jpg)
  const valveBaseGeo = new THREE.CylinderGeometry(0.015, 0.016, 0.004, 24);
  const valveBodyGeo = new THREE.CylinderGeometry(0.0125, 0.013, 0.014, 24);
  const valveKnurlGeo = new THREE.TorusGeometry(0.013, 0.0016, 8, 24);
  const valveCapGeo = new THREE.CylinderGeometry(0.009, 0.011, 0.004, 24);
  const miniBoltGeo = new THREE.CylinderGeometry(0.0016, 0.0016, 0.0025, 6);
  disposables.push(valveBaseGeo, valveBodyGeo, valveKnurlGeo, valveCapGeo, miniBoltGeo);

  for (const side of [-1, 1] as const) {
    const valveGroup = new THREE.Group();
    // Positioned on the left and right inner chin shelf
    const vx = side * 0.092;
    const vy = chin.centerY + 0.006;
    const vz = chin.centerZ + 0.004;
    valveGroup.position.set(vx, vy, vz);
    valveGroup.rotation.set(-0.35, -side * 0.28, side * 0.14);

    // Flange base ring
    const vBase = new THREE.Mesh(valveBaseGeo, fastenerMat);
    valveGroup.add(vBase);

    // 6 miniature perimeter flange hex bolts
    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2;
      const mb = new THREE.Mesh(miniBoltGeo, fastenerMat);
      mb.position.set(Math.cos(ang) * 0.0138, 0.0025, Math.sin(ang) * 0.0138);
      valveGroup.add(mb);
    }

    // Cylindrical matte ceramic / titanium valve body
    const vBody = new THREE.Mesh(valveBodyGeo, valveMat);
    vBody.position.y = 0.008;
    valveGroup.add(vBody);

    // Knurled grip collar ring
    const vKnurl = new THREE.Mesh(valveKnurlGeo, boomRimMat);
    vKnurl.rotation.x = Math.PI / 2;
    vKnurl.position.y = 0.012;
    valveGroup.add(vKnurl);

    // Beveled center cap / dial
    const vCap = new THREE.Mesh(valveCapGeo, fastenerMat);
    vCap.position.y = 0.016;
    valveGroup.add(vCap);

    group.add(valveGroup);
  }

  // Recessed braided comms conduit cables tucking from cheek into chin cavity
  for (const side of [-1, 1] as const) {
    const cablePts = [
      new THREE.Vector3(side * 0.17, -0.058, -0.225),
      new THREE.Vector3(side * 0.125, -0.076, -0.198),
      new THREE.Vector3(side * 0.072, -0.085, -0.184),
      new THREE.Vector3(side * 0.028, -0.088, -0.182),
    ];
    const cableGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(cablePts),
      28,
      details.cableRadius,
      10,
      false
    );
    group.add(new THREE.Mesh(cableGeo, cableMat));
    disposables.push(cableGeo);
  }

  // 6. Tactical Communications Radio Mic Unit (Right-Side, inspired by radio mic in ref_helmet.jpg)
  const micGroup = new THREE.Group();
  // Anchored on the right chin shelf, positioned ergonomically
  micGroup.position.set(0.048, chin.centerY + 0.022, chin.centerZ + 0.024);
  micGroup.rotation.set(-0.24, -0.35, 0.12);

  // 6a. Swivel Mount Bracket Base on Chin Shelf
  const micBaseGeo = new THREE.CylinderGeometry(0.008, 0.009, 0.005, 18);
  const micBase = new THREE.Mesh(micBaseGeo, fastenerMat);
  micGroup.add(micBase);

  const micSwivelGeo = new THREE.SphereGeometry(0.0065, 16, 12);
  const micSwivel = new THREE.Mesh(micSwivelGeo, boomRimMat);
  micSwivel.position.y = 0.005;
  micGroup.add(micSwivel);

  // 6b. Sculpted Ergonomic Radio Mic Body (trapezoidal / rounded rectangular)
  const radioShape = buildRoundedRectShape(0.024, 0.034, 0.004);
  const radioGeo = new THREE.ExtrudeGeometry(radioShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
  });
  radioGeo.center();
  const radioBody = new THREE.Mesh(radioGeo, boomBodyMat);
  radioBody.position.set(0, 0.024, 0.004);
  micGroup.add(radioBody);

  // 6c. Horizontal Acoustic Grille Slats (inspired by front slats on radio mic in ref_helmet.jpg)
  const slatGeo = new THREE.BoxGeometry(0.016, 0.0018, 0.002);
  for (let s = 0; s < 5; s++) {
    const slat = new THREE.Mesh(slatGeo, grilleMat);
    slat.position.set(0, 0.018 + s * 0.0042, 0.0115);
    micGroup.add(slat);
  }

  // 6d. Top Rotary Knob / Channel Dial
  const dialGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 16);
  const dial = new THREE.Mesh(dialGeo, fastenerMat);
  dial.position.set(-0.006, 0.042, 0.004);
  micGroup.add(dial);

  // 6e. Status Indicator LED Dot (green nominal link)
  const ledGeo = new THREE.CylinderGeometry(0.0012, 0.0012, 0.0015, 12);
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.rotation.x = Math.PI / 2;
  led.position.set(0.007, 0.036, 0.0115);
  micGroup.add(led);

  // 6f. Side Push-To-Talk (PTT) Button Bar
  const pttGeo = new THREE.BoxGeometry(0.0025, 0.016, 0.006);
  const ptt = new THREE.Mesh(pttGeo, boomRimMat);
  ptt.position.set(0.0135, 0.024, 0.004);
  micGroup.add(ptt);

  // 6g. Coiled Strain-Relief Comms Wire (looping from mic base into chin chassis socket)
  const coilPts: THREE.Vector3[] = [];
  for (let c = 0; c <= 32; c++) {
    const t = c / 32;
    const ang = t * Math.PI * 5;
    const cx = Math.sin(ang) * 0.004 + t * 0.008;
    const cy = -t * 0.014;
    const cz = Math.cos(ang) * 0.004 - t * 0.012;
    coilPts.push(new THREE.Vector3(cx, cy, cz));
  }
  const coilGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(coilPts),
    36,
    0.0022,
    8,
    false
  );
  const coilWire = new THREE.Mesh(coilGeo, cableMat);
  coilWire.position.set(0, 0.006, 0);
  micGroup.add(coilWire);

  group.add(micGroup);
  disposables.push(
    visorScrewGeo,
    bumperGeo,
    valveBaseGeo,
    valveBodyGeo,
    valveKnurlGeo,
    valveCapGeo,
    miniBoltGeo,
    micBaseGeo,
    micSwivelGeo,
    radioGeo,
    slatGeo,
    dialGeo,
    ledGeo,
    pttGeo,
    coilGeo
  );

  // =========================================================================
  // 7. UPPER BROW COWLING, FOREHEAD CUSHION, HUD PROJECTOR & RIM FASTENERS
  // =========================================================================
  const browGroup = new THREE.Group();

  const cowlingShape = buildRoundedRectShape(0.24, 0.026, 0.008);
  const cowlingGeo = new THREE.ExtrudeGeometry(cowlingShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  cowlingGeo.center();
  const cowlingMesh = new THREE.Mesh(cowlingGeo, cheekMat);
  cowlingMesh.position.set(0, 0.132, -0.248);
  cowlingMesh.rotation.x = 0.24;
  browGroup.add(cowlingMesh);

  const browPadShape = buildRoundedRectShape(0.18, 0.02, 0.009);
  const browPadGeo = new THREE.ExtrudeGeometry(browPadShape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 3,
  });
  browPadGeo.center();
  const browPadMesh = new THREE.Mesh(browPadGeo, paddingMat);
  browPadMesh.position.set(0, 0.126, -0.228);
  browPadMesh.rotation.x = 0.22;
  browGroup.add(browPadMesh);

  const projectorGroup = new THREE.Group();
  projectorGroup.position.set(0, 0.121, -0.248);
  projectorGroup.rotation.x = 0.35;

  const projHousingShape = buildRoundedRectShape(0.052, 0.015, 0.004);
  const projHousingGeo = new THREE.ExtrudeGeometry(projHousingShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
  });
  projHousingGeo.center();
  const projHousingMesh = new THREE.Mesh(projHousingGeo, boomBodyMat);
  projectorGroup.add(projHousingMesh);

  const projBezelShape = buildRoundedRectShape(0.044, 0.01, 0.0025);
  const projBezelGeo = new THREE.ExtrudeGeometry(projBezelShape, {
    depth: 0.005,
    bevelEnabled: true,
    bevelThickness: 0.001,
    bevelSize: 0.001,
    bevelSegments: 1,
  });
  projBezelGeo.center();
  const projBezelMesh = new THREE.Mesh(projBezelGeo, boomRimMat);
  projBezelMesh.position.set(0, -0.001, 0.011);
  projectorGroup.add(projBezelMesh);

  const projLensGeo = new THREE.BoxGeometry(0.036, 0.006, 0.004);
  const projLensMesh = new THREE.Mesh(projLensGeo, opticalGlassMat);
  projLensMesh.position.set(0, -0.001, 0.013);
  projectorGroup.add(projLensMesh);

  const projLedGeo = new THREE.SphereGeometry(0.0013, 8, 8);
  const projLedMesh = new THREE.Mesh(projLedGeo, projectorLedMat);
  projLedMesh.position.set(0.02, -0.001, 0.013);
  projectorGroup.add(projLedMesh);

  browGroup.add(projectorGroup);

  const upperScrewGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 0.0025, 6);
  for (let i = 0; i < 9; i++) {
    const frac = (i / 8) * 2 - 1;
    const t = Math.PI / 2 - frac * 0.72;
    const [sx, sy] = superellipsePoint(
      t,
      aperture.halfWidth * 0.96,
      aperture.halfHeight * 0.96,
      aperture.superellipsePower
    );
    const screw = new THREE.Mesh(upperScrewGeo, fastenerMat);
    screw.position.set(sx, sy, aperture.sealZ + 0.012);
    screw.rotation.x = Math.PI / 2 + 0.18;
    browGroup.add(screw);
  }

  group.add(browGroup);
  disposables.push(
    cowlingGeo,
    browPadGeo,
    projHousingGeo,
    projBezelGeo,
    projLensGeo,
    projLedGeo,
    upperScrewGeo
  );

  // Enable shadow casting & receiving across all interior helmet geometry for realistic grounding
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return {
    group,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
