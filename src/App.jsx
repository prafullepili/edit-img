import { requestLayerDeletion } from "./features/editor/layerDeletion";
import { newId } from "./ids.js";
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { actions, store } from "./store";
import { readImage, saveImage, readDraft } from "./imageStorage";
const AdvancedPanel = lazy(() => import("./AdvancedPanel"));
import AutosavedEdits from "./AutosavedEdits";
const LayersPanel = lazy(() => import("./LayersPanel"));
import LayerHandles from "./LayerHandles";
import { isLayerLocked } from "./layerEditing";
import { LayerPreview, useLayerImages } from "./layers";

import Icon from "./components/Icon";
import TextArtwork from "./features/design/TextArtwork";
import OnCanvasTextEditor from "./features/design/OnCanvasTextEditor";
import usePhotoPreview from "./features/photo/usePhotoPreview";
const AdjustPanel = lazy(() => import("./features/editor/AdjustPanel"));
const PresetsPanel = lazy(() => import("./features/editor/PresetsPanel"));
const CropPanel = lazy(() => import("./features/photo/CropPanel"));
const CropOverlay = lazy(() => import("./features/photo/CropOverlay"));
const PhotoPanel = lazy(() => import("./features/photo/PhotoPanel"));
const RetouchCanvas = lazy(() => import("./features/photo/RetouchCanvas"));
const ExportDialog = lazy(() => import("./features/export/ExportDialog"));

const DesignLibrary = lazy(() => import("./features/design/DesignLibrary"));
const ProjectsPanel = lazy(() => import("./features/projects/ProjectsPanel"));
const ShortcutGuide = lazy(() => import("./features/projects/ShortcutGuide"));
const tools = [
  { id: "projects", name: "Projects", icon: "save" },
  { id: "assets", name: "Assets", icon: "assets" },
  { id: "adjust", name: "Adjust", icon: "sliders" },
  { id: "crop", name: "Crop", icon: "crop" },
  { id: "background", name: "Cutout", icon: "image" },
  { id: "retouch", name: "Retouch", icon: "wand" },
  { id: "tone", name: "Tone", icon: "sun" },
  { id: "color", name: "Color", icon: "sparkle" },
  { id: "detail", name: "Detail", icon: "sliders" },
  { id: "text", name: "Text", icon: "text" },
  { id: "resize", name: "Resize", icon: "crop" },
  { id: "presets", name: "Looks", icon: "wand" },
  { id: "layers", name: "Layers", icon: "layers" },
];

