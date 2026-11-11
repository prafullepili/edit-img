import PrimaryTextDragHandle from "./PrimaryTextDragHandle";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  textStyle,
  textLines,
  primaryTextLayer,
  drawStyledText,
  textEffectPadding,
} from "./styles";
export default function TextArtwork({
  value,
  width,
  height,
  size,
  scale = 1,
  primary = false,
  draggable = false,
  selected = false,
  onMoveStart,
  onMove,
  onEdit,
}) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(0);
  useEffect(() => {
    let active = true;
    document.fonts.ready.then(() => active && setReady((v) => v + 1));
    return () => {
      active = false;
    };
  }, [value.fontFamily, value.fontWeight]);
  const s = textStyle(
      primary
        ? {
            ...value,
            textAlign: value.textAlign || value.position.split("-")[1],
          }
        : value,
    ),
    ctx = document.createElement("canvas").getContext("2d");
  ctx.font = `${s.fontWeight} ${size}px "${s.fontFamily}"`;
  const box = primary
    ? primaryTextLayer(value, width, height)
    : { x: 0, y: 0, width, height };
  const spacing = s.letterSpacing * scale,
    lines = textLines(ctx, value.text, box.width, spacing),
    lineHeight = size * s.lineHeight,
    x =
      box.x +
      (s.textAlign === "center"
        ? box.width / 2
        : s.textAlign === "right"
          ? box.width
          : 0),
    y = primary ? box.y - (lines.length * lineHeight) / 2 : 0;
  const measuredWidth = Math.max(
    1,
    ...lines.map(
      (line) =>
        ctx.measureText(line).width + Math.max(0, line.length - 1) * spacing,
    ),
  );
  const textWidth = Math.min(width, measuredWidth);
  const bounds = {
    x:
      x -
      (s.textAlign === "center"
        ? textWidth / 2
        : s.textAlign === "right"
          ? textWidth
          : 0),
    y,
    width: textWidth,
    height: Math.max(lineHeight, lines.length * lineHeight),
  };
  const padding = textEffectPadding(s, scale);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fullWidth = width + padding * 2,
      fullHeight = height + padding * 2;
    const ratio = Math.min(1, 1600 / Math.max(fullWidth, fullHeight));
    canvas.width = Math.max(1, Math.ceil(fullWidth * ratio));
    canvas.height = Math.max(1, Math.ceil(fullHeight * ratio));
    drawStyledText(
      canvas.getContext("2d"),
      { ...value, textAlign: s.textAlign },
      {
        x: (box.x + padding) * ratio,
        y: (box.y + padding) * ratio,
        width: box.width * ratio,
        height: box.height * ratio,
        size: size * ratio,
        scale: scale * ratio,
        centered: primary,
      },
    );
  }, [value, width, height, size, scale, primary, ready, padding]);
  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: `${(-padding / width) * 100}%`,
          top: `${(-padding / height) * 100}%`,
          width: `${((width + padding * 2) / width) * 100}%`,
          height: `${((height + padding * 2) / height) * 100}%`,
          pointerEvents: "none",
        }}
      />
      {primary && draggable && value.text && (
        <PrimaryTextDragHandle
          width={width}
          height={height}
          bounds={bounds}
          value={value}
          selected={selected}
          onMoveStart={onMoveStart}
          onMove={onMove}
          onEdit={onEdit}
        />
      )}
    </>
  );
}
