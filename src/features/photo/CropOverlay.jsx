import React, { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { actions } from "../../store";
import { resizeCrop } from "./geometry";
export default function CropOverlay() {
  const dispatch = useDispatch(),
    crop = useSelector((s) => s.editor.freeCrop),
    gesture = useRef(null);
  if (!crop) return null;
  const begin = (event, corner) => {
    event.preventDefault();
    event.stopPropagation();
    const frame = event.currentTarget
      .closest(".image-frame")
      .getBoundingClientRect();
    gesture.current = {
      crop: { ...crop },
      corner,
      x: event.clientX,
      y: event.clientY,
      frame,
    };
    dispatch(actions.snapshot());
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    const g = gesture.current;
    if (!g || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    dispatch(
      actions.setFreeCrop(
        resizeCrop(
          g.crop,
          g.corner,
          (event.clientX - g.x) / g.frame.width,
          (event.clientY - g.y) / g.frame.height,
        ),
      ),
    );
  };
  const end = (event) => {
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const events = {
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: (event) => {
      if (gesture.current) dispatch(actions.setFreeCrop(gesture.current.crop));
      end(event);
    },
  };
  return (
    <div
      className="free-crop"
      style={{
        left: `${crop.x * 100}%`,
        top: `${crop.y * 100}%`,
        width: `${crop.width * 100}%`,
        height: `${crop.height * 100}%`,
      }}
      onPointerDown={(event) => begin(event, "move")}
      {...events}
    >
      <div className="crop-guides" />
      {[
        ["nw", 0, 0],
        ["ne", 100, 0],
        ["se", 100, 100],
        ["sw", 0, 100],
      ].map(([corner, x, y]) => (
        <button
          key={corner}
          aria-label={`Crop ${corner} corner`}
          className="free-crop-handle"
          style={{ left: `${x}%`, top: `${y}%` }}
          onPointerDown={(event) => begin(event, corner)}
          {...events}
          onKeyDown={(event) => {
            if (
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                event.key,
              )
            )
              return;
            event.preventDefault();
            dispatch(actions.snapshot());
            dispatch(
              actions.setFreeCrop(
                resizeCrop(
                  crop,
                  corner,
                  event.key === "ArrowLeft"
                    ? -0.01
                    : event.key === "ArrowRight"
                      ? 0.01
                      : 0,
                  event.key === "ArrowUp"
                    ? -0.01
                    : event.key === "ArrowDown"
                      ? 0.01
                      : 0,
                ),
              ),
            );
          }}
        />
      ))}
    </div>
  );
}
