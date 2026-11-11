import { newId } from "../../ids.js";
import React, { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { actions } from "../../store";
import { viewToSource, sourceToView, cropBounds } from "./geometry";
import { createLiveBrush } from "./liveBrush";
export default function RetouchCanvas({
  editor,
  settings,
  setSettings,
  sourceWidth,
  sourceHeight,
  announce,
  previewImageRef,
  renderedPhoto,
  previewUrl,
  sampleCanvas,
}) {
  const dispatch = useDispatch();
  const gesture = useRef(null),
    overlay = useRef(null),
    painter = useRef(null),
    pending = useRef(new Set());
  const activeOverlay = useRef(false);
  const clearOverlay = () => {
    activeOverlay.current = false;
    if (overlay.current) overlay.current.style.visibility = "hidden";
    if (previewImageRef.current) previewImageRef.current.style.visibility = "";
  };
  useEffect(
    () => () => {
      if (previewImageRef.current)
        previewImageRef.current.style.visibility = "";
    },
    [previewImageRef],
  );
  useEffect(() => {
    const image = previewImageRef.current;
    const reveal = () => {
      if (gesture.current || !activeOverlay.current) return;
      if (
        [...pending.current].some(
          (id) => !editor.photo.strokes.some((stroke) => stroke.id === id),
        )
      ) {
        pending.current.clear();
        clearOverlay();
        return;
      }
      if (
        image?.complete &&
        image.naturalWidth &&
        image.src === previewUrl &&
        [...pending.current].every((id) =>
          renderedPhoto?.strokes.some((stroke) => stroke.id === id),
        )
      ) {
        pending.current.clear();
        clearOverlay();
      }
    };
    reveal();
    image?.addEventListener("load", reveal);
    return () => image?.removeEventListener("load", reveal);
  }, [renderedPhoto, previewUrl, editor.photo.strokes]);
  const point = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };
  const source = (p) => viewToSource(p, editor, sourceWidth, sourceHeight);
  const pixelPoint = (p) => ({
    x: p.x * overlay.current.width,
    y: p.y * overlay.current.height,
  });
  const append = (p) => {
    const g = gesture.current;
    if (!g) return;
    const mapped = source(p),
      last = g.points.at(-1);
    if (mapped.x === last.x && mapped.y === last.y) return;
    g.points.push(mapped);
    painter.current?.move(pixelPoint(p));
  };
  const finish = (event, cancel = false) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    if (cancel) {
      pending.current.clear();
      clearOverlay();
    } else {
      if (painter.current) pending.current.add(g.id);
      dispatch(actions.snapshot());
      dispatch(actions.addStroke(g));
    }
    painter.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <div
      className="retouch-canvas"
      aria-label="Photo retouch canvas"
      style={{ cursor: "crosshair" }}
      onPointerDown={(event) => {
        if (event.button !== 0 || gesture.current) return;
        event.preventDefault();
        const p = point(event);
        if (settings.picking || event.altKey) {
          setSettings({ ...settings, source: source(p), picking: false });
          announce("Healing source selected. Paint over the area to repair.");
          return;
        }
        if (settings.tool === "heal" && !settings.source) {
          announce("Choose a healing source first, or Alt-click the photo.");
          return;
        }
        const image = previewImageRef.current;
        if (!image?.complete || !image.naturalWidth) {
          announce("Wait for the photo to load.");
          return;
        }
        gesture.current = {
          id: newId(),
          tool: settings.tool,
          color: settings.color,
          opacity: settings.opacity / 100,
          hardness: settings.hardness / 100,
          radius: settings.size / 2 / sourceWidth,
          source: settings.source,
          points: [source(p)],
        };
        {
          const canvas = overlay.current;
          if (!activeOverlay.current) {
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            canvas.getContext("2d").drawImage(image, 0, 0);
            activeOverlay.current = true;
          }
          canvas.style.visibility = "visible";
          image.style.visibility = "hidden";
          const swap = editor.rotation % 180 !== 0;
          const crop = cropBounds(
            swap ? sourceHeight : sourceWidth,
            swap ? sourceWidth : sourceHeight,
            editor,
          );
          const radius = Math.max(
            1,
            ((settings.size / 2) * canvas.width) / crop.width,
          );
          let healing = {};
          if (settings.tool === "heal") {
            const snapshot = document.createElement("canvas");
            const fullSource = sampleCanvas || canvas;
            snapshot.width = fullSource.width;
            snapshot.height = fullSource.height;
            const sc = snapshot.getContext("2d");
            sc.drawImage(fullSource, 0, 0);
            // Include any completed strokes whose background render is still pending.
            const orientedWidth = swap ? sourceHeight : sourceWidth;
            const sampleRatio = sampleCanvas
              ? snapshot.width / orientedWidth
              : canvas.width / crop.width;
            if (sampleCanvas) {
              const rect = cropBounds(snapshot.width, snapshot.height, editor);
              sc.clearRect(rect.x, rect.y, rect.width, rect.height);
              sc.drawImage(canvas, rect.x, rect.y, rect.width, rect.height);
            }
            const sampleView = sourceToView(
              settings.source,
              sampleCanvas
                ? { ...editor, freeCrop: null, cropRatio: "Original" }
                : editor,
              sourceWidth,
              sourceHeight,
            );
            healing = {
              sampleCanvas: snapshot,
              sourcePoint: {
                x: sampleView.x * snapshot.width,
                y: sampleView.y * snapshot.height,
              },
              sampleScale: sampleRatio / (canvas.width / crop.width),
            };
          }
          painter.current = createLiveBrush(canvas.getContext("2d"), {
            radius,
            color: settings.color,
            opacity: settings.opacity / 100,
            hardness: settings.hardness / 100,
            tool: settings.tool,
            ...healing,
          });
          painter.current.start(pixelPoint(p));
        }
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!gesture.current) return;
        const samples = event.nativeEvent.getCoalescedEvents?.() || [];
        if (samples.length)
          for (const sample of samples)
            append(
              point({
                ...sample,
                clientX: sample.clientX,
                clientY: sample.clientY,
                currentTarget: event.currentTarget,
              }),
            );
        else append(point(event));
      }}
      onPointerUp={(event) => {
        if (gesture.current) append(point(event));
        finish(event);
      }}
      onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => {
        if (gesture.current) finish(event, true);
      }}
    >
      <canvas
        ref={overlay}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          visibility: "hidden",
          pointerEvents: "none",
          opacity: editor.baseVisible ? editor.baseOpacity / 100 : 0,
        }}
      />
    </div>
  );
}
