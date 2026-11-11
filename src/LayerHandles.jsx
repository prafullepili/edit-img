import React, { useRef } from "react";
import { getLayerScale } from "./layers";
import {
  startLayerTransform,
  resizeLayerFromHandle,
  rotateLayerFromHandle,
} from "./layerTransforms";

const corners = [
  ["top left", -1, -1],
  ["top right", 1, -1],
  ["bottom right", 1, 1],
  ["bottom left", -1, 1],
];
export default function LayerHandles({ layer, onStart, onChange, locked }) {
  const gesture = useRef(null);
  if (!layer?.visible || locked) return null;
  const start = (e, corner) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.focus();
    const frame = e.currentTarget
      .closest(".image-frame")
      .getBoundingClientRect();
    gesture.current = startLayerTransform(
      layer,
      frame,
      { x: e.clientX - frame.left, y: e.clientY - frame.top },
      corner,
    );
    gesture.current.pointerId = e.pointerId;
    onStart(layer.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!gesture.current || !e.currentTarget.hasPointerCapture(e.pointerId))
      return;
    e.stopPropagation();
    const g = gesture.current,
      point = { x: e.clientX - g.frame.left, y: e.clientY - g.frame.top };
    onChange(
      layer.id,
      g.diagonal
        ? resizeLayerFromHandle(g, point)
        : rotateLayerFromHandle(g, point, e.shiftKey),
    );
  };
  const finish = (e, cancel = false) => {
    if (cancel && gesture.current) {
      const l = gesture.current.layer;
      onChange(l.id, {
        x: l.x,
        y: l.y,
        scale: getLayerScale(l),
        rotation: l.rotation,
      });
    }
    const pointerId = gesture.current?.pointerId ?? e.pointerId;
    gesture.current = null;
    if (pointerId !== undefined && e.currentTarget.hasPointerCapture(pointerId))
      e.currentTarget.releasePointerCapture(pointerId);
  };
  const keyboard = (e, kind) => {
    if (e.key === "Escape" && gesture.current) {
      finish(e, true);
      return;
    }
    if (!["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(e.key))
      return;
    e.preventDefault();
    e.stopPropagation();
    onStart(layer.id);
    const sign = ["ArrowUp", "ArrowRight"].includes(e.key) ? 1 : -1;
    onChange(
      layer.id,
      kind === "rotate"
        ? {
            rotation:
              ((((layer.rotation + sign * (e.shiftKey ? 15 : 5) + 180) % 360) +
                360) %
                360) -
              180,
          }
        : {
            scale: Math.max(
              0.1,
              Math.min(4, getLayerScale(layer) + sign * 0.1),
            ),
          },
    );
  };
  const events = {
    onPointerMove: move,
    onPointerUp: (e) => finish(e),
    onPointerCancel: (e) => finish(e, true),
    onLostPointerCapture: (e) => {
      if (gesture.current) finish(e, true);
    },
  };
  return (
    <div
      className="layer-transform-box"
      style={{
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        width: `${layer.width * getLayerScale(layer)}%`,
        height: `${layer.height * getLayerScale(layer)}%`,
        transform: `translate(-50%,-50%) rotate(${layer.rotation}deg)`,
      }}
    >
      {corners.map(([name, x, y]) => (
        <button
          key={name}
          className={`layer-resize-handle ${x === y ? "diagonal-a" : "diagonal-b"}`}
          aria-label={`Resize ${layer.name} ${name}`}
          title="Drag to resize proportionally"
          style={{ left: x < 0 ? "0%" : "100%", top: y < 0 ? "0%" : "100%" }}
          onPointerDown={(e) => start(e, [x, y])}
          onKeyDown={(e) => keyboard(e, "resize")}
          {...events}
        />
      ))}
      <span className="layer-rotation-stem" />
      <button
        className="layer-rotate-handle"
        aria-label={`Rotate ${layer.name}`}
        title="Drag to rotate · Hold Shift to snap to 15°"
        onPointerDown={(e) => start(e, null)}
        onKeyDown={(e) => keyboard(e, "rotate")}
        {...events}
      >
        ↻
      </button>
    </div>
  );
}
