import React, { useEffect, useId, useRef, useState } from "react";
import { createSliderGesture, sliderGestureValue } from "./sliderGesture";
import { createFrameValueEmitter } from "./frameValueEmitter";
export default function SettingRange({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  onStart,
  info,
}) {
  const id = useId();
  const focused = useRef(false);
  const touchGesture = useRef(null);
  const nativeDragging = useRef(false);
  const [sliderValue, setSliderValue] = useState(value);
  const callback = useRef(onChange);
  callback.current = onChange;
  const emitter = useRef(null);
  if (!emitter.current)
    emitter.current = createFrameValueEmitter((number) =>
      callback.current(number),
    );
  useEffect(() => () => emitter.current.dispose(), []);
  const queueValue = (number) => {
    setSliderValue(number);
    if (!focused.current) setDraft(String(Math.round(number * 100) / 100));
    emitter.current.queue(number);
  };
  const applyGesture = (event, ending = false) => {
    const gesture = touchGesture.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const next = sliderGestureValue(
      gesture,
      event.clientX,
      event.clientY,
      ending,
    );
    if (gesture.axis === "horizontal" && !ending) {
      if (event.cancelable) event.preventDefault();
      if (!event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (next === null || next === gesture.last) return;
    if (!gesture.started) {
      onStart?.();
      gesture.started = true;
    }
    gesture.last = next;
    queueValue(next);
  };
  const [draft, setDraft] = useState(String(value));
  const normalize = (raw) =>
    Math.max(min, Math.min(max, Math.round(Number(raw) / step) * step));
  useEffect(() => {
    if (!touchGesture.current && !nativeDragging.current) {
      setSliderValue(value);
      if (!focused.current) setDraft(String(Math.round(value * 100) / 100));
    }
  }, [value]);
  return (
    <div className="setting-range">
      <div className="setting-range-heading">
        <span className="flex items-center gap-1.5">
          <label htmlFor={id}>{label}</label>
          {info}
        </span>
        <span className="opacity-value setting-range-value">
          <input
            className="opacity-value-input"
            aria-label={`${label} value`}
            type="number"
            inputMode={step < 1 ? "decimal" : "numeric"}
            min={min}
            max={max}
            step={step}
            value={draft}
            onFocus={() => {
              focused.current = true;
              onStart?.();
            }}
            onChange={(event) => {
              const raw = event.target.value;
              setDraft(raw);
              if (raw !== "" && Number.isFinite(Number(raw)))
                queueValue(normalize(raw));
            }}
            onBlur={() => {
              emitter.current.flush();
              focused.current = false;
              setDraft(String(Math.round(sliderValue * 100) / 100));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          {unit && <span aria-hidden="true">{unit}</span>}
        </span>
      </div>
      <div className="setting-range-track">
        <input
          id={id}
          aria-label={label}
          className="setting-range-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          onPointerDown={() => {
            nativeDragging.current = true;
            onStart?.();
          }}
          onPointerUp={() => {
            emitter.current.flush();
            nativeDragging.current = false;
          }}
          onPointerCancel={() => {
            emitter.current.flush();
            nativeDragging.current = false;
          }}
          onKeyDown={(event) => {
            if (
              !event.repeat &&
              [
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End",
                "PageUp",
                "PageDown",
              ].includes(event.key)
            ) {
              nativeDragging.current = true;
              onStart?.();
            }
          }}
          onKeyUp={() => {
            emitter.current.flush();
            nativeDragging.current = false;
          }}
          onBlur={() => {
            emitter.current.flush();
            nativeDragging.current = false;
          }}
          onChange={(event) => queueValue(normalize(event.target.value))}
        />
        <div
          className="setting-range-touch-surface"
          aria-hidden="true"
          onPointerDown={(event) => {
            if (
              event.isPrimary === false ||
              (event.pointerType === "mouse" && event.button !== 0)
            )
              return;
            const rect = event.currentTarget.getBoundingClientRect();
            touchGesture.current = {
              ...createSliderGesture({
                x: event.clientX,
                y: event.clientY,
                left: rect.left,
                width: rect.width,
                min,
                max,
                step,
                value: sliderValue,
                pointerType: event.pointerType,
              }),
              pointerId: event.pointerId,
            };
            // Leave vertical scrolling to the browser; do not change a value on touch-down.
            if (event.pointerType === "mouse") applyGesture(event);
          }}
          onPointerMove={(event) => applyGesture(event)}
          onPointerUp={(event) => {
            if (
              !touchGesture.current ||
              touchGesture.current.pointerId !== event.pointerId
            )
              return;
            applyGesture(event, true);
            emitter.current.flush();
            touchGesture.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (touchGesture.current?.pointerId === event.pointerId) {
              emitter.current.flush();
              touchGesture.current = null;
            }
          }}
          onLostPointerCapture={(event) => {
            if (touchGesture.current?.pointerId === event.pointerId) {
              emitter.current.flush();
              touchGesture.current = null;
            }
          }}
        />
      </div>
    </div>
  );
}
