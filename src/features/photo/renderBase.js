import { readImage } from "../../imageStorage";
import { processImageData } from "./client";
import { cropBounds } from "./geometry";
import { processPixels } from "./processing";
async function decodeBaseImage(editor) {
  const blob = editor.baseAssetId ? await readImage(editor.baseAssetId) : null;
  if (editor.baseAssetId && !blob)
    throw new Error(
      "The saved photo version is missing. Restore the original photo.",
    );
  const url = blob ? URL.createObjectURL(blob) : editor.imageUrl;
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("Could not load the photo. Upload a local image."));
      img.src = url;
    });
  } finally {
    if (blob) URL.revokeObjectURL(url);
  }
}
const imageCache = new Map();
export function loadBaseImage(editor) {
  const key = editor.baseAssetId || editor.imageUrl;
  if (imageCache.has(key)) return imageCache.get(key);
  const pending = decodeBaseImage(editor).catch((error) => {
    imageCache.delete(key);
    throw error;
  });
  imageCache.set(key, pending);
  if (imageCache.size > 3) imageCache.delete(imageCache.keys().next().value);
  return pending;
}
export async function renderBase(
  editor,
  {
    maxEdge = Infinity,
    uncropped = false,
    before = false,
    signal,
    interactive = false,
  } = {},
) {
  const img = await loadBaseImage(
      before ? { ...editor, baseAssetId: null } : editor,
    ),
    sourceWidth = img.naturalWidth,
    sourceHeight = img.naturalHeight;
  const ratio = Math.min(
    1,
    maxEdge / Math.max(sourceWidth, sourceHeight),
    8192 / Math.max(sourceWidth, sourceHeight),
    Math.sqrt(16000000 / (sourceWidth * sourceHeight)),
  );
  signal?.throwIfAborted();
  const source = document.createElement("canvas");
  source.width = Math.max(1, Math.round(sourceWidth * ratio));
  source.height = Math.max(1, Math.round(sourceHeight * ratio));
  const ctx = source.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, source.width, source.height);
  const pixels = ctx.getImageData(0, 0, source.width, source.height);
  const photo = before ? {} : editor.photo;
  const adjustments = before ? {} : editor.adjustments;
  let result;
  if (interactive) {
    // Small exact-color preview: no worker startup or queued work while dragging.
    const processed = processPixels(
      pixels.data,
      source.width,
      source.height,
      photo,
      adjustments,
    );
    result = {
      data: new ImageData(processed.data, source.width, source.height),
      histogram: processed.histogram,
    };
  } else {
    result = await processImageData(pixels, photo, adjustments, { signal });
  }
  ctx.putImageData(result.data, 0, 0);
  const rotated = document.createElement("canvas"),
    swap = editor.rotation % 180 !== 0;
  rotated.width = swap ? source.height : source.width;
  rotated.height = swap ? source.width : source.height;
  const rc = rotated.getContext("2d");
  rc.translate(rotated.width / 2, rotated.height / 2);
  rc.rotate((editor.rotation * Math.PI) / 180);
  rc.scale(editor.flipX ? -1 : 1, editor.flipY ? -1 : 1);
  rc.drawImage(source, -source.width / 2, -source.height / 2);
  const rect = cropBounds(
    rotated.width,
    rotated.height,
    uncropped ? { ...editor, freeCrop: null, cropRatio: "Original" } : editor,
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));
  canvas
    .getContext("2d")
    .drawImage(
      rotated,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  const full = cropBounds(
    swap ? sourceHeight : sourceWidth,
    swap ? sourceWidth : sourceHeight,
    editor,
  );
  return {
    canvas,
    sampleCanvas: rotated,
    histogram: result.histogram,
    sourceWidth,
    sourceHeight,
    width: Math.round(full.width),
    height: Math.round(full.height),
  };
}