function App() {
  const dispatch = useDispatch();
  const editor = useSelector((s) => s.editor);
  const fileRef = useRef(null);
  const previewImageRef = useRef(null);
  const workbenchRef = useRef(null);

  const [showBefore, setShowBefore] = useState(false);
  const [editingTextId, setEditingTextId] = useState(null);
  const [mobileLayout, setMobileLayout] = useState("balanced");
  const [mobilePastEdits, setMobilePastEdits] = useState(false);
  const [toast, setToast] = useState("");
  const [dragging, setDragging] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const canvasPointers = useRef(new Map());
  const canvasGesture = useRef(null);
  const touchGesture = useRef(null);
  const [guides, setGuides] = useState([]);
  const [working, setWorking] = useState(false);
  const layerImages = useLayerImages(editor.layers);
  const [retouch, setRetouch] = useState({
    tool: "brush",
    size: 40,
    opacity: 100,
    hardness: 70,
    color: "#ffffff",
    source: null,
    picking: false,
  });
  useEffect(() => {
    setRetouch((settings) => ({ ...settings, source: null, picking: false }));
    setEditingTextId(null);
  }, [editor.projectId]);
  useEffect(() => {
    if (editor.activeTool !== "text") setEditingTextId(null);
  }, [editor.activeTool]);
  const cropping = editor.activeTool === "crop";
  const photoPreview = usePhotoPreview(editor, {
    uncropped: cropping,
    before: showBefore,
    interactiveMaxEdge: editor.activeTool === "retouch" ? 1200 : 480,
    workerPreview: editor.activeTool === "retouch",
  });
  const selectedText = editor.layers.find(
    (layer) => layer.id === editor.selectedLayerId && layer.type === "text",
  );
  const isCanvasGestureTarget = (target) => {
    if (editor.activeTool === "crop" || editor.activeTool === "retouch") return false;
    if (!(target instanceof Element)) return false;
    if (target.closest("svg, canvas, .on-canvas-text-editor")) return false;
    return Boolean(target.closest(".workbench") && !target.closest("canvas"));
  };
  const handleCanvasPointerDown = (event) => {
    if (event.pointerType !== "mouse" || !isCanvasGestureTarget(event.target)) return;
    const pointers = canvasPointers.current;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const center = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: event.clientX, y: event.clientY };
    if (pointers.size === 1) {
      canvasGesture.current = {
        mode: "pan",
        startX: event.clientX,
        startY: event.clientY,
        panX: canvasPan.x,
        panY: canvasPan.y,
        moved: false,
      };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      canvasGesture.current = {
        mode: "pinch",
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: editor.zoom,
        originX: midpoint.x - center.x,
        originY: midpoint.y - center.y,
        panX: canvasPan.x,
        panY: canvasPan.y,
      };
      event.preventDefault();
    }
  };
  const handleCanvasPointerMove = (event) => {
    if (event.pointerType !== "mouse") return;
    const pointers = canvasPointers.current;
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = canvasGesture.current;
    if (!gesture) return;
    if (gesture.mode === "pinch" && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const nextZoom = Math.max(10, gesture.zoom * (distance / gesture.distance));
      const ratio = nextZoom / gesture.zoom;
      const rect = event.currentTarget.getBoundingClientRect();
      const centerX = rect ? rect.left + rect.width / 2 : midpoint.x;
      const centerY = rect ? rect.top + rect.height / 2 : midpoint.y;
      const focusX = midpoint.x - centerX;
      const focusY = midpoint.y - centerY;
      dispatch(actions.setZoom(nextZoom));
      setCanvasPan({
        x: focusX - (gesture.originX - gesture.panX) * ratio,
        y: focusY - (gesture.originY - gesture.panY) * ratio,
      });
      event.preventDefault();
      return;
    }
    if (gesture.mode === "pan" && pointers.size === 1) {
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) gesture.moved = true;
      if (gesture.moved) {
        setCanvasPan({ x: gesture.panX + dx, y: gesture.panY + dy });
        event.preventDefault();
      }
    }
  };
  const handleCanvasPointerUp = (event) => {
    if (event.pointerType !== "mouse") return;
    canvasPointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!canvasPointers.current.size) canvasGesture.current = null;
    else {
      const [pointer] = canvasPointers.current.values();
      canvasGesture.current = {
        mode: "pan",
        startX: pointer.x,
        startY: pointer.y,
        panX: canvasPan.x,
        panY: canvasPan.y,
        moved: false,
      };
    }
  };
  const handleCanvasWheel = (event) => {
    if (!event.ctrlKey || !window.matchMedia("(pointer: fine)").matches) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const focusX = event.clientX - (rect.left + rect.width / 2);
    const focusY = event.clientY - (rect.top + rect.height / 2);
    const nextZoom = Math.max(10, editor.zoom * Math.exp(-event.deltaY * 0.002));
    const ratio = nextZoom / editor.zoom;
    dispatch(actions.setZoom(nextZoom));
    setCanvasPan({
      x: focusX - (focusX - canvasPan.x) * ratio,
      y: focusY - (focusY - canvasPan.y) * ratio,
    });
  };
  useEffect(() => {
    const node = workbenchRef.current;
    if (!node) return undefined;
    const getTouches = (event) => Array.from(event.touches).slice(0, 2);
    const startTouch = (event) => {
      if (editor.activeTool === "crop" || editor.activeTool === "retouch") return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".workbench")) return;
      if (target.closest(".layer-transform-box, .layer-resize-handle, .layer-rotate-handle, .text-drag-handle, .on-canvas-text-editor, input, button")) return;
      const touches = getTouches(event);
      const rect = node.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      if (touches.length === 1) {
        const touch = touches[0];
        touchGesture.current = {
          mode: "pan",
          startX: touch.clientX,
          startY: touch.clientY,
          panX: canvasPan.x,
          panY: canvasPan.y,
          panAllowed: Boolean(target.closest(".preview-image, .canvas-grid, .workbench")),
          moved: false,
        };
      } else if (touches.length === 2) {
        const [a, b] = touches;
        const midpoint = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
        touchGesture.current = {
          mode: "pinch",
          distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
          zoom: editor.zoom,
          originX: midpoint.x - center.x,
          originY: midpoint.y - center.y,
          panX: canvasPan.x,
          panY: canvasPan.y,
        };
        event.preventDefault();
      }
    };
    const moveTouch = (event) => {
      const gesture = touchGesture.current;
      if (!gesture) return;
      const touches = getTouches(event);
      if (gesture.mode === "pinch" && touches.length >= 2) {
        const [a, b] = touches;
        const midpoint = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
        const distance = Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY));
        const nextZoom = Math.max(10, gesture.zoom * distance / gesture.distance);
        const ratio = nextZoom / gesture.zoom;
        const rect = node.getBoundingClientRect();
        const focusX = midpoint.x - (rect.left + rect.width / 2);
        const focusY = midpoint.y - (rect.top + rect.height / 2);
        dispatch(actions.setZoom(nextZoom));
        setCanvasPan({
          x: focusX - (gesture.originX - gesture.panX) * ratio,
          y: focusY - (gesture.originY - gesture.panY) * ratio,
        });
        event.preventDefault();
      } else if (gesture.mode === "pan" && touches.length === 1 && gesture.panAllowed) {
        const touch = touches[0];
        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) gesture.moved = true;
        if (gesture.moved) {
          setCanvasPan({ x: gesture.panX + dx, y: gesture.panY + dy });
          event.preventDefault();
        }
      }
    };
    const endTouch = (event) => {
      if (!event.touches.length) {
        touchGesture.current = null;
        return;
      }
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        touchGesture.current = {
          mode: "pan",
          startX: touch.clientX,
          startY: touch.clientY,
          panX: canvasPan.x,
          panY: canvasPan.y,
          panAllowed: true,
          moved: false,
        };
      }
    };
    node.addEventListener("touchstart", startTouch, { passive: false });
    node.addEventListener("touchmove", moveTouch, { passive: false });
    node.addEventListener("touchend", endTouch, { passive: false });
    node.addEventListener("touchcancel", endTouch, { passive: false });
    return () => {
      node.removeEventListener("touchstart", startTouch);
      node.removeEventListener("touchmove", moveTouch);
      node.removeEventListener("touchend", endTouch);
      node.removeEventListener("touchcancel", endTouch);
    };
  }, [canvasPan.x, canvasPan.y, dispatch, editor.activeTool, editor.zoom]);
  const editingText =
    editingTextId === "primary"
      ? editor.textLayer
      : editor.layers.find(
          (layer) => layer.id === editingTextId && layer.type === "text",
        );
  const beginTextEdit = (id) => {
    const layer = editor.layers.find((item) => item.id === id);
    if (id !== "primary" && (!layer || isLayerLocked(layer, editor.layers)))
      return;
    if (id === "primary" && !editor.textLayer.enabled) {
      dispatch(actions.snapshot());
      dispatch(actions.setTextLayer({ enabled: true }));
    }
    dispatch(actions.selectLayer(id === "primary" ? null : id));
    dispatch(actions.setTool("text"));
    setEditingTextId(id);
  };
  const saveCanvasText = (text) => {
    if (editingText && text !== editingText.text) {
      dispatch(actions.snapshot());
      dispatch(
        editingTextId === "primary"
          ? actions.setTextLayer({ text, enabled: true })
          : actions.updateLayer({ id: editingTextId, changes: { text } }),
      );
    }
    setEditingTextId(null);
  };
  const loaded =
    !!photoPreview.url && !photoPreview.busy && !photoPreview.error;
  const dimensions = { width: photoPreview.width, height: photoPreview.height };
  const orientedW =
      editor.rotation % 180
        ? photoPreview.sourceHeight
        : photoPreview.sourceWidth,
    orientedH =
      editor.rotation % 180
        ? photoPreview.sourceWidth
        : photoPreview.sourceHeight;
  const frameRatio = cropping
    ? orientedW / orientedH
    : dimensions.width / dimensions.height;

  const saveSnapshot = useCallback(
    () => dispatch(actions.snapshot()),
    [dispatch],
  );

  const announce = useCallback((message) => {
    setToast(message);
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(() => setToast(""), 2600);
  }, []);
  const loadFiles = useCallback(
    (files) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/"))
        return announce("Choose an image file to get started.");
      if (file.size > 24 * 1024 * 1024)
        return announce("Choose an image smaller than 24 MB.");
      const reader = new FileReader();
      reader.onload = async () => {
        const url = URL.createObjectURL(file);
        const id = newId();
        try {
          await saveImage(file, id);
        } catch {
          announce(
            "Browser storage is unavailable. This image will work for this session.",
          );
        }
        dispatch(actions.setImage({ url, name: file.name, id }));
        dispatch(actions.setTool("adjust"));
      };
      reader.readAsArrayBuffer(file);
    },
    [announce, dispatch],
  );

  const change = (key, value) => {
    saveSnapshot();
    dispatch(
      actions.setAdjustment({
        key,
        value: Math.max(-100, Math.min(100, value)),
      }),
    );
  };
  const applyPreset = (preset) => {
    saveSnapshot();
    dispatch(
      actions.applyPreset({
        name: preset.name,
        values: {
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
          ...preset.values,
        },
      }),
    );
  };

  const download = async () => {
    if (!loaded)
      return announce(
        editor.imageUrl || editor.baseAssetId
          ? "Wait for the current preview to finish."
          : "Upload a photo before exporting.",
      );
    setWorking(true);
    try {
      const { exportImage } = await import("./features/export/exportImage");
      const blob = await exportImage(editor, layerImages);
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `${editor.imageName.replace(/\.[^.]+$/, "")}-luma.${editor.exportFormat}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setExportOpen(false);
      announce("Your edited image is ready.");
    } catch (error) {
      announce(`Export failed: ${error.message}`);
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const focused = document.activeElement;
      const editing =
        ["INPUT", "TEXTAREA", "SELECT"].includes(focused?.tagName) ||
        focused?.isContentEditable;
      if (e.defaultPrevented || e.isComposing) return;
      if (document.querySelector("[data-shortcut-guide]")) {
        if (e.key === "Escape") setShortcutsOpen(false);
        return;
      }
      if (
        !editing &&
        !e.repeat &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        ["Delete", "Backspace"].includes(e.key)
      ) {
        const current = store.getState().editor;
        const layer = current.layers.find(
          (item) => item.id === current.selectedLayerId,
        );
        if (
          current.activeTool === "layers" &&
          layer &&
          !document.querySelector('[role="dialog"], dialog[open]')
        ) {
          e.preventDefault();
          requestLayerDeletion(layer.id);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !editing) {
        e.preventDefault();
        dispatch(e.shiftKey ? actions.redo() : actions.undo());
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !editing) {
        e.preventDefault();
        dispatch(actions.redo());
      }
      if (!editing && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      }
      if (!editing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExportOpen(true);
      }
      if (!editing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        dispatch(actions.setTool("projects"));
        window.dispatchEvent(new Event("luma-create-version"));
      }
      if (e.key === "Escape") {
        setExportOpen(false);
        setShowBefore(false);
        setMobilePastEdits(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const draft = await readDraft(editor.projectId);
        const saved = draft?.state || editor;
        if (!saved.isUploaded) {
          if (active && draft && saved.projectId !== "demo")
            dispatch(
              actions.openDraft({
                state: saved,
                url: draft.preview || editor.imageUrl,
              }),
            );
          return;
        }
        const blob =
          (await readImage(saved.projectId)) ||
          (saved.projectId === "demo" ? await readImage() : null);
        if (!blob) throw new Error("Saved source missing");
        if (!(await readImage(saved.projectId)))
          await saveImage(blob, saved.projectId);
        if (active)
          dispatch(
            actions.openDraft({ state: saved, url: URL.createObjectURL(blob) }),
          );
      } catch {
        if (active)
          announce(
            "Saved project could not be restored. Upload a photo to continue.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className={`app-shell mobile-layout-${mobileLayout}`}
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.target === e.currentTarget) setDragging(false);
      }}
      onDrop={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setDragging(false);
        loadFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="drop-overlay">
          <div>
            <Icon name="upload" size={30} />
            <strong>Drop your image here</strong>
            <span>JPG, PNG, WebP · up to 24 MB</span>
          </div>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            l<span>·</span>
          </div>
          <span className="brand-name">
            luma<span>studio</span>
          </span>
          <span className="brand-divider" />
          <span className="workspace-name">
            <input
              className="project-title"
              aria-label="Project title"
              title="Click to rename your edit"
              maxLength="80"
              placeholder="Untitled edit"
              value={editor.projectTitle}
              onChange={(e) => dispatch(actions.setTitle(e.target.value))}
              onBlur={() => {
                if (!editor.projectTitle.trim())
                  dispatch(actions.setTitle("Untitled edit"));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />{" "}
            <span className="saved-indicator">
              <i /> saved
            </span>
          </span>
        </div>
        <div className="top-actions">
          <button
            className="icon-button history-button"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            onClick={() => dispatch(actions.undo())}
          >
            <Icon name="undo" />
          </button>
          <button
            className="icon-button history-button"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            onClick={() => dispatch(actions.redo())}
          >
            <Icon name="redo" />
          </button>
          <span className="top-separator" />
          <button
            className="button subtle reset-button"
            onClick={() => {
              saveSnapshot();
              dispatch(actions.reset());
              announce("Adjustments reset.");
            }}
          >
            <Icon name="reset" size={15} /> Reset
          </button>
          <button
            className="shortcut-help-button"
            title="Keyboard shortcuts (?)"
            aria-label="Open keyboard shortcuts"
            onClick={() => setShortcutsOpen(true)}
          >
            i
          </button>
          <button
            className="button primary export-button"
            onClick={() => setExportOpen(true)}
          >
            <Icon name="download" size={16} /> Export
          </button>
        </div>
      </header>
      <div className="editor-layout">
        <nav className="tool-rail" aria-label="Editor tools">
          <div className="rail-tools">
            {tools.map((tool) => (
              <button
                key={tool.id}
                className={`rail-tool ${editor.activeTool === tool.id ? "active" : ""}`}
                onClick={() => {
                  dispatch(actions.setTool(tool.id));
                  if (mobileLayout === "photo") setMobileLayout("balanced");
                }}
                title={tool.name}
              >
                <Icon name={tool.icon} />
                <span>{tool.name}</span>
              </button>
            ))}
          </div>
          <div className="rail-bottom">
            <button
              className="rail-tool"
              title="Image details"
              onClick={() =>
                announce(
                  `${photoPreview.sourceWidth} × ${photoPreview.sourceHeight} px`,
                )
              }
            >
              <Icon name="image" />
              <span>Info</span>
            </button>
            <div className="avatar">L</div>
          </div>
        </nav>
        <main className="canvas-area">
          <div className="canvas-toolbar">
            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="crumb-chevron">/</span>
              <strong>{editor.imageName}</strong>
              <span className="unsaved-dot" title="Local project" />
            </div>
            <div className="canvas-actions">
              <button
                className="canvas-action mobile-only"
                aria-label="Open past edits"
                title="Past edits"
                onClick={() => setMobilePastEdits(true)}
              >
                <Icon name="save" size={15} />
              </button>
              <button
                className="canvas-action mobile-only"
                aria-label={
                  mobileLayout === "photo"
                    ? "Return to split view"
                    : "Expand photo preview"
                }
                title={mobileLayout === "photo" ? "Split view" : "Expand photo"}
                aria-pressed={mobileLayout === "photo"}
                onClick={() =>
                  setMobileLayout((value) =>
                    value === "photo" ? "balanced" : "photo",
                  )
                }
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
                </svg>
              </button>
              <button
                className={`canvas-action ${showBefore ? "pressed" : ""}`}
                onPointerDown={() => setShowBefore(true)}
                onPointerUp={() => setShowBefore(false)}
                onPointerLeave={() => setShowBefore(false)}
                title="Hold to compare with original"
              >
                <Icon name="compare" size={16} />
                <span>Compare</span>
              </button>
              <span className="toolbar-rule" />
              <button
                className="zoom-btn"
                aria-label="Zoom out"
                  onClick={() => dispatch(actions.setZoom(Math.max(10, editor.zoom - 10)))}
              >
                <Icon name="zoomOut" size={16} />
              </button>
              <button
                className="zoom-value"
                aria-label="Reset canvas zoom"
                title="Reset zoom and position"
                onClick={() => {
                  dispatch(actions.setZoom(100));
                  setCanvasPan({ x: 0, y: 0 });
                }}
              >
                {Math.round(editor.zoom)}%
              </button>
              <button
                className="zoom-btn"
                aria-label="Zoom in"
                  onClick={() => dispatch(actions.setZoom(editor.zoom + 10))}
              >
                <Icon name="zoomIn" size={16} />
              </button>
            </div>
          </div>
          <section
            className="workbench"
            ref={workbenchRef}
            aria-label="Image canvas"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onWheel={handleCanvasWheel}
          >
            <div className="canvas-grid" />
            <div
              className={`image-frame ${editor.cropRatio !== "Original" ? "cropped" : ""}`}
              style={{
                "--frame-ratio": frameRatio,
                aspectRatio: frameRatio,
                width: `min(88%, calc((100vh - 340px) * ${frameRatio}))`,
                height: "auto",
                maxHeight: "none",
                containerType: "inline-size",
                transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${editor.zoom / 100})`,
              }}
            >
              {photoPreview.url && (
                <img
                  className="preview-image"
                  ref={previewImageRef}
                  src={photoPreview.url}
                  alt="Current photo being edited"
                  onPointerDown={() => {
                    if (
                      event.pointerType !== "mouse" ||
                      showBefore ||
                      cropping ||
                      editor.activeTool === "retouch"
                    )
                      return;
                    dispatch(actions.selectLayer(null));
                    dispatch(actions.setTool("layers"));
                  }}
                  draggable={false}
                  style={{
                    opacity:
                      showBefore || cropping
                        ? 1
                        : editor.baseVisible
                          ? editor.baseOpacity / 100
                          : 0,
                    objectFit: "fill",
                  }}
                />
              )}
              {cropping && editor.freeCrop && (
                <Suspense fallback={null}>
                  <CropOverlay />
                </Suspense>
              )}
              {editor.textLayer.enabled && !showBefore && !cropping && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: editor.textLayer.opacity / 100,
                    mixBlendMode: editor.textLayer.blend || "normal",
                    pointerEvents: "none",
                  }}
                >
                  {editingTextId !== "primary" && (
                    <TextArtwork
                      value={editor.textLayer}
                      width={dimensions.width}
                      height={dimensions.height}
                      size={editor.textLayer.size}
                      draggable={editor.activeTool !== "retouch"}
                      selected={editor.activeTool === "text"}
                      onMoveStart={() => {
                        saveSnapshot();
                        dispatch(actions.setTool("text"));
                      }}
                      onMove={(changes) =>
                        dispatch(actions.setTextLayer(changes))
                      }
                      onEdit={() => beginTextEdit("primary")}
                      primary
                    />
                  )}
                </div>
              )}
              {!showBefore && !cropping && editor.activeTool !== "retouch" && (
                <LayerPreview
                  snapEnabled={editor.snapEnabled}
                  onGuides={setGuides}
                  editingTextId={editingTextId}
                  onEditText={beginTextEdit}
                  dimensions={dimensions}
                  layers={editor.layers}
                  images={layerImages}
                  selectedId={
                    editor.activeTool === "layers"
                      ? editor.selectedLayerId
                      : null
                  }
                  onSelect={(id) => {
                    saveSnapshot();
                    dispatch(actions.selectLayer(id));
                    dispatch(actions.setTool("layers"));
                    if (mobileLayout === "photo") setMobileLayout("balanced");
                  }}
                  onMove={(id, changes) =>
                    dispatch(
                      actions.updateLayer({
                        id,
                        changes,
                        aspect: dimensions.width / dimensions.height,
                      }),
                    )
                  }
                />
              )}
              {!showBefore && editor.activeTool === "layers" && (
                <LayerHandles
                  locked={isLayerLocked(
                    editor.layers.find(
                      (layer) => layer.id === editor.selectedLayerId,
                    ),
                    editor.layers,
                  )}
                  layer={editor.layers.find(
                    (layer) => layer.id === editor.selectedLayerId,
                  )}
                  onStart={() => saveSnapshot()}
                  onChange={(id, changes) =>
                    dispatch(
                      actions.updateLayer({
                        id,
                        changes,
                        aspect: dimensions.width / dimensions.height,
                      }),
                    )
                  }
                />
              )}
              {!showBefore &&
                guides.map((guide, i) => (
                  <div
                    key={i}
                    className={`snap-guide snap-guide-${guide.axis}`}
                    style={
                      guide.axis === "x"
                        ? { left: `${guide.value}%` }
                        : { top: `${guide.value}%` }
                    }
                  />
                ))}
              {editor.activeTool === "retouch" && !showBefore && (
                <Suspense fallback={null}>
                  <RetouchCanvas
                    editor={editor}
                    settings={retouch}
                    setSettings={setRetouch}
                    previewImageRef={previewImageRef}
                    renderedPhoto={photoPreview.renderedPhoto}
                    previewUrl={photoPreview.url}
                    sampleCanvas={photoPreview.sampleCanvas}
                    sourceWidth={photoPreview.sourceWidth}
                    sourceHeight={photoPreview.sourceHeight}
                    announce={announce}
                  />
                </Suspense>
              )}
              {!showBefore &&
                !cropping &&
                ["text", "layers"].includes(editor.activeTool) &&
                !editingTextId &&
                (selectedText || editor.activeTool === "text") && (
                  <button
                    className="canvas-text-edit-button"
                    disabled={
                      !!selectedText &&
                      isLayerLocked(selectedText, editor.layers)
                    }
                    onClick={() => beginTextEdit(selectedText?.id || "primary")}
                  >
                    <Icon name="text" size={14} />
                    {selectedText || editor.textLayer.enabled
                      ? "Edit text"
                      : "Add text"}
                  </button>
                )}
              {editingTextId && editingText && !cropping && !showBefore && (
                <OnCanvasTextEditor
                  key={`${editor.projectId}:${editingTextId}`}
                  value={editingText}
                  onSave={saveCanvasText}
                  onCancel={() => setEditingTextId(null)}
                />
              )}
              {!editor.imageUrl &&
                !editor.baseAssetId &&
                !editor.isUploaded && (
                  <div className="image-loading empty-photo-prompt">
                    <Icon name="image" size={32} />
                    <strong>Upload a photo to start</strong>
                    <span>
                      JPG, PNG, WebP · drag and drop or choose a photo
                    </span>
                    <button
                      className="button primary"
                      onClick={() => fileRef.current?.click()}
                    >
                      Choose photo
                    </button>
                  </div>
                )}
              {photoPreview.error && (
                <div className="image-loading">
                  <span>{photoPreview.error}</span>
                  <button
                    className="button"
                    onClick={() => fileRef.current?.click()}
                  >
                    Upload photo
                  </button>
                </div>
              )}
              {photoPreview.busy && !photoPreview.url && (
                <span className="processing-badge" role="status">
                  Loading photo…
                </span>
              )}
            </div>
            <div className="canvas-bottom">
              <span>
                <span className="status-dot" /> All edits stay on your device
              </span>
              <span>
                {editor.imageUrl && photoPreview.sourceWidth
                  ? `${photoPreview.sourceWidth} × ${photoPreview.sourceHeight} px`
                  : "No photo uploaded"}
              </span>
            </div>
            <button
              className="replace-image"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={14} /> Replace image
            </button>
          </section>
          {mobilePastEdits && (
            <button
              className="mobile-past-backdrop"
              aria-label="Close past edits"
              onClick={() => setMobilePastEdits(false)}
            />
          )}
          <div
            className={`past-edits-container ${mobilePastEdits ? "mobile-open" : ""}`}
          >
            <div className="mobile-history-heading">
              <span>Past edits</span>
              <button
                aria-label="Close past edits"
                onClick={() => setMobilePastEdits(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <AutosavedEdits
              onAdd={() => {
                setMobilePastEdits(false);
                fileRef.current?.click();
              }}
              onOpen={() => setMobilePastEdits(false)}
              announce={announce}
            />
          </div>
        </main>
        <aside className="inspector">
          <div className="inspector-heading">
            <div>
              <span className="section-eyebrow">IMAGE STUDIO</span>
              <h1>
                {editor.activeTool === "projects"
                  ? "Projects & history"
                  : editor.activeTool === "assets"
                    ? "Assets & templates"
                    : editor.activeTool === "background"
                      ? "Background removal"
                      : editor.activeTool === "retouch"
                        ? "Brush & healing"
                        : editor.activeTool === "tone"
                          ? "Curves & levels"
                          : editor.activeTool === "color"
                            ? "Selective color & HSL"
                            : editor.activeTool === "detail"
                              ? "Sharpen & denoise"
                              : editor.activeTool === "adjust"
                                ? "Adjustments"
                                : editor.activeTool === "crop"
                                  ? "Crop & rotate"
                                  : editor.activeTool === "presets"
                                    ? "Looks"
                                    : editor.activeTool === "text"
                                      ? "Text & watermark"
                                      : editor.activeTool === "resize"
                                        ? "Resize image"
                                        : "Layers"}
              </h1>
            </div>
            <button
              className="mobile-panel-toggle mobile-only"
              aria-label={
                mobileLayout === "controls"
                  ? "Return to split view"
                  : "Expand editing controls"
              }
              aria-pressed={mobileLayout === "controls"}
              onClick={() =>
                setMobileLayout((value) =>
                  value === "controls" ? "balanced" : "controls",
                )
              }
            >
              {mobileLayout === "controls" ? "Split view" : "Expand controls"}
            </button>
            <button
              className="more-button"
              title="Reset all adjustments"
              onClick={() => {
                saveSnapshot();
                dispatch(actions.reset());
                announce("Adjustments reset.");
              }}
            >
              <Icon name="reset" size={17} />
            </button>
          </div>
          <Suspense
            fallback={
              <div className="p-5 text-xs text-[#999b90]">Loading tool…</div>
            }
          >
            {editor.activeTool === "projects" && (
              <ProjectsPanel dimensions={dimensions} announce={announce} />
            )}
            {editor.activeTool === "assets" && (
              <DesignLibrary dimensions={dimensions} announce={announce} />
            )}
            {["tone", "color", "detail", "background", "retouch"].includes(
              editor.activeTool,
            ) && (
              <PhotoPanel
                key={editor.activeTool}
                type={editor.activeTool}
                histogram={photoPreview.histogram}
                retouch={retouch}
                setRetouch={setRetouch}
                announce={announce}
              />
            )}
            {["text", "resize"].includes(editor.activeTool) && (
              <AdvancedPanel type={editor.activeTool} dimensions={dimensions} />
            )}
            {editor.activeTool === "adjust" && (
              <AdjustPanel editor={editor} change={change} />
            )}
            {editor.activeTool === "crop" && <CropPanel />}
            {editor.activeTool === "presets" && (
              <PresetsPanel editor={editor} applyPreset={applyPreset} />
            )}
            {editor.activeTool === "layers" && (
              <LayersPanel dimensions={dimensions} announce={announce} />
            )}
          </Suspense>
          <div className="inspector-footer">
            <div className="footer-meta">
              <span>
                LUMA STUDIO <span>·</span> BROWSER EDITION
              </span>
              <span>v1.0</span>
            </div>
            <p className="mt-2 text-[10px] text-[#a4a894]">
              <strong>Private by design</strong>
              <br />
              Your photos never leave your device
            </p>
          </div>
        </aside>
      </div>
      <input
        ref={fileRef}
        className="hidden-file"
        type="file"
        accept="image/*"
        onChange={(e) => {
          loadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {toast && (
        <div className="toast">
          <span className="toast-check">
            <Icon name="check" size={13} />
          </span>
          {toast}
        </div>
      )}
      {shortcutsOpen && (
        <Suspense fallback={<div className="modal-backdrop" />}>
          <ShortcutGuide onClose={() => setShortcutsOpen(false)} />
        </Suspense>
      )}
      {exportOpen && (
        <Suspense
          fallback={<div className="modal-backdrop">Loading export…</div>}
        >
          <ExportDialog
            editor={editor}
            dimensions={dimensions}
            working={working}
            download={download}
            onClose={() => setExportOpen(false)}
            previewUrl={photoPreview.url}
            ready={loaded}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
