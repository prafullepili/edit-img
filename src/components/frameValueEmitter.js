// Keep pointer feedback local and dispatch only the latest value per animation frame.
export function createFrameValueEmitter(
  emit,
  schedule = requestAnimationFrame,
  cancel = cancelAnimationFrame,
) {
  let frame = null,
    pending,
    hasPending = false;
  const flush = () => {
    if (frame !== null) cancel(frame);
    frame = null;
    if (!hasPending) return;
    const value = pending;
    hasPending = false;
    emit(value);
  };
  return {
    queue(value) {
      pending = value;
      hasPending = true;
      if (frame === null)
        frame = schedule(() => {
          frame = null;
          flush();
        });
    },
    flush,
    dispose() {
      if (frame !== null) cancel(frame);
      frame = null;
      hasPending = false;
    },
  };
}
