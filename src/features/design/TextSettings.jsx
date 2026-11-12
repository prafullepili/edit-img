import React from "react";
import TextEditorControls from "./TextEditorControls";
import { TextAlignmentControl } from "./TextControls";
export default function TextSettings({
  value,
  visible,
  onVisibilityChange,
  onChange,
  onPosition,
}) {
  return (
    <div className="space-y-4 text-xs">
      <p className="text-[11px] leading-relaxed text-[#999b90]">
        Drag text on the photo to move it. Double-tap it, or tap Edit text on
        the photo, to type directly.
      </p>
      <label className="flex items-center justify-between">
        <span>Show text layer</span>
        <input
          aria-label="Show text layer"
          type="checkbox"
          checked={visible}
          onChange={(event) => onVisibilityChange(event.target.checked)}
          className="accent-[#c8ef69]"
        />
      </label>
      <TextEditorControls
        value={value}
        onChange={onChange}
        showAlignment={false}
      />
      <div>
        <p className="mb-2 text-[#999b90]">Position</p>
        <div className="grid grid-cols-3 gap-2">
          {["top", "middle", "bottom"].flatMap((vertical) =>
            ["left", "center", "right"].map((horizontal) => (
              <button
                key={`${vertical}-${horizontal}`}
                aria-label={`${vertical} ${horizontal}`}
                className={`h-9 rounded border text-xs ${value.position === `${vertical}-${horizontal}` ? "border-[#c8ef69] bg-[#303923] text-[#c8ef69]" : "border-[#393a31] bg-[#22231e]"}`}
                onClick={() => onPosition(vertical, horizontal)}
              >
                ↗
              </button>
            )),
          )}
        </div>
      </div>
      <TextAlignmentControl value={value} onChange={onChange} />
    </div>
  );
}
