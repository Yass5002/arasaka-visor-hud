import * as THREE from "three";
import { HELMET_GEO_CONFIG, SCENE_CONFIG } from "../config/visorConfig";

export class HelmetDofComposite {
  public readonly renderTarget: THREE.WebGLRenderTarget;
  private readonly quadScene: THREE.Scene;
  private readonly quadCamera: THREE.OrthographicCamera;
  private readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;

  constructor(bufferWidth: number, bufferHeight: number) {
    const w = Math.max(1, Math.floor(bufferWidth));
    const h = Math.max(1, Math.floor(bufferHeight));

    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.format = THREE.DepthFormat;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;

    this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      depthTexture,
    });

    const { dof } = HELMET_GEO_CONFIG;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tHelmet: { value: this.renderTarget.texture },
        tDepth: { value: depthTexture },
        uTexelSize: { value: new THREE.Vector2(1 / w, 1 / h) },
        uResolutionScale: { value: h / 1080 },
        uNear: { value: SCENE_CONFIG.nearPlane },
        uFar: { value: SCENE_CONFIG.farPlane },
        uNearFullFocus: { value: dof.nearFullFocusDist },
        uNearMaxBlur: { value: dof.nearMaxBlurDist },
        uMaxBlurPx: { value: dof.maxBlurPx },
        uAlphaFeatherGamma: { value: dof.alphaFeatherGamma },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tHelmet;
        uniform sampler2D tDepth;
        uniform vec2 uTexelSize;
        uniform float uResolutionScale;
        uniform float uNear;
        uniform float uFar;
        uniform float uNearFullFocus;
        uniform float uNearMaxBlur;
        uniform float uMaxBlurPx;
        uniform float uAlphaFeatherGamma;

        varying vec2 vUv;

        float linearizeDepth(float rawDepth) {
          float zNdc = rawDepth * 2.0 - 1.0;
          return (2.0 * uNear * uFar) / (uFar + uNear - zNdc * (uFar - uNear));
        }

        vec3 linearToSrgb(vec3 c) {
          vec3 clamped = max(c, vec3(0.0));
          vec3 lo = clamped * 12.92;
          vec3 hi = 1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055;
          return mix(lo, hi, step(vec3(0.0031308), clamped));
        }

        void main() {
          float maxScaledBlur = uMaxBlurPx * max(0.75, uResolutionScale);

          // Probe neighbor depth so near out-of-focus edges feather cleanly over Mars
          float minDist = linearizeDepth(texture2D(tDepth, vUv).r);
          vec2 probeStep = uTexelSize * (maxScaledBlur * 0.62);
          for (int i = 0; i < 8; i++) {
            float ang = float(i) * 0.78539816;
            vec2 off = vec2(cos(ang), sin(ang)) * probeStep;
            float d = linearizeDepth(texture2D(tDepth, clamp(vUv + off, 0.0, 1.0)).r);
            minDist = min(minDist, d);
          }

          float blurAmt = clamp(
            (uNearFullFocus - minDist) / max(0.001, uNearFullFocus - uNearMaxBlur),
            0.0,
            1.0
          );
          float blurPx = blurAmt * maxScaledBlur;

          if (blurPx < 0.25) {
            vec4 center = texture2D(tHelmet, vUv);
            if (center.a < 0.002) discard;
            gl_FragColor = vec4(linearToSrgb(center.rgb), center.a);
            return;
          }

          // 16-tap Vogel disk bokeh gather with premultiplied-safe unpremultiply
          vec3 sumRgb = vec3(0.0);
          float sumAlpha = 0.0;
          float sumWeight = 0.0;
          float centerDist = linearizeDepth(texture2D(tDepth, vUv).r);

          const float GOLDEN_ANGLE = 2.39996323;
          for (int i = 0; i < 16; i++) {
            float fi = float(i);
            float rNorm = sqrt((fi + 0.5) / 16.0);
            float theta = fi * GOLDEN_ANGLE;
            vec2 offset = vec2(cos(theta), sin(theta)) * (rNorm * blurPx) * uTexelSize;
            vec2 sampleUv = clamp(vUv + offset, 0.0, 1.0);

            vec4 s = texture2D(tHelmet, sampleUv);
            float sDist = linearizeDepth(texture2D(tDepth, sampleUv).r);
            float fgPriority = s.a > 0.01 ? mix(1.0, 1.45, step(sDist, centerDist + 0.02)) : 1.0;

            sumRgb += s.rgb * s.a * fgPriority;
            sumAlpha += s.a * fgPriority;
            sumWeight += fgPriority;
          }

          float avgAlpha = sumAlpha / max(0.0001, sumWeight);
          if (avgAlpha < 0.002) discard;

          vec3 avgLinear = sumRgb / max(0.0001, sumAlpha);
          float outAlpha = pow(clamp(avgAlpha, 0.0, 1.0), uAlphaFeatherGamma);

          gl_FragColor = vec4(linearToSrgb(avgLinear), outAlpha);
        }
      `,
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene.add(this.mesh);
  }

  public setSize(bufferWidth: number, bufferHeight: number): void {
    const w = Math.max(1, Math.floor(bufferWidth));
    const h = Math.max(1, Math.floor(bufferHeight));
    this.renderTarget.setSize(w, h);
    this.material.uniforms.uTexelSize.value.set(1 / w, 1 / h);
    this.material.uniforms.uResolutionScale.value = h / 1080;
  }

  public renderComposite(renderer: THREE.WebGLRenderer): void {
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }

  public dispose(): void {
    this.renderTarget.depthTexture?.dispose();
    this.renderTarget.dispose();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
