const THRESHOLD = 8;
export function createSliderGesture({
  x,
  y,
  left,
  width,
  min,
  max,
  step,
  value,
  pointerType,
}) {
  return {
    x,
    y,
    left,
    width,
    min,
    max,
    step,
    last: value,
    initialValue: value,
    pointerType,
    axis: pointerType === "mouse" ? "horizontal" : "pending",
    started: false,
  };
}
export function sliderGestureValue(gesture, x, y, ending = false) {
  const dx = Math.abs(x - gesture.x),
    dy = Math.abs(y - gesture.y);
  if (gesture.axis === "pending") {
    if (Math.max(dx, dy) >= THRESHOLD) {
      if (dy >= dx) gesture.axis = "vertical";
      else if (dx >= dy * 1.25) gesture.axis = "horizontal";
    } else if (!ending) return null;
    if (gesture.axis === "pending" && Math.max(dx, dy) >= THRESHOLD)
      return null;
  }
  if (gesture.axis === "vertical" || !gesture.width) return null;
  const ratio = Math.max(0, Math.min(1, (x - gesture.left) / gesture.width));
  const raw =
    gesture.axis === "horizontal" && gesture.pointerType !== "mouse"
      ? gesture.initialValue +
        ((x - gesture.x) / gesture.width) * (gesture.max - gesture.min)
      : gesture.min + ratio * (gesture.max - gesture.min);
  const stepped =
    gesture.min + Math.round((raw - gesture.min) / gesture.step) * gesture.step;
  return Number(
    Math.max(gesture.min, Math.min(gesture.max, stepped)).toFixed(8),
  );
}
