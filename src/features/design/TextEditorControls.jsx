import React from "react";
import TextControls from "./TextControls";
import SettingRange from "../../components/SettingRange";
const field = "w-full rounded border border-[#393a31] bg-[#22231e] p-2 text-xs";
export default function TextEditorControls({
  value,
  onChange,
  showAlignment = true,
  showOpacity = true,
}) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        Text content
        <textarea
          aria-label="Text content"
          className={field}
          rows="3"
          maxLength="2000"
          value={value.text}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          Text color
          <input
            aria-label="Text color"
            type="color"
            value={value.color}
            onChange={(event) => onChange({ color: event.target.value })}
          />
        </label>
      </div>
      <SettingRange
        label="Text size"
        value={value.size}
        min={4}
        max={600}
        unit="px"
        onChange={(size) => onChange({ size })}
      />
      {showOpacity && (
        <SettingRange
          label="Text opacity"
          value={value.opacity}
          min={0}
          max={100}
          unit="%"
          onChange={(opacity) => onChange({ opacity })}
        />
      )}
      <TextControls
        value={value}
        onChange={onChange}
        showAlignment={showAlignment}
      />
    </div>
  );
}
