import React from "react";
import SettingRange from "./SettingRange";
export default function Slider({ item, value, onChange }) {
  const [key, label, min, max] = item;
  return (
    <SettingRange
      label={label}
      min={min}
      max={max}
      value={value}
      onChange={(number) => onChange(key, number)}
    />
  );
}
