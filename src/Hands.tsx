import { useEffect, useRef } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  Point,
  arePointsInOrder,
  arePointsNearlyCollinear,
  euclideanDistance,
} from "./utils";
import { useAtom } from "jotai";
import {
  CameraAtom,
  DetectionLoadedAtom,
  OpacityAtom,
  ShowVideoAtom,
  VideoAtom,
  VideoLoadedAtom,
  WebcamFlippedHorizontallyAtom,
  ZoomContainerAtom,
} from "./atoms";
import { CameraType, panCamera, zoomCamera } from "./Camera";

export function Hands() {
  const [video] = useAtom(VideoAtom);
  const [videoLoaded] = useAtom(VideoLoadedAtom);
  const [camera, setCamera] = useAtom(CameraAtom);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<CameraType | null>(null);
  const [webcamFlippedHorizontally] = useAtom(WebcamFlippedHorizontallyAtom);
  const [zoomContainer] = useAtom(ZoomContainerAtom);
  const [showVideo] = useAtom(ShowVideoAtom);
  const [, setDetectionLoaded] = useAtom(DetectionLoadedAtom);
  const [opacity] = useAtom(OpacityAtom);
  const showVideoRef = useRef<boolean>(showVideo);

  cameraRef.current = camera;
  showVideoRef.current = showVideo;

  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const opacityRef = useRef(1);
  opacityRef.current = opacity;

  const handStateRef = useRef<{
    left: {
      isDown: boolean;
      x: number;
      y: number;
    };
    right: {
      isDown: boolean;
      x: number;
      y: number;
    };
    two: {
      isDown: boolean;
    };
  }>({
    left: {
      isDown: false,
      x: 0,
      y: 0,
    },
    right: {
      isDown: false,
      x: 0,
      y: 0,
    },
    two: {
      isDown: false,
    },
  });

  const leftPointingCountRef = useRef(0);
  const rightPointingCountRef = useRef(0);

  useEffect(() => {
    async function handleRecognizer() {
      if (video) {
        cancelAnimationFrame(animationFrameRef.current!);

        const vision = await FilesetResolver.forVisionTasks("wasm");

        if (handLandmarkerRef.current) {
          handLandmarkerRef.current.close();
        }

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
          },
        );
        setDetectionLoaded(true);

        let lastVideoTime = -1;
        function renderLoop(): void {
          if (video && video.currentTime !== lastVideoTime) {
            canvasRef.current!.width = video.videoWidth;
            canvasRef.current!.height = video.videoHeight;

            const landmarkResult = handLandmarkerRef.current!.detectForVideo(
              video,
              video.currentTime,
            );

            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext("2d")!;

              if (webcamFlippedHorizontally) {
                ctx.translate(canvasRef.current.width, 0);
                ctx.scale(-1, 1);
              }

              ctx.clearRect(
                0,
                0,
                canvasRef.current.width,
                canvasRef.current.height,
              );

              if (showVideoRef.current) {
                ctx.globalAlpha = 0.25;
                ctx.drawImage(
                  video,
                  0,
                  0,
                  canvasRef.current.width,
                  canvasRef.current.height,
                );
                ctx.globalAlpha = 1;
              }

              const newHandState = {
                left: {
                  isDown: false,
                  x: 0,
                  y: 0,
                },
                right: {
                  isDown: false,
                  x: 0,
                  y: 0,
                },
                two: {
                  isDown: false,
                },
              };

              // Crop area video cover window
              const aspectRatio = video.videoWidth / video.videoHeight;
              const windowAspectRatio = window.innerWidth / window.innerHeight;

              const croppedWidth = window.innerWidth;
              const croppedHeight = window.innerHeight;

              let scale = 1;
              if (aspectRatio > windowAspectRatio) {
                scale = window.innerHeight / video.videoHeight;
              } else {
                scale = window.innerWidth / video.videoWidth;
              }

              const videoWidth = Math.round(video.videoWidth * scale);
              const videoHeight = Math.round(video.videoHeight * scale);

              const videoX = (croppedWidth - videoWidth) / 2;
              const videoY = (croppedHeight - videoHeight) / 2;

              // In percent
              const active = {
                minX: -videoX / videoWidth,
                minY: -videoY / videoHeight,
                maxX: (videoWidth + videoX) / videoWidth,
                maxY: (videoHeight + videoY) / videoHeight,
              };

              const newConnector: {
                left: Point | null;
                right: Point | null
              } = {
                left: null,
                right: null,
              }

              // Gets new state and draws pointers
              for (let i = 0; i < landmarkResult.landmarks.length; i++) {
                const landmarks = landmarkResult.landmarks[i];

                const hand =
                  landmarkResult.handedness[i][0].categoryName === "Left"
                    ? "left"
                    : "right";
                const oppositeHand = hand === "left" ? "right" : "left";

                const pointer = landmarks[8];
                const thumb = landmarks[4];

                const fullThumb = landmarks.slice(1, 5);
                const fullPointer = landmarks.slice(5, 9);
                const fullMiddle = landmarks.slice(9, 13);
                const fullRing = landmarks.slice(13, 17);
                const fullPinky = landmarks.slice(17, 21);
                const fingerTips = [
                  fullThumb,
                  fullPointer,
                  fullMiddle,
                  fullRing,
                  fullPinky,
                ];

                const isLine = arePointsNearlyCollinear(
                  fullPointer[0],
                  fullPointer[1],
                  fullPointer[2],
                  fullPointer[3],
                  0.002,
                );

                const isInOrder = arePointsInOrder(
                  fullPointer[0],
                  fullPointer[1],
                  fullPointer[2],
                  fullPointer[3],
                  0.00001,
                );

                const farFromMiddle =
                  euclideanDistance(
                    fullPointer[3].x,
                    fullPointer[3].y,
                    fullMiddle[3].x,
                    fullMiddle[3].y,
                  ) > 0.05;

                // ctx.globalAlpha = 0.5;
                ctx.strokeStyle = "yellow";
                ctx.fillStyle = "yellow";
                ctx.lineWidth = 12;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                for (const finger of fingerTips) {
                  ctx.beginPath();
                  for (const point of finger) {
                    ctx.lineTo(
                      point.x * canvasRef.current.width,
                      point.y * canvasRef.current.height,
                    );
                  }
                  ctx.stroke();
                }
                // connect fingers
                ctx.beginPath();
                ctx.moveTo(
                  fullThumb[0].x * canvasRef.current.width,
                  fullThumb[0].y * canvasRef.current.height,
                );
                ctx.lineTo(
                  fullPointer[0].x * canvasRef.current.width,
                  fullPointer[0].y * canvasRef.current.height,
                );
                ctx.lineTo(
                  fullMiddle[0].x * canvasRef.current.width,
                  fullMiddle[0].y * canvasRef.current.height,
                );
                ctx.lineTo(
                  fullRing[0].x * canvasRef.current.width,
                  fullRing[0].y * canvasRef.current.height,
                );
                ctx.lineTo(
                  fullPinky[0].x * canvasRef.current.width,
                  fullPinky[0].y * canvasRef.current.height,
                );
                ctx.lineTo(
                  landmarks[0].x * canvasRef.current.width,
                  landmarks[0].y * canvasRef.current.height,
                );
                ctx.closePath();
                ctx.stroke();
                ctx.fill();

                const threshold = 2;
                ctx.lineWidth = 4;
                if (hand === "left") {
                  if (isLine && isInOrder && farFromMiddle) {
                    if (leftPointingCountRef.current > threshold) {
                      ctx.fillStyle = "green";
                      ctx.strokeStyle = "green";
                      ctx.beginPath();
                      ctx.arc(
                        pointer.x * canvasRef.current.width,
                        pointer.y * canvasRef.current.height,
                        16,
                        0,
                        2 * Math.PI,
                      );
                      ctx.stroke();
                      newConnector.left = pointer;
                    }
                    leftPointingCountRef.current += 1;
                  } else {
                    leftPointingCountRef.current = 0;
                  }
                }
                if (hand === "right") {
                  if (isLine && isInOrder && farFromMiddle) {
                    if (rightPointingCountRef.current > threshold) {
                      ctx.fillStyle = "green";
                      ctx.strokeStyle = "green";
                      ctx.beginPath();
                      ctx.arc(
                        pointer.x * canvasRef.current.width,
                        pointer.y * canvasRef.current.height,
                        16,
                        0,
                        2 * Math.PI,
                      );
                      ctx.stroke();
                      newConnector.right = pointer;
                    }
                    rightPointingCountRef.current += 1;
                  } else {
                    rightPointingCountRef.current = 0;
                  }
                }

                if (newConnector.left && newConnector.right) {
                  ctx.strokeStyle = "blue";
                  ctx.lineWidth = 14;
                  ctx.beginPath();
                  ctx.moveTo(
                    newConnector.left.x * canvasRef.current.width,
                    newConnector.left.y * canvasRef.current.height,
                  );
                  ctx.lineTo(
                    newConnector.right.x * canvasRef.current.width,
                    newConnector.right.y * canvasRef.current.height,
                  );
                  ctx.stroke();
                }

                continue;
                if (
                  pointer.x < active.minX ||
                  pointer.x > active.maxX ||
                  pointer.y < active.minY ||
                  pointer.y > active.maxY
                ) {
                  continue;
                }

                const distance = euclideanDistance(
                  pointer.x,
                  pointer.y,
                  thumb.x,
                  thumb.y,
                );

                let x = pointer.x;
                let y = pointer.y;

                if (distance < 0.05) {
                  const midPoint = {
                    x: (pointer.x + thumb.x) / 2,
                    y: (pointer.y + thumb.y) / 2,
                  };
                  x = midPoint.x;
                  y = midPoint.y;

                  newHandState[hand] = {
                    isDown: true,
                    x,
                    y,
                  };

                  ctx.fillStyle = "limegreen";
                  ctx.beginPath();
                  // use canvas width here bc CSS does the cropping and scaling
                  ctx.arc(
                    x * canvasRef.current.width,
                    y * canvasRef.current.height,
                    8,
                    0,
                    2 * Math.PI,
                  );
                  ctx.fill();
                } else {
                  ctx.fillStyle = "yellow";
                  ctx.beginPath();
                  ctx.arc(
                    pointer.x * canvasRef.current.width,
                    pointer.y * canvasRef.current.height,
                    8,
                    0,
                    2 * Math.PI,
                  );
                  ctx.fill();
                }

                if (
                  newHandState[hand].isDown &&
                  newHandState[oppositeHand].isDown
                ) {
                  newHandState.two = {
                    isDown: true,
                  };
                }
              }

              // handle two down
              if (newHandState.two.isDown) {
                const isNewDown = !handStateRef.current.two.isDown;

                if (!isNewDown) {
                  const last1 = handStateRef.current.left;
                  const last2 = handStateRef.current.right;

                  const dist1 = euclideanDistance(
                    last1.x,
                    last1.y,
                    last2.x,
                    last2.y,
                  );

                  const now1 = newHandState.left;
                  const now2 = newHandState.right;
                  const dist2 = euclideanDistance(
                    now1.x,
                    now1.y,
                    now2.x,
                    now2.y,
                  );

                  const diff = dist2 - dist1;

                  const midPointLastX = (last1.x + last2.x) / 2;
                  const midPointLastY = (last1.y + last2.y) / 2;

                  const midPointNowX =
                    (newHandState.left.x + newHandState.right.x) / 2;
                  const midPointNowY =
                    (newHandState.left.y + newHandState.right.y) / 2;

                  let dx =
                    (midPointNowX - midPointLastX) *
                    scale *
                    canvasRef.current.width;
                  const dy =
                    (midPointNowY - midPointLastY) *
                    scale *
                    canvasRef.current.height;

                  dx = webcamFlippedHorizontally ? dx : -dx;

                  ctx.fillStyle = "blue";
                  ctx.beginPath();
                  ctx.arc(
                    midPointNowX * canvasRef.current.width,
                    midPointNowY * canvasRef.current.height,
                    8,
                    0,
                    2 * Math.PI,
                  );
                  ctx.fill();

                  // Make into "screen" coordinates
                  const clientX = midPointNowX * videoWidth + videoX;
                  const clientY = midPointNowY * videoHeight + videoY;

                  let newCamera = zoomCamera(
                    cameraRef.current!,
                    {
                      x: webcamFlippedHorizontally
                        ? videoWidth - clientX
                        : clientX,
                      y: clientY,
                    },
                    -diff,
                    zoomContainer!,
                  );
                  newCamera = panCamera(newCamera, dx, -dy);
                  setCamera(newCamera);
                }
              } else {
                let activeHand: "left" | "right" | null = null;
                if (newHandState.left.isDown) activeHand = "left";
                if (newHandState.right.isDown) activeHand = "right";
                if (activeHand) {
                  const lastDown = handStateRef.current[activeHand].isDown;
                  const lastX = handStateRef.current[activeHand].x;
                  const lastY = handStateRef.current[activeHand].y;

                  const isDown = newHandState[activeHand].isDown;
                  const x = newHandState[activeHand].x;
                  const y = newHandState[activeHand].y;

                  const isNewDown = isDown && !lastDown;
                  // const isNewUp = lastDown && !isDown;

                  let dx = (x - lastX) * canvasRef.current.width * scale;
                  const dy = (y - lastY) * canvasRef.current.height * scale;

                  dx = webcamFlippedHorizontally ? dx : -dx;

                  // Actual actions
                  if (isDown && !isNewDown) {
                    const newCamera = panCamera(cameraRef.current!, dx, -dy);
                    setCamera(newCamera);
                  }
                }
              }

              handStateRef.current = newHandState;
            }

            lastVideoTime = video.currentTime;
          }

          animationFrameRef.current = requestAnimationFrame(() => {
            renderLoop();
          });
        }
        renderLoop();
      }
    }
    if (video) {
      handleRecognizer();
    }
  }, [videoLoaded, webcamFlippedHorizontally, setCamera]);

  return (
    <canvas ref={canvasRef} className="absolute object-cover w-full h-full" />
  );
}
