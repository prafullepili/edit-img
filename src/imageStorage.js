import { photoDefaults } from "./features/photo/defaults";
const DB_NAME = "luma-studio-local";
const STORE_NAME = "project-assets";
const LOCAL_STATE_KEY = "luma-studio-project-v1";

function estimateBytes(value) {
  if (value instanceof Blob) return value.size;
  if (typeof value === "string") return new Blob([value]).size;
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

function referencedAssets(value) {
  const state = value?.state || value?.project?.state || value;
  return [
    state?.projectId,
    state?.baseAssetId,
    ...(state?.layers || []).map((layer) => layer.assetId),
    ...(value?.design?.layers || []).map((layer) => layer.assetId),
  ].filter(Boolean);
}

export async function getLocalStorageSummary() {
  const entries = await records("");
  const byKey = new Map(entries.map(({ key, value }) => [String(key), value]));
  const imageBytes = (id) => estimateBytes(byKey.get(`image:${id}`));
  const edits = entries
    .filter(({ key }) => String(key).startsWith("draft:") || String(key).startsWith("trash:"))
    .map(({ key, value }) => {
      const deleted = String(key).startsWith("trash:");
      const ids = new Set(referencedAssets(value));
      return {
        id: value.id,
        name: value.state?.projectTitle?.trim() && value.state.projectTitle !== "Untitled edit"
          ? value.state.projectTitle
          : value.state?.imageName || "Untitled edit",
        updatedAt: deleted ? value.deletedAt || value.updatedAt : value.updatedAt,
        deleted,
        bytes: estimateBytes(value) + [...ids].reduce((total, id) => total + imageBytes(id), 0),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const databaseBytes = entries.reduce((total, entry) => total + estimateBytes(entry.value), 0);
  let browser = null;
  try {
    browser = await navigator.storage?.estimate?.();
  } catch {}
  return {
    databaseBytes,
    browserUsage: browser?.usage ?? null,
    browserQuota: browser?.quota ?? null,
    edits,
  };
}

export async function permanentlyDeleteEdits(ids) {
  const deleting = new Set(ids);
  if (!deleting.size) return;
  let currentId = null;
  try {
    currentId = JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || "null")?.projectId;
  } catch {}
  if (currentId && deleting.has(currentId))
    throw new Error("The open edit cannot be permanently removed");
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entries = [];
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        entries.push({ key: String(cursor.key), value: cursor.value });
        cursor.continue();
        return;
      }
      const removeKeys = new Set();
      const candidateAssets = new Set();
      const protectedAssets = new Set();
      for (const { key, value } of entries) {
        const id = key.startsWith("draft:") || key.startsWith("trash:")
          ? key.slice(key.indexOf(":") + 1)
          : null;
        if (id && deleting.has(id)) {
          removeKeys.add(`draft:${id}`);
          removeKeys.add(`trash:${id}`);
          referencedAssets(value).forEach((asset) => candidateAssets.add(asset));
        } else {
          referencedAssets(value).forEach((asset) => protectedAssets.add(asset));
        }
      }
      try {
        const current = JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || "null");
        referencedAssets(current).forEach((asset) => protectedAssets.add(asset));
      } catch {}
      for (const id of deleting) {
        removeKeys.add(`draft:${id}`);
        removeKeys.add(`trash:${id}`);
      }
      for (const asset of candidateAssets)
        if (!protectedAssets.has(asset)) removeKeys.add(`image:${asset}`);
      for (const key of removeKeys) store.delete(key);
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
    tx.oncomplete = () => {
      db.close();
      window.dispatchEvent(new Event("luma-drafts-changed"));
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Could not clean local storage"));
    };
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveImage(blob, projectId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    if (!projectId)
      transaction.objectStore(STORE_NAME).put(blob, "current-image");
    if (projectId)
      transaction.objectStore(STORE_NAME).put(blob, `image:${projectId}`);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function readImage(projectId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(projectId ? `image:${projectId}` : "current-image");
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function saveDraft(editor) {
  if (!editor.imageUrl && !editor.baseAssetId && !editor.isUploaded) return;
  const pristine =
    !editor.freeCrop &&
    !editor.baseAssetId &&
    (!editor.photo ||
      JSON.stringify(editor.photo) === JSON.stringify(photoDefaults)) &&
    (!editor.projectTitle?.trim() || editor.projectTitle === "Untitled edit") &&
    !(editor.layers || []).length &&
    editor.baseVisible !== false &&
    editor.baseOpacity === 100 &&
    !editor.isUploaded &&
    Object.values(editor.adjustments).every((value) => value === 0) &&
    editor.cropRatio === "Original" &&
    !editor.rotation &&
    !editor.flipX &&
    !editor.flipY &&
    !editor.textLayer.enabled &&
    !editor.outputWidth &&
    !editor.outputHeight;
  if (pristine) {
    const lookup = await openDatabase();
    const existing = await new Promise((resolve, reject) => {
      const request = lookup
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(`draft:${editor.projectId}`);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).finally(() => lookup.close());
    if (!existing) return;
  }
  if (editor.isUploaded && !(await readImage(editor.projectId)))
    throw new Error("Source image is not saved");
  const { imageUrl, history, future, ...state } = editor;
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(
      {
        id: state.projectId,
        state,
        updatedAt: Date.now(),
        preview: state.isUploaded ? null : imageUrl,
      },
      `draft:${state.projectId}`,
    );
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
  window.dispatchEvent(new Event("luma-drafts-changed"));
}

export async function listDrafts() {
  return (await records("draft:"))
    .map((entry) => entry.value)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteDraft(id) {
  const draft = await readDraft(id);
  if (draft) {
    await putRecord(`trash:${id}`, { ...draft, deletedAt: Date.now() });
    await removeRecord(`draft:${id}`);
  }
  window.dispatchEvent(new Event("luma-drafts-changed"));
}
export async function putRecord(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function removeRecord(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function records(prefix) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const out = [],
      req = db
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) {
        if (String(c.key).startsWith(prefix))
          out.push({ key: c.key, value: c.value });
        c.continue();
      } else {
        db.close();
        resolve(out);
      }
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
export async function restoreDraft(id) {
  const entry = (await records("trash:")).find((r) => r.value.id === id);
  if (!entry) return;
  await putRecord(`draft:${id}`, entry.value);
  await removeRecord(entry.key);
  window.dispatchEvent(new Event("luma-drafts-changed"));
}

export async function readDraft(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(`draft:${id}`);
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function saveDesignTemplate(template) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(template, `template:${template.id}`);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function listDesignTemplates() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();
    request.onsuccess = () => {
      db.close();
      resolve(
        request.result
          .filter((item) => item?.design && item?.id)
          .sort((a, b) => b.updatedAt - a.updatedAt),
      );
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}
export async function deleteDesignTemplate(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite"),
      assets = tx.objectStore(STORE_NAME);
    assets.delete(`template:${id}`);
    const request = assets.openKeyCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (String(cursor.key).startsWith(`image:${id}:layer:`))
          assets.delete(cursor.key);
        cursor.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
