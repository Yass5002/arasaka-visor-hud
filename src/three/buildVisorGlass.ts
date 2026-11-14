import * as THREE from "three";
import { SCENE_CONFIG, VISOR_GLASS_CONFIG } from "../config/visorConfig";

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
  const uvs: number[] = [];
  const indices: number[] = [];

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

      const x = centerX + radiusX * cosPhi * sinTheta;
      const y = centerY + radiusY * sinPhi;
      const z = centerZ - radiusZ * cosPhi * cosTheta;

      positions.push(x, y, z);
      uvs.push(u, v);
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
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export interface VisorGlassHandle {
  group: THREE.Group;
  updateUniforms: (cameraMatrixWorldInverse: THREE.Matrix4) => void;
  dispose: () => void;
}

/**
 * Builds the 3D curved polycarbonate visor glass dome mesh inside headGroup,
 * mathematically projecting the live HUD CanvasTexture onto the concave surface with:
 * - Soft low-effective-resolution optical focus blur + glow/bloom
 * - Ghost double reflection from glass wall thickness (view-dependent + thickness offset)
 * - Radial chromatic RGB fringing toward the curved edges
 * - Pure additive blending so Mars brightness & clarity behind the glass remain 100% untouched
 */
export function buildVisorGlass(hudTexture: THREE.Texture): VisorGlassHandle {
  const group = new THREE.Group();
  group.name = "visorGlassGroup";

  const { hudWindowUv, hudTexture: texCfg, optics } = VISOR_GLASS_CONFIG;

  const sunWorldDir = new THREE.Vector3(...SCENE_CONFIG.marsSun.direction).normalize();
  const sunViewDir = sunWorldDir.clone();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uHudMap: { value: hudTexture },
      uTexelSize: { value: new THREE.Vector2(1 / texCfg.width, 1 / texCfg.height) },
      uHudWindowMin: { value: new THREE.Vector2(hudWindowUv.uMin, hudWindowUv.vMin) },
      uHudWindowSpan: {
        value: new THREE.Vector2(
          hudWindowUv.uMax - hudWindowUv.uMin,
          hudWindowUv.vMax - hudWindowUv.vMin
        ),
      },
      uHudIntensity: { value: optics.hudIntensity },
      uSoftBlurTexels: { value: optics.softBlurRadiusTexels },
      uBloomStrength: { value: optics.bloomStrength },
      uBloomSpreadTexels: { value: optics.bloomSpreadTexels },
      uGhostOffsetUv: { value: new THREE.Vector2(...optics.ghostOffsetUv) },
      uGhostViewParallax: { value: optics.ghostViewParallax },
      uGhostOpacity: { value: optics.ghostOpacity },
      uChromaticStrength: { value: optics.chromaticEdgeStrength },
      uChromaticPower: { value: optics.chromaticPower },
      uSunViewDir: { value: sunViewDir },
      uDomeSpecColor: { value: new THREE.Color(optics.domeSpecularColor) },
      uDomeSpecOpacity: { value: optics.domeSpecularOpacity },
      uDomeFresnelColor: { value: new THREE.Color(optics.domeFresnelColor) },
      uDomeFresnelOpacity: { value: optics.domeFresnelOpacity },
      uDomeFresnelPower: { value: optics.domeFresnelPower },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;

      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uHudMap;
      uniform vec2 uTexelSize;
      uniform vec2 uHudWindowMin;
      uniform vec2 uHudWindowSpan;
      uniform float uHudIntensity;
      uniform float uSoftBlurTexels;
      uniform float uBloomStrength;
      uniform float uBloomSpreadTexels;
      uniform vec2 uGhostOffsetUv;
      uniform float uGhostViewParallax;
      uniform float uGhostOpacity;
      uniform float uChromaticStrength;
      uniform float uChromaticPower;
      uniform vec3 uSunViewDir;
      uniform vec3 uDomeSpecColor;
      uniform float uDomeSpecOpacity;
      uniform vec3 uDomeFresnelColor;
      uniform float uDomeFresnelOpacity;
      uniform float uDomeFresnelPower;

      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;

      vec4 sampleHudClamped(vec2 uv) {
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          return vec4(0.0);
        }
        return texture2D(uHudMap, uv);
      }

      // 9-tap soft Gaussian optical focus kernel
      vec4 sampleHudSoft(vec2 uv, float radiusTexels) {
        vec2 stepUv = uTexelSize * radiusTexels;
        vec4 sum = sampleHudClamped(uv) * 0.24;
        sum += sampleHudClamped(uv + vec2( stepUv.x,  0.0)) * 0.12;
        sum += sampleHudClamped(uv + vec2(-stepUv.x,  0.0)) * 0.12;
        sum += sampleHudClamped(uv + vec2( 0.0,  stepUv.y)) * 0.12;
        sum += sampleHudClamped(uv + vec2( 0.0, -stepUv.y)) * 0.12;
        sum += sampleHudClamped(uv + vec2( stepUv.x,  stepUv.y)) * 0.07;
        sum += sampleHudClamped(uv + vec2(-stepUv.x,  stepUv.y)) * 0.07;
        sum += sampleHudClamped(uv + vec2( stepUv.x, -stepUv.y)) * 0.07;
        sum += sampleHudClamped(uv + vec2(-stepUv.x, -stepUv.y)) * 0.07;
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
        vec2 hudUv = (vUv - uHudWindowMin) / uHudWindowSpan;
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

        // Faint secondary ghost reflection from inner vs outer glass surface thickness
        vec3 N = normalize(vNormalView);
        vec3 V = normalize(vViewPos);
        vec2 thicknessParallax = vec2(V.x, V.y) * uGhostViewParallax;
        vec2 ghostUv = hudUv + uGhostOffsetUv + thicknessParallax;
        vec4 ghostSample = sampleHudSoft(ghostUv, uSoftBlurTexels * 2.1);
        vec3 ghostRgb = ghostSample.rgb * ghostSample.a * uGhostOpacity * vec3(0.84, 0.94, 1.05);

        // Subtle additive curved dome sun glint & grazing Fresnel (never darkens Mars)
        vec3 L = normalize(uSunViewDir);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 42.0) * uDomeSpecOpacity;
        float fresnel = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), uDomeFresnelPower) * uDomeFresnelOpacity;

        // Mask HUD softly at outer bounds
        float edgeMask =
          smoothstep(-0.02, 0.015, hudUv.x) *
          (1.0 - smoothstep(0.985, 1.02, hudUv.x)) *
          smoothstep(-0.02, 0.015, hudUv.y) *
          (1.0 - smoothstep(0.985, 1.02, hudUv.y));

        vec3 hudFinal = (mainRgb * uHudIntensity + bloom + ghostRgb) * edgeMask;
        vec3 glassFinal = uDomeSpecColor * spec + uDomeFresnelColor * fresnel;

        gl_FragColor = vec4(hudFinal + glassFinal, 1.0);
      }
    `,
  });

  const domeGeo = buildEllipsoidalDomeGeometry();
  const domeMesh = new THREE.Mesh(domeGeo, material);
  domeMesh.name = "visorDomeMesh";
  group.add(domeMesh);

  const normalQuat = new THREE.Quaternion();

  return {
    group,
    updateUniforms: (cameraMatrixWorldInverse: THREE.Matrix4) => {
      // Transform Mars world sun direction into camera view space
      normalQuat.setFromRotationMatrix(cameraMatrixWorldInverse);
      sunViewDir.copy(sunWorldDir).applyQuaternion(normalQuat).normalize();
    },
    dispose: () => {
      domeGeo.dispose();
      material.dispose();
    },
  };
}
