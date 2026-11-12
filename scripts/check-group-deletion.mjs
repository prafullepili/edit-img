import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { addEventListener() {}, dispatchEvent() {} };
const dir = await mkdtemp(join(tmpdir(), "luma-delete-check-")),
  file = join(dir, "delete.cjs");
try {
  await build({
    stdin: {
      contents:
        "export { store, actions } from './src/store.js'; export { requestLayerDeletion } from './src/features/editor/layerDeletion.js';",
      resolveDir: process.cwd(),
    },
    outfile: file,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  const { store, actions, requestLayerDeletion } = createRequire(
    import.meta.url,
  )(file);
  for (const id of ["outside", "a", "b", "c"])
    store.dispatch(
      actions.addLayer({
        id,
        type: "rectangle",
        name: id,
        visible: true,
        x: 50,
        y: 50,
        width: 30,
        height: 20,
        rotation: 0,
        opacity: 100,
      }),
    );
  store.dispatch(
    actions.groupLayers({
      ids: ["a", "b", "c"],
      id: "group-1",
      name: "Sale card",
    }),
  );
  const ids = () => store.getState().editor.layers.map((layer) => layer.id);
  const historyLength = store.getState().editor.history.length;
  let confirmation = "";
  assert.deepEqual(
    requestLayerDeletion("a", (message) => {
      confirmation = message;
      return false;
    }),
    [],
  );
  assert.match(confirmation, /Sale card/);
  assert.match(confirmation, /3 layers/);
  assert.deepEqual(ids(), ["outside", "a", "b", "c"]);
  assert.equal(
    store.getState().editor.history.length,
    historyLength,
    "Cancel adds no undo entries",
  );
  assert.deepEqual(
    requestLayerDeletion("b", () => true),
    ["a", "b", "c"],
  );
  assert.deepEqual(ids(), ["outside"]);
  assert.equal(store.getState().editor.history.length, historyLength + 1);
  assert.equal(store.getState().editor.selectedLayerId, "outside");
  store.dispatch(actions.undo());
  assert.deepEqual(ids(), ["outside", "a", "b", "c"]);
  assert.ok(
    store
      .getState()
      .editor.layers.filter((layer) => layer.groupId === "group-1").length ===
      3,
  );
  assert.equal(store.getState().editor.selectedLayerId, "c");
  store.dispatch(actions.redo());
  assert.deepEqual(ids(), ["outside"]);
  store.dispatch(actions.undo());
  store.dispatch(actions.setLayerLock({ id: "a", locked: true }));
  assert.deepEqual(
    requestLayerDeletion("b", () => {
      throw new Error("Locked group must not prompt");
    }),
    [],
  );
  store.dispatch(actions.removeGroup("group-1"));
  assert.deepEqual(ids(), ["outside", "a", "b", "c"]);
  assert.deepEqual(
    requestLayerDeletion("outside", () => {
      throw new Error("Single layer needs no group confirmation");
    }),
    ["outside"],
  );
  assert.deepEqual(ids(), ["a", "b", "c"]);
  assert.deepEqual(
    requestLayerDeletion("missing", () => true),
    [],
  );
  store.dispatch(actions.removeGroup(null));
  assert.deepEqual(ids(), ["a", "b", "c"]);
  console.log(
    "Passed: group confirmation, cancellation without changes, atomic group deletion, undo/redo, selection restoration, lock protection, individual deletion.",
  );
} finally {
  await unlink(file).catch(() => {});
  await rmdir(dir);
}
