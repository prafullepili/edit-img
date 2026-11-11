import React from "react";
import { useDispatch } from "react-redux";
import { actions } from "../../store";
import Icon from "../../components/Icon";
import Slider from "../../components/Slider";
import { controlGroups, presets } from "./editorData";
export default function PresetsPanel({ editor, applyPreset }) {
  const dispatch = useDispatch();
  const saveSnapshot = () => dispatch(actions.snapshot());
  return (
    <div className="inspector-scroll looks-panel">
      <p className="panel-description">
        A considered starting point. Every look can be fine tuned after you
        apply it.
      </p>
      <div className="preset-list">
        {presets.map((preset, index) => (
          <button
            key={preset.name}
            className={`preset-card ${editor.preset === preset.name ? "selected" : ""}`}
            onClick={() => applyPreset(preset)}
          >
            <span
              className={`preset-swatch swatch-${index}`}
              style={{
                backgroundImage: `url(${editor.imageUrl})`,
                filter:
                  preset.values.saturation === -100
                    ? "grayscale(1) contrast(1.15)"
                    : `saturate(${1 + (preset.values.saturation || 0) / 100}) sepia(${Math.max(0, (preset.values.temperature || 0) / 200)}) contrast(${1 + (preset.values.contrast || 0) / 150})`,
              }}
            />
            <span className="preset-name">{preset.label}</span>
            {editor.preset === preset.name && (
              <span className="preset-check">
                <Icon name="check" size={12} />
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        className="refine-button"
        onClick={() => dispatch(actions.setTool("adjust"))}
      >
        <Icon name="sliders" size={15} /> Fine tune adjustments{" "}
        <Icon name="arrow" size={14} />
      </button>
    </div>
  );
}
