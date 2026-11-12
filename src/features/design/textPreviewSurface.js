export function textPreviewSurface({
  bounds,
  padding,
  width,
  height,
  displayWidth,
  pixelRatio = 1,
}) {
  const fullWidth = Math.max(1, bounds.width + padding * 2);
  const fullHeight = Math.max(1, bounds.height + padding * 2);
  const ratio = Math.min(
    1,
    (Math.max(1, displayWidth) / width) * Math.min(2, pixelRatio || 1),
    1600 / Math.max(fullWidth, fullHeight),
  );
  return {
    ratio,
    pixelWidth: Math.max(1, Math.ceil(fullWidth * ratio)),
    pixelHeight: Math.max(1, Math.ceil(fullHeight * ratio)),
    left: ((bounds.x - padding) / width) * 100,
    top: ((bounds.y - padding) / height) * 100,
    width: (fullWidth / width) * 100,
    height: (fullHeight / height) * 100,
  };
}
