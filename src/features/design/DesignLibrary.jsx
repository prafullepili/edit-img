import { newId } from "../../ids.js";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { actions, store } from "../../store";
import { layerDefaults } from "../../layers";
import {
  readImage,
  saveImage,
  saveDesignTemplate,
  listDesignTemplates,
  deleteDesignTemplate,
} from "../../imageStorage";
import { icons, stickers, iconSvg } from "./catalog";
import { builtinTemplates, instantiateDesign } from "./templateData";
const button =
  "rounded border border-[#393a31] bg-[#22231e] p-2 text-[10px] hover:border-[#c8ef69] disabled:opacity-40";
async function copyAssets(layers, owner) {
  const copies = new Map();
  return Promise.all(
    layers.map(async (layer) => {
      if (layer.type !== "image") return layer;
      if (!copies.has(layer.assetId))
        copies.set(
          layer.assetId,
          (async () => {
            const blob = await readImage(layer.assetId);
            if (!blob) throw new Error(`Image missing: ${layer.name}`);
            const id = `${owner}:layer:${newId()}`;
            await saveImage(blob, id);
            return id;
          })(),
        );
      return { ...layer, assetId: await copies.get(layer.assetId) };
    }),
  );
}
export default function DesignLibrary({ dimensions, announce }) {
  const dispatch = useDispatch(),
    editor = useSelector((s) => s.editor),
    [tab, setTab] = useState("stickers"),
    [templates, setTemplates] = useState([]),
    [name, setName] = useState("My design"),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    listDesignTemplates()
      .then(setTemplates)
      .catch(() => announce("Template storage is unavailable."));
  useEffect(() => {
    refresh();
  }, []);
  const add = (asset, type) => {
    dispatch(actions.snapshot());
    dispatch(
      actions.addLayer({
        ...layerDefaults,
        id: newId(),
        type,
        iconName: asset.id,
        name: asset.name,
        color: asset.color || "#ffffff",
        width: 15,
        height: (15 * dimensions.width) / dimensions.height,
      }),
    );
    dispatch(actions.setTool("layers"));
  };
  const apply = async (template) => {
    setBusy(true);
    const projectId = editor.projectId;
    try {
      let design = instantiateDesign(template.design, projectId);
      design = {
        ...design,
        layers: await copyAssets(design.layers, projectId),
      };
      if (store.getState().editor.projectId !== projectId)
        throw new Error("The current project changed");
      dispatch(actions.snapshot());
      dispatch(actions.addDesign(design));
      announce(`Added ${template.name}. All elements remain editable.`);
    } catch (error) {
      announce(`Template could not be added: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = newId(),
        layers = await copyAssets(
          JSON.parse(JSON.stringify(editor.layers)),
          id,
        );
      await saveDesignTemplate({
        id,
        name: name.trim().slice(0, 80),
        updatedAt: Date.now(),
        design: {
          layers,
          textLayer: JSON.parse(JSON.stringify(editor.textLayer)),
        },
      });
      await refresh();
      announce("Reusable design saved on this device.");
    } catch (error) {
      announce(`Template could not be saved: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="inspector-scroll">
      <div className="space-y-4 py-4 text-xs">
        <div className="grid grid-cols-3 gap-2">
          {["stickers", "icons", "templates"].map((t) => (
            <button
              className={`${button} ${tab === t ? "text-[#c8ef69] border-[#c8ef69]" : ""}`}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {tab !== "templates" ? (
          <>
            <p className="text-[10px] leading-relaxed text-[#999b90]">
              Add a vector asset, then use Layers to move, resize, rotate,
              recolor, or mask it.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(tab === "icons" ? icons : stickers).map((asset) => (
                <button
                  key={asset.id}
                  className={`${button} flex flex-col items-center gap-2`}
                  onClick={() =>
                    add(asset, tab === "icons" ? "icon" : "sticker")
                  }
                >
                  <span
                    className="h-9 w-9"
                    dangerouslySetInnerHTML={{
                      __html: iconSvg(asset.id, asset.color || "#c8ef69"),
                    }}
                  />
                  <span>{asset.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-[10px] leading-relaxed text-[#999b90]">
              Templates add editable design layers to your current photo. Your
              saved templates include design layers and the primary text
              overlay.
            </p>
            <h2 className="text-[#c8ef69]">Starter templates</h2>
            {builtinTemplates.map((t, i) => (
              <button
                key={t.id}
                disabled={busy}
                className={`${button} w-full text-left`}
                onClick={() => apply(t)}
              >
                <span
                  className="mb-2 block h-12 rounded"
                  style={{
                    background: [
                      "linear-gradient(130deg,#222920,#52633f)",
                      "linear-gradient(45deg,#7446ee,#eb6689)",
                      "linear-gradient(120deg,#f4f0e5,#bdc6ab)",
                    ][i],
                  }}
                />
                <strong>{t.name}</strong>
                <span className="float-right text-[#c8ef69]">+ Add</span>
              </button>
            ))}
            <h2 className="pt-2 text-[#c8ef69]">Save current design</h2>
            <input
              aria-label="Template name"
              maxLength="80"
              className="w-full rounded border border-[#393a31] bg-[#22231e] p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="button primary w-full"
              disabled={
                busy ||
                (!editor.layers.length && !editor.textLayer.enabled) ||
                !name.trim()
              }
              onClick={save}
            >
              {busy ? "Working…" : "Save reusable template"}
            </button>
            <h2 className="pt-2 text-[#c8ef69]">
              My templates ({templates.length})
            </h2>
            {templates.map((t) => (
              <div key={t.id} className="flex gap-2">
                <button
                  disabled={busy}
                  className={`${button} min-w-0 flex-1 truncate text-left`}
                  onClick={() => apply(t)}
                >
                  {t.name}
                </button>
                <button
                  aria-label={`Delete template ${t.name}`}
                  className={`${button} text-[#ffa99d]`}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await deleteDesignTemplate(t.id);
                      await refresh();
                    } catch {
                      announce("Template could not be deleted.");
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
            {!templates.length && (
              <p className="text-[10px] text-[#999b90]">
                Saved designs will appear here after you create one.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
