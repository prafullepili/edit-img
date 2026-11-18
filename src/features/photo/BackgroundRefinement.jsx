import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { actions, store } from "../../store";
import { saveImage } from "../../imageStorage";
import { newId } from "../../ids";
import { loadBaseImage } from "./renderBase";
import { viewToSource, cropBounds } from "./geometry";
import { createLiveBrush } from "./liveBrush";
export default function BackgroundRefinement({ editor, settings, announce }) {
  const canvas = useRef(null),
    source = useRef(null),
    original = useRef(null),
    stroke = useRef(null),
    backup = useRef(null);
  const [ready, setReady] = useState(false);
  const dispatch = useDispatch();
  const redraw = () => {
    const target = canvas.current,
      base = source.current;
    if (!target || !base) return;
    const swap = editor.rotation % 180 !== 0;
    const rotated = document.createElement("canvas");
    rotated.width = swap ? base.height : base.width;
    rotated.height = swap ? base.width : base.height;
    const ctx = rotated.getContext("2d");
    ctx.translate(rotated.width / 2, rotated.height / 2);
    ctx.rotate((editor.rotation * Math.PI) / 180);
    ctx.scale(editor.flipX ? -1 : 1, editor.flipY ? -1 : 1);
    ctx.drawImage(base, -base.width / 2, -base.height / 2);
    target.style.background =
      "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 / 12px 12px";
    const crop = cropBounds(rotated.width, rotated.height, editor);
    target.width = Math.max(1, Math.round(crop.width));
    target.height = Math.max(1, Math.round(crop.height));
    target
      .getContext("2d")
      .drawImage(
        rotated,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        target.width,
        target.height,
      );
  };
  useEffect(() => {
    let active = true;
    setReady(false);
    Promise.all([
      loadBaseImage(editor),
      loadBaseImage({ ...editor, baseAssetId: null }),
    ])
      .then(([base, full]) => {
        if (!active) return;
        const make = (image) => {
          const c = document.createElement("canvas");
          const scale = Math.min(
            1,
            4096 / Math.max(base.naturalWidth, base.naturalHeight),
          );
          c.width = Math.round(base.naturalWidth * scale);
          c.height = Math.round(base.naturalHeight * scale);
          c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
          return c;
        };
        source.current = make(base);
        original.current = make(full);
        setReady(true);
      })
      .catch(() => {
        if (active) announce("Could not load refinement image.");
      });
    return () => {
      active = false;
    };
  }, [editor.baseAssetId, editor.imageUrl]);
  const point = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const p = viewToSource(
      {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      },
      editor,
      source.current.width,
      source.current.height,
    );
    return { x: p.x * source.current.width, y: p.y * source.current.height };
  };
  return (
    <canvas
      ref={canvas}
      aria-label="Background refinement brush"
      className="absolute inset-0 h-full w-full"
      style={{
        zIndex: 30,
        touchAction: "none",
        cursor: ready ? "crosshair" : "wait",
        background: stroke.current
          ? "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 / 12px 12px"
          : "transparent",
      }}
      onPointerDown={(event) => {
        if (!ready || stroke.current || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        backup.current = document.createElement("canvas");
        backup.current.width = source.current.width;
        backup.current.height = source.current.height;
        backup.current.getContext("2d").drawImage(source.current, 0, 0);
        const p = point(event);
        stroke.current = createLiveBrush(source.current.getContext("2d"), {
          radius: Math.max(
            1,
            ((settings.refineSize || 20) * source.current.width) / 1000,
          ),
          color: "#ffffff",
          hardness: (settings.refineHardness ?? 50) / 100,
          opacity: 1,
          tool: settings.refineMode === "restore" ? "heal" : "eraser",
          sampleCanvas: original.current,
          sourcePoint: p,
        });
        stroke.current.start(p);
        redraw();
      }}
      onPointerMove={(event) => {
        if (stroke.current) {
          stroke.current.move(point(event));
          redraw();
        }
      }}
      onPointerCancel={() => {
        stroke.current = null;
        if (backup.current) source.current = backup.current;
        canvas.current
          .getContext("2d")
          .clearRect(0, 0, canvas.current.width, canvas.current.height);
        canvas.current.style.background = "transparent";
        setReady(true);
      }}
      onPointerUp={async (event) => {
        if (!stroke.current) return;
        stroke.current.move(point(event));
        stroke.current = null;
        setReady(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
        try {
          const blob = await new Promise((resolve) =>
            source.current.toBlob(resolve, "image/png"),
          );
          if (!blob) throw new Error("Encoding failed");
          const id = `${editor.projectId}:layer:refined-${newId()}`;
          await saveImage(blob, id);
          const current = store.getState().editor;
          if (
            current.projectId === editor.projectId &&
            current.baseAssetId === editor.baseAssetId
          ) {
            dispatch(actions.snapshot());
            dispatch(actions.setBaseAsset(id));
            announce("Background refined. Undo restores the previous result.");
          }
        } catch {
          announce("Could not save refinement. Try again.");
          setReady(true);
        }
        if (canvas.current) canvas.current.style.background = "transparent";
        canvas.current
          ?.getContext("2d")
          .clearRect(0, 0, canvas.current.width, canvas.current.height);
      }}
    />
  );
}
