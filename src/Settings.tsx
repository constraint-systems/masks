import { useAtom } from "jotai";
import { useState, useRef, useEffect } from "react";
import {
  ShowSettingsAtom,
  ShowCategoriesAtom,
  SelectedDeviceIdAtom,
  VideoAtom,
  VideoLoadedAtom,
  OpacityAtom,
  WebcamFlippedAtom,
  CanvasRefAtom,
  FpsAtom,
} from "./atoms";
import { categoryKeys } from "./consts";

export function Settings() {
  const [showSettings, setShowSettings] = useAtom(ShowSettingsAtom);
  const [showCategories, setShowCategories] = useAtom(ShowCategoriesAtom);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useAtom(SelectedDeviceIdAtom);
  const [, setVideo] = useAtom(VideoAtom);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [, setVideoLoaded] = useAtom(VideoLoadedAtom);
  const [opacity, setOpacity] = useAtom(OpacityAtom);
  const [webcamFlipped, setWebcamFlipped] = useAtom(WebcamFlippedAtom);
  const [canvasRefA] = useAtom(CanvasRefAtom);
  const [fps, setFps] = useAtom(FpsAtom);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
        });
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceInfos.filter(
          (device) => device.kind === "videoinput",
        );
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          const check = localStorage.getItem("selectedDeviceId");
          const deviceIds = videoDevices.map((device) => device.deviceId);
          if (!check || !deviceIds.includes(check)) {
            setSelectedDeviceId(videoDevices[0].deviceId);
          }
        }
      } catch (error) {
        console.error(error);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    const getStream = async (deviceId: string) => {
      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
        });
        videoRef.current.srcObject = stream;
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            setVideoLoaded(true);
          };
        }
        setVideo(videoRef.current);
      }
    };
    if (selectedDeviceId) {
      try {
        getStream(selectedDeviceId);
      } catch (error) {
        console.error(error);
        setSelectedDeviceId(devices[0].deviceId);
      }
    }
  }, [selectedDeviceId]);

  const cropperRef = useRef(document.createElement("canvas"));

  function handleDownload() {
    if (canvasRefA.current) {
      cropperRef.current.width = window.innerWidth;
      cropperRef.current.height = window.innerHeight;

      const scale = Math.max(
        window.innerWidth / canvasRefA.current.width,
        window.innerHeight / canvasRefA.current.height,
      );

      const scaledWidth = Math.round(canvasRefA.current.width * scale);
      const scaledHeight = Math.round(canvasRefA.current.height * scale);

      const offsetX = Math.floor((window.innerWidth - scaledWidth) / 2);
      const offsetY = Math.floor((window.innerHeight - scaledHeight) / 2);

      const crtx = cropperRef.current.getContext("2d")!;
      crtx.drawImage(
        canvasRefA.current,
        0,
        0,
        canvasRefA.current.width,
        canvasRefA.current.height,
        offsetX,
        offsetY,
        scaledWidth,
        scaledHeight,
      );

      const dataUrl = cropperRef.current.toDataURL("image/jpeg", 0.9);
      if (dataUrl) {
        const a = document.createElement("a");
        a.href = dataUrl;
        const timestamp = new Date().toISOString();
        a.download = `mask-${timestamp}.jpg`;
        a.click();
      }
    }
  }

  function handleClear() {
    canvasRefA.current
      ?.getContext("2d")
      ?.clearRect(0, 0, canvasRefA.current.width, canvasRefA.current.height);
  }

  return (
    <div className="absolute right-0 top-0">
      <video
        ref={videoRef}
        autoPlay={true}
        muted={true}
        playsInline={true}
        className="opacity-0 absolute"
      />
      {showSettings ? (
        <div className="max-w-[300px] w-full pointer-events-auto flex bg-neutral-800 bg-opacity-60 flex-col gap-1 px-3 py-3 select-none">
          <div className="flex justify-between">
            <div>Masks</div>
            <button
              className="px-5 py-1 -mt-1 bg-neutral-800 hover:bg-neutral-700 rounded-md"
              onClick={() => setShowSettings(false)}
            >
              &times;
            </button>
          </div>
          <div className="text-sm">
            Collage faces using your webcam. All data is processed and stored
            only on your device.
          </div>
          <div className="mt-3">Settings</div>
          <div className="flex items-center gap-2 mb-1 py-1">
            <div className="">Webcam:</div>
            <select
              value={selectedDeviceId}
              className="overflow-hidden w-full border-none focus:outline-none px-1 py-1"
              onChange={(e) => {
                setVideoLoaded(false);
                setSelectedDeviceId(e.target.value);
              }}
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex text-sm gap-1">
            <button
              className="w-1/2 bg-neutral-800 hover:bg-neutral-700 py-1 rounded-lg"
              onClick={() => {
                setWebcamFlipped((prev) => {
                  return { x: !prev.x, y: prev.y };
                });
              }}
            >
              Flip {webcamFlipped.x ? "◄" : "►"}
            </button>
            <button
              className="w-1/2 bg-neutral-800 hover:bg-neutral-700 py-1 rounded-lg"
              onClick={() => {
                setWebcamFlipped((prev) => {
                  return { x: prev.x, y: !prev.y };
                });
              }}
            >
              Flip {webcamFlipped.y ? "▲" : "▼"}
            </button>
          </div>
          <div className="py-0.5 px-1">
            <div>Render</div>
            {categoryKeys.map((categoryKey) => (
              <label
                key={categoryKey}
                className="flex gap-2 items-center py-0.5"
              >
                <input
                  type="checkbox"
                  checked={showCategories[categoryKey]}
                  onChange={() => {
                    setShowCategories((prev) => {
                      return {
                        ...prev,
                        [categoryKey]: !prev[categoryKey],
                      };
                    });
                  }}
                />
                <div>{categoryKey}</div>
              </label>
            ))}
          </div>
          <div className="px-1 gap-2 text-sm flex items-center pt-1 pb-1">
            <div>Opacity:</div>
            <div className="w-full flex items-center">
              <input
                className="w-full"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
              />
            </div>
            <div>{opacity.toFixed(1)}</div>
          </div>
          <div className="px-1 gap-2 text-sm flex items-center pt-1 pb-2">
            <div>FPS:</div>
            {[1, 5, 10, 30, 60].map((fpsValue) => {
              const isActive = fps === fpsValue;
              return (
                <label
                  key={fpsValue}
                  className={`${isActive ? "bg-neutral-700" : "bg-neutral-800"} w-full text-center hover:bg-neutral-700 px-2 py-1 rounded-lg cursor-pointer`}
                >
                  <input
                    className="hidden"
                    type="radio"
                    checked={fps === fpsValue}
                    onChange={() => setFps(fpsValue)}
                  />
                  {fpsValue}
                </label>
              );
            })}
          </div>
          <div className="flex text-sm gap-1">
            <button
              className="w-1/2 bg-neutral-800 hover:bg-neutral-700 py-1 rounded-lg"
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              className="w-1/2 bg-neutral-800 hover:bg-neutral-700 py-1 rounded-lg"
              onClick={handleDownload}
            >
              Download
            </button>
          </div>
          <div className="py-1">
            <div className="text-sm">
              A{" "}
              <a
                target="_blank"
                className="underline"
                href="https://constraint.systems"
              >
                Constraint Systems
              </a>{" "}
              project
            </div>
            <div className="text-sm pt-1">
              <a
                target="_blank"
                className="underline"
                href="https://garden.grantcuster.com/2024-10-09-18-45-25-Masks/"
              >
                Read the dev notes
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-2 mr-3">
          <button
            title="Download"
            className="select-none bg-neutral-800 px-5 py-1 rounded-md hover:bg-neutral-700 pointer-events-auto"
            onClick={handleDownload}
          >
            ↓
          </button>
          <button
            title="Show settings"
            className="select-none bg-neutral-800 px-5 py-1 rounded-md hover:bg-neutral-700 pointer-events-auto"
            onClick={() => setShowSettings(true)}
          >
            …
          </button>
        </div>
      )}
    </div>
  );
}
