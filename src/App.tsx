import { useEffect, useRef } from "react";
import { MarsBackdrop, VisorRigState } from "./components/MarsBackdrop";
import { VisorOptics } from "./components/VisorOptics";
import { VisorHud } from "./components/VisorHud";
import { VisorFrame } from "./components/VisorFrame";
import { MOTION_CONFIG, PALETTE_CONFIG } from "./config/visorConfig";

export function App() {
  const stageRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const { parallaxOffsets } = MOTION_CONFIG;
    el.style.setProperty("--void-bg", PALETTE_CONFIG.voidBg);
    el.style.setProperty("--offset-hud-x", `${parallaxOffsets.hudX}px`);
    el.style.setProperty("--offset-hud-y", `${parallaxOffsets.hudY}px`);
    el.style.setProperty("--offset-hud-rot", `${parallaxOffsets.hudRotateDeg}deg`);
    el.style.setProperty("--offset-reticle-x", `${parallaxOffsets.reticleX}px`);
    el.style.setProperty("--offset-reticle-y", `${parallaxOffsets.reticleY}px`);
    el.style.setProperty("--offset-helmet-x", `${parallaxOffsets.helmetX}px`);
    el.style.setProperty("--offset-helmet-y", `${parallaxOffsets.helmetY}px`);
    el.style.setProperty("--offset-helmet-rot", `${parallaxOffsets.helmetRotateDeg}deg`);
    el.style.setProperty("--offset-dome-x", `${parallaxOffsets.domeReflectionsX}px`);
    el.style.setProperty("--offset-dome-y", `${parallaxOffsets.domeReflectionsY}px`);
  }, []);

  const handleRigMove = (rig: VisorRigState) => {
    const el = stageRef.current;
    if (!el) return;
    el.style.setProperty("--head-x", rig.sceneX.toFixed(4));
    el.style.setProperty("--head-y", rig.sceneY.toFixed(4));
    el.style.setProperty("--hud-x", rig.hudX.toFixed(4));
    el.style.setProperty("--hud-y", rig.hudY.toFixed(4));
    el.style.setProperty("--reticle-x", rig.reticleX.toFixed(4));
    el.style.setProperty("--reticle-y", rig.reticleY.toFixed(4));
    el.style.setProperty("--helmet-x", rig.helmetX.toFixed(4));
    el.style.setProperty("--helmet-y", rig.helmetY.toFixed(4));
  };

  return (
    <main ref={stageRef} className="visor-stage">
      <MarsBackdrop onRigMove={handleRigMove} />
      <VisorOptics />
      <VisorHud />
      <VisorFrame />
    </main>
  );
}

export default App;
