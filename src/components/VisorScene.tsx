import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { MOTION_CONFIG, PANORAMA_CONFIG, SCENE_CONFIG } from "../config/visorConfig";
import { createHelmetTextures } from "../three/proceduralTextures";
import { buildHelmetGroup } from "../three/buildHelmetGroup";
import { buildVisorGlass } from "../three/buildVisorGlass";
import { HelmetDofComposite } from "../three/HelmetDofComposite";
import { HudCanvasRenderer } from "../hud/HudCanvasRenderer";

function computePanHalf(viewportAspect: number): [number, number] {
  const { panoramaAspect, panoramaCoverScale } = MOTION_CONFIG;
  const tanHalfY = Math.tan(THREE.MathUtils.degToRad(SCENE_CONFIG.fovDeg * 0.5));
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

function clampSigned(v: number, maxAbs: number): number {
  return Math.max(-maxAbs, Math.min(maxAbs, v));
}

/**
 * Unified real 3D perspective scene:
 * - Mars panorama (sky + depth-displaced terrain) rendered with untouched NASA brightness/colors
 * - Rigid headGroup containing both the real 3D PBR helmet interior and the curved 3D visor glass
 * - Eye (PerspectiveCamera) shifting & rotating independently inside the helmet cavity
 * - Projected HUD rendered onto the 3D curved dome mesh (soft blur, bloom, ghost, edge chromatic fringe)
 * - Near-eye foreground helmet parts composited with real 3D distance-based Depth-of-Field blur
 */
export const VisorScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

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

    const camera = new THREE.PerspectiveCamera(
      SCENE_CONFIG.fovDeg,
      initAspect,
      SCENE_CONFIG.nearPlane,
      SCENE_CONFIG.farPlane
    );
    camera.rotation.order = "YXZ";

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, SCENE_CONFIG.maxPixelRatio);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClear = false;

    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const drawSize = new THREE.Vector2();
    renderer.getDrawingBufferSize(drawSize);
    const dofComposite = new HelmetDofComposite(drawSize.x, drawSize.y);

    // =========================================================================
    // 1. WORLD MARS PANORAMA (UNTOUCHED BRIGHTNESS & CLARITY)
    // =========================================================================
    const marsGroup = new THREE.Group();
    marsGroup.name = "marsGroup";
    scene.add(marsGroup);

    const loader = new THREE.TextureLoader();
    const configurePanoramaTex = (tex: THREE.Texture) => {
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
    const skyTex = configurePanoramaTex(loader.load(`${base}mars/mars-sky.webp`));
    const terrainTex = configurePanoramaTex(loader.load(`${base}mars/mars-terrain.webp`));
    const depthTex = configurePanoramaTex(loader.load(`${base}mars/mars-depth.png`));

    const [initPanW, initPanH] = computePanHalf(initAspect);
    const panUniforms = {
      uTime: { value: 0 },
      uPanHalf: { value: new THREE.Vector2(initPanW, initPanH) },
      uHorizonBias: { value: PANORAMA_CONFIG.horizonBias },
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        ...panUniforms,
        uSkyMap: { value: skyTex },
        uSkyDist: { value: PANORAMA_CONFIG.skyDist },
      },
      transparent: false,
      depthWrite: true,
      toneMapped: false,
      vertexShader: /* glsl */ `
        uniform vec2 uPanHalf;
        uniform float uSkyDist;
        uniform float uHorizonBias;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec2 p = uv * 2.0 - 1.0;
          float skyY = mix(-1.2, 3.2, uv.y);
          vec3 worldPos = vec3(
            p.x * uPanHalf.x * uSkyDist,
            (skyY - uHorizonBias) * uPanHalf.y * uSkyDist,
            -uSkyDist
          );
          gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSkyMap;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(texture2D(uSkyMap, vUv).rgb, 1.0);
        }
      `,
    });

    const terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        ...panUniforms,
        uTerrainMap: { value: terrainTex },
        uDepthMap: { value: depthTex },
        uNearDist: { value: PANORAMA_CONFIG.nearDist },
        uFarDist: { value: PANORAMA_CONFIG.farDist },
        uDepthExp: { value: PANORAMA_CONFIG.depthExponent },
        uShadowBase: { value: PANORAMA_CONFIG.shadowLiftBase },
        uShadowBottom: { value: PANORAMA_CONFIG.shadowLiftBottom },
        uShadowLumThresh: { value: PANORAMA_CONFIG.shadowLumThreshold },
        uShadowBottomRange: { value: PANORAMA_CONFIG.shadowBottomRange },
      },
      transparent: false,
      depthWrite: true,
      toneMapped: false,
      vertexShader: /* glsl */ `
        uniform vec2 uPanHalf;
        uniform float uHorizonBias;
        uniform sampler2D uDepthMap;
        uniform float uNearDist;
        uniform float uFarDist;
        uniform float uDepthExp;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          float d = texture2D(uDepthMap, uv).r;
          vec2 p = uv * 2.0 - 1.0;
          float terrainY = mix(-2.2, 1.0, uv.y);
          float dist = mix(uFarDist, uNearDist, pow(d, uDepthExp));
          vec3 worldPos = vec3(
            p.x * uPanHalf.x * dist,
            (terrainY - uHorizonBias) * uPanHalf.y * dist,
            -dist
          );
          gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTerrainMap;
        uniform float uShadowBase;
        uniform float uShadowBottom;
        uniform float uShadowLumThresh;
        uniform float uShadowBottomRange;
        varying vec2 vUv;

        void main() {
          vec4 tex = texture2D(uTerrainMap, vUv);
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
    marsGroup.add(skyMesh, terrainMesh);

    // =========================================================================
    // 2. WORLD-SPACE MARS SUN & BOUNCE LIGHTING FOR HELMET PBR MATERIALS
    // =========================================================================
    const sunDir = new THREE.Vector3(...SCENE_CONFIG.marsSun.direction).normalize();
    const sunLight = new THREE.DirectionalLight(
      SCENE_CONFIG.marsSun.color,
      SCENE_CONFIG.marsSun.intensity
    );
    sunLight.position.copy(sunDir).multiplyScalar(2.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 4.5;
    sunLight.shadow.camera.left = -0.38;
    sunLight.shadow.camera.right = 0.38;
    sunLight.shadow.camera.top = 0.38;
    sunLight.shadow.camera.bottom = -0.38;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.003;
    scene.add(sunLight);

    const bounceDir = new THREE.Vector3(...SCENE_CONFIG.marsGroundBounce.direction).normalize();
    const bounceLight = new THREE.DirectionalLight(
      SCENE_CONFIG.marsGroundBounce.color,
      SCENE_CONFIG.marsGroundBounce.intensity
    );
    bounceLight.position.copy(bounceDir).multiplyScalar(10);
    scene.add(bounceLight);

    const cavityDir = new THREE.Vector3(...SCENE_CONFIG.cavityFill.direction).normalize();
    const cavityLight = new THREE.DirectionalLight(
      SCENE_CONFIG.cavityFill.color,
      SCENE_CONFIG.cavityFill.intensity
    );
    cavityLight.position.copy(cavityDir).multiplyScalar(10);
    scene.add(cavityLight);

    const hemiLight = new THREE.HemisphereLight(
      SCENE_CONFIG.hemisphereLight.skyColor,
      SCENE_CONFIG.hemisphereLight.groundColor,
      SCENE_CONFIG.hemisphereLight.intensity
    );
    scene.add(hemiLight);

    // =========================================================================
    // 3. RIGID HEAD BODY: HELMET INTERIOR + CURVED VISOR GLASS + EYE CAMERA
    // =========================================================================
    const headGroup = new THREE.Group();
    headGroup.name = "headRigidBody";
    headGroup.rotation.order = "YXZ";
    scene.add(headGroup);

    const helmetTextures = createHelmetTextures();
    const helmetInterior = buildHelmetGroup(helmetTextures);
    const hudRenderer = new HudCanvasRenderer();
    const visorGlass = buildVisorGlass(hudRenderer.texture);

    headGroup.add(helmetInterior.group);
    headGroup.add(visorGlass.group);
    headGroup.add(camera);

    // =========================================================================
    // 4. HEAD & EYE MOTION STATE WITH HARD PANORAMA CLAMPING
    // =========================================================================
    let rawTargetX = initX;
    let rawTargetY = initY;
    let pointerX = initX;
    let pointerY = initY;

    let headInputX = initX;
    let headInputY = initY;
    let eyeInputX = initX;
    let eyeInputY = initY;

    let currentAspect = initAspect;
    let lastPointerTime = lookParam
      ? performance.now() + 999999
      : performance.now() - MOTION_CONFIG.idleReturnDelayMs;

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

    const clearCol = new THREE.Color(SCENE_CONFIG.voidBg);
    const zeroAlphaCol = new THREE.Color(0x000000);

    let animId = 0;
    const startTime = performance.now();
    let prevTime = startTime;

    const animate = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;
      const elapsedSec = (now - startTime) / 1000;
      const absElapsed = now / 1000;

      // Return smoothly toward center when mouse is still
      if (now - lastPointerTime > MOTION_CONFIG.idleReturnDelayMs) {
        const decay = Math.exp(-MOTION_CONFIG.idleReturnRate * dt);
        rawTargetX *= decay;
        rawTargetY *= decay;
      }

      const ptrAlpha = 1 - Math.exp(-MOTION_CONFIG.pointerDamping * dt);
      pointerX += (rawTargetX - pointerX) * ptrAlpha;
      pointerY += (rawTargetY - pointerY) * ptrAlpha;

      // Independent heavy head vs responsive eye damping
      const headAlpha = 1 - Math.exp(-MOTION_CONFIG.head.damping * dt);
      headInputX += (pointerX - headInputX) * headAlpha;
      headInputY += (pointerY - headInputY) * headAlpha;

      const eyeAlpha = 1 - Math.exp(-MOTION_CONFIG.eye.damping * dt);
      eyeInputX += (pointerX - eyeInputX) * eyeAlpha;
      eyeInputY += (pointerY - eyeInputY) * eyeAlpha;

      // Continuous multi-harmonic idle breathing (head & eye never stop moving)
      const hb = MOTION_CONFIG.head.breathing;
      const headBreathPitch =
        Math.sin(absElapsed * hb.pitchFreqRad) * hb.pitchAmpRad +
        Math.sin(absElapsed * hb.pitchHarmonicFreqRad) * hb.pitchHarmonicAmpRad;
      const headBreathYaw = Math.cos(absElapsed * hb.yawFreqRad) * hb.yawAmpRad;
      const headBreathRoll = Math.sin(absElapsed * hb.rollFreqRad) * hb.rollAmpRad;

      const eb = MOTION_CONFIG.eye.breathing;
      const eyeBreathYaw = Math.sin(absElapsed * eb.yawFreqRad) * eb.yawAmpRad;
      const eyeBreathPitch = Math.cos(absElapsed * eb.pitchFreqRad) * eb.pitchAmpRad;
      const eyeBreathShiftX = Math.sin(absElapsed * eb.shiftXFreqRad) * eb.shiftXAmp;
      const eyeBreathShiftY = Math.cos(absElapsed * eb.shiftYFreqRad) * eb.shiftYAmp;

      // Desired head rotation (heavy rigid body: turns helmet + curved glass + HUD together)
      let headYaw = -headInputX * MOTION_CONFIG.head.maxYawRad + headBreathYaw;
      let headPitch = -headInputY * MOTION_CONFIG.head.maxPitchRad + headBreathPitch;
      const headRoll = headYaw * MOTION_CONFIG.head.rollPerYawRatio + headBreathRoll;

      // Desired independent eye rotation & translation inside the helmet cavity
      let eyeYaw = -eyeInputX * MOTION_CONFIG.eye.maxYawRad + eyeBreathYaw;
      let eyePitch = -eyeInputY * MOTION_CONFIG.eye.maxPitchRad + eyeBreathPitch;

      const eyeShiftX = clampSigned(
        eyeInputX * MOTION_CONFIG.eye.maxShiftX + eyeBreathShiftX,
        MOTION_CONFIG.eye.maxShiftX * 1.15
      );
      const eyeShiftY = clampSigned(
        eyeInputY * MOTION_CONFIG.eye.shiftYPerLookY + eyeBreathShiftY,
        MOTION_CONFIG.eye.maxShiftY * 1.15
      );
      const eyeShiftZ = clampSigned(
        Math.abs(eyeInputY) * MOTION_CONFIG.eye.shiftZPerLookY,
        MOTION_CONFIG.eye.maxShiftZ
      );

      // Strict angular clamp against live panorama coverage so Mars borders NEVER appear
      const [panW, panH] = [panUniforms.uPanHalf.value.x, panUniforms.uPanHalf.value.y];
      const tanHalfY = Math.tan(THREE.MathUtils.degToRad(SCENE_CONFIG.fovDeg * 0.5));
      const tanHalfX = tanHalfY * currentAspect;
      const maxShiftAngular =
        Math.hypot(MOTION_CONFIG.eye.maxShiftX, MOTION_CONFIG.eye.maxShiftY) /
        PANORAMA_CONFIG.nearDist;
      const maxSafeYaw = Math.max(
        0.01,
        Math.atan(panW) - Math.atan(tanHalfX) - MOTION_CONFIG.edgeSafetyMarginRad - maxShiftAngular
      );
      const maxSafePitchUp = Math.max(
        0.01,
        Math.atan((3.2 - PANORAMA_CONFIG.horizonBias) * panH) -
          Math.atan(tanHalfY) -
          MOTION_CONFIG.edgeSafetyMarginRad -
          maxShiftAngular
      );
      const maxSafePitchDown = Math.max(
        0.01,
        Math.atan((2.2 + PANORAMA_CONFIG.horizonBias) * panH) -
          Math.atan(tanHalfY) -
          MOTION_CONFIG.edgeSafetyMarginRad -
          maxShiftAngular
      );

      const rawTotalYaw = headYaw + eyeYaw;
      if (Math.abs(rawTotalYaw) > maxSafeYaw) {
        const scale = maxSafeYaw / Math.abs(rawTotalYaw);
        headYaw *= scale;
        eyeYaw *= scale;
      }

      const rawTotalPitch = headPitch + eyePitch;
      if (rawTotalPitch > maxSafePitchUp) {
        const scale = maxSafePitchUp / rawTotalPitch;
        headPitch *= scale;
        eyePitch *= scale;
      } else if (rawTotalPitch < -maxSafePitchDown) {
        const scale = -maxSafePitchDown / rawTotalPitch;
        headPitch *= scale;
        eyePitch *= scale;
      }

      // Apply 3D rigid body transforms
      headGroup.rotation.set(headPitch, headYaw, headRoll, "YXZ");
      camera.position.set(eyeShiftX, eyeShiftY, eyeShiftZ);
      camera.rotation.set(eyePitch, eyeYaw, 0, "YXZ");

      headGroup.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);

      // Update shaders & live projected HUD canvas
      panUniforms.uTime.value = absElapsed;
      const pitchNormRef = rawTotalPitch >= 0 ? maxSafePitchUp : maxSafePitchDown;
      const pitchNorm = -(headPitch + eyePitch) / Math.max(0.01, pitchNormRef);
      hudRenderer.update(now, elapsedSec, pitchNorm);
      visorGlass.updateUniforms(camera.matrixWorldInverse);

      // Pass 1: Untouched Mars panorama directly to screen
      marsGroup.visible = true;
      helmetInterior.group.visible = false;
      visorGlass.group.visible = false;
      renderer.setRenderTarget(null);
      renderer.setClearColor(clearCol, 1);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);

      // Pass 2: Curved 3D visor glass + projected soft/bloom/ghost/chromatic HUD (additive)
      marsGroup.visible = false;
      helmetInterior.group.visible = false;
      visorGlass.group.visible = true;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);

      // Pass 3: Near-eye PBR helmet interior -> offscreen RT -> distance-weighted DoF composite
      marsGroup.visible = false;
      visorGlass.group.visible = false;
      helmetInterior.group.visible = true;
      renderer.setRenderTarget(dofComposite.renderTarget);
      renderer.setClearColor(zeroAlphaCol, 0);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);

      dofComposite.renderComposite(renderer);

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (w < 4 || h < 4) return;
      currentAspect = w / h;
      const [panW, panH] = computePanHalf(currentAspect);
      panUniforms.uPanHalf.value.set(panW, panH);
      camera.aspect = currentAspect;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.getDrawingBufferSize(drawSize);
      dofComposite.setSize(drawSize.x, drawSize.y);
    };
    window.addEventListener("resize", handleResize);
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();

      hudRenderer.dispose();
      visorGlass.dispose();
      helmetInterior.dispose();
      helmetTextures.dispose();
      dofComposite.dispose();

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

  return <main ref={mountRef} className="visor-canvas-host" style={{ backgroundColor: SCENE_CONFIG.voidBg }} />;
};
