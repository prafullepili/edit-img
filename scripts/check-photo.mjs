import { build } from "esbuild";
import assert from "node:assert/strict";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const dir = await mkdtemp(join(tmpdir(), "luma-photo-check-")),
  file = join(dir, "photo.cjs");
try {
  await build({
    stdin: {
      contents:
        "export * from './src/features/photo/processing.js';export * from './src/features/photo/geometry.js';export * from './src/features/photo/defaults.js';",
      resolveDir: process.cwd(),
    },
    outfile: file,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  const {
    processPixels,
    curveLut,
    rgbToHsl,
    hslToRgb,
    histogram,
    resizeCrop,
    viewToSource,
    sourceToView,
    cropBounds,
    photoDefaults,
  } = createRequire(import.meta.url)(file);
  const identity = curveLut();
  for (let i = 0; i < 256; i++) assert.equal(identity[i], i);
  for (const rgb of [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [80, 100, 150],
    [100, 100, 100],
  ]) {
    const output = hslToRgb(...rgbToHsl(...rgb));
    rgb.forEach((v, i) => assert.ok(Math.abs(v - output[i]) < 1e-8));
  }
  const pixel = new Uint8ClampedArray([80, 100, 150, 255, 255, 0, 0, 0]);
  const unchanged = processPixels(pixel, 2, 1, photoDefaults, {});
  pixel.forEach((value, i) =>
    assert.ok(Math.abs(value - unchanged.data[i]) <= 1),
  );
  assert.equal(
    unchanged.histogram[0].reduce((a, b) => a + b, 0),
    1,
  );
  const lifted = processPixels(
    pixel,
    2,
    1,
    { levels: { black: 0, white: 255, gamma: 2 } },
    {},
  );
  assert.ok(lifted.data[0] > 80);
  assert.equal(lifted.data[7], 0);
  const crushed = processPixels(
    new Uint8ClampedArray([10, 10, 10, 255]),
    1,
    1,
    { levels: { black: 20, white: 240, gamma: 1 } },
    {},
  );
  assert.equal(crushed.data[0], 0);
  const red = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
  const yellow = processPixels(
    red,
    2,
    1,
    { hsl: { red: { hue: 60 } } },
    {},
  ).data;
  assert.ok(yellow[0] > 250 && yellow[1] > 250 && yellow[2] < 5);
  assert.deepEqual(Array.from(yellow.slice(4)), [0, 255, 0, 255]);
  const balanced = processPixels(
    new Uint8ClampedArray([150, 50, 50, 255]),
    1,
    1,
    { selective: { red: { green: 70 } } },
    {},
  ).data;
  assert.ok(balanced[1] > 50);
  const image = new Uint8ClampedArray(9 * 9 * 4);
  for (let i = 0; i < image.length; i += 4) {
    image[i] = 80;
    image[i + 1] = 80;
    image[i + 2] = 80;
    image[i + 3] = 255;
  }
  const center = (4 * 9 + 4) * 4,
    source = (4 * 9 + 2) * 4;
  image[source] = 255;
  image[source + 1] = 0;
  image[source + 2] = 0;
  const stroke = {
    tool: "brush",
    color: "#00ff00",
    opacity: 1,
    hardness: 1,
    radius: 0.15,
    points: [{ x: 4 / 9, y: 4 / 9 }],
  };
  const brushed = processPixels(image, 9, 9, { strokes: [stroke] }, {}).data;
  assert.deepEqual(
    Array.from(brushed.slice(center, center + 4)),
    [0, 255, 0, 255],
  );
  const erased = processPixels(
    image,
    9,
    9,
    { strokes: [{ ...stroke, tool: "eraser" }] },
    {},
  ).data;
  assert.equal(erased[center + 3], 0);
  const healed = processPixels(
    image,
    9,
    9,
    { strokes: [{ ...stroke, tool: "heal", source: { x: 2 / 9, y: 4 / 9 } }] },
    {},
  ).data;
  assert.deepEqual(
    Array.from(healed.slice(center, center + 4)),
    [255, 0, 0, 255],
  );
  // A 40px source diameter stays proportional across preview/export resolutions.
  const diameterStroke = {
    ...stroke,
    radius: 40 / 2 / 200,
    points: [{ x: 0.5, y: 0.5 }],
  };
  const coverage = (size, hardness = 1) =>
    processPixels(
      new Uint8ClampedArray(size * size * 4),
      size,
      size,
      { strokes: [{ ...diameterStroke, hardness }] },
      {},
    ).data;
  for (const size of [100, 200]) {
    const pixels = coverage(size);
    const centerY = size / 2;
    const painted = Array.from(
      { length: size },
      (_, x) => pixels[(centerY * size + x) * 4 + 3],
    ).filter((alpha) => alpha > 0).length;
    assert.ok(
      Math.abs(painted - (40 * size) / 200) <= 1,
      `Brush diameter at ${size}px`,
    );
  }
  const hard = coverage(200, 1),
    soft = coverage(200, 0);
  const edge = (100 * 200 + 115) * 4 + 3;
  assert.ok(hard[edge] > soft[edge], "Hardness controls edge falloff");
  assert.equal(
    hard[(100 * 200 + 100) * 4 + 3],
    soft[(100 * 200 + 100) * 4 + 3],
    "Hardness preserves the center",
  );
  const impulse = new Uint8ClampedArray(9 * 9 * 4);
  for (let i = 0; i < impulse.length; i += 4) {
    impulse[i] = 100;
    impulse[i + 1] = 100;
    impulse[i + 2] = 100;
    impulse[i + 3] = 255;
  }
  impulse[center] = 140;
  assert.ok(
    processPixels(impulse, 9, 9, { denoise: 100 }, {}).data[center] < 140,
  );
  assert.ok(
    processPixels(impulse, 9, 9, { sharpen: 100 }, {}).data[center] > 140,
  );
  const crop = { x: 0.1, y: 0.2, width: 0.7, height: 0.6 };
  assert.deepEqual(resizeCrop(crop, "se", 0.1, 0.1), {
    x: 0.1,
    y: 0.2,
    width: 0.7999999999999999,
    height: 0.7,
  });
  const limited = resizeCrop(crop, "nw", 1, 1);
  assert.ok(limited.width >= 0.019999 && limited.height >= 0.019999);
  const moved = resizeCrop(crop, "move", 1, 1);
  assert.ok(moved.x + moved.width <= 1 && moved.y + moved.height <= 1);
  assert.deepEqual(
    cropBounds(1800, 1200, {
      freeCrop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    }),
    { x: 180, y: 120, width: 1440, height: 960 },
  );
  const base = {
    rotation: 0,
    flipX: false,
    flipY: false,
    cropRatio: "Original",
    freeCrop: null,
  };
  assert.deepEqual(viewToSource({ x: 0.2, y: 0.3 }, base, 1000, 500), {
    x: 0.2,
    y: 0.3,
  });
  assert.deepEqual(
    viewToSource({ x: 0.2, y: 0.3 }, { ...base, flipX: true }, 1000, 500),
    { x: 0.8, y: 0.3 },
  );
  const rotated = viewToSource(
    { x: 0, y: 0 },
    { ...base, rotation: 90 },
    1000,
    500,
  );
  assert.ok(Math.abs(rotated.x) < 1e-8 && Math.abs(rotated.y - 1) < 1e-8);
  for (const rotation of [0, 90, 180, 270])
    for (const flipX of [false, true])
      for (const flipY of [false, true]) {
        const transformed = {
          ...base,
          rotation,
          flipX,
          flipY,
          freeCrop: { x: 0.1, y: 0.15, width: 0.7, height: 0.6 },
        };
        const view = { x: 0.23, y: 0.64 };
        const actual = sourceToView(
          viewToSource(view, transformed, 1000, 500),
          transformed,
          1000,
          500,
        );
        assert.ok(
          Math.abs(actual.x - view.x) < 1e-10 &&
            Math.abs(actual.y - view.y) < 1e-10,
          "Healing source maps correctly through crop, rotation and flips",
        );
      }
  console.log(
    "Passed: identity processing, curves, RGB/HSL conversion, levels, histogram transparency, selective color, brush/eraser/healing, noise reduction, sharpening, crop limits, inverse retouch mapping.",
  );
} finally {
  await unlink(file).catch(() => {});
  await rmdir(dir);
}
