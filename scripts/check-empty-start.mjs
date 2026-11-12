import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
let stored = null;
globalThis.localStorage = { getItem: () => stored };
const dir = await mkdtemp(join(tmpdir(), "luma-empty-check-")),
  file = join(dir, "empty.cjs");
try {
  await build({
    stdin: {
      contents:
        "export { default as reducer, actions } from './src/features/editor/editorSlice.js'; export { saveDraft } from './src/imageStorage.js';",
      resolveDir: process.cwd(),
    },
    outfile: file,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  const require = createRequire(import.meta.url);
  const load = (value) => {
    stored = value ? JSON.stringify(value) : null;
    delete require.cache[file];
    return require(file);
  };
  let module = load(null),
    initial = module.reducer(undefined, { type: "init" });
  assert.equal(initial.imageUrl, "");
  assert.equal(initial.imageName, "Upload a photo");
  assert.equal(initial.isUploaded, false);
  await module.saveDraft(initial); // No IndexedDB is available: blank projects must not open it.
  module = load({
    projectId: "demo",
    isUploaded: false,
    imageName: "alpine-lake.jpg",
  });
  assert.equal(module.reducer(undefined, { type: "init" }).imageUrl, "");
  assert.equal(
    module.reducer(undefined, { type: "init" }).imageName,
    "Upload a photo",
  );
  module = load({
    projectId: "my-photo",
    isUploaded: true,
    imageName: "family.jpg",
    projectTitle: "Family",
  });
  initial = module.reducer(undefined, { type: "init" });
  assert.equal(initial.projectId, "my-photo");
  assert.equal(initial.imageName, "family.jpg");
  assert.equal(initial.isUploaded, true);
  const restored = module.reducer(
    initial,
    module.actions.restoreImage({ url: "blob:local-source" }),
  );
  assert.equal(restored.imageUrl, "blob:local-source");
  assert.equal(
    module.reducer(restored, module.actions.discardDraft()).imageUrl,
    "",
  );
  console.log(
    "Passed: blank startup, legacy sample migration, uploaded project restoration, no blank autosaves, blank reset.",
  );
} finally {
  await unlink(file).catch(() => {});
  await rmdir(dir);
}
