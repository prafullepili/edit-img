// Cache a soft brush stamp once; draw only the newest segment on pointer movement.
export function createLiveBrush(
  ctx,
  {
    radius,
    color,
    opacity,
    hardness,
    tool,
    sampleCanvas,
    sourcePoint,
    sampleScale = 1,
  },
  makeCanvas = () => document.createElement("canvas"),
) {
  const stamp = makeCanvas();
  const padding = 2;
  const extent = Math.ceil(radius * 2) + padding * 2;
  stamp.width = stamp.height = extent;
  const sc = stamp.getContext("2d");
  const center = extent / 2;
  const inner = radius * Math.min(0.95, Math.max(0, hardness));
  const gradient = sc.createRadialGradient(
    center,
    center,
    inner,
    center,
    center,
    radius,
  );
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, `${color}00`);
  sc.fillStyle = gradient;
  sc.fillRect(0, 0, extent, extent);
  const patch = tool === "heal" ? makeCanvas() : null;
  if (patch) patch.width = patch.height = extent;
  const pc = patch?.getContext("2d");
  let previous, first;
  function dab(point) {
    let texture = stamp;
    if (pc) {
      // The source snapshot never changes while painting, so healing cannot feed back into itself.
      const sx = sourcePoint.x + (point.x - first.x) * sampleScale;
      const sy = sourcePoint.y + (point.y - first.y) * sampleScale;
      pc.clearRect(0, 0, extent, extent);
      pc.globalCompositeOperation = "source-over";
      pc.drawImage(
        sampleCanvas,
        sx - center * sampleScale,
        sy - center * sampleScale,
        extent * sampleScale,
        extent * sampleScale,
        0,
        0,
        extent,
        extent,
      );
      pc.globalCompositeOperation = "destination-in";
      pc.drawImage(stamp, 0, 0);
      texture = patch;
    }
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.drawImage(texture, point.x - center, point.y - center);
    ctx.restore();
  }
  return {
    start(point) {
      previous = first = point;
      dab(point);
    },
    move(point) {
      if (!previous) return this.start(point);
      const dx = point.x - previous.x,
        dy = point.y - previous.y;
      if (dx === 0 && dy === 0) return;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (radius * 0.3)));
      for (let i = 1; i <= steps; i++)
        dab({
          x: previous.x + (dx * i) / steps,
          y: previous.y + (dy * i) / steps,
        });
      previous = point;
    },
  };
}
