import { VisorScene } from "./components/VisorScene";

export function App() {
  return (
    <div className="screen-shell">
      <div className="visor-frame">
        <VisorScene />
      </div>
    </div>
  );
}

export default App;
