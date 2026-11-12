import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { actions } from "./store";
import SettingRange from "./components/SettingRange";
import TextSettings from "./features/design/TextSettings";
import { textPositionChanges } from "./features/design/textPosition";
import { textEditorValue, textLayerChanges } from "./features/design/styles";
import { isLayerLocked } from "./layerEditing";

const field =
  "w-full rounded-md border border-[#393a31] bg-[#22231e] px-3 py-2 text-xs text-[#eeeee5] focus:border-[#c8ef69]";
export default function AdvancedPanel({ type, dimensions }) {
  const dispatch = useDispatch();
  const e = useSelector((s) => s.editor);
  const selectedText = e.layers.find(
    (layer) => layer.id === e.selectedLayerId && layer.type === "text",
  );
  const value = selectedText
    ? textEditorValue(selectedText, dimensions.width)
    : {
        ...e.textLayer,
        textAlign: e.textLayer.textAlign || e.textLayer.position.split("-")[1],
      };
  const locked = selectedText && isLayerLocked(selectedText, e.layers);
  const update = (payload) => {
    if (locked) return;
    dispatch(actions.snapshot());
    dispatch(
      selectedText
        ? actions.updateLayer({
            id: selectedText.id,
            changes: textLayerChanges(payload, dimensions.width),
            aspect: dimensions.width / dimensions.height,
          })
        : actions.setTextLayer({ enabled: true, ...payload }),
    );
  };
  const resize = (key, value) => {
    const size = Math.max(1, Math.min(8192, Number(value) || 1));
    const width = e.outputWidth || dimensions.width,
      height = e.outputHeight || dimensions.height;
    dispatch(actions.snapshot());
    dispatch(
      actions.setDimensions(
        key === "width"
          ? {
              width: size,
              height: e.lockAspect
                ? Math.max(1, Math.round((size * height) / width))
                : height,
            }
          : {
              height: size,
              width: e.lockAspect
                ? Math.max(1, Math.round((size * width) / height))
                : width,
            },
      ),
    );
  };
  return (
    <div className="inspector-scroll">
      <div className="space-y-5 pt-5 text-xs">
        {type === "text" ? (
          <>
            {selectedText && (
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="truncate">Editing {selectedText.name}</span>
                <button
                  className="text-[#c8ef69]"
                  onClick={() => dispatch(actions.selectLayer(null))}
                >
                  Watermark
                </button>
              </div>
            )}
            {locked && (
              <p className="text-[10px] text-[#e3cc8e]">
                Unlock this layer in Layers to edit it.
              </p>
            )}
            <fieldset
              disabled={locked}
              className="space-y-4 disabled:opacity-40"
            >
              <TextSettings
                value={value}
                visible={
                  selectedText ? selectedText.visible : e.textLayer.enabled
                }
                onVisibilityChange={(visible) =>
                  update(selectedText ? { visible } : { enabled: visible })
                }
                onChange={update}
                onPosition={(vertical, horizontal) =>
                  update(
                    textPositionChanges(
                      selectedText,
                      e.layers,
                      vertical,
                      horizontal,
                      dimensions.width / dimensions.height,
                    ),
                  )
                }
              />
            </fieldset>
          </>
        ) : (
          <>
            <p className="text-[11px] leading-relaxed text-[#999b90]">
              Set the exact download dimensions. Leave both at original size to
              export the current crop at full resolution.
            </p>
            <div className="space-y-3">
              {["width", "height"].map((key) => (
                <SettingRange
                  key={key}
                  label={`Output ${key}`}
                  min={1}
                  max={8192}
                  unit="px"
                  value={
                    e[`output${key[0].toUpperCase() + key.slice(1)}`] ||
                    dimensions[key]
                  }
                  onChange={(number) => resize(key, number)}
                />
              ))}
            </div>
            <label className="flex items-center justify-between">
              <span>Lock aspect ratio</span>
              <input
                className="accent-[#c8ef69]"
                type="checkbox"
                checked={e.lockAspect}
                onChange={(x) =>
                  dispatch(actions.setLockAspect(x.target.checked))
                }
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[0.25, 0.5, 1].map((scale) => (
                <button
                  key={scale}
                  className="rounded border border-[#393a31] bg-[#22231e] py-3 hover:border-[#c8ef69]"
                  onClick={() => {
                    dispatch(actions.snapshot());
                    dispatch(
                      actions.setDimensions({
                        width: Math.round(dimensions.width * scale),
                        height: Math.round(dimensions.height * scale),
                      }),
                    );
                  }}
                >
                  {scale * 100}%
                </button>
              ))}
            </div>
            <button
              className="w-full rounded-md border border-[#687848] bg-[#29321f] py-3 text-[#d9edaa]"
              onClick={() =>
                dispatch(actions.setDimensions({ width: 0, height: 0 }))
              }
            >
              Use original crop dimensions
            </button>
            <p className="rounded-md border border-[#30372a] bg-[#1d2019] p-3 text-[10px] leading-relaxed text-[#a3af8d]">
              Resizing is applied during export. Your source image stays at its
              original resolution.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
