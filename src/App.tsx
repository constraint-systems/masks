import { Mask } from "./Mask";
import { Settings } from "./Settings";

function App() {
  return (
    <div className="w-full relative h-[100dvh] overflow-hidden pointer-events-none">
      <Mask />
      <Settings />
    </div>
  );
}

export default App;


