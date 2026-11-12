import { store, actions } from "../../store";
import { isLayerLocked, selectionLayers } from "../../layerEditing";

// Every delete entry point shares group confirmation and one undo snapshot.
export function requestLayerDeletion(
  id,
  confirmGroup = (message) => window.confirm(message),
) {
  const state = store.getState().editor;
  const layer = state.layers.find((item) => item.id === id);
  if (!layer || isLayerLocked(layer, state.layers)) return [];
  const members = selectionLayers(layer, state.layers);
  if (
    layer.groupId &&
    !confirmGroup(
      `Delete group “${layer.groupName || "Group"}” and its ${members.length} ${members.length === 1 ? "layer" : "layers"}? You can undo this.`,
    )
  )
    return [];
  store.dispatch(actions.snapshot());
  store.dispatch(
    layer.groupId
      ? actions.removeGroup(layer.groupId)
      : actions.removeLayer(layer.id),
  );
  return members.map((item) => item.id);
}
