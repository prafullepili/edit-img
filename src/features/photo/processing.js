import { colorBands, mergePhoto } from "./defaults";
const clamp = (v, min = 0, max = 255) => Math.max(min, Math.min(max, v));
export function curveLut(values = [0, 64, 128, 192, 255]) {
  const knots = [0, 64, 128, 192, 255];
  return Array.from({ length: 256 }, (_, x) => {
    let i = 0;
    while (i < 3 && x > knots[i + 1]) i++;
    return clamp(
      values[i] +
        ((values[i + 1] - values[i]) * (x - knots[i])) /
          (knots[i + 1] - knots[i]),
    );
  });
}
export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    l = (max + min) / 2;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
export function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2;
  const rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgb.map((v) => (v + m) * 255);
}
const hues = [0, 30, 60, 120, 180, 240, 275, 315];
export function histogram(data) {
  const bins = [
    new Uint32Array(256),
    new Uint32Array(256),
    new Uint32Array(256),
  ];
  for (let i = 0; i < data.length; i += 4)
    if (data[i + 3]) for (let c = 0; c < 3; c++) bins[c][data[i + c]]++;
  return bins.map((b) => Array.from(b));
}
function paint(data, width, height, strokes) {
  for (const stroke of strokes) {
    if (!stroke.points?.length) continue;
    const source = stroke.tool === "heal" ? new Uint8ClampedArray(data) : null;
    const radius = Math.max(1, stroke.radius * width),
      opacity = stroke.opacity ?? 1;
    const color = (stroke.color || "#ffffff")
      .match(/\w\w/g)
      .map((v) => parseInt(v, 16));
    const first = stroke.points[0];
    const stamp = (p) => {
      const cx = p.x * width,
        cy = p.y * height;
      for (
        let y = Math.max(0, Math.floor(cy - radius));
        y < Math.min(height, Math.ceil(cy + radius));
        y++
      )
        for (
          let x = Math.max(0, Math.floor(cx - radius));
          x < Math.min(width, Math.ceil(cx + radius));
          x++
        ) {
          const distance = Math.hypot(x - cx, y - cy) / radius;
          if (distance > 1) continue;
          const t =
            opacity *
            Math.min(
              1,
              (1 - distance) / Math.max(0.05, 1 - (stroke.hardness ?? 0.7)),
            );
          const i = (y * width + x) * 4;
          if (stroke.tool === "eraser") {
            data[i + 3] *= 1 - t;
            continue;
          }
          if (source) {
            const sx = Math.round(
                x + ((stroke.source?.x ?? first.x) - first.x) * width,
              ),
              sy = Math.round(
                y + ((stroke.source?.y ?? first.y) - first.y) * height,
              );
            if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
            const j = (sy * width + sx) * 4;
            for (let c = 0; c < 4; c++)
              data[i + c] = data[i + c] * (1 - t) + source[j + c] * t;
          } else {
            const alpha = data[i + 3] / 255,
              a = t + alpha * (1 - t);
            for (let c = 0; c < 3; c++)
              data[i + c] =
                (color[c] * t + data[i + c] * alpha * (1 - t)) / (a || 1);
            data[i + 3] = a * 255;
          }
        }
    };
    stamp(first);
    for (let j = 1; j < stroke.points.length; j++) {
      const a = stroke.points[j - 1],
        b = stroke.points[j],
        steps = Math.max(
          1,
          Math.ceil(
            Math.hypot((b.x - a.x) * width, (b.y - a.y) * height) /
              (radius * 0.3),
          ),
        );
      for (let k = 1; k <= steps; k++)
        stamp({
          x: a.x + ((b.x - a.x) * k) / steps,
          y: a.y + ((b.y - a.y) * k) / steps,
        });
    }
  }
}
export function processPixels(
  input,
  width,
  height,
  photoValue,
  adjustments = {},
) {
  const data = new Uint8ClampedArray(input),
    photo = mergePhoto(photoValue);
  paint(data, width, height, photo.strokes);
  const curves = ["rgb", "red", "green", "blue"].map((key) =>
    curveLut(photo.curves[key]),
  );
  const a = {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    clarity: 0,
    vignette: 0,
    grain: 0,
    ...adjustments,
  };
  const black = clamp(photo.levels.black, 0, 254),
    white = clamp(photo.levels.white, black + 1, 255),
    gamma = clamp(photo.levels.gamma, 0.1, 3);
  const activeBands = colorBands
    .map((band, index) => ({
      index,
      hsl: photo.hsl[band] || {},
      selective: photo.selective[band] || {},
    }))
    .filter(({ hsl, selective }) =>
      [...Object.values(hsl), ...Object.values(selective)].some(Boolean),
    );
  const colorActive = a.saturation !== 0 || activeBands.length > 0;
  const neutral =
    !Object.values(a).some(Boolean) &&
    !activeBands.length &&
    black === 0 &&
    white === 255 &&
    gamma === 1 &&
    Object.values(photo.curves).every((points) =>
      points.every((v, i) => v === [0, 64, 128, 192, 255][i]),
    );
  if (!neutral)
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue;
      let rgb = [data[i], data[i + 1], data[i + 2]];
      const lum = (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) / 255;
      rgb = rgb.map((v, c) => {
        let n =
          v * Math.pow(2, (a.exposure / 100) * 2) +
          (a.shadows * (1 - lum) ** 2 + a.highlights * lum ** 2) * 0.6;
        n = (n - 127.5) * (1 + (a.contrast + a.clarity * 0.2) / 100) + 127.5;
        n +=
          c === 0
            ? a.temperature * 0.25
            : c === 2
              ? -a.temperature * 0.25
              : -a.tint * 0.15;
        n =
          255 * Math.pow(clamp((n - black) / (white - black), 0, 1), 1 / gamma);
        return curves[c + 1][Math.round(curves[0][Math.round(clamp(n))])];
      });
      let dr = 0,
        dg = 0,
        db = 0;
      if (colorActive) {
        let [h, s, l] = rgbToHsl(...rgb),
          dh = 0,
          ds = 0,
          dl = 0;
        activeBands.forEach(({ index: j, hsl: v, selective: select }) => {
          const distance = Math.min(
              Math.abs(h - hues[j]),
              360 - Math.abs(h - hues[j]),
            ),
            weight = Math.max(0, 1 - distance / 45) * Math.min(1, s * 4);
          dh += (v.hue || 0) * weight;
          ds += ((v.saturation || 0) * weight) / 100;
          dl += ((v.lightness || 0) * weight) / 100;
          dr += (select.red || 0) * weight * 0.6;
          dg += (select.green || 0) * weight * 0.6;
          db += (select.blue || 0) * weight * 0.6;
        });
        rgb = hslToRgb(
          (h + dh + 360) % 360,
          clamp(s * (1 + a.saturation / 100 + ds), 0, 1),
          clamp(l + dl * 0.5, 0, 1),
        );
      }
      const x = (i / 4) % width,
        y = Math.floor(i / 4 / width),
        dist = a.vignette
          ? Math.hypot(
              (x - width / 2) / (width / 2),
              (y - height / 2) / (height / 2),
            )
          : 0;
      const vignette = 1 - (Math.max(0, dist - 0.4) * a.vignette) / 150;
      const noise =
        ((((i * 1664525 + 1013904223) >>> 0) % 256) / 255 - 0.5) *
        a.grain *
        0.5;
      data[i] = clamp((rgb[0] + dr) * vignette + noise);
      data[i + 1] = clamp((rgb[1] + dg) * vignette + noise);
      data[i + 2] = clamp((rgb[2] + db) * vignette + noise);
    }
  if (photo.denoise > 0 || photo.sharpen > 0) {
    const source = new Uint8ClampedArray(data);
    for (let y = 1; y < height - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        if (!source[i + 3]) continue;
        for (let c = 0; c < 3; c++) {
          let total = 0,
            weights = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const j = ((y + dy) * width + x + dx) * 4;
              if (!source[j + 3]) continue;
              const weight = Math.exp(
                -Math.abs(source[j + c] - source[i + c]) / 30,
              );
              total += source[j + c] * weight;
              weights += weight;
            }
          const smooth = total / (weights || 1),
            denoised =
              source[i + c] + ((smooth - source[i + c]) * photo.denoise) / 100;
          data[i + c] = clamp(
            denoised + ((source[i + c] - smooth) * photo.sharpen) / 30,
          );
        }
      }
  }
  return { data, histogram: histogram(data) };
}
