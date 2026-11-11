// Coalesce rapid edits without starving a running preview of a chance to display.
export function createPreviewQueue({
  render,
  publish,
  onError,
  discard = () => {},
  schedule = requestAnimationFrame,
  cancel = cancelAnimationFrame,
}) {
  let pending = null,
    latestKey,
    running = false,
    frame = null,
    disposed = false;
  const requestFrame = () => {
    if (!disposed && !running && frame === null && pending)
      frame = schedule(run);
  };
  async function run() {
    frame = null;
    if (disposed || !pending) return;
    const job = pending;
    pending = null;
    running = true;
    try {
      const output = await render(job);
      // An older stroke frame is useful while drawing, but never show another image/crop.
      if (!disposed && job.key === latestKey) publish(output, job);
      else discard(output);
    } catch (error) {
      if (!disposed && job.key === latestKey) onError(error);
    } finally {
      running = false;
      requestFrame();
    }
  }
  return {
    submit(job) {
      if (disposed) return;
      latestKey = job.key;
      pending = job;
      requestFrame();
    },
    invalidate(key) {
      latestKey = key;
      pending = null;
      if (frame !== null) cancel(frame);
      frame = null;
    },
    dispose() {
      disposed = true;
      pending = null;
      if (frame !== null) cancel(frame);
      frame = null;
    },
  };
}
