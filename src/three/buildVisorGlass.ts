import * as THREE from "three";
import { SCENE_CONFIG, VISOR_GLASS_CONFIG } from "../config/visorConfig";
import { createVisorSurfaceTexture } from "./proceduralTextures";

function buildEllipsoidalDomeGeometry(): THREE.BufferGeometry {
  const {
    centerX,
    centerY,
    centerZ,
    radiusX,
    radiusY,
    radiusZ,
    arcYawDeg,
    arcPitchDeg,
    segmentsW,
    segmentsH,
  } = VISOR_GLASS_CONFIG.dome;

  const arcYaw = THREE.MathUtils.degToRad(arcYawDeg);
  const arcPitch = THREE.MathUtils.degToRad(arcPitchDeg);

  const positions: number[] = [];
  const normals: number[] = [];
  const tangents: number[] = [];
  const bitangents: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const invRx2 = 1 / (radiusX * radiusX);
  const invRy2 = 1 / (radiusY * radiusY);
  const invRz2 = 1 / (radiusZ * radiusZ);

  const nVec = new THREE.Vector3();
  const tVec = new THREE.Vector3();
  const bVec = new THREE.Vector3();

  for (let j = 0; j <= segmentsH; j++) {
    const v = j / segmentsH;
    const phi = (v - 0.5) * arcPitch;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    for (let i = 0; i <= segmentsW; i++) {
      const u = i / segmentsW;
      const theta = (u - 0.5) * arcYaw;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      const dx = radiusX * cosPhi * sinTheta;
      const dy = radiusY * sinPhi;
      const dz = -radiusZ * cosPhi * cosTheta;

      positions.push(centerX + dx, centerY + dy, centerZ + dz);
      uvs.push(u, v);

      // Exact analytical inward-pointing normal for smooth ellipsoid curvature
      nVec.set(-dx * invRx2, -dy * invRy2, -dz * invRz2).normalize();
      normals.push(nVec.x, nVec.y, nVec.z);

      // Analytical tangent along +u (dP/dtheta), orthogonalized against normal
      tVec.set(radiusX * cosPhi * cosTheta, 0, radiusZ * cosPhi * sinTheta);
      if (tVec.lengthSq() < 1e-10) {
        tVec.set(1, 0, 0);
      }
      tVec.addScaledVector(nVec, -tVec.dot(nVec)).normalize();
      bVec.crossVectors(nVec, tVec).normalize();

      tangents.push(tVec.x, tVec.y, tVec.z);
      bitangents.push(bVec.x, bVec.y, bVec.z);
    }
  }

  const stride = segmentsW + 1;
  for (let j = 0; j < segmentsH; j++) {
    for (let i = 0; i < segmentsW; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i;
      const d = c + 1;
      // Inward-facing winding toward the eye inside the helmet
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("aTangent", new THREE.Float32BufferAttribute(tangents, 3));
  geo.setAttribute("aBitangent", new THREE.Float32BufferAttribute(bitangents, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

const SHARED_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aTangent;
  attribute vec3 aBitangent;

  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldTangent;
  varying vec3 vWorldBitangent;

  void main() {
    vLocalPos = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;

    vec4 mvPos = viewMatrix * worldPos;
    vViewPos = -mvPos.xyz;

    mat3 worldRot = mat3(modelMatrix);
    vWorldNormal = normalize(worldRot * normal);
    vWorldTangent = normalize(worldRot * aTangent);
    vWorldBitangent = normalize(worldRot * aBitangent);

    gl_Position = projectionMatrix * mvPos;
  }
`;

const SHARED_SURFACE_GLSL = /* glsl */ `
  uniform vec2 uHudWindowMin;
  uniform vec2 uHudWindowSpan;
  uniform float uCalCenterZ;
  uniform float uCalRadius;
  uniform float uCalArcYawRad;
  uniform float uCalArcPitchRad;
  uniform sampler2D uSurfaceMap;
  uniform vec2 uSurfaceTexelSize;
  uniform float uSurfacePad;
  uniform float uBumpStrengthWave;
  uniform float uBumpStrengthScratch;
  uniform vec3 uSunWorldDir;

  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldTangent;
  varying vec3 vWorldBitangent;

  vec2 computeCalibratedHudUv(vec3 localPos) {
    vec3 dir = normalize(localPos);
    float b = dir.z * uCalCenterZ;
    float disc = b * b + (uCalRadius * uCalRadius - uCalCenterZ * uCalCenterZ);
    float t = b + sqrt(max(disc, 0.0));
    vec3 q = t * dir - vec3(0.0, 0.0, uCalCenterZ);
    float phi = asin(clamp(q.y / uCalRadius, -1.0, 1.0));
    float theta = atan(q.x, -q.z);
    vec2 domeUv = vec2(theta / uCalArcYawRad + 0.5, phi / uCalArcPitchRad + 0.5);
    return (domeUv - uHudWindowMin) / uHudWindowSpan;
  }

  vec2 hudUvToSurfaceUv(vec2 hudUv) {
    return (hudUv + uSurfacePad) / (1.0 + 2.0 * uSurfacePad);
  }

  void sampleMicroSurface(
    vec2 surfaceUv,
    vec3 baseN,
    vec3 T,
    vec3 B,
    out vec4 surf,
    out vec3 microN,
    out vec2 scratchGrad
  ) {
    surf = texture2D(uSurfaceMap, surfaceUv);
    float sX = texture2D(uSurfaceMap, surfaceUv + vec2(uSurfaceTexelSize.x, 0.0)).g;
    float sY = texture2D(uSurfaceMap, surfaceUv + vec2(0.0, uSurfaceTexelSize.y)).g;
    scratchGrad = vec2(surf.g - sX, surf.g - sY);

    float wX = texture2D(uSurfaceMap, surfaceUv + vec2(uSurfaceTexelSize.x * 4.0, 0.0)).b;
    float wY = texture2D(uSurfaceMap, surfaceUv + vec2(0.0, uSurfaceTexelSize.y * 4.0)).b;
    vec2 waveGrad = vec2(surf.b - wX, surf.b - wY);

    vec2 slope = scratchGrad * uBumpStrengthScratch * 14.0 + waveGrad * uBumpStrengthWave * 18.0;
    microN = normalize(baseN + T * slope.x + B * slope.y);
  }

  float computeRimCurvature(float cosTheta) {
    float curveAngle = clamp((1.0 - cosTheta) / 0.22, 0.0, 1.55);
    return pow(curveAngle, 1.45);
  }
`;

export interface VisorGlassHandle {
  group: THREE.Group;
  updateUniforms: (cameraMatrixWorldInverse: THREE.Matrix4) => void;
  dispose: () => void;
}

/**
 * Builds a two-pass 3D curved polycarbonate EVA visor dome inside headGroup:
 * 1. Physical Glass Shell (`NormalBlending`, `renderOrder: 1`):
 *    - Compound ellipsoidal curvature wrapping the face (`dot(N, V)` falls off naturally toward bezel)
 *    - World-space Mars sky/sun/terrain + dark helmet cavity environment reflections
 *    - Polycarbonate Fresnel & gold-neutral thin-film coating interference + perimeter gasket AO
 *    - Fine perimeter Martian regolith dust & lower-corner anti-fog haze (center stays crystal clear)
 * 2. Optical Projection & Highlights (`AdditiveBlending`, `renderOrder: 2`):
 *    - Calibrated projected holographic HUD with optical focus, bloom, ghost parallax, and chromatic fringe
 *    - Outer-wall Martian sun corona & anisotropic micro-scratch specular glints
 *    - Forward Mie dust scatter + subtle concave internal brow projector & HUD glow reflections
 */
export function buildVisorGlass(hudTexture: THREE.Texture): VisorGlassHandle {
  const group = new THREE.Group();
  group.name = "visorGlassGroup";

  const {
    hudCalibrationSphere: calCfg,
    hudWindowUv,
    hudTexture: texCfg,
    surface: surfCfg,
    optics,
  } = VISOR_GLASS_CONFIG;

  const surfaceTexture = createVisorSurfaceTexture();
  const sunWorldDir = new THREE.Vector3(...SCENE_CONFIG.marsSun.direction).normalize();

  const sharedUniforms = {
    uHudWindowMin: { value: new THREE.Vector2(hudWindowUv.uMin, hudWindowUv.vMin) },
    uHudWindowSpan: {
      value: new THREE.Vector2(
        hudWindowUv.uMax - hudWindowUv.uMin,
        hudWindowUv.vMax - hudWindowUv.vMin
      ),
    },
    uCalCenterZ: { value: calCfg.centerZ },
    uCalRadius: { value: calCfg.radius },
    uCalArcYawRad: { value: THREE.MathUtils.degToRad(calCfg.arcYawDeg) },
    uCalArcPitchRad: { value: THREE.MathUtils.degToRad(calCfg.arcPitchDeg) },
    uSurfaceMap: { value: surfaceTexture },
    uSurfaceTexelSize: { value: new THREE.Vector2(1 / surfCfg.texSize, 1 / surfCfg.texSize) },
    uSurfacePad: { value: surfCfg.uvPad },
    uBumpStrengthWave: { value: surfCfg.bumpStrengthWave },
    uBumpStrengthScratch: { value: surfCfg.bumpStrengthScratch },
    uSunWorldDir: { value: sunWorldDir },
  };

  // Pass A: Physical polycarbonate shell (world Fresnel, thin-film iridescence, bezel shadow, dust)
  const shellMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uFresnelF0: { value: optics.fresnelF0 },
      uFresnelEdgeOpacity: { value: optics.fresnelEdgeOpacity },
      uFresnelPower: { value: optics.fresnelPower },
      uIridescenceStrength: { value: optics.iridescenceStrength },
      uIridescenceBaseNm: { value: optics.iridescenceBaseNm },
      uIridescenceWaveNm: { value: optics.iridescenceWaveNm },
      uBezelShadowColor: { value: new THREE.Color(optics.bezelShadowColor) },
      uBezelShadowOpacity: { value: optics.bezelShadowOpacity },
      uDomeFresnelColor: { value: new THREE.Color(optics.domeFresnelColor) },
      uCavityReflectionOpacity: { value: optics.cavityReflectionOpacity },
      uDustReflectColor: { value: new THREE.Color(surfCfg.dustReflectColor) },
      uDustReflectOpacity: { value: surfCfg.dustReflectOpacity },
      uEdgeFogColor: { value: new THREE.Color(surfCfg.edgeFogColor) },
      uEdgeFogOpacity: { value: surfCfg.edgeFogOpacity },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    vertexShader: SHARED_VERTEX_SHADER,
    fragmentShader: /* glsl */ `
      ${SHARED_SURFACE_GLSL}

      uniform float uFresnelF0;
      uniform float uFresnelEdgeOpacity;
      uniform float uFresnelPower;
      uniform float uIridescenceStrength;
      uniform float uIridescenceBaseNm;
      uniform float uIridescenceWaveNm;
      uniform vec3 uBezelShadowColor;
      uniform float uBezelShadowOpacity;
      uniform vec3 uDomeFresnelColor;
      uniform float uCavityReflectionOpacity;
      uniform vec3 uDustReflectColor;
      uniform float uDustReflectOpacity;
      uniform vec3 uEdgeFogColor;
      uniform float uEdgeFogOpacity;

      vec3 sampleCavityAndMarsEnv(vec3 R, vec3 V, vec3 outN, float wave, float rimCurvature) {
        // Inner dark carbon helmet cavity + warm Mars regolith underside bounce
        float upFactor = smoothstep(-0.55, 0.65, R.y);
        vec3 carbonInterior = mix(vec3(0.018, 0.022, 0.028), vec3(0.045, 0.042, 0.046), upFactor);
        float chinBounce = smoothstep(0.15, -0.75, R.y) * smoothstep(-0.35, 0.85, R.z);
        vec3 regolithBounce = vec3(0.24, 0.095, 0.045) * chinBounce;

        // Grazing external Martian sky/horizon reflected along outer dome wall
        vec3 outerSkyRay = normalize(mix(-V, outN, 0.45));
        float horizon = exp(-abs(outerSkyRay.y) * 5.2);
        vec3 skyZenith = vec3(0.26, 0.19, 0.16);
        vec3 skyHorizon = vec3(0.76, 0.48, 0.30);
        float sunHalo = pow(max(dot(outerSkyRay, normalize(uSunWorldDir)), 0.0), 4.0);
        vec3 marsEnv = mix(skyZenith, skyHorizon, horizon) + vec3(0.95, 0.66, 0.42) * sunHalo * 0.55;

        vec3 cavity = carbonInterior + regolithBounce;
        return mix(cavity, marsEnv * uDomeFresnelColor, clamp(rimCurvature * 0.82 + 0.14 * wave, 0.0, 1.0));
      }

      void main() {
        vec2 hudUv = computeCalibratedHudUv(vLocalPos);
        vec2 surfUv = hudUvToSurfaceUv(hudUv);

        vec3 baseN = normalize(vWorldNormal);
        vec3 T = normalize(vWorldTangent);
        vec3 B = normalize(vWorldBitangent);
        vec3 V = normalize(cameraPosition - vWorldPos);

        vec4 surf;
        vec3 microN;
        vec2 scratchGrad;
        sampleMicroSurface(surfUv, baseN, T, B, surf, microN, scratchGrad);

        float cosTheta = clamp(abs(dot(microN, V)), 0.0, 1.0);
        float rimCurvature = computeRimCurvature(cosTheta);

        // Schlick Fresnel + polycarbonate solar thin-film interference tint
        float schlick = uFresnelF0 + (1.0 - uFresnelF0) * pow(1.0 - cosTheta, uFresnelPower);
        float filmNm = uIridescenceBaseNm + (surf.b - 0.5) * uIridescenceWaveNm;
        float opd = filmNm * max(cosTheta, 0.25);
        vec3 phase = (6.2831853 * opd) / vec3(640.0, 530.0, 460.0);
        vec3 thinFilm = 0.56 + 0.44 * cos(phase);
        vec3 coatTint = mix(vec3(1.0), thinFilm * vec3(1.06, 0.96, 0.88), uIridescenceStrength);

        vec3 R = reflect(-V, microN);
        vec3 outN = -microN;
        vec3 envCol = sampleCavityAndMarsEnv(R, V, outN, surf.b, rimCurvature) * coatTint;

        float reflectWeight = clamp(
          rimCurvature * uFresnelEdgeOpacity + schlick * uCavityReflectionOpacity,
          0.0,
          0.42
        );

        // Perimeter bezel shadow where thick curved polycarbonate seats into rubber gasket
        vec2 centered = (hudUv - 0.5) * vec2(1.92, 2.04);
        float bezelRadius = length(centered);
        float sunFront = max(dot(outN, normalize(uSunWorldDir)), 0.0);
        float bezelAlpha = smoothstep(0.74, 1.08, bezelRadius) * uBezelShadowOpacity * (1.0 - sunFront * 0.32);

        // Illuminated perimeter Martian dust & whisper-subtle lower-corner anti-fog haze
        float dustSun = 0.22 + 0.78 * sunFront;
        float dustAlpha = surf.r * dustSun * uDustReflectOpacity;
        float fogAlpha = surf.a * uEdgeFogOpacity * (0.45 + 0.55 * rimCurvature);

        // Blend layers in straight (non-premultiplied) RGB + alpha for THREE.NormalBlending
        vec3 col = envCol;
        float alpha = reflectWeight;

        float dustBlend = smoothstep(0.0, 0.35, dustAlpha);
        col = mix(col, uDustReflectColor * dustSun, clamp(dustBlend * 0.72, 0.0, 0.78));
        alpha = max(alpha, dustAlpha * 0.92);

        float fogBlend = smoothstep(0.0, 0.14, fogAlpha);
        col = mix(col, uEdgeFogColor, clamp(fogBlend * 0.55, 0.0, 0.45));
        alpha = clamp(alpha + fogAlpha * 0.65, 0.0, 0.68);

        float bezelBlend = smoothstep(0.0, 0.28, bezelAlpha);
        col = mix(col, uBezelShadowColor, clamp(bezelBlend * 0.85, 0.0, 0.92));
        alpha = clamp(max(alpha, bezelAlpha), 0.0, 0.72);

        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `,
  });

  // Pass B: Projected holographic HUD, solar specular glints, anisotropic scratches & Mie dust scatter
  const opticsMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uHudMap: { value: hudTexture },
      uTexelSize: { value: new THREE.Vector2(1 / texCfg.width, 1 / texCfg.height) },
      uHudIntensity: { value: optics.hudIntensity },
      uSoftBlurTexels: { value: optics.softBlurRadiusTexels },
      uBloomStrength: { value: optics.bloomStrength },
      uBloomSpreadTexels: { value: optics.bloomSpreadTexels },
      uGhostOffsetUv: { value: new THREE.Vector2(...optics.ghostOffsetUv) },
      uGhostViewParallax: { value: optics.ghostViewParallax },
      uGhostOpacity: { value: optics.ghostOpacity },
      uChromaticStrength: { value: optics.chromaticEdgeStrength },
      uChromaticPower: { value: optics.chromaticPower },
      uDomeSpecColor: { value: new THREE.Color(optics.domeSpecularColor) },
      uDomeSpecOpacity: { value: optics.domeSpecularOpacity },
      uDomeSpecBroadOpacity: { value: optics.domeSpecularBroadOpacity },
      uDomeFresnelColor: { value: new THREE.Color(optics.domeFresnelColor) },
      uDomeFresnelOpacity: { value: optics.domeFresnelOpacity },
      uDomeFresnelPower: { value: optics.domeFresnelPower },
      uDustScatterColor: { value: new THREE.Color(surfCfg.dustScatterColor) },
      uDustScatterOpacity: { value: surfCfg.dustScatterOpacity },
      uScratchGlintColor: { value: new THREE.Color(surfCfg.scratchGlintColor) },
      uScratchGlintOpacity: { value: surfCfg.scratchGlintOpacity },
      uCavityHudBounceOpacity: { value: optics.cavityHudBounceOpacity },
      uProjectorBounceColor: { value: new THREE.Color(optics.projectorBounceColor) },
      uProjectorBounceOpacity: { value: optics.projectorBounceOpacity },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    vertexShader: SHARED_VERTEX_SHADER,
    fragmentShader: /* glsl */ `
      ${SHARED_SURFACE_GLSL}

      uniform sampler2D uHudMap;
      uniform vec2 uTexelSize;
      uniform float uHudIntensity;
      uniform float uSoftBlurTexels;
      uniform float uBloomStrength;
      uniform float uBloomSpreadTexels;
      uniform vec2 uGhostOffsetUv;
      uniform float uGhostViewParallax;
      uniform float uGhostOpacity;
      uniform float uChromaticStrength;
      uniform float uChromaticPower;
      uniform vec3 uDomeSpecColor;
      uniform float uDomeSpecOpacity;
      uniform float uDomeSpecBroadOpacity;
      uniform vec3 uDomeFresnelColor;
      uniform float uDomeFresnelOpacity;
      uniform float uDomeFresnelPower;
      uniform vec3 uDustScatterColor;
      uniform float uDustScatterOpacity;
      uniform vec3 uScratchGlintColor;
      uniform float uScratchGlintOpacity;
      uniform float uCavityHudBounceOpacity;
      uniform vec3 uProjectorBounceColor;
      uniform float uProjectorBounceOpacity;

      vec4 sampleHudClamped(vec2 uv) {
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          return vec4(0.0);
        }
        return texture2D(uHudMap, uv);
      }

      // Clean optical focus kernel preserving crisp character glyphs
      vec4 sampleHudSoft(vec2 uv, float radiusTexels) {
        if (radiusTexels <= 0.08) {
          return sampleHudClamped(uv);
        }
        vec2 stepUv = uTexelSize * radiusTexels;
        vec4 center = sampleHudClamped(uv);
        vec4 sum = center * 0.60;
        sum += (sampleHudClamped(uv + vec2( stepUv.x,  0.0)) +
                sampleHudClamped(uv + vec2(-stepUv.x,  0.0)) +
                sampleHudClamped(uv + vec2( 0.0,  stepUv.y)) +
                sampleHudClamped(uv + vec2( 0.0, -stepUv.y))) * 0.10;
        return sum;
      }

      // 8-tap wide optical bloom scatter kernel (weighted by emitted alpha)
      vec3 sampleHudBloom(vec2 uv, float spreadTexels) {
        vec2 r = uTexelSize * spreadTexels;
        vec3 acc = vec3(0.0);
        vec4 s;
        s = sampleHudClamped(uv + vec2( r.x,  0.0)); acc += s.rgb * s.a;
        s = sampleHudClamped(uv + vec2(-r.x,  0.0)); acc += s.rgb * s.a;
        s = sampleHudClamped(uv + vec2( 0.0,  r.y)); acc += s.rgb * s.a;
        s = sampleHudClamped(uv + vec2( 0.0, -r.y)); acc += s.rgb * s.a;
        vec2 d = r * 0.7071;
        s = sampleHudClamped(uv + vec2( d.x,  d.y)); acc += s.rgb * s.a;
        s = sampleHudClamped(uv + vec2(-d.x,  d.y)); acc += s.rgb * s.a;
        s = sampleHudClamped(uv + vec2( d.x, -d.y)); acc += s.rgb * s.a;
        s = sampleHudClamped(uv + vec2(-d.x, -d.y)); acc += s.rgb * s.a;
        return acc * 0.125;
      }

      void main() {
        vec2 hudUv = computeCalibratedHudUv(vLocalPos);
        vec2 surfUv = hudUvToSurfaceUv(hudUv);
        vec2 centered = hudUv - 0.5;
        float distEdge = length(centered * vec2(1.0, 1.12));
        vec2 radialDir = distEdge > 0.0001 ? centered / distEdge : vec2(0.0);
        float fringe = pow(clamp(distEdge * 1.42, 0.0, 1.35), uChromaticPower) * uChromaticStrength;

        // Subtle radial RGB chromatic fringing toward curved glass edges
        vec2 uvR = hudUv + radialDir * fringe;
        vec2 uvG = hudUv;
        vec2 uvB = hudUv - radialDir * fringe;

        vec4 sR = sampleHudSoft(uvR, uSoftBlurTexels);
        vec4 sG = sampleHudSoft(uvG, uSoftBlurTexels);
        vec4 sB = sampleHudSoft(uvB, uSoftBlurTexels);

        vec3 mainRgb = vec3(sR.r * sR.a, sG.g * sG.a, sB.b * sB.a);

        // Optical glow & bloom halo
        vec3 bloom = sampleHudBloom(hudUv, uBloomSpreadTexels) * uBloomStrength;

        // View vectors & micro-perturbed curved glass normal in world space
        vec3 baseN = normalize(vWorldNormal);
        vec3 T = normalize(vWorldTangent);
        vec3 B = normalize(vWorldBitangent);
        vec3 V_world = normalize(cameraPosition - vWorldPos);
        vec3 V_view = normalize(vViewPos);
        vec3 L_sun = normalize(uSunWorldDir);

        vec4 surf;
        vec3 microN;
        vec2 scratchGrad;
        sampleMicroSurface(surfUv, baseN, T, B, surf, microN, scratchGrad);

        vec3 outN = -microN;
        float cosTheta = clamp(abs(dot(microN, V_world)), 0.0, 1.0);
        float rimCurvature = computeRimCurvature(cosTheta);

        // Faint secondary ghost reflection from inner vs outer glass wall thickness
        vec2 thicknessParallax = vec2(V_view.x, V_view.y) * uGhostViewParallax;
        vec2 ghostUv = hudUv + uGhostOffsetUv + thicknessParallax;
        vec4 ghostSample = sampleHudSoft(ghostUv, uSoftBlurTexels * 2.1);
        vec3 ghostRgb = ghostSample.rgb * ghostSample.a * uGhostOpacity * vec3(0.84, 0.94, 1.05);

        // Mask HUD softly at outer bounds
        float edgeMask =
          smoothstep(-0.02, 0.015, hudUv.x) *
          (1.0 - smoothstep(0.985, 1.02, hudUv.x)) *
          smoothstep(-0.02, 0.015, hudUv.y) *
          (1.0 - smoothstep(0.985, 1.02, hudUv.y));

        vec3 hudFinal = (mainRgb * uHudIntensity + bloom + ghostRgb) * edgeMask;

        // Solar specular lobes, outer Fresnel rim & upper-left dome forward corona
        float sunDotOut = max(dot(outN, L_sun), 0.0);
        float forwardMie = pow(max(dot(-V_world, L_sun), 0.0), 3.6);
        float crispSpec = pow(sunDotOut, 18.0) * (0.55 + 0.45 * surf.b) * uDomeSpecOpacity * (0.35 + 0.65 * rimCurvature);
        float broadSpec = pow(sunDotOut, 4.5) * uDomeSpecBroadOpacity * (0.25 + 0.75 * rimCurvature);
        float rimFresnel = pow(1.0 - cosTheta, uDomeFresnelPower) * uDomeFresnelOpacity * (0.35 + 0.65 * sunDotOut);

        // Anisotropic micro-scratch catchlights & sunlit Mie regolith dust scatter
        float dirAlign = min(1.2, abs(dot(T * scratchGrad.x + B * scratchGrad.y, L_sun)) * 4.5);
        float scratchFlash = surf.g * (0.18 + 0.82 * pow(sunDotOut, 2.2) + dirAlign * 0.55) * uScratchGlintOpacity;
        float dustMie = surf.r * (0.22 + 0.78 * pow(sunDotOut, 1.5) + 0.55 * forwardMie) * uDustScatterOpacity;

        // Subtle concave cavity bounce from upper brow projector & peripheral HUD glow
        float browZone = smoothstep(0.68, 0.98, hudUv.y) * (1.0 - smoothstep(0.04, 0.28, abs(hudUv.x - 0.5)));
        vec3 projectorBounce = uProjectorBounceColor * (browZone * uProjectorBounceOpacity * (0.4 + 0.6 * rimCurvature));

        vec2 bounceUv = clamp(0.5 + (hudUv - 0.5) * 0.72 + vec2(0.0, -0.05), 0.0, 1.0);
        vec3 hudBounce = sampleHudBloom(bounceUv, uBloomSpreadTexels * 4.2) * uCavityHudBounceOpacity * smoothstep(0.22, 0.95, rimCurvature);

        vec3 glassFinal =
          uDomeSpecColor * (crispSpec + broadSpec) +
          uDomeFresnelColor * rimFresnel +
          uScratchGlintColor * scratchFlash +
          uDustScatterColor * dustMie +
          projectorBounce +
          hudBounce;

        gl_FragColor = vec4(hudFinal + glassFinal, 1.0);
      }
    `,
  });

  const domeGeo = buildEllipsoidalDomeGeometry();

  const shellMesh = new THREE.Mesh(domeGeo, shellMaterial);
  shellMesh.name = "visorDomeShellMesh";
  shellMesh.renderOrder = 1;

  const opticsMesh = new THREE.Mesh(domeGeo, opticsMaterial);
  opticsMesh.name = "visorDomeOpticsMesh";
  opticsMesh.renderOrder = 2;

  group.add(shellMesh, opticsMesh);

  return {
    group,
    updateUniforms: (_cameraMatrixWorldInverse: THREE.Matrix4) => {
      // World-space matrix & cameraPosition uniforms are updated automatically by Three.js
    },
    dispose: () => {
      domeGeo.dispose();
      shellMaterial.dispose();
      opticsMaterial.dispose();
      surfaceTexture.dispose();
    },
  };
}
