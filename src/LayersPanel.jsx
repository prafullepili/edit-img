import { requestLayerDeletion } from "./features/editor/layerDeletion";
import { newId } from "./ids.js";
import React, { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { actions, store } from "./store";
import { saveImage } from "./imageStorage";
import { layerDefaults, getLayerScale } from "./layers";
import TextEditorControls from "./features/design/TextEditorControls";
import { textEditorValue, textLayerChanges } from "./features/design/styles";
import ShapeControls from "./features/design/ShapeControls";
import ShapePicker from "./features/design/ShapePicker";
import { isShape } from "./features/design/shapeGeometry";
import Icon from "./components/Icon";
import SettingRange from "./components/SettingRange";
import AlignmentIcon, {
  alignmentLabels,
} from "./features/design/AlignmentIcon";
import { isLayerLocked, alignSelection } from "./layerEditing";

const inputClass =
  "w-full rounded border border-[#393a31] bg-[#22231e] px-2 py-2 text-[11px] text-[#eeeee5]";
const buttonClass =
  "rounded border border-[#393a31] bg-[#22231e] px-2 py-2 text-[10px] hover:border-[#c8ef69] disabled:opacity-30";
export default function LayersPanel({ dimensions, announce }) {
  const e = useSelector((s) => s.editor),
    dispatch = useDispatch(),
    file = useRef(null);
  const [adding, setAdding] = useState(false);
  const [checked, setChecked] = useState([]);
  const [renamingId, setRenamingId] = useState(null);
  const dragId = useRef(null);
  const [dropTarget, setDropTarget] = useState(null);
  const candidates = e.layers.filter((l) => checked.includes(l.id));
  const selected = e.layers.find((l) => l.id === e.selectedLayerId);
  const locked = isLayerLocked(selected, e.layers);
  const mask = {
    enabled: false,
    type: "rectangle",
    x: 10,
    y: 10,
    width: 80,
    height: 80,
    inverted: false,
    ...selected?.mask,
  };
  const editMask = (changes) =>
    edit(selected.id, { mask: { ...mask, ...changes } });
  const edit = (id, changes) => {
    if (
      isLayerLocked(
        e.layers.find((l) => l.id === id),
        e.layers,
      )
    )
      return;
    dispatch(actions.snapshot());
    dispatch(
      actions.updateLayer({
        id,
        changes,
        aspect: dimensions.width / dimensions.height,
      }),
    );
  };
  const setOpacity = (value) => {
    if (selected && locked) return;
    const opacity = Math.max(0, Math.min(100, Number(value) || 0));
    dispatch(
      selected
        ? actions.updateLayer({ id: selected.id, changes: { opacity } })
        : actions.setBase({ opacity }),
    );
  };
  const zoom = selected ? Math.round(getLayerScale(selected) * 100) : 100;
  const setZoom = (value) =>
    edit(selected.id, {
      scale: Math.max(10, Math.min(400, Number(value) || 100)) / 100,
    });
  const add = (type, extra = {}) => {
    dispatch(actions.snapshot());
    dispatch(
      actions.addLayer({
        ...layerDefaults,
        id: newId(),
        type,
        name: `${type[0].toUpperCase() + type.slice(1)} ${e.layers.length + 1}`,
        color: type === "text" ? "#ffffff" : layerDefaults.color,
        size:
          type === "text" ? (44 / dimensions.width) * 100 : layerDefaults.size,
        text: "Your text",
        ...extra,
      }),
    );
  };
  const addImage = async (event) => {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image) return;
    if (!image.type.startsWith("image/") || image.size > 24 * 1024 * 1024)
      return announce("Choose an image smaller than 24 MB.");
    const projectId = e.projectId,
      id = newId(),
      assetId = `${projectId}:layer:${id}`;
    setAdding(true);
    let url;
    try {
      url = URL.createObjectURL(image);
      const img = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      await saveImage(image, assetId);
      if (store.getState().editor.projectId !== projectId) return;
      const width = Math.min(
        45,
        (45 * img.naturalWidth) /
          img.naturalHeight /
          (dimensions.width / dimensions.height),
      );
      const height =
        (((width * dimensions.width) / dimensions.height) * img.naturalHeight) /
        img.naturalWidth;
      add("image", { assetId, name: image.name, width, height });
    } catch {
      announce("This layer could not be loaded or saved. Try another image.");
    } finally {
      if (url) URL.revokeObjectURL(url);
      setAdding(false);
    }
  };
  const group = () => {
    dispatch(actions.snapshot());
    dispatch(
      actions.groupLayers({
        ids: candidates.map((l) => l.id),
        id: newId(),
        name: "Group",
      }),
    );
    setChecked([]);
  };
  return (
    <div className="inspector-scroll layers-panel">
      <div className="space-y-4 text-[11px]">
        <p
          className="text-[9px] leading-snug text-[#989c8e]"
          title="Layers at the top appear in front. Drag the grip to reorder layers. On the canvas, drag a layer to move it or use its handles to resize and rotate."
        >
          Drag to reorder · Top layers appear in front
        </p>
        <div
          className="relative flex items-center gap-2"
          aria-label="Add layer"
        >
          <button
            className="flex h-9 w-10 items-center justify-center rounded border border-[#393a31] bg-[#22231e] hover:border-[#c8ef69] disabled:opacity-30"
            title={adding ? "Adding image…" : "Add image"}
            aria-label="Add image layer"
            onClick={() => file.current.click()}
            disabled={adding}
          >
            <Icon name="image" size={18} />
          </button>
          <button
            className="flex h-9 w-10 items-center justify-center rounded border border-[#393a31] bg-[#22231e] hover:border-[#c8ef69]"
            title="Add text"
            aria-label="Add text layer"
            onClick={() => add("text")}
          >
            <Icon name="text" size={18} />
          </button>
          <ShapePicker onAdd={(type) => add(type)} />
        </div>
        <div className="space-y-2 rounded border border-[#393a31] p-2">
          <p className="text-[10px] text-[#a4a894]">
            Check two or more ungrouped layers to group them.
          </p>
          <div className="flex gap-2">
            <button
              className={buttonClass}
              disabled={
                candidates.length < 2 ||
                candidates.some((l) => l.groupId || l.locked)
              }
              onClick={group}
            >
              Group selected ({candidates.length})
            </button>
            <button
              className={buttonClass}
              disabled={!selected?.groupId || locked}
              onClick={() => {
                dispatch(actions.snapshot());
                dispatch(actions.ungroupLayers(selected.groupId));
              }}
            >
              Ungroup
            </button>
          </div>
          <label className="flex items-center justify-between">
            Snap to guides
            <input
              type="checkbox"
              checked={e.snapEnabled}
              className="accent-[#c8ef69]"
              onChange={(event) =>
                dispatch(actions.setSnap(event.target.checked))
              }
            />
          </label>
          <p className="text-[9px] text-[#a4a894]">
            Hold Alt while dragging to bypass snapping.
          </p>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={addImage}
        />
        <div className="layer-card-list">
          {[...e.layers].reverse().map((layer, index) => (
            <div
              key={layer.id}
              className={`layer-card ${selected?.id === layer.id ? "is-selected" : ""}`}
              onClick={(event) => {
                if (!event.target.closest("button, input"))
                  dispatch(actions.selectLayer(layer.id));
              }}
              onDragOver={(event) => {
                if (!dragId.current) return;
                event.preventDefault();
                event.stopPropagation();
                const bounds = event.currentTarget.getBoundingClientRect();
                const position =
                  event.clientY < bounds.top + bounds.height / 2
                    ? "before"
                    : "after";
                const source = e.layers.find(
                  (item) => item.id === dragId.current,
                );
                if (
                  isLayerLocked(layer, e.layers) ||
                  source?.id === layer.id ||
                  (source?.groupId && source.groupId === layer.groupId)
                ) {
                  event.dataTransfer.dropEffect = "none";
                  setDropTarget(null);
                  return;
                }
                event.dataTransfer.dropEffect = "move";
                setDropTarget({ id: layer.id, position });
              }}
              onDrop={(event) => {
                if (!dragId.current) return;
                event.preventDefault();
                event.stopPropagation();
                if (dropTarget?.id === layer.id) {
                  dispatch(actions.snapshot());
                  dispatch(
                    actions.reorderLayer({
                      id: dragId.current,
                      targetId: layer.id,
                      position: dropTarget.position,
                    }),
                  );
                }
                dragId.current = null;
                setDropTarget(null);
              }}
            >
              {dropTarget?.id === layer.id && (
                <span
                  className={`pointer-events-none absolute inset-x-0 h-0.5 bg-[#c8ef69] ${dropTarget.position === "before" ? "-top-1" : "-bottom-1"}`}
                />
              )}
              <button
                aria-label={`Drag to reorder ${layer.name}`}
                title="Drag to reorder"
                className="layer-card-grip"
                draggable={!isLayerLocked(layer, e.layers)}
                disabled={isLayerLocked(layer, e.layers)}
                onDragStart={(event) => {
                  event.stopPropagation();
                  dragId.current = layer.id;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    "application/x-luma-layer",
                    layer.id,
                  );
                  dispatch(actions.selectLayer(layer.id));
                }}
                onDragEnd={() => {
                  dragId.current = null;
                  setDropTarget(null);
                }}
              >
                ⠿
              </button>
              <input
                type="checkbox"
                aria-label={`Include ${layer.name} in group`}
                className="layer-card-checkbox"
                checked={checked.includes(layer.id)}
                disabled={!!layer.groupId || !!layer.locked}
                onChange={(event) =>
                  setChecked(
                    event.target.checked
                      ? [...checked, layer.id]
                      : checked.filter((id) => id !== layer.id),
                  )
                }
              />
              <div className="min-w-0 flex-1 text-left">
                {renamingId === layer.id ? (
                  <input
                    key={`${layer.id}:${layer.name}`}
                    aria-label={`Rename ${layer.name}`}
                    title="Enter to save · Escape to cancel"
                    className="layer-card-name"
                    defaultValue={layer.name}
                    maxLength={80}
                    disabled={isLayerLocked(layer, e.layers)}
                    autoFocus
                    onFocus={(event) => event.currentTarget.select()}
                    onBlur={(event) => {
                      const name =
                        event.currentTarget.value.trim() || layer.name;
                      event.currentTarget.value = name;
                      if (name !== layer.name) edit(layer.id, { name });
                      setRenamingId(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.value = layer.name;
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    className="layer-card-name text-left"
                    title="Double-click to rename"
                    aria-label={`Select ${layer.name}; double-click to rename`}
                    onClick={() => dispatch(actions.selectLayer(layer.id))}
                    onDoubleClick={() => {
                      if (!isLayerLocked(layer, e.layers))
                        setRenamingId(layer.id);
                    }}
                  >
                    {layer.name}
                  </button>
                )}
                <button
                  className="layer-card-info"
                  aria-label={`Select ${layer.name}`}
                  onClick={() => dispatch(actions.selectLayer(layer.id))}
                >
                  {layer.groupId ? `${layer.groupName || "Group"} / ` : ""}
                  {layer.type} · {layer.opacity}%
                </button>
              </div>
              <div
                className="layer-card-actions"
                role="group"
                aria-label={`Actions for ${layer.name}`}
              >
                <button
                  aria-label={`${isLayerLocked(layer, e.layers) ? "Unlock" : "Lock"} ${layer.name}`}
                  onClick={() => {
                    dispatch(actions.snapshot());
                    dispatch(
                      actions.setLayerLock({
                        id: layer.id,
                        locked: !isLayerLocked(layer, e.layers),
                      }),
                    );
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <rect x="5" y="10" width="14" height="11" rx="2" />
                    <path
                      d={
                        isLayerLocked(layer, e.layers)
                          ? "M8 10V6a4 4 0 0 1 8 0v4"
                          : "M8 10V6a4 4 0 0 1 8 0"
                      }
                    />
                  </svg>
                </button>
                <button
                  className="px-1 text-[#c8ef69]"
                  aria-label={`Toggle ${layer.name} visibility`}
                  disabled={isLayerLocked(layer, e.layers)}
                  onClick={() => edit(layer.id, { visible: !layer.visible })}
                >
                  {layer.visible ? "◉" : "○"}
                </button>
                <button
                  aria-label={
                    layer.groupId
                      ? `Delete group ${layer.groupName || "Group"}`
                      : `Delete ${layer.name}`
                  }
                  title={
                    layer.groupId
                      ? "Delete entire group (confirmation required)"
                      : "Delete layer · Delete / Backspace (undo available)"
                  }
                  aria-keyshortcuts="Delete Backspace"
                  className="px-0.5 text-[#e9958b] disabled:opacity-25"
                  disabled={isLayerLocked(layer, e.layers)}
                  onClick={() => {
                    const removed = requestLayerDeletion(layer.id);
                    setChecked((ids) =>
                      ids.filter((id) => !removed.includes(id)),
                    );
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                  </svg>
                </button>
                <button
                  aria-label={`Move ${layer.name} forward`}
                  disabled={index === 0 || isLayerLocked(layer, e.layers)}
                  className="disabled:opacity-20"
                  onClick={() => {
                    dispatch(actions.snapshot());
                    dispatch(actions.moveLayer({ id: layer.id, direction: 1 }));
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="m6 11 6-6 6 6M12 5v15" />
                  </svg>
                </button>
                <button
                  aria-label={`Move ${layer.name} backward`}
                  disabled={
                    index === e.layers.length - 1 ||
                    isLayerLocked(layer, e.layers)
                  }
                  className="disabled:opacity-20"
                  onClick={() => {
                    dispatch(actions.snapshot());
                    dispatch(
                      actions.moveLayer({ id: layer.id, direction: -1 }),
                    );
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="m6 13 6 6 6-6M12 19V4" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {e.textLayer.enabled && (
            <button
              className={`${buttonClass} w-full text-left`}
              onClick={() => dispatch(actions.setTool("text"))}
            >
              Primary text / watermark · Edit in Text
            </button>
          )}
          <div
            className={`flex items-center justify-between rounded border p-2 ${!selected ? "border-[#a2bd66] bg-[#29311f]" : "border-[#37392f]"}`}
          >
            <button
              className="flex-1 text-left"
              aria-pressed={!selected}
              onClick={() => dispatch(actions.selectLayer(null))}
            >
              Base photo
            </button>
            <button
              aria-label="Toggle base photo visibility"
              onClick={() => {
                dispatch(actions.snapshot());
                dispatch(actions.setBase({ visible: !e.baseVisible }));
              }}
            >
              {e.baseVisible ? "◉" : "○"}
            </button>
          </div>
        </div>
        <fieldset
          disabled={!!selected && locked}
          aria-label="Opacity"
          className="rounded border border-[#393a31] px-2.5 py-2 disabled:opacity-40"
        >
          <div
            className="mb-1 truncate text-right text-[10px] text-[#a4a894]"
            title={selected?.name || "Base photo"}
          >
            {selected?.name || "Base photo"}
          </div>
          <SettingRange
            label="Opacity"
            min={0}
            max={100}
            unit="%"
            value={selected ? (selected.opacity ?? 100) : e.baseOpacity}
            onStart={() => dispatch(actions.snapshot())}
            onChange={setOpacity}
          />
        </fieldset>
        {selected && (
          <div className="space-y-3 border-t border-[#393a31] pt-4">
            {locked && (
              <p
                role="status"
                className="rounded border border-[#7f7145] p-3 text-[#e3cc8e]"
              >
                This layer or group is locked. Use its lock button above to
                enable editing.
              </p>
            )}
            <fieldset
              disabled={locked}
              className="space-y-3 disabled:opacity-40"
            >
              <fieldset className="space-y-2 rounded border border-[#393a31] p-3">
                <legend>Align to canvas</legend>
                <div
                  className="grid grid-cols-6 gap-1"
                  role="group"
                  aria-label="Align selected layer to canvas"
                >
                  {["left", "center", "right", "top", "middle", "bottom"].map(
                    (mode) => (
                      <button
                        key={mode}
                        title={alignmentLabels[mode]}
                        aria-label={alignmentLabels[mode]}
                        className={`${buttonClass} flex justify-center !px-1 !py-2 hover:bg-[#29311f]`}
                        onClick={() =>
                          edit(
                            selected.id,
                            alignSelection(
                              selected,
                              e.layers,
                              mode,
                              dimensions.width / dimensions.height,
                            ),
                          )
                        }
                      >
                        <AlignmentIcon mode={mode} />
                      </button>
                    ),
                  )}
                </div>
              </fieldset>
              <fieldset className="space-y-2 rounded border border-[#393a31] p-3">
                <legend>Visibility mask</legend>
                <label className="flex justify-between">
                  Enable mask
                  <input
                    aria-label="Enable layer mask"
                    type="checkbox"
                    checked={mask.enabled}
                    onChange={(event) =>
                      editMask({ enabled: event.target.checked })
                    }
                  />
                </label>
                {mask.enabled && (
                  <>
                    <select
                      aria-label="Mask shape"
                      className={inputClass}
                      value={mask.type}
                      onChange={(event) =>
                        editMask({ type: event.target.value })
                      }
                    >
                      <option value="rectangle">Rectangle mask</option>
                      <option value="ellipse">Ellipse mask</option>
                    </select>
                    <label className="flex justify-between">
                      Invert mask
                      <input
                        type="checkbox"
                        checked={mask.inverted}
                        onChange={(event) =>
                          editMask({ inverted: event.target.checked })
                        }
                      />
                    </label>
                    <div className="space-y-3">
                      {["x", "y", "width", "height"].map((key) => (
                        <SettingRange
                          key={key}
                          label={`Mask ${key}`}
                          min={key === "width" || key === "height" ? 1 : 0}
                          max={100}
                          step={0.1}
                          unit="%"
                          value={mask[key]}
                          onChange={(number) => editMask({ [key]: number })}
                        />
                      ))}
                    </div>
                    <button
                      className={buttonClass}
                      onClick={() => edit(selected.id, { mask: null })}
                    >
                      Remove mask
                    </button>
                  </>
                )}
                <p className="text-[9px] text-[#a4a894]">
                  Reveal only the area inside the mask, or invert to hide it.
                  Your original layer is preserved.
                </p>
              </fieldset>

              <fieldset className="space-y-2 rounded border border-[#393a31] p-3">
                <legend className="px-1 text-[#c8ef69]">Layer zoom</legend>
                <SettingRange
                  label="Layer zoom"
                  min={10}
                  max={400}
                  unit="%"
                  value={zoom}
                  onChange={setZoom}
                />
                <button
                  className={`${buttonClass} w-full`}
                  onClick={() => setZoom(100)}
                >
                  Reset to 100%
                </button>
                <p className="text-[9px] leading-relaxed text-[#a4a894]">
                  Scales this layer around its center, including text and
                  borders.
                </p>
              </fieldset>
              {selected.type === "text" && (
                <TextEditorControls
                  value={textEditorValue(selected, dimensions.width)}
                  showOpacity={false}
                  onChange={(changes) =>
                    edit(
                      selected.id,
                      textLayerChanges(changes, dimensions.width),
                    )
                  }
                />
              )}
              {isShape(selected.type) && (
                <ShapeControls
                  value={selected}
                  onChange={(changes) => edit(selected.id, changes)}
                />
              )}
              {["icon", "sticker"].includes(selected.type) && (
                <label className="flex justify-between">
                  Color
                  <input
                    aria-label="Asset color"
                    type="color"
                    value={selected.color}
                    onChange={(event) =>
                      edit(selected.id, { color: event.target.value })
                    }
                  />
                </label>
              )}
              {isShape(selected.type) && (
                <fieldset className="space-y-3 rounded border border-[#393a31] p-3">
                  <legend className="px-1 text-[#c8ef69]">Fill & border</legend>
                  <label className="flex items-center justify-between">
                    Fill
                    <input
                      aria-label="Enable shape fill"
                      type="checkbox"
                      className="accent-[#c8ef69]"
                      checked={selected.fillEnabled !== false}
                      onChange={(x) =>
                        edit(selected.id, { fillEnabled: x.target.checked })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    Fill color
                    <input
                      aria-label="Fill color"
                      type="color"
                      value={selected.color}
                      onChange={(x) =>
                        edit(selected.id, { color: x.target.value })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    Border
                    <input
                      aria-label="Enable shape border"
                      type="checkbox"
                      className="accent-[#c8ef69]"
                      checked={!!selected.borderEnabled}
                      onChange={(x) =>
                        edit(selected.id, { borderEnabled: x.target.checked })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    Border color
                    <input
                      aria-label="Border color"
                      type="color"
                      value={selected.borderColor || "#ffffff"}
                      onChange={(x) =>
                        edit(selected.id, {
                          borderColor: x.target.value,
                          borderEnabled: true,
                        })
                      }
                    />
                  </label>
                  <SettingRange
                    label="Border width"
                    min={0}
                    max={200}
                    unit="px"
                    value={selected.borderWidth ?? 4}
                    onChange={(borderWidth) =>
                      edit(selected.id, {
                        borderWidth,
                        borderEnabled: borderWidth > 0,
                      })
                    }
                  />
                  <p className="text-[9px] leading-relaxed text-[#a4a894]">
                    Border width is measured at original size and scales with
                    the exported image.
                  </p>
                </fieldset>
              )}
              <div className="space-y-3">
                {[
                  ["x", 0, 100],
                  ["y", 0, 100],
                  ["width", 1, 150],
                  ["height", 1, 150],
                  ["rotation", -180, 180],
                ].map(([key, min, max]) => (
                  <SettingRange
                    key={key}
                    label={`Layer ${key}`}
                    min={min}
                    max={max}
                    step={0.1}
                    unit={key === "rotation" ? "°" : "%"}
                    value={Math.round(selected[key] * 10) / 10}
                    onChange={(number) => edit(selected.id, { [key]: number })}
                  />
                ))}
              </div>
              {selected.type !== "text" && (
                <label className="block space-y-1">
                  <span>Blend mode</span>
                  <select
                    aria-label="Layer blend mode"
                    className={inputClass}
                    value={selected.blend}
                    onChange={(x) =>
                      edit(selected.id, { blend: x.target.value })
                    }
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
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={buttonClass}
                  onClick={() =>
                    add(selected.type, {
                      ...selected,
                      id: newId(),
                      name: `${selected.name} copy`,
                      groupId: null,
                      groupName: null,
                      x: Math.min(100, selected.x + 3),
                      y: Math.min(100, selected.y + 3),
                    })
                  }
                >
                  Duplicate
                </button>
                <button
                  className={`${buttonClass} text-[#ffa99d]`}
                  onClick={() => {
                    const removed = requestLayerDeletion(selected.id);
                    setChecked((ids) =>
                      ids.filter((id) => !removed.includes(id)),
                    );
                  }}
                >
                  {selected.groupId ? "Delete group" : "Delete layer"}
                </button>
              </div>
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}
