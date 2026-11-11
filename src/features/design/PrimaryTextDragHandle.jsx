import React, { useRef } from "react";
import { draggedTextOffset } from "./styles";
export default function PrimaryTextDragHandle({
  width,
  height,
  bounds,
  value,
  selected,
  onMoveStart,
  onMove,
  onEdit,
}) {
  const drag = useRef(null);
  const update = (event) => {
    const start = drag.current;
    if (!start || event.pointerId !== start.pointerId) return;
    onMove?.(
      draggedTextOffset(
        start,
        ((event.clientX - start.clientX) / start.frame.width) * start.width,
        ((event.clientY - start.clientY) / start.frame.height) * start.height,
      ),
    );
  };
  const end = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    update(event);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <button
      type="button"
      className="text-drag-handle"
      aria-label="Drag text or watermark"
      aria-pressed={selected}
      title="Drag to move text or watermark"
      style={{
        left: `${((bounds.x + bounds.width / 2) / width) * 100}%`,
        top: `${((bounds.y + bounds.height / 2) / height) * 100}%`,
        width: `${(bounds.width / width) * 100}%`,
        height: `${(bounds.height / height) * 100}%`,
      }}
      onPointerDown={(event) => {
        if (
          (event.pointerType === "mouse" && event.button !== 0) ||
          event.isPrimary === false ||
          drag.current
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const frame = event.currentTarget.parentElement.getBoundingClientRect();
        if (!frame.width || !frame.height) return;
        drag.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          frame,
          width,
          height,
          bounds,
          offsetX: value.offsetX || 0,
          offsetY: value.offsetY || 0,
        };
        // Capture on an HTML element before any Redux updates can change the tool panel.
        event.currentTarget.setPointerCapture(event.pointerId);
        onMoveStart?.();
      }}
      onPointerMove={update}
      onPointerUp={end}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEdit?.();
      }}
      onKeyDown={(event) => {
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          )
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        onMoveStart?.();
        const step = event.shiftKey ? 10 : 1;
        onMove?.(
          draggedTextOffset(
            {
              width,
              height,
              bounds,
              offsetX: value.offsetX || 0,
              offsetY: value.offsetY || 0,
            },
            event.key === "ArrowLeft"
              ? -step
              : event.key === "ArrowRight"
                ? step
                : 0,
            event.key === "ArrowUp"
              ? -step
              : event.key === "ArrowDown"
                ? step
                : 0,
          ),
        );
      }}
    />
  );
}
