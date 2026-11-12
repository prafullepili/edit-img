export const fontFamilies = [
  "DM Sans",
  "Manrope",
  "DM Mono",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
];
export const textDefaults = {
  fontFamily: "DM Sans",
  fontWeight: 700,
  letterSpacing: 0,
  lineHeight: 1.2,
  textAlign: "left",
  outlineWidth: 0,
  blur: 0,
  outlineColor: "#111111",
  shadow: false,
  blend: "normal",
  shadowColor: "#000000",
  shadowOpacity: 60,
  shadowBlur: 8,
  shadowX: 2,
  shadowY: 3,
};
export function textStyle(value) {
  return { ...textDefaults, ...value };
}
export function gradientEndpoints(angle, width, height) {
  const a = (angle * Math.PI) / 180,
    dx = Math.cos(a),
    dy = Math.sin(a),
    length = Math.abs(width * dx) + Math.abs(height * dy);
  return {
    x1: width / 2 - (dx * length) / 2,
    y1: height / 2 - (dy * length) / 2,
    x2: width / 2 + (dx * length) / 2,
    y2: height / 2 + (dy * length) / 2,
  };
}
export function shadowRgba(value) {
  const s = textStyle(value),
    hex = s.shadowColor.replace("#", "");
  return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${s.shadowOpacity / 100})`;
}
export function textLines(ctx, text, width, spacing = 0) {
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    let line = "";
    for (const char of paragraph) {
      const candidate = line + char,
        measure =
          ctx.measureText(candidate).width +
          Math.max(0, candidate.length - 1) * spacing;
      if (line && measure > width) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
function spaced(ctx, line, x, y, spacing, stroke) {
  if (!spacing) {
    ctx[stroke ? "strokeText" : "fillText"](line, x, y);
    return;
  }
  for (const char of line) {
    ctx[stroke ? "strokeText" : "fillText"](char, x, y);
    x += ctx.measureText(char).width + spacing;
  }
}
export function textEffectPadding(value, scale = 1) {
  const s = textStyle(value);
  return Math.ceil(
    (s.outlineWidth +
      (s.blur || 0) * 3 +
      (s.shadow
        ? s.shadowBlur * 2 + Math.max(Math.abs(s.shadowX), Math.abs(s.shadowY))
        : 0) +
      2) *
      scale,
  );
}
export function textEditorValue(layer, canvasWidth) {
  return { ...layer, size: (layer.size * canvasWidth) / 100 };
}
export function textLayerChanges(changes, canvasWidth) {
  return "size" in changes
    ? { ...changes, size: (changes.size / canvasWidth) * 100 }
    : changes;
}
export function drawStyledText(
  ctx,
  value,
  {
    x,
    y,
    width,
    height,
    size,
    scale = 1,
    centered = false,
    lines: cachedLines,
  },
) {
  const s = textStyle(value);
  ctx.save();
  ctx.font = `${s.fontWeight} ${size}px "${s.fontFamily}"`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = value.color;
  ctx.lineJoin = "round";
  if (s.blur > 0) ctx.filter = `blur(${s.blur * scale}px)`;
  const spacing = s.letterSpacing * scale,
    lines = cachedLines || textLines(ctx, value.text, width, spacing),
    lineHeight = size * s.lineHeight;
  if (s.shadow) {
    ctx.shadowColor = shadowRgba(s);
    ctx.shadowBlur = s.shadowBlur * scale;
    ctx.shadowOffsetX = s.shadowX * scale;
    ctx.shadowOffsetY = s.shadowY * scale;
  }
  if (!centered) {
    ctx.beginPath();
    const padding = textEffectPadding(s, scale);
    ctx.rect(
      x - padding,
      y - padding,
      width + padding * 2,
      height + padding * 2,
    );
    ctx.clip();
  }
  const startY = centered ? y - (lines.length * lineHeight) / 2 : y;
  lines.forEach((line, i) => {
    const measure =
        ctx.measureText(line).width + Math.max(0, line.length - 1) * spacing,
      offset =
        s.textAlign === "center"
          ? (width - measure) / 2
          : s.textAlign === "right"
            ? width - measure
            : 0,
      px = x + offset,
      py = startY + i * lineHeight;
    if (s.outlineWidth > 0) {
      ctx.strokeStyle = s.outlineColor;
      ctx.lineWidth = s.outlineWidth * 2 * scale;
      spaced(ctx, line, px, py, spacing, true);
    }
    spaced(ctx, line, px, py, spacing, false);
  });
  ctx.restore();
}
export function primaryTextLayer(value, width, height) {
  const [v, h] = value.position.split("-");
  return {
    ...value,
    ...textStyle(value),
    textAlign: value.textAlign || h,
    x: width * (0.05 + (value.offsetX || 0) / 100),
    y:
      height *
      ((v === "top" ? 0.08 : v === "bottom" ? 0.92 : 0.5) +
        (value.offsetY || 0) / 100),
    width: width * 0.9,
    height,
    size: value.size,
  };
}
export function roundedRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
export function canvasFill(
  ctx,
  layer,
  w,
  h,
  offsetX = -w / 2,
  offsetY = -h / 2,
) {
  const g = layer.gradient;
  if (!g?.enabled) return layer.color;
  let gradient;
  if (g.type === "radial")
    gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 2);
  else {
    const p = gradientEndpoints(g.angle ?? 0, w, h);
    gradient = ctx.createLinearGradient(
      offsetX + p.x1,
      offsetY + p.y1,
      offsetX + p.x2,
      offsetY + p.y2,
    );
  }
  gradient.addColorStop(0, g.from || layer.color);
  gradient.addColorStop(1, g.to || "#725cff");
  return gradient;
}

export function draggedTextOffset(start, dx, dy) {
  const clamp = (value, low, high) =>
    Math.max(Math.min(low, high), Math.min(Math.max(low, high), value));
  const x = clamp(
    dx,
    -start.bounds.x,
    start.width - start.bounds.x - start.bounds.width,
  );
  const y = clamp(
    dy,
    -start.bounds.y,
    start.height - start.bounds.y - start.bounds.height,
  );
  return {
    offsetX: start.offsetX + (x / start.width) * 100,
    offsetY: start.offsetY + (y / start.height) * 100,
  };
}
