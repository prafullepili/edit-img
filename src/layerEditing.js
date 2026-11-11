const scaleOf = (l) =>
  Number.isFinite(l.scale) ? Math.max(0.1, Math.min(4, l.scale)) : 1;
export const selectionLayers = (layer, layers) =>
  layer.groupId ? layers.filter((l) => l.groupId === layer.groupId) : [layer];
export const isLayerLocked = (layer, layers) =>
  !!layer && selectionLayers(layer, layers).some((l) => l.locked);
export function layerBounds(layer, aspect = 1) {
  const angle = (layer.rotation * Math.PI) / 180,
    scale = scaleOf(layer);
  const w = layer.width * scale,
    h = layer.height * scale;
  const dx =
    (Math.abs(Math.cos(angle)) * w + (Math.abs(Math.sin(angle)) * h) / aspect) /
    2;
  const dy =
    (Math.abs(Math.sin(angle)) * w * aspect + Math.abs(Math.cos(angle)) * h) /
    2;
  return {
    left: layer.x - dx,
    right: layer.x + dx,
    top: layer.y - dy,
    bottom: layer.y + dy,
    cx: layer.x,
    cy: layer.y,
  };
}
export function selectionBounds(layer, layers, aspect) {
  const boxes = selectionLayers(layer, layers).map((l) =>
    layerBounds(l, aspect),
  );
  const left = Math.min(...boxes.map((b) => b.left)),
    right = Math.max(...boxes.map((b) => b.right)),
    top = Math.min(...boxes.map((b) => b.top)),
    bottom = Math.max(...boxes.map((b) => b.bottom));
  return {
    left,
    right,
    top,
    bottom,
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
  };
}
export function alignSelection(layer, layers, mode, aspect) {
  const b = selectionBounds(layer, layers, aspect);
  const dx = { left: -b.left, center: 50 - b.cx, right: 100 - b.right }[mode];
  const dy = { top: -b.top, middle: 50 - b.cy, bottom: 100 - b.bottom }[mode];
  return dx !== undefined ? { x: layer.x + dx } : { y: layer.y + dy };
}
export function snapSelection(layer, changes, layers, frame) {
  const b = selectionBounds(layer, layers, frame.width / frame.height);
  const dx = changes.x - layer.x,
    dy = changes.y - layer.y;
  const others = layers
    .filter(
      (l) =>
        l.visible &&
        l.id !== layer.id &&
        (!layer.groupId || l.groupId !== layer.groupId),
    )
    .map((l) => layerBounds(l, frame.width / frame.height));
  const find = (values, targets, tolerance) => {
    let best = null;
    for (const target of targets)
      for (const value of values) {
        const delta = target - value;
        if (
          Math.abs(delta) <= tolerance &&
          (!best || Math.abs(delta) < Math.abs(best.delta))
        )
          best = { delta, target };
      }
    return best;
  };
  const x = find(
    [b.left + dx, b.cx + dx, b.right + dx],
    [0, 50, 100, ...others.flatMap((b) => [b.left, b.cx, b.right])],
    600 / frame.width,
  );
  const y = find(
    [b.top + dy, b.cy + dy, b.bottom + dy],
    [0, 50, 100, ...others.flatMap((b) => [b.top, b.cy, b.bottom])],
    600 / frame.height,
  );
  return {
    changes: { x: changes.x + (x?.delta || 0), y: changes.y + (y?.delta || 0) },
    guides: [
      ...(x ? [{ axis: "x", value: x.target }] : []),
      ...(y ? [{ axis: "y", value: y.target }] : []),
    ],
  };
}
export function groupTransform(layer, layers, changes, aspect = 1) {
  const members = selectionLayers(layer, layers);
  let ratio = changes.scale === undefined ? 1 : changes.scale / scaleOf(layer);
  ratio = Math.max(
    ...members.map((l) => 0.1 / scaleOf(l)),
    Math.min(ratio, ...members.map((l) => 4 / scaleOf(l))),
  );
  const angle =
    (((changes.rotation ?? layer.rotation) - layer.rotation) * Math.PI) / 180;
  const cx = changes.x ?? layer.x,
    cy = changes.y ?? layer.y;
  return members.map((member) => {
    const x = (member.x - layer.x) * ratio,
      y = ((member.y - layer.y) / aspect) * ratio;
    return {
      id: member.id,
      changes: {
        x: cx + x * Math.cos(angle) - y * Math.sin(angle),
        y: cy + (x * Math.sin(angle) + y * Math.cos(angle)) * aspect,
        scale: scaleOf(member) * ratio,
        rotation:
          ((((member.rotation + (angle * 180) / Math.PI + 180) % 360) + 360) %
            360) -
          180,
      },
    };
  });
}
export function maskGeometry(mask) {
  const x = Math.max(0, Math.min(100, Number(mask.x) || 0)) / 100,
    y = Math.max(0, Math.min(100, Number(mask.y) || 0)) / 100;
  return {
    x,
    y,
    width: Math.max(0.001, Math.min(1 - x, (Number(mask.width) || 1) / 100)),
    height: Math.max(0.001, Math.min(1 - y, (Number(mask.height) || 1) / 100)),
  };
}
export function maskSvgPath(mask) {
  const { x, y, width: w, height: h } = maskGeometry(mask);
  const shape =
    mask.type === "ellipse"
      ? `M ${x} ${y + h / 2} a ${w / 2} ${h / 2} 0 1 0 ${w} 0 a ${w / 2} ${h / 2} 0 1 0 ${-w} 0 Z`
      : `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
  return (mask.inverted ? "M 0 0 H 1 V 1 H 0 Z " : "") + shape;
}
export function clipLayerMask(ctx, mask, w, h) {
  if (!mask?.enabled) return;
  const { x, y, width, height } = maskGeometry(mask);
  ctx.beginPath();
  if (mask.inverted) ctx.rect(-w / 2, -h / 2, w, h);
  if (mask.type === "ellipse") {
    ctx.moveTo(-w / 2 + (x + width) * w, -h / 2 + (y + height / 2) * h);
    ctx.ellipse(
      -w / 2 + (x + width / 2) * w,
      -h / 2 + (y + height / 2) * h,
      (width * w) / 2,
      (height * h) / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else ctx.rect(-w / 2 + x * w, -h / 2 + y * h, width * w, height * h);
  ctx.clip(mask.inverted ? "evenodd" : "nonzero");
}
