import { useEffect, useRef, useState } from "react";
import { createPreviewQueue } from "./previewQueue";
export default function usePhotoPreview(
  editor,
  {
    uncropped = false,
    before = false,
    interactiveMaxEdge = 480,
    workerPreview = false,
  } = {},
) {
  const previewUrl = useRef(null);
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  const [result, setResult] = useState({
    url: null,
    busy: true,
    error: null,
    width: 1800,
    height: 1200,
    sourceWidth: 1800,
    sourceHeight: 1200,
    histogram: null,
  });
  const {
    imageUrl,
    baseAssetId,
    photo,
    adjustments,
    rotation,
    flipX,
    flipY,
    freeCrop,
    cropRatio,
  } = editor;
  const queue = useRef(null);
  const revision = useRef(0);
  const detailedRevision = useRef(-1);
  const publish = (output, url) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = url.startsWith("blob:") ? url : null;
    setResult({ ...output, canvas: undefined, url, busy: false, error: null });
  };
  useEffect(() => {
    queue.current = createPreviewQueue({
      render: async (job) => {
        const { renderBase } = await import("./renderBase");
        const output = await renderBase(job.settings, job.options);
        if (!job.options.interactive) {
          const blob = await new Promise((resolve) =>
            output.canvas.toBlob(resolve, "image/png"),
          );
          if (!blob) throw new Error("Preview could not be rendered");
          return { output, url: URL.createObjectURL(blob) };
        }
        return { output, url: output.canvas.toDataURL("image/png") };
      },
      publish: ({ output, url }, job) => {
        if (detailedRevision.current < job.revision)
          publish({ ...output, renderedPhoto: job.settings.photo }, url);
        else if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      },
      discard: ({ url }) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      },
      onError: (error) =>
        setResult((r) => ({ ...r, busy: false, error: error.message })),
    });
    return () => {
      queue.current.dispose();
      queue.current = null;
    };
  }, []);
  const renderCrop = uncropped ? null : freeCrop,
    renderRatio = uncropped ? "Original" : cropRatio;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const settings = {
      imageUrl,
      baseAssetId,
      photo,
      adjustments,
      rotation,
      flipX,
      flipY,
      freeCrop: renderCrop,
      cropRatio: renderRatio,
    };
    let timer;
    const currentRevision = ++revision.current;
    const fail = (error) => {
      if (active && error.name !== "AbortError")
        setResult((r) => ({ ...r, busy: false, error: error.message }));
    };
    queue.current.submit({
      settings,
      key: JSON.stringify([
        imageUrl,
        baseAssetId,
        rotation,
        flipX,
        flipY,
        renderCrop,
        renderRatio,
        uncropped,
        before,
        interactiveMaxEdge,
      ]),
      revision: currentRevision,
      options: {
        maxEdge: interactiveMaxEdge,
        uncropped,
        before,
        interactive: false,
      },
    });
    // Replace the interactive image silently with a detailed preview after dragging pauses.
    if (!workerPreview)
      timer = setTimeout(async () => {
        try {
          const { renderBase } = await import("./renderBase");
          if (!active) return;
          const output = await renderBase(settings, {
            maxEdge: 1200,
            uncropped,
            before,
            signal: controller.signal,
          });
          if (!active) return;
          const blob = await new Promise((resolve) =>
            output.canvas.toBlob(resolve, "image/png"),
          );
          if (!blob) throw new Error("Preview could not be rendered");
          if (active) {
            detailedRevision.current = currentRevision;
            publish(
              { ...output, renderedPhoto: photo },
              URL.createObjectURL(blob),
            );
          }
        } catch (error) {
          fail(error);
        }
      }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    imageUrl,
    baseAssetId,
    photo,
    adjustments,
    rotation,
    flipX,
    flipY,
    renderCrop,
    renderRatio,
    uncropped,
    before,
    interactiveMaxEdge,
    workerPreview,
  ]);
  return result;
}
