export type PointType = {
  x: number;
  y: number;
};

export type CameraType = {
  x: number;
  y: number;
  z: number;
};

export function screenToCanvas(
  point: PointType,
  camera: CameraType,
  container: HTMLDivElement,
) {
  const x = (point.x - container.clientWidth / 2) / camera.z - camera.x;
  const y = (point.y - container.clientHeight / 2) / camera.z - camera.y;
  return { x, y };
}

export function canvasToScreen(
  point: PointType,
  camera: CameraType,
  container: HTMLDivElement,
) {
  const x = (point.x + camera.x) * camera.z + container.clientWidth / 2;
  const y = (point.y + camera.y) * camera.z + container.clientHeight / 2;
  return { x, y };
}

export function panCamera(
  camera: CameraType,
  dx: number,
  dy: number,
): CameraType {
  return {
    x: camera.x - dx / camera.z,
    y: camera.y - dy / camera.z,
    z: camera.z,
  };
}

export function zoomCamera(
  camera: CameraType,
  point: PointType,
  dz: number,
  container: HTMLDivElement,
): CameraType {
  const zoom = camera.z - dz * camera.z;

  const p1 = screenToCanvas(point, camera, container);

  const p2 = screenToCanvas(point, { ...camera, z: zoom }, container);

  return {
    x: camera.x + p2.x - p1.x,
    y: camera.y + p2.y - p1.y,
    z: zoom,
  };
}
