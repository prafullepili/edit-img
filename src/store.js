import { configureStore } from "@reduxjs/toolkit";
import { saveDraft } from "./imageStorage";
import editorReducer, {
  actions,
  STORAGE_KEY,
} from "./features/editor/editorSlice";
export { actions };
export const store = configureStore({ reducer: { editor: editorReducer } });
let saveTimer;
let pendingDraft;
let draftQueue = Promise.resolve();
const enqueueDraft = (draft) => {
  draftQueue = draftQueue
    .then(() => saveDraft(draft))
    .catch(() => window.dispatchEvent(new Event("luma-draft-error")));
};
export function flushDraft() {
  if (pendingDraft) {
    enqueueDraft(pendingDraft);
    pendingDraft = null;
  }
}
export async function prepareDraftDeletion(id) {
  if (pendingDraft?.projectId === id) pendingDraft = null;
  await draftQueue;
}
store.subscribe(() => {
  const current = store.getState().editor;
  if (pendingDraft && pendingDraft.projectId !== current.projectId)
    flushDraft();
  pendingDraft = current;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    flushDraft();
    const {
      projectTitle,
      imageName,
      isUploaded,
      activeTool,
      adjustments,
      cropRatio,
      rotation,
      flipX,
      flipY,
      zoom,
      preset,
      exportFormat,
      exportQuality,
      textLayer,
      outputWidth,
      outputHeight,
      lockAspect,
      layers,
      selectedLayerId,
      baseVisible,
      baseOpacity,
      snapEnabled,
      photo,
      freeCrop,
      baseAssetId,
    } = store.getState().editor;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          projectId: current.projectId,
          projectTitle,
          imageName,
          isUploaded,
          activeTool,
          adjustments,
          cropRatio,
          rotation,
          flipX,
          flipY,
          zoom,
          preset,
          exportFormat,
          exportQuality,
          textLayer,
          outputWidth,
          outputHeight,
          lockAspect,
          layers,
          selectedLayerId,
          baseVisible,
          baseOpacity,
          snapEnabled,
          photo,
          freeCrop,
          baseAssetId,
        }),
      );
    } catch {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            projectId: current.projectId,
            imageName,
            isUploaded,
          }),
        );
      } catch {}
    }
  }, 240);
});
window.addEventListener("pagehide", flushDraft);
