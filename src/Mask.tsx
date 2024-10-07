import { useAtom } from "jotai";
import {
  CanvasRefAtom,
  FpsAtom,
  OpacityAtom,
  SelectedDeviceIdAtom,
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

export function Mask() {
  const [video] = useAtom(VideoAtom);
  const [videoLoaded] = useAtom(VideoLoadedAtom);
  const [showCategorySettings] = useAtom(ShowCategoriesAtom);
  const [selectedDeviceId] = useAtom(SelectedDeviceIdAtom);

  const [canvasRefA] = useAtom(CanvasRefAtom);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const showCategorySettingsRef = useRef(showCategorySettings);
  showCategorySettingsRef.current = showCategorySettings;

  const [opacity] = useAtom(OpacityAtom);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  const [webcamFlipped] = useAtom(WebcamFlippedAtom);
  const webcamFlippedRef = useRef(webcamFlipped);
  webcamFlippedRef.current = webcamFlipped;

  const imageSegmenterRef = useRef<ImageSegmenter | null>(null);

  const animationRef = useRef<number | null>(null);

  const [fps] = useAtom(FpsAtom);
  const fpsRef = useRef(fps);
  fpsRef.current = fps;

  const width = 640;
  const height = 480;

  useEffect(() => {
    const createShaderProgram = (gl: WebGL2RenderingContext) => {
      const vs = `
    attribute vec2 position;
    varying vec2 texCoords;
  
    void main() {
      texCoords = (position + 1.0) / 2.0;
      texCoords.y = 1.0 - texCoords.y;
      gl_Position = vec4(position, 0, 1.0);
    }
  `;

      const fs = `
    precision highp float;
    uniform bool showBackground;
    uniform bool showFace;
    uniform bool showHair;
    uniform bool showBody;
    uniform bool showClothes;
    uniform float opacity;

    varying vec2 texCoords;
    uniform sampler2D textureSampler;
    void main() {
      int maskVal = int(texture2D(textureSampler, texCoords).r * 255.0);

      vec4 color = vec4(0.0, 0.0, 0.0, 1.0);

      // Determine transparency based on the mask value and user preferences
      if (
          (maskVal == 0 && showBackground) ||
          (maskVal == 1 && showHair) ||
          (maskVal == 3 && showFace) ||
          (maskVal == 2 && showBody) ||
          (maskVal == 4 && showClothes)
      ) {
          // Make the fragment transparent
          color.a = 1.0 - opacity;
      }

      // Set the final fragment color
      gl_FragColor = color;
    }
  `;

      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      if (!vertexShader) {
        throw Error("can not create vertex shader");
      }
      gl.shaderSource(vertexShader, vs);
      gl.compileShader(vertexShader);

      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      if (!fragmentShader) {
        throw Error("can not create fragment shader");
      }
      gl.shaderSource(fragmentShader, fs);
      gl.compileShader(fragmentShader);

      const program = gl.createProgram();
      if (!program) {
        throw Error("can not create program");
      }
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      // Check if program linked successfully
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error("Program linking failed: " + error);
      }

      return {
        vertexShader,
        fragmentShader,
        shaderProgram: program,
        attribLocations: {
          position: gl.getAttribLocation(program, "position"),
        },
        uniformLocations: {
          textureSampler: gl.getUniformLocation(program, "textureSampler"),
          showBackground: gl.getUniformLocation(program, "showBackground"),
          showFace: gl.getUniformLocation(program, "showFace"),
          showHair: gl.getUniformLocation(program, "showHair"),
          showBody: gl.getUniformLocation(program, "showBody"),
          showClothes: gl.getUniformLocation(program, "showClothes"),
          opacity: gl.getUniformLocation(program, "opacity"),
        },
      };
    };

    const createVertexBuffer = (gl: WebGL2RenderingContext) => {
      if (!gl) {
        return null;
      }
      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]),
        gl.STATIC_DRAW,
      );
      return vertexBuffer;
    };

    function createCopyTextureToCanvas(
      canvas: HTMLCanvasElement | OffscreenCanvas,
    ) {
      const gl = canvas.getContext("webgl2");
      if (!gl) {
        return undefined;
      }
      const {
        shaderProgram,
        attribLocations: { position: positionLocation },
        uniformLocations: {
          textureSampler: textureLocation,
          showBackground,
          showFace,
          showHair,
          showBody,
          showClothes,
          opacity,
        },
      } = createShaderProgram(gl);
      const vertexBuffer = createVertexBuffer(gl);

      return (mask: any) => {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.useProgram(shaderProgram);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const texture = mask.getAsWebGLTexture();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(textureLocation, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.uniform1i(
          showBackground,
          showCategorySettingsRef.current.background ? 1 : 0,
        );
        gl.uniform1i(showFace, showCategorySettingsRef.current.face ? 1 : 0);
        gl.uniform1i(showHair, showCategorySettingsRef.current.hair ? 1 : 0);
        gl.uniform1i(showBody, showCategorySettingsRef.current.body ? 1 : 0);
        gl.uniform1i(
          showClothes,
          showCategorySettingsRef.current.clothes ? 1 : 0,
        );
        gl.uniform1f(opacity, opacityRef.current);

        return createImageBitmap(canvas);
      };
    }

    const tasksCanvas = new OffscreenCanvas(1, 1);
    const createImageSegmenter = async () => {
      const audio = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );

      imageSegmenterRef.current = await ImageSegmenter.createFromOptions(
        audio,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
            delegate: "GPU",
          },
          canvas: tasksCanvas,
          runningMode: "VIDEO",
          outputConfidenceMasks: false,
          outputCategoryMask: true,
        },
      );
    };
    const toImageBitmap = createCopyTextureToCanvas(tasksCanvas);

    const canvasCtx = canvasRef.current!.getContext("2d")!;
    canvasRefA.current = canvasRef.current;
    async function callbackForVideo(
      result: ImageSegmenterResult,
      image: ImageBitmap,
    ) {
      const maskImage = await toImageBitmap(result.categoryMask);

      if (webcamFlippedRef.current.x || webcamFlippedRef.current.y) {
        applyTransform(canvasCtx);
      }

      canvasCtx.globalCompositeOperation = "destination-atop";
      canvasCtx.drawImage(
        maskImage,
        0,
        0,
        video!.videoWidth,
        video!.videoHeight,
      );
      canvasCtx.drawImage(image, 0, 0, video!.videoWidth, video!.videoHeight);

      if (webcamFlippedRef.current.x || webcamFlippedRef.current.y) {
        resetTransform(canvasCtx);
      }

      animationRef.current = requestAnimationFrame(predictWebcam);
    }

    let lastTime = 0;
    let lastSaveTime = 0;
    async function predictWebcam() {
      let startTimeMs = performance.now();

      if (startTimeMs - lastTime < 1000 / fpsRef.current) {
        animationRef.current = requestAnimationFrame(predictWebcam);
        return;
      }
      const image = await createImageBitmap(video!);
    
      // Start segmenting the stream.
      imageSegmenterRef.current.segmentForVideo(image, startTimeMs, (result) =>
        callbackForVideo(result, image),
      );

      if (startTimeMs - lastSaveTime > 1000) {
        const dataUrl = canvasRefA.current!.toDataURL("image/jpeg", 0.9);
        localStorage.setItem("dataUrl", dataUrl);
        lastSaveTime = startTimeMs;
      }

      lastTime = startTimeMs;
    }

    async function main() {
      canvasRef.current!.width = video!.videoWidth;
      canvasRef.current!.height = video!.videoHeight;

      const check = localStorage.getItem("dataUrl");
      if (check) {
        const img = new Image();
        img.src = check;
        img.onload = () => {
          const ctx = canvasRef.current?.getContext("2d");
          ctx?.drawImage(img, 0, 0);
        };
      }

      cancelAnimationFrame(animationRef.current!);
      if (imageSegmenterRef.current) {
        imageSegmenterRef.current.close();
      }

      await createImageSegmenter();

      predictWebcam();
    }

    if (video && videoLoaded) {
      main();
    }
  }, [video, videoLoaded, selectedDeviceId]);

  function applyTransform(ctx: CanvasRenderingContext2D) {
    if (webcamFlippedRef.current.x && webcamFlippedRef.current.y) {
      ctx.setTransform(-1, 0, 0, -1, width, height);
    } else if (webcamFlippedRef.current.x) {
      ctx.setTransform(-1, 0, 0, 1, width, 0);
    } else if (webcamFlippedRef.current.y) {
      ctx.setTransform(1, 0, 0, -1, 0, height);
    }
  }

  function resetTransform(ctx: CanvasRenderingContext2D) {
    if (webcamFlippedRef.current.x || webcamFlippedRef.current.y) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
    </div>
  );
}
