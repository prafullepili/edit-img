import { createSlice, current } from "@reduxjs/toolkit";
import { photoDefaults, mergePhoto } from "../photo/defaults";
import { isLayerLocked, groupTransform } from "../../layerEditing";
export const STORAGE_KEY = "luma-studio-project-v1";
const defaults = {
  projectId: "demo",
  projectTitle: "Untitled edit",
  photo: photoDefaults,
  freeCrop: null,
  baseAssetId: null,
  layers: [],
  snapEnabled: true,
  selectedLayerId: null,
  baseVisible: true,
  baseOpacity: 100,
  imageUrl: "",
  imageName: "Upload a photo",
  isUploaded: false,
  activeTool: "projects",
  adjustments: {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    clarity: 0,
    vignette: 0,
    grain: 0,
  },
  cropRatio: "Original",
  rotation: 0,
  flipX: false,
  flipY: false,
  zoom: 100,
  preset: "Original",
  exportFormat: "jpeg",
  exportQuality: 92,
  textLayer: {
    enabled: false,
    text: "Your story here",
    color: "#ffffff",
    size: 44,
    opacity: 100,
    position: "bottom-center",
    offsetX: 0,
    offsetY: 0,
    shadow: true,
  },
  outputWidth: 0,
  outputHeight: 0,
  lockAspect: true,
  history: [],
  future: [],
};

function loadProject() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== "object") return defaults;
    if (!stored.isUploaded && stored.projectId === "demo") return defaults;
    return {
      ...defaults,
      ...stored,
      activeTool:
        stored.isUploaded || stored.baseAssetId
          ? stored.activeTool || "adjust"
          : "projects",
      imageUrl: defaults.imageUrl,
      photo: mergePhoto(stored.photo),
      textLayer: { ...defaults.textLayer, ...stored.textLayer },
      adjustments: { ...defaults.adjustments, ...stored.adjustments },
      history: [],
      future: [],
    };
  } catch {
    return defaults;
  }
}

const capture = (state) => ({
  photo: state.photo,
  freeCrop: state.freeCrop,
  baseAssetId: state.baseAssetId,
  adjustments: { ...state.adjustments },
  preset: state.preset,
  cropRatio: state.cropRatio,
  rotation: state.rotation,
  flipX: state.flipX,
  flipY: state.flipY,
  zoom: state.zoom,
  textLayer: { ...state.textLayer },
  outputWidth: state.outputWidth,
  outputHeight: state.outputHeight,
  lockAspect: state.lockAspect,
  layers: state.layers.map((layer) => ({ ...layer })),
  selectedLayerId: state.selectedLayerId,
  baseVisible: state.baseVisible,
  baseOpacity: state.baseOpacity,
  snapEnabled: state.snapEnabled,
});

const HISTORY_LIMIT = 30;

