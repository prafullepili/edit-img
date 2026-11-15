import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { actions } from "../../store";
import Icon from "../../components/Icon";
import { newId } from "../../ids.js";
import { controlGroups, presets } from "./editorData";
const CUSTOM_LOOKS_KEY = "luma-studio-custom-looks-v1";
const adjustmentKeys = controlGroups.flatMap((group) =>
  group.controls.map(([key]) => key),
);

function readCustomLooks() {
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOM_LOOKS_KEY));
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(
        (look) =>
          look && typeof look.id === "string" && typeof look.name === "string",
      )
      .map((look) => ({
        id: look.id,
        name: look.name.slice(0, 36),
        values: Object.fromEntries(
          adjustmentKeys
            .filter((key) => Number.isFinite(Number(look.values?.[key])))
            .map((key) => [key, Number(look.values[key])]),
        ),
      }))
      .slice(0, 40);
  } catch {
    return [];
  }
}

export default function PresetsPanel({ editor, applyPreset }) {
  const dispatch = useDispatch();
  const [customLooks, setCustomLooks] = useState(readCustomLooks);
  const [lookName, setLookName] = useState("");
  const [feedback, setFeedback] = useState("");
  const hasPhoto = Boolean(
    editor.imageUrl || editor.baseAssetId || editor.isUploaded,
  );
  const saveCustomLooks = (next) => {
    try {
      localStorage.setItem(CUSTOM_LOOKS_KEY, JSON.stringify(next));
      setCustomLooks(next);
      return true;
    } catch {
      setFeedback("Could not save this look in browser storage.");
      return false;
    }
  };
  const saveLook = (event) => {
    event.preventDefault();
    const name = lookName.trim().slice(0, 36);
    if (!name || !hasPhoto) return;
    const look = {
      id: newId(),
      name,
      values: { ...editor.adjustments },
    };
    if (saveCustomLooks([look, ...customLooks].slice(0, 40))) {
      setLookName("");
      setFeedback(`Saved “${name}”.`);
    }
  };
  return (
    <div className="inspector-scroll looks-panel">
      <p className="panel-description">
        A considered starting point. Every look can be fine tuned after you
        apply it.
      </p>
      <form className="custom-look-form" onSubmit={saveLook}>
        <label htmlFor="custom-look-name">My looks</label>
        <p>Save the current adjustments to reuse on another photo.</p>
        <div>
          <input
            id="custom-look-name"
            value={lookName}
            onChange={(event) => setLookName(event.target.value)}
            maxLength={36}
            placeholder="Name this look"
            disabled={!hasPhoto}
          />
          <button type="submit" disabled={!hasPhoto || !lookName.trim()}>
            Save
          </button>
        </div>
      </form>
      {feedback && (
        <p className="custom-look-feedback" role="status">
          {feedback}
        </p>
      )}
      {customLooks.length > 0 && (
        <div className="custom-look-list" aria-label="Saved custom looks">
          {customLooks.map((look) => (
            <div className="custom-look-card" key={look.id}>
              <button
                type="button"
                className={`custom-look-apply ${editor.preset === `My look · ${look.name}` ? "selected" : ""}`}
                disabled={!hasPhoto}
                onClick={() =>
                  applyPreset({
                    name: `My look · ${look.name}`,
                    values: look.values,
                  })
                }
              >
                <span
                  className="custom-look-swatch"
                  style={{
                    backgroundImage: `url(${editor.imageUrl})`,
                    filter: `saturate(${1 + (look.values.saturation || 0) / 100}) sepia(${Math.max(0, (look.values.temperature || 0) / 200)}) contrast(${1 + (look.values.contrast || 0) / 150})`,
                  }}
                />
                <span>{look.name}</span>
                {editor.preset === `My look · ${look.name}` && (
                  <span className="preset-check">
                    <Icon name="check" size={12} />
                  </span>
                )}
              </button>
              <button
                type="button"
                className="custom-look-delete"
                aria-label={`Delete ${look.name} look`}
                title={`Delete ${look.name}`}
                onClick={() => {
                  const next = customLooks.filter(
                    (item) => item.id !== look.id,
                  );
                  if (saveCustomLooks(next))
                    setFeedback(`Deleted “${look.name}”.`);
                }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <h2 className="built-in-looks-heading">Built-in looks</h2>
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
