import { removeBackground } from "@imgly/background-removal";
self.onmessage = async ({ data: { source } }) => {
  try {
    const blob = await removeBackground(source, {
      model: "isnet_quint8",
      device: "cpu",
      output: { format: "image/png", type: "foreground" },
      progress: (key, current, total) =>
        self.postMessage({
          progress: total
            ? `${key.startsWith("compute") ? "Processing" : "Downloading model"} ${Math.round((current / total) * 100)}%`
            : "Processing…",
        }),
    });
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
