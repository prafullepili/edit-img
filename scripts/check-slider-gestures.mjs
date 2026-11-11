import assert from "node:assert/strict";
import {
  createSliderGesture,
  sliderGestureValue,
} from "../src/components/sliderGesture.js";
const start = (options = {}) =>
  createSliderGesture({
    x: 80,
    y: 20,
    left: 0,
    width: 200,
    min: 0,
    max: 100,
    step: 1,
    value: 20,
    pointerType: "touch",
    ...options,
  });
let gesture = start();
assert.equal(
  sliderGestureValue(gesture, 80, 20),
  null,
  "Touch-down never jumps a value",
);
assert.equal(
  sliderGestureValue(gesture, 82, 38),
  null,
  "Vertical scroll does not adjust a slider",
);
assert.equal(
  sliderGestureValue(gesture, 150, 55),
  null,
  "A scrolling gesture stays scrolling if the finger drifts sideways",
);
assert.equal(sliderGestureValue(gesture, 150, 55, true), null);
gesture = start();
assert.equal(
  sliderGestureValue(gesture, 85, 21),
  null,
  "Small movement waits for direction",
);
assert.equal(
  sliderGestureValue(gesture, 100, 22),
  30,
  "Intentional horizontal drag preserves the initial thumb grip",
);
assert.equal(
  sliderGestureValue(gesture, 240, 24),
  100,
  "Values remain clamped",
);
gesture = start();
assert.equal(sliderGestureValue(gesture, 80, 20), null);
assert.equal(
  sliderGestureValue(gesture, 80, 20, true),
  40,
  "An intentional tap changes only on release",
);
gesture = start();
assert.equal(
  sliderGestureValue(gesture, 90, 29),
  null,
  "Ambiguous diagonal motion waits instead of applying",
);
assert.equal(
  sliderGestureValue(gesture, 91, 36),
  null,
  "Diagonal scrolling is then recognized",
);
gesture = start({ min: -100, max: 100, step: 0.5 });
assert.equal(sliderGestureValue(gesture, 50, 20, true), -10);
gesture = start({ min: 0.1, max: 3, step: 0.05, value: 1 });
assert.equal(sliderGestureValue(gesture, 100, 20, true), 1.3);
gesture = start({ pointerType: "mouse" });
assert.equal(
  sliderGestureValue(gesture, 80, 20),
  40,
  "Mouse controls still respond immediately",
);
console.log(
  "Passed: scroll-safe touch sliders, direction lock, tap-on-release, horizontal dragging, clamping, decimals, mouse behavior.",
);

const { createFrameValueEmitter } =
  await import("../src/components/frameValueEmitter.js");
const callbacks = new Map(),
  emitted = [];
let frameId = 0;
const emitter = createFrameValueEmitter(
  (value) => emitted.push(value),
  (callback) => {
    callbacks.set(++frameId, callback);
    return frameId;
  },
  (id) => callbacks.delete(id),
);
emitter.queue(10);
emitter.queue(20);
emitter.queue(30);
assert.equal(callbacks.size, 1);
assert.deepEqual(emitted, []);
const firstFrame = [...callbacks.values()][0];
callbacks.clear();
firstFrame();
assert.deepEqual(
  emitted,
  [30],
  "Rapid moves emit the latest value once per frame",
);
emitter.queue(40);
emitter.queue(45);
emitter.flush();
assert.deepEqual(emitted, [30, 45], "Release flushes the exact final value");
assert.equal(callbacks.size, 0);
emitter.queue(50);
emitter.dispose();
assert.equal(callbacks.size, 0);
assert.deepEqual(emitted, [30, 45], "Unmount drops pending callbacks");
console.log(
  "Passed: frame-coalesced slider updates, final value flushing, cleanup.",
);
