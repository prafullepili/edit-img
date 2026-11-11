import { photoDefaults } from "./features/photo/defaults";
const DB_NAME = "luma-studio-local";
const STORE_NAME = "project-assets";

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
