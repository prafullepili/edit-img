import assert from "node:assert/strict";
const workers = [];
globalThis.Worker = class {
  constructor() {
    workers.push(this);
  }
  postMessage(message) {
    this.message = message;
  }
  terminate() {
    this.terminated = true;
  }
};
globalThis.ImageData = class {
  constructor(data, width, height) {
    Object.assign(this, { data, width, height });
  }
};
const { processImageData } = await import("../src/features/photo/client.js");
const image = () =>
  new ImageData(new Uint8ClampedArray([10, 20, 30, 255]), 1, 1);
const controller = new AbortController();
const stale = processImageData(image(), {}, {}, { signal: controller.signal });
const rejected = assert.rejects(stale, { name: "AbortError" });
const exported = processImageData(image(), {}, {});
assert.equal(workers.length, 2);
controller.abort();
await rejected;
assert.equal(workers[0].terminated, true);
assert.equal(workers[1].terminated, undefined);
const next = new AbortController();
const latest = processImageData(image(), {}, {}, { signal: next.signal });
function finish(worker) {
  worker.onmessage({
    data: {
      id: worker.message.id,
      pixels: new Uint8ClampedArray([10, 20, 30, 255]).buffer,
      histogram: {},
    },
  });
}
finish(workers[2]);
assert.equal((await latest).data.data[0], 10);
next.abort();
assert.equal(
  workers[2].terminated,
  undefined,
  "Completed preview worker remains reusable",
);
finish(workers[1]);
await exported;
const cancelled = new AbortController();
cancelled.abort();
assert.throws(
  () => processImageData(image(), {}, {}, { signal: cancelled.signal }),
  { name: "AbortError" },
);
console.log(
  "Passed: stale preview cancellation, independent export, replacement render, worker reuse, pre-aborted render.",
);

const { createPreviewQueue } =
  await import("../src/features/photo/previewQueue.js");
const frames = [],
  rendered = [],
  shown = [],
  errors = [];
let finishRender;
const queue = createPreviewQueue({
  schedule: (fn) => {
    frames.push(fn);
    return frames.length;
  },
  cancel: () => {},
  render: (job) => {
    rendered.push(job.revision);
    return new Promise((resolve) => {
      finishRender = resolve;
    });
  },
  publish: (result, job) => shown.push(job.revision),
  onError: (error) => errors.push(error),
});
queue.submit({ key: "photo-a", revision: 1 });
const firstFrame = frames.shift()();
queue.submit({ key: "photo-a", revision: 2 });
queue.submit({ key: "photo-a", revision: 3 });
finishRender("first");
await firstFrame;
assert.deepEqual(
  shown,
  [1],
  "Drawing publishes an in-flight frame even when points keep arriving",
);
const nextFrame = frames.shift()();
assert.deepEqual(
  rendered,
  [1, 3],
  "Intermediate points coalesce into the latest stroke snapshot",
);
queue.submit({ key: "photo-b", revision: 4 });
finishRender("obsolete source");
await nextFrame;
assert.deepEqual(shown, [1], "Old image or crop must not replace a new photo");
const lastFrame = frames.shift()();
finishRender("new source");
await lastFrame;
assert.deepEqual(shown, [1, 4]);
queue.submit({ key: "photo-b", revision: 5 });
const disposedFrame = frames.shift()();
queue.dispose();
finishRender("unmounted");
await disposedFrame;
assert.deepEqual(shown, [1, 4]);
assert.deepEqual(errors, []);
console.log(
  "Passed: continuous live stroke publication, latest-only queued work, source isolation, unmount cleanup.",
);

const { createLiveBrush } = await import("../src/features/photo/liveBrush.js");
const stamps = [],
  gradients = [];
let textures = 0;
const drawing = {
  save() {},
  restore() {},
  drawImage(texture, x, y) {
    stamps.push({
      texture,
      x,
      y,
      alpha: this.globalAlpha,
      mode: this.globalCompositeOperation,
    });
  },
};
const makeCanvas = () => {
  textures++;
  return {
    getContext: () => ({
      createRadialGradient(...args) {
        gradients.push(args);
        return { addColorStop() {} };
      },
      fillRect() {},
    }),
  };
};
const brush = createLiveBrush(
  drawing,
  { radius: 10, color: "#ff0000", opacity: 0.5, hardness: 0.7, tool: "brush" },
  makeCanvas,
);
brush.start({ x: 100, y: 100 });
brush.move({ x: 106, y: 100 });
brush.move({ x: 109, y: 100 });
brush.move({ x: 109, y: 100 });
assert.equal(textures, 1, "Brush texture is built once per stroke");
assert.equal(
  stamps.length,
  4,
  "Movement draws new segments only, without replaying old points",
);
assert.ok(
  stamps.every((stamp) => stamp.alpha === 0.5 && stamp.mode === "source-over"),
);
assert.equal(stamps.at(-1).x + stamps.at(-1).texture.width / 2, 109);
assert.equal(gradients[0][2], 7, "Hardness controls the solid center");
const eraser = createLiveBrush(
  drawing,
  { radius: 10, color: "#ffffff", opacity: 1, hardness: 1, tool: "eraser" },
  makeCanvas,
);
eraser.start({ x: 20, y: 20 });
assert.equal(stamps.at(-1).mode, "destination-out");
console.log(
  "Passed: incremental direct brush drawing, cached stamps, stable brush radius, edge hardness, eraser compositing.",
);

const sampled = [],
  masked = [];
const fixedSource = { width: 200, height: 100 };
const makeHealingCanvas = () => ({
  getContext: () => ({
    createRadialGradient() {
      return { addColorStop() {} };
    },
    fillRect() {},
    clearRect() {},
    drawImage(texture, ...args) {
      if (texture === fixedSource) sampled.push(args);
      else masked.push(this.globalCompositeOperation);
    },
  }),
});
const heal = createLiveBrush(
  drawing,
  {
    radius: 10,
    color: "#ffffff",
    opacity: 0.6,
    hardness: 0.5,
    tool: "heal",
    sampleCanvas: fixedSource,
    sourcePoint: { x: 20, y: 30 },
    sampleScale: 2,
  },
  makeHealingCanvas,
);
heal.start({ x: 100, y: 100 });
heal.move({ x: 103, y: 100 });
heal.move({ x: 103, y: 100 });
assert.equal(sampled.length, 2, "Healing samples only newly painted segments");
assert.equal(
  sampled[1][0] - sampled[0][0],
  6,
  "Healing source follows the brush at the correct preview scale",
);
assert.equal(sampled[0][2], 48);
assert.ok(masked.every((mode) => mode === "destination-in"));
assert.equal(stamps.at(-1).alpha, 0.6);
assert.equal(stamps.at(-1).mode, "source-over");
console.log(
  "Passed: incremental healing, fixed source snapshot, scaled source offsets, feathered mask and opacity.",
);
