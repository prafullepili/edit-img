import PrimaryTextDragHandle from "./PrimaryTextDragHandle";
import { textPreviewSurface } from "./textPreviewSurface";
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
} from "react";
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
  const measureRef = useRef(null);
  const drawRef = useRef(null);
  const paintKeyRef = useRef(null);
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
      ? { ...value, textAlign: value.textAlign || value.position.split("-")[1] }
      : value,
  );
  const box = primary
    ? primaryTextLayer(value, width, height)
    : { x: 0, y: 0, width, height };
  const spacing = s.letterSpacing * scale;
  const measured = useMemo(() => {
    if (!measureRef.current)
      measureRef.current = document.createElement("canvas").getContext("2d");
    const ctx = measureRef.current;
    ctx.font = `${s.fontWeight} ${size}px "${s.fontFamily}"`;
    const lines = textLines(ctx, value.text, box.width, spacing);
    return {
      lines,
      width: Math.max(
        1,
        ...lines.map(
          (line) =>
            ctx.measureText(line).width +
            Math.max(0, line.length - 1) * spacing,
        ),
      ),
    };
  }, [value.text, s.fontFamily, s.fontWeight, size, box.width, spacing, ready]);
  const lineHeight = size * s.lineHeight;
  const textWidth = Math.min(width, measured.width);
  const anchorX =
    box.x +
    (s.textAlign === "center"
      ? box.width / 2
      : s.textAlign === "right"
        ? box.width
        : 0);
  const bounds = {
    x:
      anchorX -
      (s.textAlign === "center"
        ? textWidth / 2
        : s.textAlign === "right"
          ? textWidth
          : 0),
    y: primary ? box.y - (measured.lines.length * lineHeight) / 2 : 0,
    width: textWidth,
    height: Math.max(lineHeight, measured.lines.length * lineHeight),
  };
  const inkBounds = {
    ...bounds,
    height: Math.min(
      primary ? Infinity : height,
      Math.max(
        bounds.height,
        (measured.lines.length - 1) * lineHeight + size * 1.4,
      ),
    ),
  };
  const padding = textEffectPadding(s, scale);
  const surface = textPreviewSurface({
    bounds: inkBounds,
    padding,
    width,
    height,
    displayWidth: width,
  });
  useLayoutEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const displayWidth = canvas.parentElement.getBoundingClientRect().width;
      const target = textPreviewSurface({
        bounds: inkBounds,
        padding,
        width,
        height,
        displayWidth,
        pixelRatio: window.devicePixelRatio,
      });
      const ratio = target.ratio;
      const key = JSON.stringify([
        value.text,
        value.color,
        s.fontFamily,
        s.fontWeight,
        s.textAlign,
        s.letterSpacing,
        s.lineHeight,
        s.outlineWidth,
        s.outlineColor,
        s.blur,
        s.shadow,
        s.shadowColor,
        s.shadowOpacity,
        s.shadowBlur,
        s.shadowX,
        s.shadowY,
        size,
        scale,
        primary,
        box.width,
        box.height,
        target.pixelWidth,
        target.pixelHeight,
        ratio,
        ready,
      ]);
      if (paintKeyRef.current === key) return;
      paintKeyRef.current = key;
      if (canvas.width !== target.pixelWidth) canvas.width = target.pixelWidth;
      if (canvas.height !== target.pixelHeight)
        canvas.height = target.pixelHeight;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawStyledText(
        ctx,
        { ...value, textAlign: s.textAlign },
        {
          x: (box.x - inkBounds.x + padding) * ratio,
          y: (box.y - inkBounds.y + padding) * ratio,
          width: box.width * ratio,
          height: box.height * ratio,
          size: size * ratio,
          scale: scale * ratio,
          centered: primary,
          lines: measured.lines,
        },
      );
    };
    drawRef.current = draw;
    draw();
  });
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => drawRef.current?.());
    const parent = canvasRef.current?.parentElement;
    if (parent) observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: `${surface.left}%`,
          top: `${surface.top}%`,
          width: `${surface.width}%`,
          height: `${surface.height}%`,
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
