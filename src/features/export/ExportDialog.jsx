import SettingRange from "../../components/SettingRange";
import React, { useEffect, useState } from "react";
import { exportImage } from "./exportImage";
import { useDispatch } from "react-redux";
import { actions } from "../../store";
import Icon from "../../components/Icon";
export default function ExportDialog({
  editor,
  dimensions,
  working,
  download,
  onClose,
  previewUrl,
  ready,
  layerImages,
}) {
  const dispatch = useDispatch();
  const loaded = ready;
  const [encoded, setEncoded] = useState(null);
  const [previewError, setPreviewError] = useState("");
  useEffect(() => {
    let active = true,
      url;
    setEncoded(null);
    setPreviewError("");
    const timer = setTimeout(async () => {
      try {
        const blob = await exportImage(editor, layerImages);
        if (!active) return;
        url = URL.createObjectURL(blob);
        setEncoded({ url, size: blob.size });
      } catch {
        if (active) setPreviewError("Could not prepare export preview.");
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [editor, layerImages]);
  return (
    <div className="modal-backdrop" onClick={() => onClose()}>
      <section
        className="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-top">
          <div>
            <span className="section-eyebrow">READY WHEN YOU ARE</span>
            <h2 id="export-heading">Export your image</h2>
          </div>
          <button
            className="modal-close"
            onClick={() => onClose()}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="export-preview">
          <img
            src={encoded?.url || previewUrl || editor.imageUrl}
            style={{
              background:
                "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 / 12px 12px",
            }}
            alt="Export preview"
          />
          <div>
            <strong>{editor.imageName.replace(/\.[^.]+$/, "")}-luma</strong>
            <span>Current crop · All visible layers</span>
          </div>
        </div>
        <p className="my-2 text-xs" role="status">
          {previewError ||
            (encoded
              ? `Estimated file size: ${(encoded.size / 1024).toFixed(1)} KB`
              : "Preparing export preview…")}{" "}
          ·{" "}
          {editor.exportFormat === "jpeg"
            ? "Transparency filled with white"
            : "Transparency preserved"}
        </p>
        <label className="export-label">FILE FORMAT</label>
        <div className="format-options">
          <button
            className={editor.exportFormat === "jpeg" ? "selected" : ""}
            onClick={() =>
              dispatch(actions.setExport({ exportFormat: "jpeg" }))
            }
          >
            <strong>JPEG</strong>
            <span>Smaller file · photographs</span>
          </button>
          <button
            className={editor.exportFormat === "png" ? "selected" : ""}
            onClick={() => dispatch(actions.setExport({ exportFormat: "png" }))}
          >
            <strong>PNG</strong>
            <span>Lossless quality</span>
          </button>
          <button
            className={editor.exportFormat === "webp" ? "selected" : ""}
            onClick={() =>
              dispatch(actions.setExport({ exportFormat: "webp" }))
            }
          >
            <strong>WebP</strong>
            <span>Optimized for the web</span>
          </button>
        </div>
        <p className="mt-3 text-[10px] text-[#a6aa9c]">
          Output: {editor.outputWidth || dimensions.width} ×{" "}
          {editor.outputHeight || dimensions.height} px
        </p>
        {editor.exportFormat !== "png" && (
          <div className="mt-3">
            <SettingRange
              label="Quality"
              min={50}
              max={100}
              unit="%"
              value={editor.exportQuality}
              onChange={(exportQuality) =>
                dispatch(actions.setExport({ exportQuality }))
              }
            />
          </div>
        )}
        <button
          className="button primary modal-export"
          onClick={download}
          disabled={working || !loaded}
        >
          {working ? (
            <>
              <span className="loader small" /> Preparing export…
            </>
          ) : (
            <>
              <Icon name="download" size={16} /> Download image
            </>
          )}
        </button>
        <p className="export-note">
          <span className="lock-icon">⌑</span> Rendered locally on your device.
          No account needed.
        </p>
      </section>
    </div>
  );
}