const slice = createSlice({
  name: "editor",
  initialState: loadProject(),
  reducers: {
    setImage(state, action) {
      return {
        ...defaults,
        projectId: action.payload.id,
        imageUrl: action.payload.url,
        imageName: action.payload.name,
        isUploaded: true,
        activeTool: "adjust",
        history: [],
        future: [],
      };
    },
    openDraft(state, action) {
      return {
        ...defaults,
        ...action.payload.state,
        photo: mergePhoto(action.payload.state.photo),
        imageUrl: action.payload.url,
        history: [],
        future: [],
      };
    },
    restoreVersion(state, action) {
      return {
        ...state,
        ...action.payload,
        history: state.history,
        future: [],
      };
    },
    discardDraft() {
      return { ...defaults, history: [], future: [] };
    },
    restoreImage(state, action) {
      state.imageUrl = action.payload.url;
    },
    clearUploadedImage(state) {
      state.imageUrl = defaults.imageUrl;
      state.imageName = defaults.imageName;
      state.isUploaded = false;
    },
    setTitle(state, action) {
      state.projectTitle = action.payload.slice(0, 80);
    },
    setTool(state, action) {
      state.activeTool =
        !state.imageUrl && !state.baseAssetId && action.payload !== "projects"
          ? "projects"
          : action.payload;
    },
    setAdjustment(state, action) {
      state.adjustments[action.payload.key] = Number(action.payload.value);
      state.preset = "Custom";
    },
    pasteAdjustments(state, action) {
      state.adjustments = { ...state.adjustments, ...action.payload };
      state.preset = "Custom";
    },
    applyPreset(state, action) {
      state.preset = action.payload.name;
      state.adjustments = { ...state.adjustments, ...action.payload.values };
    },
    setCropRatio(state, action) {
      state.cropRatio = action.payload;
      state.freeCrop = null;
      state.outputWidth = 0;
      state.outputHeight = 0;
    },
    setFreeCrop(state, action) {
      state.freeCrop = action.payload;
      state.outputWidth = 0;
      state.outputHeight = 0;
    },
    setPhoto(state, action) {
      state.photo = { ...state.photo, ...action.payload };
    },
    addStroke(state, action) {
      const stroke = action.payload;
      if (["brush", "eraser"].includes(stroke.tool) && stroke.paintLayerId) {
        let layer = state.layers.find(
          (item) => item.id === stroke.paintLayerId && item.type === "paint",
        );
        if (!layer && stroke.tool === "brush") {
          layer = {
            id: stroke.paintLayerId,
            type: "paint",
            name: "Brush strokes",
            visible: true,
            opacity: 100,
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            rotation: 0,
            scale: 1,
            blend: "normal",
            strokes: [],
          };
          state.layers.push(layer);
        }
        if (layer) {
          layer.strokes ||= [];
          layer.strokes.push(stroke);
          state.selectedLayerId = layer.id;
        }
        return;
      }
      state.photo.strokes.push(stroke);
    },
    setBaseAsset(state, action) {
      state.baseAssetId = action.payload;
    },
    rotate(state, action) {
      state.rotation = (state.rotation + action.payload + 360) % 360;
    },
    flip(state, action) {
      state[action.payload] = !state[action.payload];
    },
    setZoom(state, action) {
      state.zoom = action.payload;
    },
    setExport(state, action) {
      Object.assign(state, action.payload);
    },
    setTextLayer(state, action) {
      state.textLayer = { ...state.textLayer, ...action.payload };
    },
    setDimensions(state, action) {
      state.outputWidth = action.payload.width;
      state.outputHeight = action.payload.height;
    },
    setLockAspect(state, action) {
      state.lockAspect = action.payload;
    },
    resetCurrent(state) {
      const tool = state.activeTool;
      const layer = state.layers.find(
        (item) => item.id === state.selectedLayerId,
      );
      if (
        ["layers", "text"].includes(tool) &&
        layer &&
        isLayerLocked(layer, state.layers)
      )
        return;
      state.history.push({
        ...capture(current(state)),
        historyLabel: `Reset ${tool === "layers" ? "selected layer appearance" : tool}`,
      });
      if (state.history.length > HISTORY_LIMIT) state.history.shift();
      state.future = [];
      if (tool === "layers") {
        if (layer)
          Object.assign(layer, {
            opacity: 100,
            rotation: 0,
            scale: 1,
            blend: "normal",
            mask: { enabled: false },
          });
        else {
          state.baseOpacity = 100;
          state.baseVisible = true;
        }
      } else if (tool === "tone") {
        state.photo.levels = photoDefaults.levels;
        state.photo.curves = photoDefaults.curves;
      } else if (tool === "color") {
        state.photo.hsl = {};
        state.photo.selective = {};
      } else if (tool === "detail") {
        state.photo.sharpen = 0;
        state.photo.denoise = 0;
      } else if (tool === "retouch") {
        if (layer?.type === "paint" && !isLayerLocked(layer, state.layers))
          layer.strokes = [];
        else state.photo.strokes = [];
      } else if (tool === "background") {
        state.baseAssetId = null;
      } else if (tool === "crop") {
        state.cropRatio = "Original";
        state.freeCrop = null;
        state.rotation = 0;
        state.flipX = false;
        state.flipY = false;
        state.outputWidth = 0;
        state.outputHeight = 0;
      } else if (tool === "resize") {
        state.outputWidth = 0;
        state.outputHeight = 0;
        state.lockAspect = true;
      } else if (tool === "text") {
        if (layer?.type === "text" && !isLayerLocked(layer, state.layers))
          Object.assign(layer, {
            opacity: 100,
            blur: 0,
            outlineWidth: 0,
            shadow: false,
            letterSpacing: 0,
            lineHeight: 1.2,
          });
        else if (!layer)
          state.textLayer = {
            ...defaults.textLayer,
            text: state.textLayer.text,
          };
      } else {
        state.adjustments = defaults.adjustments;
        state.preset = "Original";
      }
    },
    reset(state) {
      const history = [...state.history, { ...capture(current(state)), historyLabel: "Restored original image" }];
      if (history.length > HISTORY_LIMIT) history.shift();
      return {
        ...defaults,
        projectId: state.projectId,
        projectTitle: state.projectTitle,
        snapEnabled: state.snapEnabled,
        imageUrl: state.imageUrl,
        imageName: state.imageName,
        isUploaded: state.isUploaded,
        activeTool: state.activeTool,
        history,
        future: [],
      };
    },
    addDesign(state, action) {
      state.layers.push(...action.payload.layers);
      if (action.payload.textLayer)
        state.textLayer = {
          ...defaults.textLayer,
          ...action.payload.textLayer,
        };
      state.selectedLayerId = action.payload.layers.at(-1)?.id || null;
      state.activeTool = "layers";
    },
    addLayer(state, action) {
      state.layers.push(action.payload);
      state.selectedLayerId = action.payload.id;
    },
    selectLayer(state, action) {
      state.selectedLayerId = action.payload;
    },
    updateLayer(state, action) {
      const layer = state.layers.find((l) => l.id === action.payload.id);
      if (!layer || isLayerLocked(layer, state.layers)) return;
      const changes = action.payload.changes;
      const transformed =
        layer.groupId &&
        ["x", "y", "scale", "rotation"].some((k) => k in changes)
          ? groupTransform(
              layer,
              state.layers,
              changes,
              action.payload.aspect || 1,
            )
          : null;
      Object.assign(layer, changes);
      if (transformed)
        for (const update of transformed)
          Object.assign(
            state.layers.find((l) => l.id === update.id),
            update.changes,
          );
    },
    setLayerLock(state, action) {
      const layer = state.layers.find((l) => l.id === action.payload.id);
      if (!layer) return;
      for (const member of state.layers.filter(
        (l) =>
          l.id === layer.id || (layer.groupId && l.groupId === layer.groupId),
      ))
        member.locked = action.payload.locked;
    },
    setSnap(state, action) {
      state.snapEnabled = action.payload;
    },
    groupLayers(state, action) {
      const selected = state.layers.filter((l) =>
        action.payload.ids.includes(l.id),
      );
      if (selected.length < 2 || selected.some((l) => l.groupId || l.locked))
        return;
      const top = Math.max(...selected.map((l) => state.layers.indexOf(l)));
      const insertion = state.layers
        .slice(0, top + 1)
        .filter((l) => !action.payload.ids.includes(l.id)).length;
      state.layers = state.layers.filter(
        (l) => !action.payload.ids.includes(l.id),
      );
      selected.forEach((l) => {
        l.groupId = action.payload.id;
        l.groupName = action.payload.name;
      });
      state.layers.splice(insertion, 0, ...selected);
      state.selectedLayerId = selected.at(-1).id;
    },
    ungroupLayers(state, action) {
      const members = state.layers.filter((l) => l.groupId === action.payload);
      if (members.some((l) => l.locked)) return;
      members.forEach((l) => {
        delete l.groupId;
        delete l.groupName;
      });
    },
    removeLayer(state, action) {
      const layer = state.layers.find((l) => l.id === action.payload);
      if (!layer || isLayerLocked(layer, state.layers)) return;
      state.layers = state.layers.filter((l) => l.id !== action.payload);
      if (state.selectedLayerId === action.payload)
        state.selectedLayerId = state.layers.at(-1)?.id || null;
    },
    removeGroup(state, action) {
      if (!action.payload) return;
      const members = state.layers.filter(
        (layer) => layer.groupId === action.payload,
      );
      if (!members.length || members.some((layer) => layer.locked)) return;
      if (members.some((layer) => layer.id === state.selectedLayerId)) {
        state.selectedLayerId =
          state.layers
            .filter((layer) => layer.groupId !== action.payload)
            .at(-1)?.id || null;
      }
      state.layers = state.layers.filter(
        (layer) => layer.groupId !== action.payload,
      );
    },
    moveLayer(state, action) {
      const layer = state.layers.find((l) => l.id === action.payload.id);
      if (!layer || isLayerLocked(layer, state.layers)) return;
      const units = [];
      for (const l of state.layers) {
        const last = units.at(-1);
        if (l.groupId && last?.[0].groupId === l.groupId) last.push(l);
        else units.push([l]);
      }
      const i = units.findIndex((unit) => unit.some((l) => l.id === layer.id)),
        j = i + action.payload.direction;
      if (j < 0 || j >= units.length || units[j].some((l) => l.locked)) return;
      [units[i], units[j]] = [units[j], units[i]];
      state.layers = units.flat();
    },
    reorderLayer(state, action) {
      const { id, targetId, position } = action.payload;
      if (id === targetId || !["before", "after"].includes(position)) return;
      const units = [];
      for (const layer of state.layers) {
        const previous = units.at(-1);
        if (layer.groupId && previous?.[0].groupId === layer.groupId)
          previous.push(layer);
        else units.push([layer]);
      }
      const from = units.findIndex((unit) =>
        unit.some((layer) => layer.id === id),
      );
      const to = units.findIndex((unit) =>
        unit.some((layer) => layer.id === targetId),
      );
      if (from < 0 || to < 0 || from === to) return;
      // Groups stay together; locked layers cannot move or be crossed.
      if (
        units
          .slice(Math.min(from, to), Math.max(from, to) + 1)
          .some((unit) =>
            unit.some((layer) => isLayerLocked(layer, state.layers)),
          )
      )
        return;
      const [moving] = units.splice(from, 1);
      const target = units.findIndex((unit) =>
        unit.some((layer) => layer.id === targetId),
      );
      units.splice(target + (position === "before" ? 1 : 0), 0, moving);
      state.layers = units.flat();
    },
    setBase(state, action) {
      if ("visible" in action.payload)
        state.baseVisible = action.payload.visible;
      if ("opacity" in action.payload)
        state.baseOpacity = action.payload.opacity;
    },
    undo(state) {
      if (!state.history.length) return;
      const previous = state.history.pop();
      state.future.unshift({
        ...capture(current(state)),
        historyLabel: previous.historyLabel,
      });
      if (state.future.length > HISTORY_LIMIT) state.future.pop();
      Object.assign(state, previous);
    },
    redo(state) {
      if (!state.future.length) return;
      const next = state.future.shift();
      state.history.push({
        ...capture(current(state)),
        historyLabel: next.historyLabel,
      });
      if (state.history.length > HISTORY_LIMIT) state.history.shift();
      Object.assign(state, next);
    },
    snapshot(state) {
      state.history.push(capture(state));
      if (state.history.length > HISTORY_LIMIT) state.history.shift();
      state.future = [];
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      (action) =>
        /^editor\/(setAdjustment|updateLayer|addLayer|addStroke|setBase|setPhoto|setTextLayer|setDimensions|setFreeCrop|setCropRatio|rotate|flip|applyPreset|removeLayer|deleteLayer|addDesign|setBaseAsset|pasteAdjustments|removeGroup|groupLayers|ungroupLayers|moveLayer|reorderLayer|setLayerLock|restoreVersion|setLockAspect)$/.test(
          action.type,
        ),
      (state, action) => {
        const entry = state.history.at(-1);
        if (!entry) return;
        const kind = action.type.split("/")[1];
        const field =
          action.payload?.key ||
          Object.keys(action.payload?.changes || action.payload || {})[0];
        const readable = (name) =>
          String(name || "settings")
            .replace(/([A-Z])/g, " $1")
            .toLowerCase();
        const labels = {
          addLayer: `Added ${action.payload?.type || "layer"}`,
          addStroke: `Painted ${action.payload?.tool || "stroke"}`,
          setBaseAsset: "Changed background",
          addDesign: "Added design",
          removeGroup: "Deleted group",
          groupLayers: "Grouped layers",
          ungroupLayers: "Ungrouped layers",
          moveLayer: "Reordered layer",
          reorderLayer: "Reordered layer",
          setLayerLock: "Changed layer lock",
          restoreVersion: "Restored version",
          setLockAspect: "Changed aspect lock",
          setDimensions: "Resized output",
          rotate: "Rotated photo",
          flip: "Flipped photo",
          applyPreset: "Applied look",
          setFreeCrop: "Changed crop",
          setCropRatio: "Changed crop",
          removeLayer: "Deleted layer",
          deleteLayer: "Deleted layer",
        };
        entry.historyLabel = labels[kind] || `Changed ${readable(field)}`;
      },
    );
  },
});

export const actions = slice.actions;
export default slice.reducer;
