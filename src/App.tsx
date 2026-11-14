import { useRef } from "react";
import { MarsBackdrop } from "./components/MarsBackdrop";
import { VisorOptics } from "./components/VisorOptics";
import { VisorFrame } from "./components/VisorFrame";

export function App() {
  const stageRef = useRef<HTMLElement | null>(null);

  const handleHeadMove = (headX: number, headY: number) => {
    const el = stageRef.current;
    if (!el) return;
    el.style.setProperty("--head-x", headX.toFixed(4));
    el.style.setProperty("--head-y", headY.toFixed(4));
  };

  return (
    <main ref={stageRef} className="visor-stage">
      <MarsBackdrop onHeadMove={handleHeadMove} />
      <VisorOptics />
      <VisorFrame />
    </main>
  );
}

export default App;
