import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { actions, store } from "../../store";
import InfoTip from "../../components/InfoTip";
import SettingRange from "../../components/SettingRange";
import { colorBands, photoDefaults } from "./defaults";
const field = "w-full rounded border border-[#393a31] bg-[#22231e] p-2 text-xs";
function Range({
  label,
  info,
  value,
  min = -100,
  max = 100,
  step = 1,
  onChange,
}) {
  return (
    <SettingRange
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
      info={info ? <InfoTip label={label}>{info}</InfoTip> : null}
    />
  );
}
function Histogram({ bins }) {
  if (!bins)
    return (
      <p className="text-[#999b90]">Histogram appears when the photo loads.</p>
    );
  const maximum = Math.max(1, ...bins.flat().map((v) => Math.log1p(v)));
  return (
    <svg
      viewBox="0 0 256 90"
      className="w-full rounded bg-[#10110e]"
      aria-label="RGB histogram"
    >
      {bins.map((channel, index) => (
        <polyline
          key={index}
          points={channel
            .map(
              (count, x) => `${x},${88 - (Math.log1p(count) / maximum) * 84}`,
            )
            .join(" ")}
          fill="none"
          stroke={["#f77e80", "#bce578", "#7bafff"][index]}
          strokeWidth="1"
          opacity=".8"
        />
      ))}
    </svg>
  );
}
function CurveEditor({ values, onChange }) {
  const change = (event) => {
    const r = event.currentTarget.getBoundingClientRect(),
      x = ((event.clientX - r.left) / r.width) * 255,
      y = Math.max(
        0,
        Math.min(255, 255 - ((event.clientY - r.top) / r.height) * 255),
      ),
      index = Math.max(0, Math.min(4, Math.round(x / 64)));
    const next = [...values];
    next[index] = Math.round(y);
    onChange(next);
  };
  return (
    <svg
      aria-label="Tone curve: drag to change a control point"
      role="img"
      viewBox="0 0 255 255"
      className="w-full touch-none rounded border border-[#393a31] bg-[#11120f]"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        change(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) change(e);
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
    >
      <path
        d="M0 64H255M0 128H255M0 192H255M64 0V255M128 0V255M192 0V255"
        stroke="#2d3026"
      />
      <path d="M0 255 255 0" stroke="#565b47" strokeDasharray="3 3" />
      <polyline
        points={values
          .map((y, i) => `${[0, 64, 128, 192, 255][i]},${255 - y}`)
          .join(" ")}
        fill="none"
        stroke="#c8ef69"
        strokeWidth="2"
      />
      {values.map((y, i) => (
        <circle
          key={i}
          cx={[0, 64, 128, 192, 255][i]}
          cy={255 - y}
          r="4"
          fill="#c8ef69"
        />
      ))}
    </svg>
  );
}
export default function PhotoPanel({
  type,
  histogram,
  retouch,
  setRetouch,
  announce,
}) {
  const cancellation = useRef(null);
  useEffect(() => () => cancellation.current?.abort(), []);
  const editor = useSelector((s) => s.editor),
    dispatch = useDispatch(),
    photo = editor.photo;
  const [channel, setChannel] = useState("rgb"),
    [band, setBand] = useState("red"),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const edit = (changes) => {
    dispatch(actions.snapshot());
    dispatch(actions.setPhoto(changes));
  };
  const remove = async () => {
    cancellation.current = new AbortController();
    setBusy(true);
    setStatus("Preparing model…");
    const projectId = editor.projectId;
    try {
      const { removePhotoBackground } = await import("./background");
      const assetId = await removePhotoBackground(
        editor,
        setStatus,
        cancellation.current.signal,
      );
      if (store.getState().editor.projectId === projectId) {
        dispatch(actions.snapshot());
        dispatch(actions.setBaseAsset(assetId));
        dispatch(actions.setExport({ exportFormat: "png" }));
        announce("Background removed. PNG export preserves transparency.");
      }
    } catch (error) {
      announce(
        `Background removal failed: ${error.message}. Check your connection and retry.`,
      );
    } finally {
      setBusy(false);
      setStatus("");
    }
  };
  return (
    <div className="inspector-scroll">
      <div className="space-y-5 py-4 text-[11px]">
        {type === "tone" && (
          <>
            <Histogram bins={histogram} />
            <h2 className="font-semibold text-[#c8ef69]">Levels</h2>
            <Range
              label="Black point"
              min={0}
              max={photo.levels.white - 1}
              value={photo.levels.black}
              onChange={(black) => edit({ levels: { ...photo.levels, black } })}
            />
            <Range
              label="White point"
              min={photo.levels.black + 1}
              max={255}
              value={photo.levels.white}
              onChange={(white) => edit({ levels: { ...photo.levels, white } })}
            />
            <Range
              label="Midtone gamma"
              min={0.1}
              max={3}
              step={0.05}
              value={photo.levels.gamma}
              onChange={(gamma) => edit({ levels: { ...photo.levels, gamma } })}
            />
            <h2 className="font-semibold text-[#c8ef69]">Curves</h2>
            <select
              aria-label="Curve channel"
              className={field}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {["rgb", "red", "green", "blue"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <CurveEditor
              values={photo.curves[channel]}
              onChange={(values) =>
                edit({ curves: { ...photo.curves, [channel]: values } })
              }
            />
            {photo.curves[channel].map((value, index) => (
              <Range
                key={index}
                label={`Curve point ${index + 1}`}
                min={0}
                max={255}
                value={value}
                onChange={(v) =>
                  edit({
                    curves: {
                      ...photo.curves,
                      [channel]: photo.curves[channel].map((old, i) =>
                        i === index ? v : old,
                      ),
                    },
                  })
                }
              />
            ))}
            <button
              className="button w-full"
              onClick={() =>
                edit({
                  levels: photoDefaults.levels,
                  curves: photoDefaults.curves,
                })
              }
            >
              Reset curves & levels
            </button>
          </>
        )}
        {type === "color" && (
          <>
            <p className="text-[#999b90]">
              Adjust one color range at a time. Changes blend smoothly into
              neighboring hues.
            </p>
            <select
              aria-label="Color range"
              className={field}
              value={band}
              onChange={(e) => setBand(e.target.value)}
            >
              {colorBands.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <h2 className="font-semibold text-[#c8ef69]">HSL</h2>
            {["hue", "saturation", "lightness"].map((key) => (
              <Range
                key={key}
                label={`${band} ${key}`}
                min={key === "hue" ? -60 : -100}
                max={key === "hue" ? 60 : 100}
                value={photo.hsl[band]?.[key] || 0}
                onChange={(value) =>
                  edit({
                    hsl: {
                      ...photo.hsl,
                      [band]: { ...photo.hsl[band], [key]: value },
                    },
                  })
                }
              />
            ))}
            <h2 className="font-semibold text-[#c8ef69]">
              Selective color balance
            </h2>
            {["red", "green", "blue"].map((key) => (
              <Range
                key={key}
                label={`${band}: ${key}`}
                value={photo.selective[band]?.[key] || 0}
                onChange={(value) =>
                  edit({
                    selective: {
                      ...photo.selective,
                      [band]: { ...photo.selective[band], [key]: value },
                    },
                  })
                }
              />
            ))}
            <button
              className="button w-full"
              onClick={() => edit({ hsl: {}, selective: {} })}
            >
              Reset selective color & HSL
            </button>
          </>
        )}
        {type === "detail" && (
          <>
            <Histogram bins={histogram} />
            <Range
              label="Sharpening"
              min={0}
              max={100}
              value={photo.sharpen}
              onChange={(sharpen) => edit({ sharpen })}
            />
            <Range
              label="Noise reduction"
              min={0}
              max={100}
              value={photo.denoise}
              onChange={(denoise) => edit({ denoise })}
            />
            <p className="text-[#999b90]">
              Edge-aware smoothing reduces small color variations. Sharpening
              increases local edge contrast.
            </p>
            <button
              className="button w-full"
              onClick={() => edit({ sharpen: 0, denoise: 0 })}
            >
              Reset detail
            </button>
          </>
        )}
        {type === "background" && (
          <>
            <p className="text-[#999b90]">
              Remove the background using an AI model on this device. The first
              run downloads the model and runtime. Your photo stays in your
              browser.
            </p>
            <button
              className="button primary w-full"
              disabled={busy}
              onClick={remove}
            >
              {busy ? "Removing background…" : "Remove background"}
            </button>
            {busy && (
              <button
                className="button w-full"
                onClick={() => cancellation.current?.abort()}
              >
                Cancel removal
              </button>
            )}
            <p role="status">{status}</p>
            <button
              className="button w-full"
              disabled={!editor.baseAssetId || busy}
              onClick={() => {
                dispatch(actions.snapshot());
                dispatch(actions.setBaseAsset(null));
              }}
            >
              Restore original background
            </button>
            <p className="text-[#999b90]">
              Use PNG or WebP to keep transparency. Use the eraser to refine the
              result.
            </p>
          </>
        )}
        {type === "retouch" && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {["brush", "eraser", "heal"].map((tool) => (
                <div key={tool} className="relative min-w-0">
                  <button
                    className={`button w-full ${retouch.tool === tool ? "primary" : ""}`}
                    style={tool === "heal" ? { paddingRight: 24 } : undefined}
                    onClick={() => setRetouch({ ...retouch, tool })}
                  >
                    {tool}
                  </button>
                  {tool === "heal" && (
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
                      <InfoTip label="Heal" align="end">
                        Heal copies pixels from a clean part of the photo.
                        Choose a healing source, then tap or click a clean area
                        (or Alt-click it). Paint over the area to repair. Use a
                        soft brush edge to blend; choose a new source when
                        needed.
                      </InfoTip>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <Range
              label="Brush diameter (source pixels)"
              min={2}
              max={300}
              value={retouch.size}
              onChange={(size) => setRetouch({ ...retouch, size })}
            />
            <Range
              label="Brush opacity"
              min={1}
              max={100}
              value={retouch.opacity}
              onChange={(opacity) => setRetouch({ ...retouch, opacity })}
            />
            <Range
              label="Brush hardness"
              info="Hardness controls edge softness. 0% gives a soft, feathered edge; 100% gives a sharp edge. It does not change brush diameter. Use softer edges to blend healing into the photo."
              min={0}
              max={100}
              value={retouch.hardness}
              onChange={(hardness) => setRetouch({ ...retouch, hardness })}
            />
            <label className="flex justify-between">
              Brush color
              <input
                aria-label="Brush color"
                type="color"
                value={retouch.color}
                onChange={(e) =>
                  setRetouch({ ...retouch, color: e.target.value })
                }
              />
            </label>
            {retouch.tool === "heal" && (
              <>
                <button
                  className="button w-full"
                  onClick={() => setRetouch({ ...retouch, picking: true })}
                >
                  {retouch.picking
                    ? "Click the photo to choose a source"
                    : "Choose healing source"}
                </button>
                <p className="text-[#999b90]">
                  Alt-click to sample a clean area, then paint to copy its
                  texture with blended edges.
                </p>
              </>
            )}
            <p className="text-[#999b90]">
              Paint directly on the base photo. Each completed stroke can be
              undone. Design layers are unaffected.
            </p>
            <button
              className="button w-full"
              disabled={!photo.strokes.length}
              onClick={() => edit({ strokes: [] })}
            >
              Clear all retouching ({photo.strokes.length})
            </button>
          </>
        )}
      </div>
    </div>
  );
}
