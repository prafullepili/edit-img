import { restoreDraft } from "./imageStorage";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { actions, flushDraft, prepareDraftDeletion } from "./store";
import { deleteDraft, listDrafts, readImage } from "./imageStorage";

function DraftCard({ draft, active, open, remove }) {
  const [url, setUrl] = useState(draft.preview);
  useEffect(() => {
    let alive = true,
      localUrl;
    if (draft.state.isUploaded)
      readImage(draft.id)
        .then((blob) => {
          if (alive && blob) {
            localUrl = URL.createObjectURL(blob);
            setUrl(localUrl);
          }
        })
        .catch(() => {});
    return () => {
      alive = false;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [draft.id, draft.state.isUploaded]);
  const a = draft.state.adjustments;
  return (
    <div className={`draft-card ${active ? "draft-active" : ""}`}>
      <button
        className="draft-open"
        onClick={() => open(draft)}
        title={`Resume ${draft.state.imageName}`}
      >
        {url ? (
          <img
            src={url}
            alt=""
            style={{
              filter: `brightness(${1 + a.exposure / 180}) saturate(${Math.max(0, 1 + a.saturation / 100)})`,
            }}
          />
        ) : (
          <span className="draft-placeholder">Image</span>
        )}
        <span>
          <strong>
            {draft.state.projectTitle?.trim() &&
            draft.state.projectTitle !== "Untitled edit"
              ? draft.state.projectTitle
              : draft.state.imageName}
          </strong>
          <small>
            {active ? "Current edit · " : ""}
            {new Date(draft.updatedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </small>
        </span>
        <span className="draft-resume">{active ? "●" : "↗"}</span>
      </button>
      <button
        className="draft-delete"
        onClick={() => remove(draft)}
        aria-label={`Delete ${draft.state.imageName}`}
        title="Delete autosaved edit"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
        </svg>
      </button>
    </div>
  );
}

export default function AutosavedEdits({ onAdd, onOpen, announce }) {
  const dispatch = useDispatch();
  const currentId = useSelector((s) => s.editor.projectId);
  const [drafts, setDrafts] = useState([]);
  const [deleted, setDeleted] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      listDrafts()
        .then((items) => {
          if (active) {
            setDrafts(items);
            setError(false);
          }
        })
        .catch(() => active && setError(true));
    const failed = () => setError(true);
    refresh();
    window.addEventListener("luma-drafts-changed", refresh);
    window.addEventListener("luma-draft-error", failed);
    return () => {
      active = false;
      window.removeEventListener("luma-drafts-changed", refresh);
      window.removeEventListener("luma-draft-error", failed);
    };
  }, []);
  const open = async (draft) => {
    try {
      const blob = draft.state.isUploaded ? await readImage(draft.id) : null;
      if (draft.state.isUploaded && !blob) throw new Error("Missing source");
      flushDraft();
      dispatch(
        actions.openDraft({
          state: draft.state,
          url: blob ? URL.createObjectURL(blob) : draft.preview,
        }),
      );
      announce(`Resumed ${draft.state.imageName}`);
      onOpen?.();
    } catch {
      announce(
        "This edit’s source image is unavailable. Please upload it again.",
      );
    }
  };
  const remove = async (draft) => {
    try {
      if (draft.id === currentId) dispatch(actions.discardDraft());
      await prepareDraftDeletion(draft.id);
      await deleteDraft(draft.id);
      setDeleted(draft.id);
      announce(`Deleted ${draft.state.imageName} from past edits.`);
    } catch {
      announce("The edit could not be deleted. Please try again.");
    }
  };
  return (
    <section className="filmstrip" aria-label="Autosaved past edits">
      <div className="filmstrip-header">
        <div>
          <span className="section-eyebrow">AUTOSAVED ON THIS DEVICE</span>
          <span className="filmstrip-title">
            Past edits <span>{drafts.length}</span>
          </span>
        </div>
        <button className="filmstrip-add" onClick={onAdd}>
          + Add image
        </button>
      </div>
      {deleted && (
        <button
          className="filmstrip-add"
          onClick={async () => {
            try {
              await restoreDraft(deleted);
              setDeleted(null);
              announce("Project restored.");
            } catch {
              announce("Restore failed.");
            }
          }}
        >
          Undo delete
        </button>
      )}
      {error ? (
        <p className="draft-empty" role="status">
          Autosave unavailable. Browser storage may be full.
        </p>
      ) : drafts.length ? (
        <div className="draft-list">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              active={draft.id === currentId}
              open={open}
              remove={remove}
            />
          ))}
        </div>
      ) : (
        <p className="draft-empty">
          Your edits appear here automatically. Select one to continue later.
        </p>
      )}
    </section>
  );
}
