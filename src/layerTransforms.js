export const clampScale = (value) => Math.max(0.1, Math.min(4, value));
const rotate = (x, y, angle) => ({
  x: x * Math.cos(angle) - y * Math.sin(angle),
  y: x * Math.sin(angle) + y * Math.cos(angle),
});
export function startLayerTransform(layer, frame, point, corner) {
  const angle = (layer.rotation * Math.PI) / 180;
  const scale = Number.isFinite(layer.scale) ? clampScale(layer.scale) : 1;
  const center = {
    x: (layer.x * frame.width) / 100,
    y: (layer.y * frame.height) / 100,
  };
  const diagonal = corner
    ? rotate(
        (corner[0] * layer.width * frame.width) / 100,
        (corner[1] * layer.height * frame.height) / 100,
        angle,
      )
    : null;
  return {
    layer: { ...layer },
    frame,
    center,
    diagonal,
    anchor: diagonal
      ? {
          x: center.x - (diagonal.x * scale) / 2,
          y: center.y - (diagonal.y * scale) / 2,
        }
      : null,
    startAngle: Math.atan2(point.y - center.y, point.x - center.x),
  };
}
export function resizeLayerFromHandle(gesture, point) {
  const { diagonal, anchor, frame } = gesture;
  const length = diagonal.x ** 2 + diagonal.y ** 2;
  const scale = clampScale(
    ((point.x - anchor.x) * diagonal.x + (point.y - anchor.y) * diagonal.y) /
      Math.max(length, 0.001),
  );
  return {
    scale,
    x: ((anchor.x + (diagonal.x * scale) / 2) / frame.width) * 100,
    y: ((anchor.y + (diagonal.y * scale) / 2) / frame.height) * 100,
  };
}
export function rotateLayerFromHandle(gesture, point, snap = false) {
  const angle = Math.atan2(
    point.y - gesture.center.y,
    point.x - gesture.center.x,
  );
  let rotation =
    gesture.layer.rotation + ((angle - gesture.startAngle) * 180) / Math.PI;
  if (snap) rotation = Math.round(rotation / 15) * 15;
  return { rotation: ((((rotation + 180) % 360) + 360) % 360) - 180 };
}
