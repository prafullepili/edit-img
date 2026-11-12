import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { prepareDraftDeletion } from "../../store";
import {
  getLocalStorageSummary,
  permanentlyDeleteEdits,
  restoreDraft,
} from "../../imageStorage";

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const number = value / 1024 ** index;
  return `${number.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function LocalStorageManager({ announce }) {
  const currentId = useSelector((state) => state.editor.projectId);
  const currentHasPhoto = useSelector((state) =>
    Boolean(state.editor.imageUrl || state.editor.baseAssetId),
  );
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSummary(await getLocalStorageSummary());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("luma-drafts-changed", refresh);
    return () => window.removeEventListener("luma-drafts-changed", refresh);
  }, [refresh]);

  const toggle = (id) =>
    setSelected((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );

  const removeSelected = async () => {
    const items = summary?.edits.filter(
      (edit) =>
        selected.includes(edit.id) &&
        (!currentHasPhoto || edit.id !== currentId || edit.deleted),
    ) || [];
    if (!items.length) return;
    const bytes = items.reduce((sum, item) => sum + item.bytes, 0);
    const names = items.slice(0, 3).map((item) => `“${item.name}”`).join(", ");
    const more = items.length > 3 ? ` and ${items.length - 3} more` : "";
    if (
      !window.confirm(
        `Permanently remove ${items.length} saved edit${items.length === 1 ? "" : "s"} (${names}${more})? This cannot be undone and will free about ${formatBytes(bytes)}.`,
      )
    )
      return;
    setBusy(true);
    try {
      await Promise.all(items.map((item) => prepareDraftDeletion(item.id)));
      await permanentlyDeleteEdits(
        items.map((item) => ({ id: item.id, deleted: item.deleted })),
        { currentId, currentHasPhoto },
      );
      setSelected([]);
      await refresh();
      announce(`Removed ${items.length} saved edit${items.length === 1 ? "" : "s"} from this device.`);
    } catch {
      announce("Storage cleanup failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (edit) => {
    setBusy(true);
    try {
      await restoreDraft(edit.id);
      setSelected((items) => items.filter((id) => id !== edit.id));
      await refresh();
      announce(`Restored “${edit.name}” to Past edits.`);
    } catch {
      announce(`Could not restore “${edit.name}”. Please try again.`);
    } finally {
      setBusy(false);
    }
  };

  const quotaPercent = summary?.browserUsage != null && summary.browserQuota
    ? Math.min(100, (summary.browserUsage / summary.browserQuota) * 100)
    : null;
  const removableCount = summary?.edits.filter(
    (edit) => !currentHasPhoto || edit.id !== currentId || edit.deleted,
  ).length || 0;

  return (
    <section className="space-y-3 rounded-lg border border-[#393a31] bg-[#1b1c18] p-3" aria-label="Local storage management">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#eeeee5]">Local storage</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-[#999b90]">
            Saved edits and their image assets stay in this browser.
          </p>
        </div>
        <button
          className="shrink-0 rounded border border-[#393a31] px-2 py-1 text-[10px] text-[#c8ef69] hover:border-[#c8ef69]"
          onClick={refresh}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="text-[11px] text-[#e3a39b]" role="status">
          Could not read local storage details.
        </p>
      ) : summary ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-[#b7b8ad]">Luma Studio data</span>
            <strong className="font-mono text-xs text-[#eeeee5]">
              {formatBytes(summary.databaseBytes)}
            </strong>
          </div>
          {quotaPercent != null && (
            <div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-[#303127]"
                role="progressbar"
                aria-label="Browser storage used"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(quotaPercent)}
              >
                <div
                  className="h-full rounded-full bg-[#c8ef69]"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[9px] text-[#85877d]">
                This site uses {formatBytes(summary.browserUsage)} of the browser’s estimated {formatBytes(summary.browserQuota)} allowance.
              </p>
            </div>
          )}

          <details className="group rounded-md border border-[#303127]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-2 text-[11px] text-[#d2d3c9] [&::-webkit-details-marker]:hidden">
              <span>Manage saved edits ({summary.edits.length})</span>
              <span className="text-[#c8ef69] group-open:rotate-180">⌄</span>
            </summary>
            <div className="space-y-2 border-t border-[#303127] p-2">
              <p className="text-[9px] leading-relaxed text-[#85877d]">
                Select edits to permanently remove them and their unused image files. The open edit is protected.
              </p>
              {summary.edits.length ? (
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {summary.edits.map((edit) => {
                    const protectedEdit =
                      currentHasPhoto && edit.id === currentId && !edit.deleted;
                    return (
                      <div
                        key={`${edit.deleted ? "trash" : "draft"}:${edit.id}`}
                        className={`flex items-center gap-2 rounded border border-[#303127] px-2 py-1.5 ${protectedEdit ? "opacity-50" : "hover:border-[#565a43]"}`}
                      >
                        <input
                          type="checkbox"
                          className="accent-[#c8ef69]"
                          checked={selected.includes(edit.id)}
                          disabled={protectedEdit || busy}
                          onChange={() => toggle(edit.id)}
                          aria-label={`Select ${edit.name} for permanent removal`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] text-[#dedfd5]">
                            {edit.name}
                          </span>
                          <span className="block text-[9px] text-[#85877d]">
                            {edit.deleted ? "Deleted · recoverable" : protectedEdit ? "Open edit · protected" : "Saved edit"}
                            {edit.updatedAt ? ` · ${new Date(edit.updatedAt).toLocaleDateString()}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[9px] text-[#aeb09f]">
                          ~{formatBytes(edit.bytes)}
                        </span>
                        {edit.deleted && (
                          <button
                            className="shrink-0 rounded border border-[#4c5a37] px-2 py-1 text-[9px] text-[#c8ef69] hover:border-[#c8ef69] disabled:opacity-40"
                            onClick={() => restore(edit)}
                            disabled={busy}
                            aria-label={`Restore ${edit.name}`}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-[#85877d]">No saved edits to clean up.</p>
              )}
              <button
                className="w-full rounded-md border border-[#704b42] bg-[#2b211e] px-2 py-2 text-[10px] text-[#efb5a8] hover:border-[#a86a5b] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={busy || !selected.length || !removableCount}
                onClick={removeSelected}
              >
                {busy ? "Deleting…" : `Permanently delete selected edits${selected.length ? ` (${selected.length})` : ""}`}
              </button>
            </div>
          </details>
        </>
      ) : (
        <p className="text-[10px] text-[#85877d]">Checking this browser’s storage…</p>
      )}
    </section>
  );
}
