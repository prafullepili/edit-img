import { build } from "esbuild";
import assert from "node:assert/strict";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const directory = await mkdtemp(join(tmpdir(), "luma-layer-check-"));
const files = ["store.cjs", "layers.cjs", "transforms.cjs", "editing.cjs"].map(
  (name) => join(directory, name),
);
globalThis.localStorage = {
  getItem: () => null,
  setItem: (key, value) => {
    globalThis.savedProject = JSON.parse(value);
  },
};
globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.document = { fonts: { ready: Promise.resolve() } };
try {
  for (const [index, entry] of [
    "src/store.js",
    "src/layers.jsx",
    "src/layerTransforms.js",
    "src/layerEditing.js",
  ].entries())
    await build({
      entryPoints: [entry],
      outfile: files[index],
      bundle: true,
      platform: "node",
      format: "cjs",
      logLevel: "silent",
    });
  const require = createRequire(import.meta.url);
  const { store, actions } = require(files[0]);
  const { drawLayers, layerDefaults, shapePaint, getLayerScale } = require(
    files[1],
  );
  const {
    startLayerTransform,
    resizeLayerFromHandle,
    rotateLayerFromHandle,
  } = require(files[2]);
  const frame = { width: 1000, height: 600 };
  const original = { ...layerDefaults, x: 50, y: 50, rotation: 0 };
  const gesture = startLayerTransform(
    original,
    frame,
    { x: 700, y: 375 },
    [1, 1],
  );
  const resized = resizeLayerFromHandle(gesture, { x: 1100, y: 525 });
  assert.equal(resized.scale, 2);
  assert.equal(resized.x, 70);
  assert.equal(resized.y, 62.5);
  assert.equal(resizeLayerFromHandle(gesture, { x: 0, y: 0 }).scale, 0.1);
  assert.equal(resizeLayerFromHandle(gesture, { x: 99999, y: 99999 }).scale, 4);
  const rotated = startLayerTransform(
    { ...original, rotation: 90 },
    frame,
    { x: 425, y: 500 },
    [1, 1],
  );
  const resizedRotated = resizeLayerFromHandle(rotated, { x: 275, y: 900 });
  assert.ok(Math.abs(resizedRotated.scale - 2) < 1e-10);
  assert.ok(Math.abs(resizedRotated.x - 42.5) < 1e-10);
  assert.ok(Math.abs(resizedRotated.y - (500 / 600) * 100) < 1e-10);
  const rotationGesture = startLayerTransform(
    original,
    frame,
    { x: 500, y: 200 },
    null,
  );
  assert.equal(
    rotateLayerFromHandle(rotationGesture, { x: 600, y: 300 }).rotation,
    90,
  );
  assert.equal(
    rotateLayerFromHandle(rotationGesture, { x: 600, y: 310 }, true).rotation,
    90,
  );
  const wrapped = startLayerTransform(
    { ...original, rotation: 175 },
    frame,
    { x: 400, y: 301 },
    null,
  );
  assert.ok(
    Math.abs(
      rotateLayerFromHandle(wrapped, { x: 400, y: 299 }).rotation -
        176.14587739536697,
    ) < 0.00001,
  );
  const {
    layerBounds,
    selectionBounds,
    alignSelection,
    snapSelection,
    groupTransform,
    maskGeometry,
    maskSvgPath,
    clipLayerMask,
    isLayerLocked,
  } = require(files[3]);
  const rectangle = {
    ...layerDefaults,
    id: "rect",
    type: "rectangle",
    name: "Rectangle",
  };
  const text = {
    ...layerDefaults,
    id: "text",
    type: "text",
    name: "Text",
    text: "Hello",
  };
  store.dispatch(actions.snapshot());
  store.dispatch(actions.addLayer(rectangle));
  store.dispatch(actions.snapshot());
  store.dispatch(actions.addLayer(text));
  store.dispatch(actions.snapshot());
  store.dispatch(actions.moveLayer({ id: "text", direction: -1 }));
  assert.deepEqual(
    store.getState().editor.layers.map((l) => l.id),
    ["text", "rect"],
  );
  store.dispatch(actions.undo());
  assert.deepEqual(
    store.getState().editor.layers.map((l) => l.id),
    ["rect", "text"],
  );
  store.dispatch(actions.redo());
  assert.deepEqual(
    store.getState().editor.layers.map((l) => l.id),
    ["text", "rect"],
  );
  store.dispatch(actions.snapshot());
  store.dispatch(actions.removeLayer("text"));
  assert.equal(store.getState().editor.selectedLayerId, "rect");
  store.dispatch(actions.undo());
  assert.equal(store.getState().editor.layers.length, 2);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(globalThis.savedProject.layers.length, 2);
  const calls = [];
  const ctx = {
    save() {},
    restore() {},
    translate(x, y) {
      calls.push(["position", x, y]);
    },
    rotate() {},
    scale(x, y) {
      calls.push(["scale", x, y]);
    },
    fillRect() {
      calls.push(["rectangle"]);
    },
    beginPath() {},
    rect(...args) {
      calls.push(["rect", ...args]);
    },
    clip() {},
    ellipse() {
      calls.push(["ellipse"]);
    },
    fill() {
      calls.push(["fill", this.fillStyle]);
    },
    stroke() {
      calls.push(["stroke", this.strokeStyle, this.lineWidth]);
    },
    measureText(text) {
      return { width: text.length * 10 };
    },
    fillText(text) {
      calls.push(["text", text]);
    },
    drawImage() {
      calls.push(["image"]);
    },
  };
  await drawLayers(
    ctx,
    [{ ...rectangle, visible: false }, text, { ...rectangle, type: "ellipse" }],
    {},
    1000,
    600,
  );
  assert.equal(
    calls.some((c) => c[0] === "rectangle"),
    false,
  );
  assert.deepEqual(
    calls.filter((c) => ["text", "ellipse"].includes(c[0])),
    [["text", "Hello"], ["ellipse"]],
  );
  assert.deepEqual(calls[0], ["position", 500, 300]);
  assert.equal(shapePaint({ color: "#123456" }, 400, 150).fill, "#123456");
  assert.equal(shapePaint({ color: "#123456" }, 400, 150).stroke, "none");
  const bordered = {
    ...rectangle,
    fillEnabled: false,
    borderEnabled: true,
    borderColor: "#ff0000",
    borderWidth: 12,
  };
  assert.deepEqual(shapePaint(bordered, 400, 150, 0.5), {
    fill: "none",
    stroke: "#ff0000",
    borderWidth: 6,
    inset: 3,
    width: 394,
    height: 144,
  });
  assert.equal(
    shapePaint({ ...bordered, borderWidth: 200 }, 40, 10).borderWidth,
    10,
  );
  calls.length = 0;
  await drawLayers(ctx, [bordered], {}, 500, 300, 1000);
  assert.equal(
    calls.some((c) => c[0] === "fill"),
    false,
  );
  assert.deepEqual(calls.at(-1), ["stroke", "#ff0000", 6]);
  assert.deepEqual(
    calls.find((c) => c[0] === "rect"),
    ["rect", -97, -34.5, 194, 69],
  );
  calls.length = 0;
  await drawLayers(
    ctx,
    [
      {
        ...bordered,
        type: "ellipse",
        fillEnabled: true,
        color: "#00ff00",
        borderEnabled: false,
      },
    ],
    {},
    1000,
    600,
  );
  assert.deepEqual(calls.at(-1), ["fill", "#00ff00"]);
  assert.equal(
    calls.some((c) => c[0] === "stroke"),
    false,
  );
  assert.equal(getLayerScale({}), 1);
  assert.equal(getLayerScale({ scale: 99 }), 4);
  assert.equal(getLayerScale({ scale: -1 }), 0.1);
  calls.length = 0;
  await drawLayers(ctx, [{ ...rectangle, scale: 2 }], {}, 1000, 600);
  assert.deepEqual(
    calls.find((c) => c[0] === "scale"),
    ["scale", 2, 2],
  );
  store.dispatch(actions.snapshot());
  store.dispatch(actions.updateLayer({ id: "rect", changes: { scale: 2 } }));
  store.dispatch(actions.undo());
  assert.equal(
    getLayerScale(store.getState().editor.layers.find((l) => l.id === "rect")),
    1,
  );
  store.dispatch(actions.redo());
  assert.equal(
    getLayerScale(store.getState().editor.layers.find((l) => l.id === "rect")),
    2,
  );
  globalThis.Image = class {
    set src(url) {
      queueMicrotask(() => this.onload());
    }
  };
  await drawLayers(
    ctx,
    [
      {
        ...rectangle,
        type: "image",
        assetId: "asset",
        blend: "multiply",
        opacity: 40,
      },
    ],
    { asset: "blob:test" },
    1000,
    600,
  );
  assert.equal(ctx.globalCompositeOperation, "multiply");
  assert.equal(ctx.globalAlpha, 0.4);
  assert.equal(calls.at(-1)[0], "image");
  await assert.rejects(
    drawLayers(
      ctx,
      [{ ...rectangle, type: "image", assetId: "missing" }],
      {},
      1000,
      600,
    ),
    /Wait for image layers/,
  );
  const groupA = {
    ...rectangle,
    id: "a",
    x: 30,
    y: 40,
    groupId: "g",
    groupName: "Group",
  };
  const groupB = {
    ...text,
    id: "b",
    x: 60,
    y: 40,
    groupId: "g",
    groupName: "Group",
  };
  const moved = groupTransform(groupA, [groupA, groupB], { x: 40, y: 50 }, 2);
  assert.equal(moved[1].changes.x, 70);
  assert.equal(moved[1].changes.y, 50);
  const turned = groupTransform(groupA, [groupA, groupB], { rotation: 90 }, 2);
  assert.ok(Math.abs(turned[1].changes.x - 30) < 1e-8);
  assert.ok(Math.abs(turned[1].changes.y - 100) < 1e-8);
  const scaled = groupTransform(groupA, [groupA, groupB], { scale: 2 }, 2);
  assert.equal(scaled[1].changes.x, 90);
  assert.equal(scaled[1].changes.scale, 2);
  assert.equal(
    isLayerLocked(groupA, [groupA, { ...groupB, locked: true }]),
    true,
  );
  assert.equal(alignSelection(rectangle, [rectangle], "left", 2).x, 20);
  assert.equal(
    alignSelection({ ...rectangle, rotation: 90 }, [rectangle], "top", 2).y,
    40,
  );
  const snapped = snapSelection(
    { ...rectangle, x: 25, y: 25 },
    { x: 49.8, y: 49.8 },
    [],
    { width: 1000, height: 600 },
  );
  assert.equal(snapped.changes.x, 50);
  assert.equal(snapped.changes.y, 50);
  assert.equal(snapped.guides.length, 2);
  assert.equal(
    snapSelection({ ...rectangle, x: 25, y: 25 }, { x: 47, y: 47 }, [], {
      width: 1000,
      height: 600,
    }).guides.length,
    0,
  );
  const mask = {
    enabled: true,
    type: "rectangle",
    x: 10,
    y: 20,
    width: 50,
    height: 60,
  };
  calls.length = 0;
  ctx.clip = (rule) => calls.push(["clip", rule]);
  ctx.moveTo = () => {};
  clipLayerMask(ctx, mask, 400, 200);
  assert.deepEqual(
    calls.find((c) => c[0] === "rect"),
    ["rect", -160, -60, 200, 120],
  );
  assert.deepEqual(calls.at(-1), ["clip", "nonzero"]);
  calls.length = 0;
  clipLayerMask(ctx, { ...mask, type: "ellipse", inverted: true }, 400, 200);
  assert.equal(
    calls.some((c) => c[0] === "ellipse"),
    true,
  );
  assert.deepEqual(calls.at(-1), ["clip", "evenodd"]);
  assert.ok(maskSvgPath({ ...mask, inverted: true }).startsWith("M 0 0 H 1"));
  assert.equal(
    maskGeometry({ ...mask, x: 80, width: 50 }).width,
    0.19999999999999996,
  );
  store.dispatch(actions.discardDraft());
  store.dispatch(actions.addLayer({ ...rectangle, id: "a" }));
  store.dispatch(actions.addLayer({ ...text, id: "b", x: 70 }));
  store.dispatch(
    actions.groupLayers({ ids: ["a", "b"], id: "group", name: "Test group" }),
  );
  assert.equal(
    store.getState().editor.layers.every((l) => l.groupId === "group"),
    true,
  );
  store.dispatch(actions.snapshot());
  store.dispatch(actions.setLayerLock({ id: "a", locked: true }));
  store.dispatch(actions.updateLayer({ id: "b", changes: { x: 99 } }));
  store.dispatch(actions.removeLayer("b"));
  store.dispatch(actions.ungroupLayers("group"));
  assert.equal(store.getState().editor.layers.length, 2);
  assert.equal(store.getState().editor.layers[1].x, 70);
  assert.equal(store.getState().editor.layers[1].groupId, "group");
  store.dispatch(actions.undo());
  assert.equal(
    store.getState().editor.layers.some((l) => l.locked),
    false,
  );
  store.dispatch(actions.snapshot());
  store.dispatch(actions.ungroupLayers("group"));
  assert.equal(
    store.getState().editor.layers.some((l) => l.groupId),
    false,
  );
  store.dispatch(actions.undo());
  assert.equal(
    store.getState().editor.layers.every((l) => l.groupId === "group"),
    true,
  );
  store.dispatch(actions.snapshot());
  store.dispatch(
    actions.updateLayer({ id: "a", changes: { x: 60 }, aspect: 2 }),
  );
  assert.equal(store.getState().editor.layers[1].x, 80);
  store.dispatch(actions.undo());
  assert.equal(store.getState().editor.layers[1].x, 70);
  store.dispatch(actions.setSnap(false));
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(globalThis.savedProject.snapEnabled, false);
  assert.equal(globalThis.savedProject.layers[1].groupId, "group");
  store.dispatch(actions.snapshot());
  store.dispatch(actions.setPhoto({ sharpen: 25, denoise: 20 }));
  store.dispatch(
    actions.setFreeCrop({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }),
  );
  store.dispatch(
    actions.addStroke({
      tool: "eraser",
      radius: 0.01,
      points: [{ x: 0.5, y: 0.5 }],
    }),
  );
  store.dispatch(actions.setBaseAsset("derived-test"));
  store.dispatch(actions.undo());
  assert.equal(store.getState().editor.photo.sharpen, 0);
  assert.equal(store.getState().editor.photo.strokes.length, 0);
  assert.equal(store.getState().editor.freeCrop, null);
  assert.equal(store.getState().editor.baseAssetId, null);
  store.dispatch(actions.redo());
  assert.equal(store.getState().editor.photo.sharpen, 25);
  assert.equal(store.getState().editor.photo.strokes.length, 1);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(globalThis.savedProject.photo.denoise, 20);
  assert.equal(globalThis.savedProject.baseAssetId, "derived-test");
  assert.equal(globalThis.savedProject.freeCrop.width, 0.8);
  const beforeDesign = store.getState().editor.layers.length;
  store.dispatch(actions.snapshot());
  store.dispatch(
    actions.addDesign({
      layers: [
        {
          ...rectangle,
          id: "design-layer",
          type: "text",
          text: "Template title",
          fontFamily: "Georgia",
          letterSpacing: 3,
          outlineWidth: 2,
        },
      ],
      textLayer: { enabled: true, text: "Reusable", shadowBlur: 16 },
    }),
  );
  assert.equal(store.getState().editor.layers.length, beforeDesign + 1);
  assert.equal(store.getState().editor.layers.at(-1).fontFamily, "Georgia");
  assert.equal(store.getState().editor.textLayer.shadowBlur, 16);
  store.dispatch(actions.undo());
  assert.equal(store.getState().editor.layers.length, beforeDesign);
  store.dispatch(actions.redo());
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(globalThis.savedProject.layers.at(-1).outlineWidth, 2);
  store.dispatch(actions.snapshot());
  const priorSharpen = store.getState().editor.photo.sharpen;
  store.dispatch(
    actions.restoreVersion({
      photo: { ...store.getState().editor.photo, sharpen: 77 },
    }),
  );
  assert.equal(store.getState().editor.photo.sharpen, 77);
  store.dispatch(actions.undo());
  assert.equal(store.getState().editor.photo.sharpen, priorSharpen);
  // Every polygon shape exports through the same fill/border path as rectangles.
  ctx.moveTo = (...args) => calls.push(["move", ...args]);
  ctx.lineTo = (...args) => calls.push(["line", ...args]);
  ctx.closePath = () => calls.push(["close"]);
  for (const [type, vertices] of [
    ["triangle", 3],
    ["diamond", 4],
    ["pentagon", 5],
    ["hexagon", 6],
    ["star", 10],
    ["arrow", 7],
  ]) {
    calls.length = 0;
    await drawLayers(
      ctx,
      [
        {
          ...rectangle,
          type,
          borderEnabled: true,
          borderWidth: 4,
          borderColor: "#ff0000",
        },
      ],
      {},
      1000,
      600,
    );
    assert.equal(
      calls.filter((call) => call[0] === "line").length,
      vertices - 1,
      type,
    );
    assert.equal(calls.filter((call) => call[0] === "move").length, 1, type);
    assert.ok(
      calls.some((call) => call[0] === "close"),
      type,
    );
    assert.ok(
      calls.some((call) => call[0] === "fill"),
      type,
    );
    assert.ok(
      calls.some((call) => call[0] === "stroke"),
      type,
    );
    for (const call of calls.filter((call) =>
      ["line", "move"].includes(call[0]),
    ))
      assert.ok(call.slice(1).every(Number.isFinite));
  }
  console.log(
    "Passed: triangle, diamond, pentagon, hexagon, star and arrow export with fill and borders.",
  );
  store.dispatch(actions.discardDraft());
  for (const id of ["a", "b", "c", "d"])
    store.dispatch(actions.addLayer({ ...rectangle, id }));
  const order = () => store.getState().editor.layers.map((layer) => layer.id);
  store.dispatch(actions.snapshot());
  store.dispatch(
    actions.reorderLayer({ id: "a", targetId: "d", position: "before" }),
  );
  assert.deepEqual(order(), ["b", "c", "d", "a"]);
  store.dispatch(actions.undo());
  assert.deepEqual(order(), ["a", "b", "c", "d"]);
  store.dispatch(actions.redo());
  assert.deepEqual(order(), ["b", "c", "d", "a"]);
  store.dispatch(
    actions.reorderLayer({ id: "a", targetId: "c", position: "after" }),
  );
  assert.deepEqual(order(), ["b", "a", "c", "d"]);
  store.dispatch(
    actions.groupLayers({
      ids: ["a", "c"],
      id: "drag-group",
      name: "Drag group",
    }),
  );
  store.dispatch(
    actions.reorderLayer({ id: "a", targetId: "d", position: "before" }),
  );
  assert.deepEqual(order(), ["b", "d", "a", "c"]);
  store.dispatch(
    actions.reorderLayer({ id: "a", targetId: "c", position: "after" }),
  );
  assert.deepEqual(order(), ["b", "d", "a", "c"], "Cannot split a group");
  store.dispatch(actions.setLayerLock({ id: "d", locked: true }));
  store.dispatch(
    actions.reorderLayer({ id: "b", targetId: "c", position: "before" }),
  );
  assert.deepEqual(order(), ["b", "d", "a", "c"], "Cannot cross locked layer");
  store.dispatch(
    actions.reorderLayer({ id: "d", targetId: "b", position: "after" }),
  );
  assert.deepEqual(order(), ["b", "d", "a", "c"], "Cannot drag locked layer");
  store.dispatch(
    actions.reorderLayer({ id: "missing", targetId: "b", position: "after" }),
  );
  assert.deepEqual(order(), ["b", "d", "a", "c"]);
  store.dispatch(actions.selectLayer("b"));
  store.dispatch(actions.snapshot());
  store.dispatch(actions.removeLayer("b"));
  assert.deepEqual(order(), ["d", "a", "c"]);
  store.dispatch(actions.undo());
  assert.deepEqual(order(), ["b", "d", "a", "c"]);
  assert.equal(store.getState().editor.selectedLayerId, "b");
  console.log(
    "Passed: drag ordering above/below, group integrity, lock barriers, invalid targets, undo/redo, undoable row deletion.",
  );
  console.log(
    "Passed: locking, grouping and ungrouping, group transforms and undo, alignment, guide snapping, normal and inverted masks, persistence.",
  );
  console.log(
    "Passed: layer ordering, undo/redo, deletion selection, persisted metadata, visibility, positioning, text/shape/image export, fill and border colors, transparent fills, scaled and clamped border width, legacy shapes, selected layer zoom, corner resize anchors, rotated resizing, scale limits, rotation snapping and angle wrap, zoom undo/redo, blend and opacity, missing-image handling.",
  );
} finally {
  for (const file of files) await unlink(file).catch(() => {});
  await rmdir(directory);
}
