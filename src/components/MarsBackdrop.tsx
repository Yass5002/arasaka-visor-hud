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

/**
 * Multi-layer NASA Perseverance panorama (PIA24663) backdrop rendered with
 * 4 depth planes (sky, far, mid, near), depth-map relief parallax, horizon heat
 * shimmer, slow drifting dust haze/clouds, shifting soft sun glare, and heavy
 * cursor + breathing sway inertia.
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

    // Optional URL parameter ?look=x,y for reproducible multi-angle captures
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
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const loader = new THREE.TextureLoader();
    const configureTex = (tex: THREE.Texture, isColor = true) => {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const base = import.meta.env.BASE_URL;
    const skyTex = configureTex(loader.load(`${base}mars/mars-sky.jpg`), true);
    const farTex = configureTex(loader.load(`${base}mars/mars-far.png`), true);
    const midTex = configureTex(loader.load(`${base}mars/mars-mid.png`), true);
    const nearTex = configureTex(loader.load(`${base}mars/mars-near.png`), true);
    const depthTex = configureTex(loader.load(`${base}mars/mars-depth.png`), false);

    // Panorama natural aspect = 3200 / 1634
    const texAspect = 3200 / 1634;
    const sharedUniforms = {
      uTime: { value: 0 },
      uHead: { value: new THREE.Vector2(initX, initY) },
      uViewportAspect: { value: width / height },
      uTexAspect: { value: texAspect },
      uDepthMap: { value: depthTex },
    };

    const COVER_UV_GLSL = /* glsl */ `
      // Maps screen UV [0..1] into zoomed panorama UV with safe overscan margins for parallax
      vec2 getBaseUv(vec2 uv, float vpAspect, float txAspect) {
        float zoom = 1.15; // Overscan so head movement never exposes edges
        vec2 centered = uv - 0.5;
        if (vpAspect > txAspect) {
          centered.y *= (txAspect / vpAspect);
        } else {
          centered.x *= (vpAspect / txAspect);
        }
        // Slight downward framing adjustment so horizon sits naturally at ~34% height
        vec2 framed = centered / zoom + vec2(0.5, 0.515);
        return framed;
      }
    `;

    // =========================================================================
    // LAYER 1: SKY (Slow high-altitude dust clouds + shifting soft sun glare)
    // =========================================================================
    const skyMat = new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: {
        ...sharedUniforms,
        uTex: { value: skyTex },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.9, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform float uTime;
        uniform vec2 uHead;
        uniform float uViewportAspect;
        uniform float uTexAspect;
        varying vec2 vUv;

        ${NOISE_GLSL}
        ${COVER_UV_GLSL}

        void main() {
          vec2 uv = getBaseUv(vUv, uViewportAspect, uTexAspect);
          // Minimal sky parallax (distant infinity)
          uv += vec2(uHead.x * 0.011, -uHead.y * 0.008);
          uv = clamp(uv, 0.002, 0.998);

          vec3 col = texture2D(uTex, uv).rgb;

          // Slow high-altitude Martian cirrus / dust clouds drifting gently across sky
          vec2 cloudUv = vec2(uv.x * 3.4 + uTime * 0.007, uv.y * 7.5 - uTime * 0.0015);
          float c1 = fbm(cloudUv);
          float c2 = fbm(cloudUv * 2.1 + vec2(uTime * 0.004, 2.3));
          float cloudMask = smoothstep(0.46, 0.82, c1 * 0.65 + c2 * 0.35);
          float skyHeightMask = smoothstep(0.66, 0.96, uv.y);
          vec3 cloudTint = vec3(0.86, 0.72, 0.56);
          col = mix(col, cloudTint, cloudMask * skyHeightMask * 0.14);

          // Soft atmospheric sun glare in upper-right sky shifting gently with head movement
          vec2 sunCenter = vec2(0.76 - uHead.x * 0.032, 0.87 + uHead.y * 0.022);
          vec2 sunDelta = (uv - sunCenter) * vec2(uTexAspect, 1.0);
          float sunDist = length(sunDelta);
          float wideGlow = exp(-sunDist * 3.2) * 0.24;
          float coreGlow = exp(-sunDist * 11.5) * 0.30;
          float softDisc = smoothstep(0.065, 0.0, sunDist) * 0.16;

          vec3 glareColor = vec3(1.0, 0.86, 0.68);
          col += glareColor * (wideGlow + coreGlow + softDisc);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    // =========================================================================
    // LAYER 2: FAR MOUNTAINS & HORIZON HEAT SHIMMER
    // =========================================================================
    const farMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...sharedUniforms,
        uTex: { value: farTex },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.7, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform sampler2D uDepthMap;
        uniform float uTime;
        uniform vec2 uHead;
        uniform float uViewportAspect;
        uniform float uTexAspect;
        varying vec2 vUv;

        ${NOISE_GLSL}
        ${COVER_UV_GLSL}

        void main() {
          vec2 uv = getBaseUv(vUv, uViewportAspect, uTexAspect);
          uv += vec2(uHead.x * 0.026, -uHead.y * 0.017);

          float d = texture2D(uDepthMap, clamp(uv, 0.002, 0.998)).r;

          // Subtle horizon heat shimmer concentrated near the distant ridge & far plain
          float horizonBand = smoothstep(0.01, 0.08, d) * (1.0 - smoothstep(0.10, 0.28, d));
          float shimWave = sin(uv.y * 190.0 - uTime * 3.6 + uv.x * 42.0) * 0.5
                         + (vnoise(vec2(uv.x * 55.0 + uTime * 0.9, uv.y * 95.0 - uTime * 2.2)) - 0.5);
          vec2 shimmerUv = uv + vec2(shimWave * 0.00055, shimWave * 0.00085) * horizonBand;

          vec4 texel = texture2D(uTex, clamp(shimmerUv, 0.002, 0.998));

          // Soft atmospheric dust scattering along distant ridge
          float farDust = fbm(vec2(uv.x * 5.0 + uTime * 0.012, uv.y * 9.0));
          vec3 hazeCol = vec3(0.72, 0.55, 0.39);
          texel.rgb = mix(texel.rgb, hazeCol, horizonBand * (0.14 + farDust * 0.14));

          gl_FragColor = texel;
        }
      `,
    });

    // =========================================================================
    // LAYER 3: MIDGROUND TERRAIN + DRIFTING DUST HAZE + DEPTH RELIEF
    // =========================================================================
    const midMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...sharedUniforms,
        uTex: { value: midTex },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.5, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform sampler2D uDepthMap;
        uniform float uTime;
        uniform vec2 uHead;
        uniform float uViewportAspect;
        uniform float uTexAspect;
        varying vec2 vUv;

        ${NOISE_GLSL}
        ${COVER_UV_GLSL}

        void main() {
          vec2 uv = getBaseUv(vUv, uViewportAspect, uTexAspect);
          uv += vec2(uHead.x * 0.048, -uHead.y * 0.028);

          float d = texture2D(uDepthMap, clamp(uv, 0.002, 0.998)).r;
          // Per-pixel depth relief shift
          uv += vec2(uHead.x * d * 0.010, -uHead.y * d * 0.007);

          vec4 texel = texture2D(uTex, clamp(uv, 0.002, 0.998));

          // Slowly drifting low Martian dust haze sweeping across mid-ground plain
          float hazeNoise = fbm(vec2(uv.x * 3.8 - uTime * 0.014, uv.y * 6.5 + uTime * 0.003));
          float hazeLayer = smoothstep(0.36, 0.80, hazeNoise);
          vec3 dustTone = vec3(0.68, 0.48, 0.32);
          texel.rgb = mix(texel.rgb, dustTone, hazeLayer * 0.13);

          gl_FragColor = texel;
        }
      `,
    });

    // =========================================================================
    // LAYER 4: NEAR FOREGROUND BOULDERS + ROCK RELIEF + VEIL + SUN GLARE BLOOM
    // =========================================================================
    const nearMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...sharedUniforms,
        uTex: { value: nearTex },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.3, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform sampler2D uDepthMap;
        uniform float uTime;
        uniform vec2 uHead;
        uniform float uViewportAspect;
        uniform float uTexAspect;
        varying vec2 vUv;

        ${NOISE_GLSL}
        ${COVER_UV_GLSL}

        void main() {
          vec2 uv = getBaseUv(vUv, uViewportAspect, uTexAspect);
          uv += vec2(uHead.x * 0.072, -uHead.y * 0.040);

          // Sample local depth twice so foreground boulders physically shift forward
          float d0 = texture2D(uDepthMap, clamp(uv, 0.002, 0.998)).r;
          vec2 reliefUv = uv + vec2(uHead.x * d0 * 0.018, -uHead.y * d0 * 0.011);

          vec4 texel = texture2D(uTex, clamp(reliefUv, 0.002, 0.998));

          // Subtle ground-skimming dust haze drift
          float lowHaze = fbm(vec2(reliefUv.x * 3.0 - uTime * 0.020, reliefUv.y * 5.0));
          vec3 hazeTone = vec3(0.64, 0.44, 0.29);
          texel.rgb = mix(texel.rgb, hazeTone, smoothstep(0.45, 0.85, lowHaze) * 0.09);

          gl_FragColor = texel;
        }
      `,
    });

    // =========================================================================
    // LAYER 5: FULL-SCENE SOFT SUN VEIL GLARE OVERLAY (SHIFTS WITH HEAD)
    // =========================================================================
    const glareMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: sharedUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.1, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec2 uHead;
        uniform float uViewportAspect;
        varying vec2 vUv;

        void main() {
          // Soft sun glare source in upper-right sky that drifts gently with head pose
          vec2 sunScreen = vec2(0.76 - uHead.x * 0.10, 0.85 + uHead.y * 0.07);
          vec2 delta = (vUv - sunScreen) * vec2(uViewportAspect, 1.0);
          float dist = length(delta);

          // Broad soft atmospheric sun scatter washing subtly across upper-right sky & ridge
          float broadScatter = exp(-dist * 2.1) * 0.095;
          // Subtle soft anamorphic optical streak
          float streak = exp(-abs(delta.y) * 14.0) * exp(-abs(delta.x) * 1.9) * 0.045;
          // Faint warm optical ghost ring opposite the sun center
          vec2 ghostPos = vec2(0.5, 0.5) - (sunScreen - vec2(0.5, 0.5)) * 0.55;
          float gDist = length((vUv - ghostPos) * vec2(uViewportAspect, 1.0));
          float ghostRing = smoothstep(0.06, 0.02, abs(gDist - 0.14)) * 0.018;

          vec3 col = vec3(1.0, 0.80, 0.58) * (broadScatter + streak)
                   + vec3(0.95, 0.70, 0.52) * ghostRing;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const skyMesh = new THREE.Mesh(quadGeo, skyMat);
    const farMesh = new THREE.Mesh(quadGeo, farMat);
    const midMesh = new THREE.Mesh(quadGeo, midMat);
    const nearMesh = new THREE.Mesh(quadGeo, nearMat);
    const glareMesh = new THREE.Mesh(quadGeo, glareMat);

    scene.add(skyMesh, farMesh, midMesh, nearMesh, glareMesh);

    // =========================================================================
    // HEAVY CURSOR INERTIA + LAGGED BREATHING SWAY
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
      // Keep movement small and heavy
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

      // Heavy helmet damping toward cursor target
      const primaryLerp = 1 - Math.exp(-2.8 * dt);
      currentX += (targetX - currentX) * primaryLerp;
      currentY += (targetY - currentY) * primaryLerp;

      // Gentle breathing sway with slight secondary lag
      const breathCycle = Math.sin(elapsed * 1.15) * 0.022 + Math.sin(elapsed * 0.52) * 0.010;
      const lateralMicroSway = Math.cos(elapsed * 0.68) * 0.012;
      const lagLerp = 1 - Math.exp(-1.9 * dt);

      breathLagX += (currentX + lateralMicroSway - breathLagX) * lagLerp;
      breathLagY += (currentY + breathCycle - breathLagY) * lagLerp;

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
      sharedUniforms.uViewportAspect.value = w / h;
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", handleResize);
      quadGeo.dispose();
      skyMat.dispose();
      farMat.dispose();
      midMat.dispose();
      nearMat.dispose();
      glareMat.dispose();
      skyTex.dispose();
      farTex.dispose();
      midTex.dispose();
      nearTex.dispose();
      depthTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="mars-canvas-layer" aria-hidden="true" />;
};
