import React from "react";

import { useDispatch, useSelector } from "react-redux";

import { actions } from "../../store";

export default function HistoryPanel() {
  const { history, future } = useSelector((state) => state.editor);

  const dispatch = useDispatch();

  return (
    <details className="mx-5 my-2 border-b border-[#393a31] pb-2 text-xs">
      <summary className="cursor-pointer">
        Edit history · {history.length}
      </summary>

      <div className="flex gap-2 py-2">
        <button
          className="button"
          disabled={!history.length}
          onClick={() => dispatch(actions.undo())}
        >
          Undo {history.at(-1)?.historyLabel || ""}
        </button>

        <button
          className="button"
          disabled={!future.length}
          onClick={() => dispatch(actions.redo())}
        >
          Redo {future[0]?.historyLabel || ""}
        </button>
      </div>

      <ol className="max-h-36 overflow-auto text-[#b7b8ad]">
        {history.map((entry, index) => (
          <li key={index} className="py-1">
            {index + 1}. {entry.historyLabel || "Edited photo"}
          </li>
        ))}
      </ol>

      {!history.length && (
        <p className="py-2 text-[#999b90]">No edits in this session.</p>
      )}
    </details>
  );
}
