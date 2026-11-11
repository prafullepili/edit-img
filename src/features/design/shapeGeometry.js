export const shapeTypes = [
  "rectangle",
  "ellipse",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
  "star",
  "arrow",
];
export const isShape = (type) => shapeTypes.includes(type);
export function shapePoints(type) {
  if (type === "triangle")
    return [
      [0.5, 0],
      [1, 1],
      [0, 1],
    ];
  if (type === "diamond")
    return [
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ];
  if (type === "arrow")
    return [
      [0, 0.3],
      [0.6, 0.3],
      [0.6, 0],
      [1, 0.5],
      [0.6, 1],
      [0.6, 0.7],
      [0, 0.7],
    ];
  const sides =
    type === "star" ? 10 : type === "pentagon" ? 5 : type === "hexagon" ? 6 : 0;
  return Array.from({ length: sides }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / sides;
    const radius = type === "star" && i % 2 ? 0.22 : 0.5;
    return [0.5 + Math.cos(angle) * radius, 0.5 + Math.sin(angle) * radius];
  });
}
