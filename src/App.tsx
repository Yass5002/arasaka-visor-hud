import { VisorFrame } from "./components/VisorFrame";

export function App() {
  return (
    <main className="visor-stage">
      <VisorFrame status="nominal" />
    </main>
  );
}

export default App;
