import { build } from "esbuild";
import assert from "node:assert/strict";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const dir = await mkdtemp(join(tmpdir(), "luma-design-check-")),
  file = join(dir, "design.cjs");
try {
  await build({
    stdin: {
      contents:
        "export * from './src/features/design/styles';export * from './src/features/design/catalog';export * from './src/features/design/templateData';",
      resolveDir: process.cwd(),
    },
    outfile: file,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  const {
    gradientEndpoints,
    textLines,
    drawStyledText,
    roundedRect,
    canvasFill,
    iconSvg,
    icons,
    builtinTemplates,
    instantiateDesign,
    primaryTextLayer,
    draggedTextOffset,
    textEditorValue,
    textLayerChanges,
    textEffectPadding,
  } = createRequire(import.meta.url)(file);
  const calls = [],
    ctx = {
      save() {},
      restore() {},
      beginPath() {},
      rect(...args) {
        calls.push(["rect", ...args]);
      },
      clip() {},
      moveTo(...args) {
        calls.push(["move", ...args]);
      },
      lineTo() {},
      quadraticCurveTo(...args) {
        calls.push(["curve", ...args]);
      },
      closePath() {},
      measureText(text) {
        return { width: text.length * 10 };
      },
      fillText(...args) {
        calls.push(["fill", ...args]);
      },
      strokeText(...args) {
        calls.push(["stroke", ...args]);
      },
      createLinearGradient(...args) {
        calls.push(["gradient", ...args]);
        return {
          addColorStop(...args) {
            calls.push(["stop", ...args]);
          },
        };
      },
    };
  assert.deepEqual(textLines(ctx, "ABCDE", 35), ["ABC", "DE"]);
  assert.deepEqual(textLines(ctx, "ABCD", 35, 10), ["AB", "CD"]);
  drawStyledText(
    ctx,
    {
      text: "AB",
      color: "#ffffff",
      textAlign: "center",
      fontFamily: "Georgia",
      fontWeight: 400,
      letterSpacing: 2,
      outlineWidth: 3,
      outlineColor: "#ff0000",
      shadow: true,
      shadowColor: "#000000",
      shadowOpacity: 50,
      shadowBlur: 12,
      shadowX: 4,
      shadowY: 8,
    },
    { x: 0, y: 0, width: 100, height: 50, size: 20, scale: 2 },
  );
  assert.equal(ctx.font, '400 20px "Georgia"');
  assert.equal(ctx.lineWidth, 12);
  assert.equal(ctx.shadowBlur, 24);
  assert.equal(ctx.shadowOffsetX, 8);
  assert.equal(ctx.shadowOffsetY, 16);
  assert.deepEqual(
    calls.filter((c) => c[0] === "fill").map((c) => c[2]),
    [38, 52],
  );
  assert.equal(calls.filter((c) => c[0] === "stroke").length, 2);
  const horizontal = gradientEndpoints(0, 100, 50);
  assert.deepEqual(horizontal, { x1: 0, y1: 25, x2: 100, y2: 25 });
  const vertical = gradientEndpoints(90, 100, 50);
  assert.ok(Math.abs(vertical.x1 - 50) < 1e-8 && Math.abs(vertical.y1) < 1e-8);
  calls.length = 0;
  canvasFill(
    ctx,
    {
      color: "#000000",
      gradient: {
        enabled: true,
        type: "linear",
        from: "#ff0000",
        to: "#0000ff",
        angle: 0,
      },
    },
    100,
    50,
  );
  assert.deepEqual(calls[0], ["gradient", -50, 0, 50, 0]);
  assert.deepEqual(calls[1], ["stop", 0, "#ff0000"]);
  calls.length = 0;
  roundedRect(ctx, 0, 0, 100, 40, 100);
  assert.deepEqual(calls[0], ["move", 20, 0]);
  assert.equal(calls.filter((c) => c[0] === "curve").length, 4);
  for (const icon of icons)
    assert.ok(iconSvg(icon.id, "#c8ef69").includes(icon.path));
  assert.equal(iconSvg("missing", "<script>").includes("<script>"), false);
  const design = {
    layers: [
      { id: "a", groupId: "g", type: "text", text: "Title" },
      { id: "b", groupId: "g", type: "rectangle" },
    ],
  };
  const first = instantiateDesign(design),
    second = instantiateDesign(design);
  assert.notEqual(first.layers[0].id, second.layers[0].id);
  assert.equal(first.layers[0].groupId, first.layers[1].groupId);
  assert.notEqual(first.layers[0].groupId, "g");
  assert.equal(design.layers[0].id, "a");
  assert.ok(builtinTemplates.every((t) => t.design.layers.length >= 3));
  assert.equal(
    primaryTextLayer({ position: "bottom-right", size: 44 }, 1000, 500)
      .textAlign,
    "right",
  );
  const positioned = primaryTextLayer(
    { position: "bottom-center", size: 44, offsetX: 10, offsetY: -20 },
    1000,
    500,
  );
  assert.ok(Math.abs(positioned.x - 150) < 1e-8);
  assert.ok(Math.abs(positioned.y - 360) < 1e-8);
  const smaller = primaryTextLayer(
    { position: "bottom-center", size: 44, offsetX: 10, offsetY: -20 },
    500,
    250,
  );
  assert.equal(smaller.x, positioned.x / 2);
  assert.equal(smaller.y, positioned.y / 2);
  const start = {
    width: 1000,
    height: 500,
    bounds: { x: 300, y: 200, width: 200, height: 50 },
    offsetX: 0,
    offsetY: 0,
  };
  assert.deepEqual(draggedTextOffset(start, 100, 50), {
    offsetX: 10,
    offsetY: 10,
  });
  assert.deepEqual(draggedTextOffset(start, 9999, 9999), {
    offsetX: 50,
    offsetY: 50,
  });
  assert.deepEqual(draggedTextOffset(start, -9999, -9999), {
    offsetX: -30,
    offsetY: -40,
  });
  const uiText = textEditorValue(
    { size: 5, text: "Layer", shadow: true, shadowBlur: 8 },
    1800,
  );
  assert.equal(uiText.size, 90, "Layer font size is shown in source pixels");
  assert.equal(textLayerChanges({ size: 90, text: "Changed" }, 1800).size, 5);
  assert.deepEqual(textLayerChanges({ text: "Changed" }, 1800), {
    text: "Changed",
  });
  const blurCalls = [];
  const blurCtx = {
    ...ctx,
    set filter(value) {
      blurCalls.push(value);
    },
  };
  drawStyledText(
    blurCtx,
    { text: "Blurred", color: "#ffffff", blur: 6, shadow: true, shadowBlur: 8 },
    { x: 0, y: 0, width: 400, height: 100, size: 30, scale: 0.5 },
  );
  assert.ok(
    blurCalls.includes("blur(3px)"),
    "Preview and export apply the same scaled text blur",
  );
  assert.equal(blurCtx.shadowBlur, 4);
  assert.ok(
    textEffectPadding({ blur: 6, shadow: true, shadowBlur: 8 }) >= 34,
    "Blur and shadow have room outside the text box",
  );
  console.log(
    "Passed: consistent text size conversions, shared blur/shadow rendering, effect padding.",
  );
  console.log(
    "Passed: primary text drag offsets, canvas bounds, scaled export positions.",
  );
  console.log(
    "Passed: font/weight, text wrapping and spacing, alignment, outlines, shadow scaling, gradient geometry, rounded corner clamping, safe vector assets, reusable template IDs and groups.",
  );
} finally {
  await unlink(file).catch(() => {});
  await rmdir(dir);
}
