import { useAtom } from "jotai";
import { LoadingSegmenterAtom } from "./atoms";
import { Mask } from "./Mask";
import { Settings } from "./Settings";

function App() {
  return (
    <div className="w-full relative h-[100dvh] overflow-hidden pointer-events-none">
      <Mask />
      <Settings />
      <Loading />
    </div>
  );
}

export default App;

function Loading() {
  const [loadingSegmenter] = useAtom(LoadingSegmenterAtom);

  return loadingSegmenter ? (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-800 bg-opacity-60">
      <div className="text-lg text-neutral-100 animate-bounce">Loading segmenter...</div>
    </div>
  ) : null;
}
