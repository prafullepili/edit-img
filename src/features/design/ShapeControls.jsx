import React from "react";
import SettingRange from "../../components/SettingRange";
const field = "w-full rounded border border-[#393a31] bg-[#22231e] p-2 text-xs";
export default function ShapeControls({ value, onChange }) {
  const g = {
    enabled: false,
    type: "linear",
    from: value.color,
    to: "#725cff",
    angle: 0,
    ...value.gradient,
  };
  const edit = (change) => onChange({ gradient: { ...g, ...change } });
  return (
    <fieldset className="space-y-3 rounded border border-[#393a31] p-3">
      <legend>Gradient & corners</legend>
      <label className="flex justify-between">
        Gradient fill
        <input
          aria-label="Enable gradient"
          type="checkbox"
          checked={g.enabled}
          onChange={(e) => edit({ enabled: e.target.checked })}
        />
      </label>
      {g.enabled && (
        <>
          <select
            aria-label="Gradient type"
            className={field}
            value={g.type}
            onChange={(e) => edit({ type: e.target.value })}
          >
            <option value="linear">Linear</option>
            <option value="radial">Radial</option>
          </select>
          <div className="flex justify-between">
            <label>
              Start{" "}
              <input
                aria-label="Gradient start color"
                type="color"
                value={g.from}
                onChange={(e) => edit({ from: e.target.value })}
              />
            </label>
            <label>
              End{" "}
              <input
                aria-label="Gradient end color"
                type="color"
                value={g.to}
                onChange={(e) => edit({ to: e.target.value })}
              />
            </label>
          </div>
          {g.type === "linear" && (
            <SettingRange
              label="Gradient angle"
              min={0}
              max={360}
              unit="°"
              value={g.angle}
              onChange={(angle) => edit({ angle })}
            />
          )}
        </>
      )}
      {value.type === "rectangle" && (
        <SettingRange
          label="Corner radius"
          min={0}
          max={500}
          unit="px"
          value={value.cornerRadius || 0}
          onChange={(cornerRadius) => onChange({ cornerRadius })}
        />
      )}
    </fieldset>
  );
}
