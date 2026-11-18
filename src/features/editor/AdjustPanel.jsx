import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { actions } from "../../store";
import Icon from "../../components/Icon";
import Slider from "../../components/Slider";
import { controlGroups } from "./editorData";
const ADJUSTMENT_CLIPBOARD_KEY = "luma-studio-adjustment-clipboard-v1";

export default function AdjustPanel({ editor, change, onChangeStart }) {
  const dispatch = useDispatch();
  const hasPhoto = Boolean(editor.imageUrl || editor.baseAssetId || editor.isUploaded);
  const [clipboard, setClipboard] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(ADJUSTMENT_CLIPBOARD_KEY));
      if (!stored || !Object.keys(editor.adjustments).every((key) => Number.isFinite(Number(stored[key])))) return null;
      return Object.fromEntries(
        Object.keys(editor.adjustments).map((key) => [key, Number(stored[key])]),
      );
    } catch {
      return null;
    }
  });
  const [feedback, setFeedback] = useState("");
  return (
    <div className="inspector-scroll">
      <div className="adjustment-summary">
        <span>
          <i className="summary-dot" />{" "}
          {editor.preset === "Custom" ? "Custom adjustments" : editor.preset}
        </span>
        <button
          onClick={() => {
            dispatch(actions.resetCurrent());
          }}
        >
          Reset all
        </button>
      </div>
      <div className="adjustment-transfer">
        <button
          type="button"
          disabled={!hasPhoto}
          onClick={() => {
            const values = { ...editor.adjustments };
            try {
              localStorage.setItem(ADJUSTMENT_CLIPBOARD_KEY, JSON.stringify(values));
            } catch {}
            setClipboard(values);
            setFeedback("Copied");
          }}
        >
          Copy adjustments
        </button>
        <button
          type="button"
          disabled={!hasPhoto || !clipboard}
          onClick={() => {
            saveSnapshot();
            dispatch(actions.pasteAdjustments(clipboard));
            setFeedback("Pasted");
          }}
        >
          Paste adjustments
        </button>
        <span role="status" aria-live="polite">{feedback}</span>
      </div>
      {controlGroups.map((group) => (
        <section className="control-group" key={group.title}>
          <div className="group-heading">
            <span className="group-icon">
              <Icon name={group.icon} size={15} />
            </span>
            <span>{group.title}</span>
            <span className="group-line" />
          </div>
          {group.controls.map((item) => (
            <Slider
              key={item[0]}
              item={item}
              value={editor.adjustments[item[0]]}
              onChange={change}
              onStart={onChangeStart}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
