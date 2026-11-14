import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface MarsBackdropProps {
  onHeadMove?: (headX: number, headY: number) => void;
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

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = rot * p * 2.03 + vec2(17.1, 31.7);
      a *= 0.48;
    }
    return v;
  }
`;

const TEX_ASPECT = 2400 / 1225;
const FOV_DEG = 46;
const COVER_SCALE = 1.13;

function computePanHalf(viewportAspect: number): [number, number] {
  const tanHalfY = Math.tan(THREE.MathUtils.degToRad(FOV_DEG * 0.5));
  const tanHalfX = tanHalfY * viewportAspect;
  if (viewportAspect <= TEX_ASPECT) {
    const h = tanHalfY * COVER_SCALE;
    return [h * TEX_ASPECT, h];
  }
  const w = tanHalfX * COVER_SCALE;
  return [w, w / TEX_ASPECT];
}

/**
 * NASA Perseverance panorama (PIA24663) rendered with two 100% opaque layers:
 * 1) Solid Mars sky plane at far distance with slowly drifting cirrus wisps & warm sun scatter.
 * 2) Solid 3D depth-displaced terrain mesh (far rim -> mid plains -> near boulders) with crisp
 *    ridge cutout (alphaTest / discard), subtle heat shimmer & windborne dust haze, and genuine
 *    perspective parallax driven exclusively by heavily damped camera movement (zero transparent
 *    layer overlaps, zero frame blending/trails, zero motion ghosting).
 */
export const MarsBackdrop: React.FC<MarsBackdropProps> = ({ onHeadMove }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onHeadMoveRef = useRef(onHeadMove);
  onHeadMoveRef.current = onHeadMove;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const initAspect = width / height;

    // Optional URL parameter ?look=x,y for deterministic capture angles
    const params = new URLSearchParams(window.location.search);
    const lookParam = params.get("look");
    let initX = 0;
    let initY = 0;
    if (lookParam) {
      const [lx, ly] = lookParam.split(",").map(Number);
      if (Number.isFinite(lx)) initX = Math.max(-1, Math.min(1, lx));
      if (Number.isFinite(ly)) initY = Math.max(-1, Math.min(1, ly));
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV_DEG, initAspect, 0.5, 300);
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
    const configureTex = (tex: THREE.Texture, srgb: boolean) => {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      return tex;
    };

    const base = import.meta.env.BASE_URL;
    const skyTex = configureTex(loader.load(`${base}mars/mars-sky.webp`), true);
    const terrainTex = configureTex(loader.load(`${base}mars/mars-terrain.webp`), true);
    const depthTex = configureTex(loader.load(`${base}mars/mars-depth.png`), false);

    const [initPanW, initPanH] = computePanHalf(initAspect);
    const sharedUniforms = {
      uTime: { value: 0 },
      uHead: { value: new THREE.Vector2(initX, initY) },
      uPanHalf: { value: new THREE.Vector2(initPanW, initPanH) },
      uViewportAspect: { value: initAspect },
    };

    // =========================================================================
    // 1. OPAQUE SKY LAYER (far background Z = -148)
    // =========================================================================
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uSkyMap: { value: skyTex },
      },
      transparent: false,
      depthWrite: true,
      vertexShader: /* glsl */ `
        uniform vec2 uPanHalf;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec2 p = uv * 2.0 - 1.0;
          float dist = 148.0;
          vec3 worldPos = vec3(p.x * uPanHalf.x * dist, p.y * uPanHalf.y * dist, -dist);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec2 uHead;
        uniform vec2 uPanHalf;
        uniform sampler2D uSkyMap;
        varying vec2 vUv;
        ${NOISE_GLSL}

        void main() {
          vec3 col = texture2D(uSkyMap, vUv).rgb;

          // Subtle high-altitude Martian dust cirrus drift
          float skyBand = smoothstep(0.68, 0.96, vUv.y);
          float cloudA = fbm(vec2(vUv.x * 4.5 - uTime * 0.008, vUv.y * 9.0 + uTime * 0.002));
          float cloudB = fbm(vec2(vUv.x * 8.2 - uTime * 0.014 + 3.1, vUv.y * 14.0));
          float wisp = smoothstep(0.46, 0.80, cloudA * 0.65 + cloudB * 0.35) * skyBand;
          col = mix(col, col + vec3(0.09, 0.065, 0.042), wisp * 0.30);

          // Clear, soft warm Martian sun area with surrounding atmospheric haze (shifts subtly on turn)
          vec2 sunPos = vec2(0.77, 0.85) + uHead * vec2(-0.028, 0.018);
          vec2 d = vUv - sunPos;
          d.x *= (uPanHalf.x / max(0.001, uPanHalf.y));
          float r = length(d);
          float sunDisc = exp(-r * 22.0) * 0.56;
          float innerBloom = exp(-r * 8.2) * 0.34;
          float dustHaze = exp(-r * 2.15) * 0.24;
          col += vec3(1.0, 0.90, 0.76) * sunDisc
               + vec3(1.0, 0.78, 0.52) * innerBloom
               + vec3(0.96, 0.65, 0.36) * dustHaze;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    // =========================================================================
    // 2. OPAQUE 3D DEPTH-DISPLACED TERRAIN MESH (far rim -> mid -> near boulders)
    // =========================================================================
    const terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uTerrainMap: { value: terrainTex },
        uDepthMap: { value: depthTex },
      },
      transparent: false,
      depthWrite: true,
      vertexShader: /* glsl */ `
        uniform vec2 uPanHalf;
        uniform sampler2D uDepthMap;
        varying vec2 vUv;
        varying float vDepth;

        void main() {
          vUv = uv;
          float d = texture2D(uDepthMap, uv).r;
          vDepth = d;
          vec2 p = uv * 2.0 - 1.0;

          // Map normalized depth (0 = distant ridge, 1 = nearest foreground boulders)
          // strictly along the camera ray so projection is exact at rest and produces
          // natural continuous 3D parallax without overlapping semi-transparent slices.
          float dist = mix(94.0, 22.0, pow(d, 0.90));
          vec3 worldPos = vec3(p.x * uPanHalf.x * dist, p.y * uPanHalf.y * dist, -dist);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec2 uHead;
        uniform vec2 uPanHalf;
        uniform sampler2D uTerrainMap;
        uniform sampler2D uDepthMap;
        varying vec2 vUv;
        varying float vDepth;
        ${NOISE_GLSL}

        void main() {
          // Delicate horizon heat shimmer strictly near distant rim
          float depthSample = texture2D(uDepthMap, vUv).r;
          float horizonBand = smoothstep(0.0, 0.04, depthSample) * (1.0 - smoothstep(0.05, 0.17, depthSample));
          vec2 uvSample = vUv;
          float shimmer = (vnoise(vec2(vUv.x * 58.0 + uTime * 1.4, vUv.y * 92.0 - uTime * 2.6)) - 0.5);
          uvSample.x += shimmer * 0.00055 * horizonBand;
          uvSample.y += shimmer * 0.00035 * horizonBand;

          vec4 tex = texture2D(uTerrainMap, uvSample);
          // Hard cutout along mountain ridge — everything below ridge is 100% opaque
          if (tex.a < 0.5) discard;

          vec3 col = tex.rgb;

          // Slightly raise ground contrast while keeping natural dark regolith floor
          col = clamp((col - 0.36) * 1.14 + 0.36, 0.0, 1.0);

          // Brighter edges on rocks facing the upper-right sun (directional relief edge catchlight)
          vec2 sunStep = normalize(vec2(0.78, 0.62) + uHead * vec2(-0.18, 0.12)) * vec2(0.0014, 0.0028);
          vec3 sampleAway = texture2D(uTerrainMap, clamp(uvSample - sunStep, 0.001, 0.999)).rgb;
          float lumHere = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
          float lumBehind = dot(sampleAway, vec3(0.299, 0.587, 0.114));
          float sunEdge = smoothstep(0.006, 0.075, lumHere - lumBehind);
          float rockWeight = 0.25 + 0.75 * smoothstep(0.06, 0.75, depthSample);
          col += vec3(1.0, 0.76, 0.48) * (sunEdge * rockWeight * 0.28);

          // Atmospheric distance dust veil (pure tint modulation, zero silhouette duplication)
          float distWeight = 1.0 - smoothstep(0.04, 0.58, depthSample);
          float dustNoise = fbm(vec2(vUv.x * 4.2 - uTime * 0.015, vUv.y * 6.5 - uTime * 0.004));
          vec3 dustColor = vec3(0.56, 0.43, 0.34);
          col = mix(col, dustColor, distWeight * (0.04 + dustNoise * 0.07));

          // Gentle darker falloff away from upper-right sun + responsive forward glare scatter
          vec2 sunPos = vec2(0.77, 0.85) + uHead * vec2(-0.028, 0.018);
          float awayDist = clamp(dot(vUv - sunPos, vec2(-0.72, -0.69)), 0.0, 1.45);
          col *= mix(1.06, 0.82, smoothstep(0.0, 1.35, awayDist));

          vec2 d = vUv - sunPos;
          d.x *= (uPanHalf.x / max(0.001, uPanHalf.y));
          float r = length(d);
          float forwardScatter = exp(-r * 2.2) * 0.095 * (0.35 + 0.65 * distWeight);
          col += vec3(1.0, 0.72, 0.44) * forwardScatter;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const skyGeo = new THREE.PlaneGeometry(2, 2, 1, 1);
    const terrainGeo = new THREE.PlaneGeometry(2, 2, 240, 120);

    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    // Disable frustum culling because PlaneGeometry bounds (-1..1) do not reflect vertex displacement
    skyMesh.frustumCulled = false;
    terrainMesh.frustumCulled = false;

    scene.add(skyMesh, terrainMesh);

    // =========================================================================
    // DAMPED CAMERA MOVEMENT + GENTLE BREATHING SWAY (NO FRAME BLENDING)
    // =========================================================================
    let targetX = initX;
    let targetY = initY;
    let currentX = initX;
    let currentY = initY;
    let breathLagX = initX;
    let breathLagY = initY;

    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
      const ny = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
      targetX = Math.max(-1, Math.min(1, nx));
      targetY = Math.max(-1, Math.min(1, ny));
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);

    let animId = 0;
    let prevTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;
      const elapsed = now / 1000;

      // Heavy helmet neck inertia
      const primaryLerp = 1 - Math.exp(-3.0 * dt);
      currentX += (targetX - currentX) * primaryLerp;
      currentY += (targetY - currentY) * primaryLerp;

      // Small lagged breathing sway
      const breathCycle = Math.sin(elapsed * 1.15) * 0.022 + Math.sin(elapsed * 0.52) * 0.010;
      const lateralMicroSway = Math.cos(elapsed * 0.68) * 0.012;
      const lagLerp = 1 - Math.exp(-2.1 * dt);

      breathLagX += (currentX + lateralMicroSway - breathLagX) * lagLerp;
      breathLagY += (currentY + breathCycle - breathLagY) * lagLerp;

      // Apply strictly to the PerspectiveCamera (small heavy translation + subtle yaw/pitch)
      camera.position.x = breathLagX * 0.55;
      camera.position.y = -breathLagY * 0.28;
      camera.rotation.order = "YXZ";
      camera.rotation.y = -breathLagX * 0.026;
      camera.rotation.x = -breathLagY * 0.017;

      sharedUniforms.uTime.value = elapsed;
      sharedUniforms.uHead.value.set(breathLagX, breathLagY);

      onHeadMoveRef.current?.(breathLagX, breathLagY);

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
      sharedUniforms.uViewportAspect.value = aspect;
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
        background: "#120c08",
      }}
    />
  );
};
