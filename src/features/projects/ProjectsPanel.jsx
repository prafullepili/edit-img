import ShortcutList from "./ShortcutList";
import { newId } from "../../ids.js";
import React, { useCallback, useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { actions } from "../../store";
import SettingRange from "../../components/SettingRange";
import {
  records,
  putRecord,
  restoreDraft,
  readImage,
  removeRecord,
} from "../../imageStorage";
import LocalStorageManager from "./LocalStorageManager";
const download = (blob, name) => {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};
const encode = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
export default function ProjectsPanel({ announce, dimensions }) {
  const resultUrls = useRef([]);
  const announceRef = useRef(announce);
  announceRef.current = announce;
  useEffect(() => () => resultUrls.current.forEach(URL.revokeObjectURL), []);
  const e = useSelector((s) => s.editor),
    dispatch = useDispatch(),
    [trash, setTrash] = useState([]),
    [versions, setVersions] = useState([]),
    [name, setName] = useState("Version 1"),
    [busy, setBusy] = useState(false),
    [size, setSize] = useState(1200),
    [results, setResults] = useState([]);
  const refresh = useCallback(async () => {
    setTrash(await records("trash:"));
    setVersions(await records(`version:${e.projectId}:`));
  }, [e.projectId]);
  useEffect(() => {
    const update = () =>
      refresh().catch(() => announceRef.current("Project history is unavailable."));
    update();
    window.addEventListener("luma-drafts-changed", update);
    return () => {
      window.removeEventListener("luma-drafts-changed", update);
    };
  }, [refresh]);
  const run = async (task) => {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      announce(error.message);
    } finally {
      setBusy(false);
    }
  };
  const pack = async () => {
    const { imageUrl, history, future, ...state } = e,
      assets = {};
    if (e.isUploaded) {
      const b = await readImage(e.projectId);
      if (!b) throw new Error("Original image missing");
      assets.source = await encode(b);
    } else assets.source = await encode(await (await fetch(imageUrl)).blob());
    for (const id of [
      ...new Set(
        [
          e.baseAssetId,
          ...e.layers.filter((l) => l.type === "image").map((l) => l.assetId),
        ].filter(Boolean),
      ),
    ]) {
      const b = await readImage(id);
      if (!b) throw new Error("A project asset is missing");
      assets[id] = await encode(b);
    }
    return { format: "luma-project", version: 1, state, assets };
  };
  return (
    <div className="inspector-scroll">
      <div className="space-y-4 py-4 text-xs">
        <LocalStorageManager announce={announce} />
        <h2>Named versions</h2>
        <input
          aria-label="Version name"
          className="w-full bg-[#25271f] p-2"
          value={name}
          maxLength="80"
          onChange={(event) => setName(event.target.value)}
        />
        <button
          className="button w-full"
          disabled={busy || !name.trim()}
          onClick={() =>
            run(async () => {
              await putRecord(`version:${e.projectId}:${newId()}`, {
                name: name.trim(),
                date: Date.now(),
                project: await pack(),
              });
              await refresh();
              window.dispatchEvent(new Event("luma-drafts-changed"));
            })
          }
        >
          Create named version
        </button>
        {versions.map((v) => (
          <div className="flex w-full gap-2" key={v.key}>
            <button
              className="button min-w-0 flex-1 text-left"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const state = v.value.project.state;
                  dispatch(actions.snapshot());
                  dispatch(
                    actions.restoreVersion({
                      ...state,
                      projectId: e.projectId,
                      imageUrl: e.imageUrl,
                    }),
                  );
                  announce("Version restored.");
                })
              }
            >
              <span className="block truncate">{v.value.name}</span>
              <span className="block text-[9px] text-[#999b90]">
                {new Date(v.value.date).toLocaleString()}
              </span>
            </button>
            <button
              className="rounded border border-[#393a31] px-3 text-[#d8a095] hover:border-[#a86a5b] disabled:opacity-40"
              aria-label={`Delete version ${v.value.name}`}
              title="Delete this named version"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(`Delete version “${v.value.name}”? This cannot be undone.`)) return;
                run(async () => {
                  await removeRecord(v.key);
                  await refresh();
                  window.dispatchEvent(new Event("luma-drafts-changed"));
                  announce(`Deleted version “${v.value.name}”.`);
                });
              }}
            >
              ×
            </button>
          </div>
        ))}
        <h2>Deleted projects</h2>
        {trash.map((r) => (
          <button
            key={r.key}
            className="button w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await restoreDraft(r.value.id);
                await refresh();
              })
            }
          >
            Restore {r.value.state.projectTitle || r.value.state.imageName}
          </button>
        ))}
        {!trash.length && <p>No deleted projects.</p>}
        <h2>Export individual layer</h2>
        <button
          className="button w-full"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const { exportImage } = await import("../export/exportImage");
              download(
                await exportImage(
                  {
                    ...e,
                    layers: [],
                    textLayer: { ...e.textLayer, enabled: false },
                    baseVisible: true,
                    baseOpacity: 100,
                    exportFormat: "png",
                  },
                  {},
                ),
                "base-photo.png",
              );
            })
          }
        >
          PNG: Base photo
        </button>
        {e.textLayer.enabled && (
          <button
            className="button w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const { exportImage } = await import("../export/exportImage");
                download(
                  await exportImage(
                    {
                      ...e,
                      layers: [],
                      baseVisible: false,
                      exportFormat: "png",
                    },
                    {},
                  ),
                  "primary-text.png",
                );
              })
            }
          >
            PNG: Primary text
          </button>
        )}
        {e.layers.map((layer) => (
          <button
            key={layer.id}
            className="button w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const { drawLayers } = await import("../../layers");
                const canvas = document.createElement("canvas");
                canvas.width = e.outputWidth || dimensions.width;
                canvas.height = e.outputHeight || dimensions.height;
                const images = {};
                try {
                  if (layer.type === "image") {
                    const blob = await readImage(layer.assetId);
                    if (!blob) throw new Error("Layer image missing");
                    images[layer.assetId] = URL.createObjectURL(blob);
                  }
                  await drawLayers(
                    canvas.getContext("2d"),
                    [{ ...layer, visible: true }],
                    images,
                    canvas.width,
                    canvas.height,
                    dimensions.width,
                  );
                  download(
                    await new Promise((resolve) =>
                      canvas.toBlob(resolve, "image/png"),
                    ),
                    `${layer.name}.png`,
                  );
                } finally {
                  Object.values(images).forEach(URL.revokeObjectURL);
                }
              })
            }
          >
            PNG: {layer.name}
          </button>
        ))}
        <h2>Batch resize</h2>
        <SettingRange
          label="Batch maximum edge"
          min={64}
          max={8192}
          unit="px"
          value={size}
          onChange={setSize}
        />
        <input
          aria-label="Batch images"
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(event.target.files || []).slice(0, 50);
            event.target.value = "";
            run(async () => {
              results.forEach((r) => URL.revokeObjectURL(r.url));
              const output = [];
              for (const file of files) {
                if (!file.type.startsWith("image/")) continue;
                const bitmap = await createImageBitmap(file),
                  ratio = Math.min(
                    1,
                    size / Math.max(bitmap.width, bitmap.height),
                  ),
                  canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
                canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
                canvas
                  .getContext("2d")
                  .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                bitmap.close();
                const blob = await new Promise((resolve) =>
                  canvas.toBlob(resolve, "image/png"),
                );
                output.push({
                  name: `${file.name.replace(/\.[^.]+$/, "")}-${canvas.width}x${canvas.height}.png`,
                  blob,
                  url: URL.createObjectURL(blob),
                });
              }
              setResults(output);
            });
          }}
        />
        {results.map((r) => (
          <a
            key={r.name}
            href={r.url}
            download={r.name}
            className="block text-[#c8ef69]"
          >
            Download {r.name}
          </a>
        ))}
        {results.length > 1 && (
          <button
            className="button w-full"
            onClick={() => results.forEach((r) => download(r.blob, r.name))}
          >
            Download all ({results.length})
          </button>
        )}
        <h2>Keyboard shortcuts</h2>
        <ShortcutList />
        {busy && <p role="status">Working…</p>}
      </div>
    </div>
  );
}
