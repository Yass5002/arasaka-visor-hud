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

function buildTaperedTubeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radiusStart: number,
  radiusEnd: number,
  radialSegments: number,
  flattenScaleY = 0.82
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const vertex = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(u, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);
    const r = radiusStart + (radiusEnd - radiusStart) * u;

    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);

      vertex.copy(P)
        .addScaledVector(N, r * cos)
        .addScaledVector(B, r * flattenScaleY * sin);
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(u * 4, v);
    }
  }

  const stride = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
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
  const { pbr, aperture, cheeks, chin, rightBoom, details } = HELMET_GEO_CONFIG;

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
    fastenerMat
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

  // 6. Single Right-Side Integrated Microphone Boom (Physically Anchored into Cheek/Chin Armor)
  const pMount = new THREE.Vector3(rightBoom.mountX, rightBoom.mountY, rightBoom.mountZ);
  const pElbow = new THREE.Vector3(rightBoom.elbowX, rightBoom.elbowY, rightBoom.elbowZ);
  const pNeck = new THREE.Vector3(rightBoom.neckX, rightBoom.neckY, rightBoom.neckZ);
  const pTip = new THREE.Vector3(rightBoom.tipX, rightBoom.tipY, rightBoom.tipZ);

  const boomCurve = new THREE.CatmullRomCurve3([pMount, pElbow, pNeck, pTip]);

  // 6a. Recessed Mounting Escutcheon Bracket bolted into the right inner cheek housing
  const mountGroup = new THREE.Group();
  mountGroup.position.copy(pMount);
  mountGroup.lookAt(pElbow);

  const plateShape = buildRoundedRectShape(
    rightBoom.mountPlateWidth,
    rightBoom.mountPlateHeight,
    0.005
  );
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.0022,
    bevelSize: 0.0022,
    bevelSegments: 2,
  });
  plateGeo.center();
  const plateMesh = new THREE.Mesh(plateGeo, boomBodyMat);
  mountGroup.add(plateMesh);

  // Dark recessed socket well + anodized swivel turret collar
  const socketWellGeo = new THREE.CylinderGeometry(
    rightBoom.mountSocketRadius,
    rightBoom.mountSocketRadius * 1.08,
    0.008,
    20
  );
  const socketWell = new THREE.Mesh(socketWellGeo, socketDarkMat);
  socketWell.rotation.x = Math.PI / 2;
  socketWell.position.z = 0.0025;
  mountGroup.add(socketWell);

  const turretRingGeo = new THREE.TorusGeometry(
    rightBoom.mountSocketRadius * 0.88,
    0.0024,
    10,
    24
  );
  const turretRing = new THREE.Mesh(turretRingGeo, boomRimMat);
  turretRing.position.z = 0.0055;
  mountGroup.add(turretRing);

  // Corner mounting hex bolts securing bracket to cheek wall
  for (const bx of [-rightBoom.mountPlateWidth * 0.34, rightBoom.mountPlateWidth * 0.34]) {
    const mBolt = new THREE.Mesh(boltGeo, fastenerMat);
    mBolt.rotation.x = Math.PI / 2;
    mBolt.position.set(bx, rightBoom.mountPlateHeight * 0.24, 0.0045);
    mountGroup.add(mBolt);
  }
  group.add(mountGroup);
  disposables.push(plateGeo, socketWellGeo, turretRingGeo);

  // 6b. Ribbed Elastomer Strain-Relief Flex Boot exiting socket along curve
  const ribGeo = new THREE.TorusGeometry(rightBoom.armBaseRadius * 1.18, 0.0018, 8, 18);
  disposables.push(ribGeo);
  for (let r = 0; r < rightBoom.flexRibCount; r++) {
    const t = 0.03 + r * 0.038;
    const pos = boomCurve.getPointAt(t);
    const tangent = boomCurve.getTangentAt(t);
    const rib = new THREE.Mesh(ribGeo, gasketMat);
    rib.position.copy(pos);
    rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    group.add(rib);
  }

  // 6c. Tapered Curved Boom Arm & Metallic Spine Conduit
  const boomArmGeo = buildTaperedTubeGeometry(
    boomCurve,
    32,
    rightBoom.armBaseRadius,
    rightBoom.armTipRadius,
    16,
    0.84
  );
  const boomArmMesh = new THREE.Mesh(boomArmGeo, boomBodyMat);
  group.add(boomArmMesh);
  disposables.push(boomArmGeo);

  // Subtle stepped collar transition before microphone capsule
  const neckCollarGeo = new THREE.CylinderGeometry(
    rightBoom.armTipRadius * 1.16,
    rightBoom.armTipRadius * 1.05,
    0.008,
    16
  );
  const neckCollar = new THREE.Mesh(neckCollarGeo, boomRimMat);
  neckCollar.position.copy(boomCurve.getPointAt(0.92));
  neckCollar.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    boomCurve.getTangentAt(0.92)
  );
  group.add(neckCollar);
  disposables.push(neckCollarGeo);

  // 6d. Sculpted Acoustic Microphone Capsule Head angled toward wearer's mouth
  const tipGroup = new THREE.Group();
  tipGroup.position.copy(pTip);
  tipGroup.rotation.set(
    THREE.MathUtils.degToRad(rightBoom.capsuleTiltXDeg),
    -THREE.MathUtils.degToRad(rightBoom.capsuleTiltYDeg),
    0
  );

  const housingGeo = new THREE.CylinderGeometry(
    rightBoom.capsuleRadius * 0.96,
    rightBoom.capsuleRadius * 0.82,
    rightBoom.capsuleLength * 0.56,
    24
  );
  const housingMesh = new THREE.Mesh(housingGeo, boomBodyMat);
  housingMesh.rotation.x = Math.PI / 2;
  housingMesh.position.z = -rightBoom.capsuleLength * 0.14;
  tipGroup.add(housingMesh);

  // Textured acoustic foam / dampener collar
  const windscreenGeo = new THREE.CylinderGeometry(
    rightBoom.capsuleRadius * 1.04,
    rightBoom.capsuleRadius * 1.02,
    rightBoom.capsuleLength * 0.36,
    24
  );
  const windscreenMesh = new THREE.Mesh(windscreenGeo, windscreenMat);
  windscreenMesh.rotation.x = Math.PI / 2;
  windscreenMesh.position.z = rightBoom.capsuleLength * 0.20;
  tipGroup.add(windscreenMesh);

  const bezelGeo = new THREE.TorusGeometry(rightBoom.capsuleRadius * 0.98, 0.0014, 10, 28);
  const bezelMesh = new THREE.Mesh(bezelGeo, boomRimMat);
  bezelMesh.position.z = rightBoom.capsuleLength * 0.38;
  tipGroup.add(bezelMesh);

  // Hemispherical perforated steel microphone dome grille
  const grilleDomeGeo = new THREE.SphereGeometry(
    rightBoom.capsuleRadius * 0.94,
    24,
    14,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.48
  );
  const grilleDomeMesh = new THREE.Mesh(grilleDomeGeo, grilleMat);
  grilleDomeMesh.rotation.x = Math.PI / 2;
  grilleDomeMesh.scale.set(1, 0.45, 1);
  grilleDomeMesh.position.z = rightBoom.capsuleLength * 0.38;
  tipGroup.add(grilleDomeMesh);

  group.add(tipGroup);
  disposables.push(housingGeo, windscreenGeo, bezelGeo, grilleDomeGeo);

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
