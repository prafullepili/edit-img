// Preview and export use separate workers so a large export cannot block editing.
const lanes = new Map();
let id = 0;
export function processImageData(image, photo, adjustments, { signal } = {}) {
  signal?.throwIfAborted();
  const lane = signal ? "preview" : "export";
  let state = lanes.get(lane);
  if (!state) {
    const worker = new Worker(
      new URL("./processor.worker.js", import.meta.url),
      { type: "module" },
    );
    state = { worker, jobs: new Map() };
    lanes.set(lane, state);
    worker.onmessage = ({ data }) => {
      const job = state.jobs.get(data.id);
      if (!job) return;
      state.jobs.delete(data.id);
      job.cleanup();
      data.error
        ? job.reject(new Error(data.error))
        : job.resolve({
            data: new ImageData(
              new Uint8ClampedArray(data.pixels),
              job.width,
              job.height,
            ),
            histogram: data.histogram,
          });
    };
    worker.onerror = () =>
      stop(
        new Error("Photo processing failed. Reload the editor and try again."),
      );
  }
  function stop(error) {
    state.worker.terminate();
    if (lanes.get(lane) === state) lanes.delete(lane);
    for (const job of state.jobs.values()) {
      job.cleanup();
      job.reject(error);
    }
    state.jobs.clear();
  }
  return new Promise((resolve, reject) => {
    const key = ++id;
    const abort = () =>
      stop(signal.reason || new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });
    state.jobs.set(key, {
      resolve,
      reject,
      width: image.width,
      height: image.height,
      cleanup: () => signal?.removeEventListener("abort", abort),
    });
    state.worker.postMessage(
      {
        id: key,
        pixels: image.data.buffer,
        width: image.width,
        height: image.height,
        photo,
        adjustments,
      },
      [image.data.buffer],
    );
  });
}
