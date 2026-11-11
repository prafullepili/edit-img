import { newId } from "../../ids.js";
import { loadBaseImage } from "./renderBase";
import { saveImage } from "../../imageStorage";
export async function removePhotoBackground(editor, onProgress, signal) {
  const image = await loadBaseImage(editor),
    canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  const source = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!source) throw new Error("Could not prepare the photo");
  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./background.worker.js", import.meta.url),
      { type: "module" },
    );
    const stop = () => {
      clearTimeout(timer);
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      stop();
      reject(new Error("Cancelled"));
    };
    const timer = setTimeout(() => {
      stop();
      reject(
        new Error("The model download or inference timed out. Please retry."),
      );
    }, 360000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.onmessage = ({ data }) => {
      if (data.progress) {
        onProgress(data.progress);
        return;
      }
      stop();
      data.error ? reject(new Error(data.error)) : resolve(data.blob);
    };
    worker.onerror = () => {
      stop();
      reject(
        new Error(
          "Background removal could not start in this browser. Try Chrome or Edge.",
        ),
      );
    };
    worker.postMessage({ source });
  });
  const id = `${editor.projectId}:layer:base-${newId()}`;
  await saveImage(result, id);
  return id;
}
