export const colorBands = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "magenta",
];
export const photoDefaults = {
  levels: { black: 0, white: 255, gamma: 1 },
  curves: {
    rgb: [0, 64, 128, 192, 255],
    red: [0, 64, 128, 192, 255],
    green: [0, 64, 128, 192, 255],
    blue: [0, 64, 128, 192, 255],
  },
  hsl: {},
  selective: {},
  sharpen: 0,
  denoise: 0,
  strokes: [],
};
export function mergePhoto(value) {
  return {
    ...photoDefaults,
    ...value,
    levels: { ...photoDefaults.levels, ...value?.levels },
    curves: { ...photoDefaults.curves, ...value?.curves },
  };
}
