import React, { useRef } from "react";
import { shapeTypes, shapePoints } from "./shapeGeometry";
function ShapeGlyph({ type }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "rectangle" ? (
        <rect x="3" y="5" width="18" height="14" rx="1" />
      ) : type === "ellipse" ? (
        <ellipse cx="12" cy="12" rx="10" ry="8" />
      ) : (
        <polygon
          points={shapePoints(type)
            .map(([x, y]) => `${2 + x * 20},${2 + y * 20}`)
            .join(" ")}
        />
      )}
    </svg>
  );
}
export default function ShapePicker({ onAdd }) {
  const menu = useRef(null);
  return (
    <details
      ref={menu}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          menu.current.open = false;
      }}
      className="group"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          menu.current.open = false;
          menu.current.querySelector("summary").focus();
        }
      }}
    >
      <summary
        aria-label="Add shape"
        title="Shapes"
        className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded border border-[#393a31] bg-[#22231e] hover:border-[#c8ef69] [&::-webkit-details-marker]:hidden"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="11" height="11" rx="1" />
          <circle cx="16" cy="16" r="6" />
        </svg>
      </summary>
      <div
        className="absolute left-0 top-11 z-50 w-56 rounded-lg border border-[#484b3c] bg-[#20211c] p-3 shadow-xl"
        aria-label="Shapes"
      >
        <p className="mb-2 text-[11px] text-[#a4a894]">Add a shape</p>
        <div className="grid grid-cols-2 gap-1.5">
          {shapeTypes.map((type) => (
            <button
              key={type}
              title={`Add ${type}`}
              aria-label={`Add ${type} layer`}
              className="flex items-center gap-2 rounded border border-[#393a31] p-2 text-[10px] capitalize hover:border-[#c8ef69] hover:bg-[#29311f]"
              onClick={() => {
                onAdd(type);
                menu.current.open = false;
                menu.current.querySelector("summary").focus();
              }}
            >
              <ShapeGlyph type={type} />
              {type}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
