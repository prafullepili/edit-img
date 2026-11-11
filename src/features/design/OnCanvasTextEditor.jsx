import React, { useLayoutEffect, useRef, useState } from "react";
import { textStyle } from "./styles";
export default function OnCanvasTextEditor({ value, onSave, onCancel }) {
  const [draft, setDraft] = useState(value.text || "");
  const input = useRef(null);
  const s = textStyle(value);
  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, []);
  return (
    <div
      className="on-canvas-text-editor"
      role="group"
      aria-label="Edit text on image"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <textarea
        ref={input}
        aria-label="Edit text on image"
        rows="3"
        maxLength="2000"
        value={draft}
        spellCheck="true"
        style={{
          fontFamily: s.fontFamily,
          fontWeight: s.fontWeight,
          textAlign: s.textAlign,
          lineHeight: s.lineHeight,
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            onSave(draft);
          }
        }}
      />
      <div className="on-canvas-text-actions">
        <span>Edit text</span>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="text-edit-done"
          onClick={() => onSave(draft)}
        >
          Done
        </button>
      </div>
    </div>
  );
}
