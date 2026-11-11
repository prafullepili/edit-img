import React from "react";
import SettingRange from "../../components/SettingRange";
import { fontFamilies, textStyle } from "./styles";
const field = "w-full rounded border border-[#393a31] bg-[#22231e] p-2 text-xs";
export default function TextControls({
  value,
  onChange,
  showAlignment = true,
}) {
  const s = textStyle(value);
  return (
    <fieldset className="space-y-3 rounded border border-[#393a31] p-3">
      <legend>Typography & effects</legend>
      <label className="block space-y-1">
        Font family
        <select
          aria-label="Font family"
          className={field}
          value={s.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
        >
          {fontFamilies.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        Font weight
        <select
          aria-label="Font weight"
          className={field}
          value={s.fontWeight}
          onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
        >
          {[400, 500, 600, 700, 800].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-3">
        {[
          ["letterSpacing", "Letter spacing", -5, 50, 0.5, "px"],
          ["lineHeight", "Line spacing", 0.7, 3, 0.1, "×"],
          ["outlineWidth", "Outline width", 0, 30, 0.5, "px"],
          ["blur", "Text blur", 0, 30, 0.5, "px"],
        ].map(([key, label, min, max, step, unit]) => (
          <SettingRange
            key={key}
            label={label}
            value={s[key]}
            min={min}
            max={max}
            step={step}
            unit={unit}
            onChange={(number) => onChange({ [key]: number })}
          />
        ))}
      </div>
      {showAlignment && (
        <TextAlignmentControl value={value} onChange={onChange} />
      )}
      <label className="flex justify-between">
        Outline color
        <input
          aria-label="Text outline color"
          type="color"
          value={s.outlineColor}
          onChange={(e) => onChange({ outlineColor: e.target.value })}
        />
      </label>
      <label className="flex justify-between">
        Shadow
        <input
          aria-label="Enable text shadow"
          type="checkbox"
          checked={s.shadow}
          onChange={(e) => onChange({ shadow: e.target.checked })}
        />
      </label>
      <div className="grid grid-cols-2 items-end gap-2">
        <label className="block space-y-1">
          <span>Shadow color</span>
          <input
            aria-label="Shadow color"
            className="block"
            type="color"
            disabled={!s.shadow}
            value={s.shadowColor}
            onChange={(event) => onChange({ shadowColor: event.target.value })}
          />
        </label>
        <label className="block space-y-1">
          <span>Blend mode</span>
          <select
            aria-label="Text blend mode"
            className={field}
            value={s.blend || "normal"}
            onChange={(event) => onChange({ blend: event.target.value })}
          >
            {[
              "normal",
              "multiply",
              "screen",
              "overlay",
              "darken",
              "lighten",
            ].map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </select>
        </label>
      </div>
      {s.shadow && (
        <>
          <div className="space-y-3">
            {[
              ["shadowOpacity", "Shadow opacity", 0, 100, "%"],
              ["shadowBlur", "Shadow blur", 0, 100, "px"],
              ["shadowX", "Shadow X", -100, 100, "px"],
              ["shadowY", "Shadow Y", -100, 100, "px"],
            ].map(([key, label, min, max, unit]) => (
              <SettingRange
                key={key}
                label={label}
                value={s[key]}
                min={min}
                max={max}
                unit={unit}
                onChange={(number) => onChange({ [key]: number })}
              />
            ))}
          </div>
        </>
      )}
    </fieldset>
  );
}

export function TextAlignmentControl({ value, onChange }) {
  return (
    <label className="block space-y-1">
      Text alignment
      <select
        aria-label="Text alignment"
        className={field}
        value={textStyle(value).textAlign}
        onChange={(e) => onChange({ textAlign: e.target.value })}
      >
        {["left", "center", "right"].map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
    </label>
  );
}
