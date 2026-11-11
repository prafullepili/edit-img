export const icons = [
  {
    id: "heart",
    name: "Heart",
    path: "M12 21S2 15 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 7-10 13-10 13Z",
  },
  {
    id: "star",
    name: "Star",
    path: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z",
  },
  { id: "bolt", name: "Lightning", path: "M13 1 3 14h7l-1 9 12-14h-8Z" },
  { id: "check", name: "Check", path: "m3 12 6 6L21 5", line: true },
  { id: "arrow", name: "Arrow", path: "M3 12h18m-7-7 7 7-7 7", line: true },
  {
    id: "pin",
    name: "Location",
    path: "M12 22S4 14 4 9a8 8 0 1 1 16 0c0 5-8 13-8 13Zm0-16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  },
  {
    id: "leaf",
    name: "Leaf",
    path: "M3 21C1 5 12 2 22 2c0 13-5 20-16 17m-3 2L18 6",
    line: true,
  },
  {
    id: "sun",
    name: "Sun",
    path: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
    line: true,
  },
  {
    id: "moon",
    name: "Moon",
    path: "M21 14A10 10 0 0 1 10 3a10 10 0 1 0 11 11Z",
  },
  {
    id: "camera",
    name: "Camera",
    path: "M2 7h5l2-4h6l2 4h5v14H2Zm14 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z",
    line: true,
  },
  {
    id: "music",
    name: "Music",
    path: "M9 18V4l12-2v14M9 8l12-2M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    line: true,
  },
  {
    id: "smile",
    name: "Smile",
    path: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM7 9h1m8 0h1M7 14q5 7 10 0",
    line: true,
  },
];
export const stickers = [
  { id: "heart", name: "Love", color: "#ff657a" },
  { id: "star", name: "Gold star", color: "#ffd75a" },
  { id: "bolt", name: "Energy", color: "#c8ef69" },
  { id: "smile", name: "Happy", color: "#ffb347" },
  { id: "leaf", name: "Organic", color: "#70dc9a" },
  { id: "moon", name: "Dream", color: "#bfa1ff" },
];
export function iconSvg(id, color = "#ffffff") {
  const icon = icons.find((i) => i.id === id) || icons[0],
    safe = /^#[0-9a-f]{6}$/i.test(color) ? color : "#ffffff";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24"><path d="${icon.path}" fill="${icon.line ? "none" : safe}" stroke="${icon.line ? safe : "none"}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd"/></svg>`;
}
