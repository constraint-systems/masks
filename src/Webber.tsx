import { useAtom } from "jotai";
import {
  CanvasRefAtom,
  OpacityAtom,
  ShowCategoriesAtom,
  VideoAtom,
  VideoLoadedAtom,
  WebcamFlippedAtom,
} from "./atoms";
import { useEffect, useRef } from "react";
import {
  ImageSegmenter,
  FilesetResolver,
  ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

export function Webber() {
  const [video] = useAtom(VideoAtom);
  const [videoLoaded] = useAtom(VideoLoadedAtom);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferCanvasRef = useRef(document.createElement("canvas"));
  const [showCategories] = useAtom(ShowCategoriesAtom);
  const [webcamFlipped] = useAtom(WebcamFlippedAtom);
  const [opacity] = useAtom(OpacityAtom);
  const [canvasRefA] = useAtom(CanvasRefAtom);

  const webcamFlippedRef = useRef(webcamFlipped);
  webcamFlippedRef.current = webcamFlipped;

  const showCategoriesRef = useRef(showCategories);
  showCategoriesRef.current = showCategories;

  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  const segmentRef = useRef<ImageSegmenter | null>(null);

  useEffect(() => {
    canvasRefA.current = canvasRef.current;
  }, [canvasRef]);
    

  useEffect(() => {
    async function main() {
      if (video && videoLoaded && canvasRef.current) {
        const vision = await FilesetResolver.forVisionTasks("wasm");

        if (segmentRef.current) {
          cancelAnimationFrame(animationRef.current!);
          segmentRef.current.close();
        }

        segmentRef.current = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
            delegate: "GPU",
          },
          outputCategoryMask: true,
          outputConfidenceMasks: false,
          runningMode: "VIDEO",
        });

        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        bufferCanvasRef.current.width = video.videoWidth;
        bufferCanvasRef.current.height = video.videoHeight;

        const ctx = canvas.getContext("2d")!;

        const btx = bufferCanvasRef.current.getContext("2d")!;

        let lastVideoTime = -1;
        function callbackForVideo(result: ImageSegmenterResult) {
          if (video && video.currentTime !== lastVideoTime) {
            btx.drawImage(
              video,
              0,
              0,
              canvasRef.current!.width,
              canvasRef.current!.height,
            );
            let imageData = btx.getImageData(
              0,
              0,
              video.videoWidth,
              video.videoHeight,
            ).data;
            const mask: Number[] = result.categoryMask.getAsFloat32Array();
            let j = 0;
            // 0: background, 1: hair, 2: body, 3: face, 4: face
            for (let i = 0; i < mask.length; ++i) {
              const maskVal = Math.round(mask[i] * 255.0);
              let remove = true;
              if (showCategoriesRef.current["background"] && maskVal === 0)
                remove = false;
              if (showCategoriesRef.current["hair"] && maskVal === 1)
                remove = false;
              if (showCategoriesRef.current["face"] && maskVal === 3)
                remove = false;
              if (showCategoriesRef.current["clothes"] && maskVal === 4)
                remove = false;
              if (showCategoriesRef.current["body"] && maskVal === 2)
                remove = false;
              if (remove) {
                imageData[j] = 0;
                imageData[j + 1] = 0;
                imageData[j + 2] = 0;
                imageData[j + 3] = 0;
              }
              j += 4;
            }
            const uint8Array = new Uint8ClampedArray(imageData.buffer);
            const dataNew = new ImageData(
              uint8Array,
              video.videoWidth,
              video.videoHeight,
            );
            btx.putImageData(dataNew, 0, 0);
            ctx.globalAlpha = opacityRef.current;
            if (webcamFlippedRef.current.x && webcamFlippedRef.current.y) {
              ctx.setTransform(
                -1,
                0,
                0,
                -1,
                video.videoWidth,
                video.videoHeight,
              );
            } else if (webcamFlippedRef.current.x) {
              ctx.setTransform(-1, 0, 0, 1, video.videoWidth, 0);
            } else if (webcamFlippedRef.current.y) {
              ctx.setTransform(1, 0, 0, -1, 0, video.videoHeight);
            }
            ctx.drawImage(bufferCanvasRef.current, 0, 0);
            if (webcamFlippedRef.current.x) {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            if (webcamFlippedRef.current.y) {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
          }
          lastVideoTime = video.currentTime;
          animationRef.current = requestAnimationFrame(predictWebcam);
        }

        async function predictWebcam() {
          const startTimeMs = performance.now();
          segmentRef.current?.segmentForVideo(
            video,
            startTimeMs,
            callbackForVideo,
          );
        }

        predictWebcam();
      }
    }
    main();
  }, [video, videoLoaded]);

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
    </div>
  );
}
