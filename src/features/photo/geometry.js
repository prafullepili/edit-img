export function cropBounds(width, height, editor) {
  if (editor.freeCrop) {
    const c = editor.freeCrop;
    return {
      x: c.x * width,
      y: c.y * height,
      width: c.width * width,
      height: c.height * height,
    };
  }
  const ratio =
    editor.cropRatio === "Original"
      ? null
      : editor.cropRatio.split(":").map(Number);
  if (!ratio) return { x: 0, y: 0, width, height };
  const target = ratio[0] / ratio[1],
    w = Math.min(width, height * target),
    h = Math.min(height, width / target);
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}
export function resizeCrop(start, corner, dx, dy) {
  let x = start.x,
    y = start.y,
    right = x + start.width,
    bottom = y + start.height;
  if (corner.includes("w")) x = Math.max(0, Math.min(right - 0.02, x + dx));
  if (corner.includes("e")) right = Math.max(x + 0.02, Math.min(1, right + dx));
  if (corner.includes("n")) y = Math.max(0, Math.min(bottom - 0.02, y + dy));
  if (corner.includes("s"))
    bottom = Math.max(y + 0.02, Math.min(1, bottom + dy));
  if (corner === "move") {
    const nx = Math.max(0, Math.min(1 - start.width, start.x + dx)),
      ny = Math.max(0, Math.min(1 - start.height, start.y + dy));
    return { ...start, x: nx, y: ny };
  }
  return { x, y, width: right - x, height: bottom - y };
}
export function viewToSource(point, editor, sourceWidth, sourceHeight) {
  const swap = editor.rotation % 180 !== 0,
    w = swap ? sourceHeight : sourceWidth,
    h = swap ? sourceWidth : sourceHeight,
    c = cropBounds(w, h, editor);
  const ox = c.x + point.x * c.width - w / 2,
    oy = c.y + point.y * c.height - h / 2,
    a = (-editor.rotation * Math.PI) / 180;
  const x =
    (ox * Math.cos(a) - oy * Math.sin(a)) * (editor.flipX ? -1 : 1) +
    sourceWidth / 2;
  const y =
    (ox * Math.sin(a) + oy * Math.cos(a)) * (editor.flipY ? -1 : 1) +
    sourceHeight / 2;
  return {
    x: Math.max(0, Math.min(1, x / sourceWidth)),
    y: Math.max(0, Math.min(1, y / sourceHeight)),
  };
}

// Inverse of viewToSource, deliberately unclamped for samples outside a crop.
export function sourceToView(point, editor, sourceWidth, sourceHeight) {
  const swap = editor.rotation % 180 !== 0;
  const w = swap ? sourceHeight : sourceWidth,
    h = swap ? sourceWidth : sourceHeight;
  const rect = cropBounds(w, h, editor);
  const x = (point.x * sourceWidth - sourceWidth / 2) * (editor.flipX ? -1 : 1);
  const y =
    (point.y * sourceHeight - sourceHeight / 2) * (editor.flipY ? -1 : 1);
  const angle = (editor.rotation * Math.PI) / 180;
  return {
    x:
      (x * Math.cos(angle) - y * Math.sin(angle) + w / 2 - rect.x) / rect.width,
    y:
      (x * Math.sin(angle) + y * Math.cos(angle) + h / 2 - rect.y) /
      rect.height,
  };
}
