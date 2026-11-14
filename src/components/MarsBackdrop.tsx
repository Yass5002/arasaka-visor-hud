import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { MOTION_CONFIG, PALETTE_CONFIG, PANORAMA_CONFIG } from "../config/visorConfig";

export interface VisorRigState {
  sceneX: number;
  sceneY: number;
  hudX: number;
  hudY: number;
  reticleX: number;
  reticleY: number;
  helmetX: number;
  helmetY: number;
}

interface MarsBackdropProps {
  onRigMove?: (state: VisorRigState) => void;
}

const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
`;

function computePanHalf(viewportAspect: number): [number, number] {
  const { fovDeg, panoramaAspect, panoramaCoverScale } = MOTION_CONFIG;
  const tanHalfY = Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5));
  const tanHalfX = tanHalfY * viewportAspect;
  if (viewportAspect <= panoramaAspect) {
    const h = tanHalfY * panoramaCoverScale;
    return [h * panoramaAspect, h];
  }
  const w = tanHalfX * panoramaCoverScale;
  return [w, w / panoramaAspect];
}

function clampUnit(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

/**
 * NASA Perseverance panorama (PIA24663) rendered with two opaque 3D depth-displaced meshes:
 * - Preserves exact raw NASA brightness, clarity, and color (NoColorSpace 1:1 passthrough)
 * - Smooth damped mouse look with hard clamping (never shows panorama edges)
 * - Idle breathing that never stops + smooth return-to-center drift when mouse is still
 * - Multi-tier damped parallax rig driving trailing HUD, reticle, optics, and helmet interior
 */
export const MarsBackdrop: React.FC<MarsBackdropProps> = ({ onRigMove }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onRigMoveRef = useRef(onRigMove);
  onRigMoveRef.current = onRigMove;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const initAspect = width / height;

    const params = new URLSearchParams(window.location.search);
    const lookParam = params.get("look");
    let initX = 0;
    let initY = 0;
    if (lookParam) {
      const [lx, ly] = lookParam.split(",").map(Number);
      if (Number.isFinite(lx)) initX = clampUnit(lx);
      if (Number.isFinite(ly)) initY = clampUnit(ly);
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(MOTION_CONFIG.fovDeg, initAspect, 0.5, 300);
    camera.position.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const loader = new THREE.TextureLoader();
    const configureTex = (tex: THREE.Texture) => {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.NoColorSpace;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      return tex;
    };

    const base = import.meta.env.BASE_URL;
    const skyTex = configureTex(loader.load(`${base}mars/mars-sky.webp`));
    const terrainTex = configureTex(loader.load(`${base}mars/mars-terrain.webp`));
    const depthTex = configureTex(loader.load(`${base}mars/mars-depth.png`));

    const [initPanW, initPanH] = computePanHalf(initAspect);
    const sharedUniforms = {
      uTime: { value: 0 },
      uPanHalf: { value: new THREE.Vector2(initPanW, initPanH) },
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uSkyMap: { value: skyTex },
        uSkyDist: { value: PANORAMA_CONFIG.skyDist },
      },
      transparent: false,
      depthWrite: true,
      vertexShader: /* glsl */ `
        uniform vec2 uPanHalf;
        uniform float uSkyDist;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec2 p = uv * 2.0 - 1.0;
          vec3 worldPos = vec3(p.x * uPanHalf.x * uSkyDist, p.y * uPanHalf.y * uSkyDist, -uSkyDist);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSkyMap;
        varying vec2 vUv;
        void main() {
          vec3 col = texture2D(uSkyMap, vUv).rgb;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uTerrainMap: { value: terrainTex },
        uDepthMap: { value: depthTex },
        uNearDist: { value: PANORAMA_CONFIG.nearDist },
        uFarDist: { value: PANORAMA_CONFIG.farDist },
        uDepthExp: { value: PANORAMA_CONFIG.depthExponent },
        uShimmerX: { value: PANORAMA_CONFIG.horizonShimmerAmpX },
        uShimmerY: { value: PANORAMA_CONFIG.horizonShimmerAmpY },
        uShadowBase: { value: PANORAMA_CONFIG.shadowLiftBase },
        uShadowBottom: { value: PANORAMA_CONFIG.shadowLiftBottom },
        uShadowLumThresh: { value: PANORAMA_CONFIG.shadowLumThreshold },
        uShadowBottomRange: { value: PANORAMA_CONFIG.shadowBottomRange },
      },
      transparent: false,
      depthWrite: true,
      vertexShader: /* glsl */ `
        uniform vec2 uPanHalf;
        uniform sampler2D uDepthMap;
        uniform float uNearDist;
        uniform float uFarDist;
        uniform float uDepthExp;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          float d = texture2D(uDepthMap, uv).r;
          vec2 p = uv * 2.0 - 1.0;
          float dist = mix(uFarDist, uNearDist, pow(d, uDepthExp));
          vec3 worldPos = vec3(p.x * uPanHalf.x * dist, p.y * uPanHalf.y * dist, -dist);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uTerrainMap;
        uniform sampler2D uDepthMap;
        uniform float uShimmerX;
        uniform float uShimmerY;
        uniform float uShadowBase;
        uniform float uShadowBottom;
        uniform float uShadowLumThresh;
        uniform float uShadowBottomRange;
        varying vec2 vUv;
        ${NOISE_GLSL}

        void main() {
          float depthSample = texture2D(uDepthMap, vUv).r;
          float horizonBand = smoothstep(0.0, 0.04, depthSample) * (1.0 - smoothstep(0.05, 0.17, depthSample));
          vec2 uvSample = vUv;
          float shimmer = (vnoise(vec2(vUv.x * 58.0 + uTime * 1.4, vUv.y * 92.0 - uTime * 2.6)) - 0.5);
          uvSample.x += shimmer * uShimmerX * horizonBand;
          uvSample.y += shimmer * uShimmerY * horizonBand;

          vec4 tex = texture2D(uTerrainMap, uvSample);
          if (tex.a < 0.5) discard;

          vec3 col = tex.rgb;
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          float shadowMask = 1.0 - smoothstep(0.0, uShadowLumThresh, lum);
          float bottomWeight = 1.0 - smoothstep(0.0, uShadowBottomRange, vUv.y);
          col = min(vec3(1.0), col + vec3(shadowMask * (uShadowBase + uShadowBottom * bottomWeight)));

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const skyGeo = new THREE.PlaneGeometry(2, 2, 1, 1);
    const terrainGeo = new THREE.PlaneGeometry(
      2,
      2,
      PANORAMA_CONFIG.meshSegmentsX,
      PANORAMA_CONFIG.meshSegmentsY
    );

    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    skyMesh.frustumCulled = false;
    terrainMesh.frustumCulled = false;

    scene.add(skyMesh, terrainMesh);

    let rawTargetX = initX;
    let rawTargetY = initY;
    let pointerX = initX;
    let pointerY = initY;
    let sceneX = initX;
    let sceneY = initY;
    let hudX = initX;
    let hudY = initY;
    let reticleX = initX;
    let reticleY = initY;
    let helmetX = initX;
    let helmetY = initY;
    let lastPointerTime = lookParam ? performance.now() + 999999 : performance.now() - MOTION_CONFIG.idleReturnDelayMs;

    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
      const ny = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
      rawTargetX = clampUnit(nx);
      rawTargetY = clampUnit(ny);
      lastPointerTime = performance.now();
    };

    const handlePointerLeave = () => {
      lastPointerTime = performance.now() - MOTION_CONFIG.idleReturnDelayMs;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);

    let animId = 0;
    let prevTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;
      const elapsed = now / 1000;

      // Drift view target smoothly back to center when mouse is still
      if (now - lastPointerTime > MOTION_CONFIG.idleReturnDelayMs) {
        const returnFactor = Math.exp(-MOTION_CONFIG.idleReturnRate * dt);
        rawTargetX *= returnFactor;
        rawTargetY *= returnFactor;
      }

      const pointerLerp = 1 - Math.exp(-MOTION_CONFIG.pointerDamping * dt);
      pointerX += (rawTargetX - pointerX) * pointerLerp;
      pointerY += (rawTargetY - pointerY) * pointerLerp;

      // Continuous idle breathing that never fully stops
      const { breathing } = MOTION_CONFIG;
      const breathY =
        Math.sin(elapsed * breathing.primaryFreqRad) * breathing.primaryAmpY +
        Math.sin(elapsed * breathing.secondaryFreqRad) * breathing.secondaryAmpY;
      const breathX =
        Math.cos(elapsed * breathing.lateralFreqRad) * breathing.lateralAmpX +
        Math.sin(elapsed * breathing.microDriftFreqRad) * breathing.microDriftAmpX;

      const combinedX = clampUnit(pointerX + breathX);
      const combinedY = clampUnit(pointerY + breathY);

      // Multi-tier damped motion: world camera -> helmet -> HUD -> floating reticle
      sceneX += (combinedX - sceneX) * (1 - Math.exp(-MOTION_CONFIG.sceneDamping * dt));
      sceneY += (combinedY - sceneY) * (1 - Math.exp(-MOTION_CONFIG.sceneDamping * dt));

      helmetX += (combinedX - helmetX) * (1 - Math.exp(-MOTION_CONFIG.helmetDamping * dt));
      helmetY += (combinedY - helmetY) * (1 - Math.exp(-MOTION_CONFIG.helmetDamping * dt));

      hudX += (combinedX - hudX) * (1 - Math.exp(-MOTION_CONFIG.hudTrailDamping * dt));
      hudY += (combinedY - hudY) * (1 - Math.exp(-MOTION_CONFIG.hudTrailDamping * dt));

      reticleX += (combinedX - reticleX) * (1 - Math.exp(-MOTION_CONFIG.reticleTrailDamping * dt));
      reticleY += (combinedY - reticleY) * (1 - Math.exp(-MOTION_CONFIG.reticleTrailDamping * dt));

      const clampedCamX = clampUnit(sceneX);
      const clampedCamY = clampUnit(sceneY);
      camera.position.x = clampedCamX * MOTION_CONFIG.maxCameraShiftX;
      camera.position.y = -clampedCamY * MOTION_CONFIG.maxCameraShiftY;
      camera.rotation.order = "YXZ";
      camera.rotation.y = -clampedCamX * MOTION_CONFIG.maxCameraYawRad;
      camera.rotation.x = -clampedCamY * MOTION_CONFIG.maxCameraPitchRad;

      sharedUniforms.uTime.value = elapsed;

      onRigMoveRef.current?.({
        sceneX: clampedCamX,
        sceneY: clampedCamY,
        hudX: clampUnit(hudX),
        hudY: clampUnit(hudY),
        reticleX: clampUnit(reticleX),
        reticleY: clampUnit(reticleY),
        helmetX: clampUnit(helmetX),
        helmetY: clampUnit(helmetY),
      });

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const aspect = w / h;
      const [panW, panH] = computePanHalf(aspect);
      sharedUniforms.uPanHalf.value.set(panW, panH);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", handleResize);
      skyGeo.dispose();
      terrainGeo.dispose();
      skyMat.dispose();
      terrainMat.dispose();
      skyTex.dispose();
      terrainTex.dispose();
      depthTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        background: PALETTE_CONFIG.voidBg,
      }}
    />
  );
};
