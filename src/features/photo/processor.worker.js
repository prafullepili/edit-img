import { processPixels } from "./processing";
self.onmessage = ({
  data: { id, pixels, width, height, photo, adjustments },
}) => {
  try {
    const result = processPixels(
      new Uint8ClampedArray(pixels),
      width,
      height,
      photo,
      adjustments,
    );
    self.postMessage(
      { id, pixels: result.data.buffer, histogram: result.histogram },
      [result.data.buffer],
    );
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
