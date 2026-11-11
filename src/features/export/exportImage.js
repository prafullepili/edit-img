import { renderBase } from "../photo/renderBase";
import { drawLayers } from "../../layers";
import { drawStyledText, primaryTextLayer } from "../design/styles";
export async function exportImage(editor, layerImages) {
  const base = await renderBase(editor);
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(8192, Math.max(1, editor.outputWidth || base.width));
  canvas.height = Math.min(
    8192,
    Math.max(1, editor.outputHeight || base.height),
  );
  const ctx = canvas.getContext("2d");
  if (editor.exportFormat === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.globalAlpha = editor.baseOpacity / 100;
  if (editor.baseVisible)
    ctx.drawImage(base.canvas, 0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  if (editor.textLayer.enabled && editor.textLayer.text) {
    await document.fonts.ready;
    const text = editor.textLayer,
      box = primaryTextLayer(text, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = text.opacity / 100;
    ctx.globalCompositeOperation =
      text.blend && text.blend !== "normal" ? text.blend : "source-over";
    drawStyledText(
      ctx,
      { ...text, textAlign: text.textAlign || text.position.split("-")[1] },
      {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        size: (text.size * canvas.width) / base.width,
        scale: canvas.width / base.width,
        centered: true,
      },
    );
    ctx.restore();
  }

  await drawLayers(
    ctx,
    editor.layers,
    layerImages,
    canvas.width,
    canvas.height,
    base.width,
  );

  const blob = await new Promise((resolve) =>
    canvas.toBlob(
      resolve,
      `image/${editor.exportFormat}`,
      editor.exportQuality / 100,
    ),
  );
  if (!blob) throw new Error("Image encoding failed");
  return blob;
}
