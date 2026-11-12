import { alignSelection } from "../../layerEditing";
export function textPositionChanges(
  layer,
  layers,
  vertical,
  horizontal,
  aspect,
) {
  const common = {
    position: `${vertical}-${horizontal}`,
    textAlign: horizontal,
  };
  if (!layer) return { ...common, offsetX: 0, offsetY: 0 };
  return {
    ...alignSelection(layer, layers, horizontal, aspect),
    ...alignSelection(layer, layers, vertical, aspect),
    ...common,
  };
}
