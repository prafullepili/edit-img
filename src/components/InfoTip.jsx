import React, { useId, useState } from "react";
export default function InfoTip({ label, children, align = "start" }) {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  return (
    <span
      className="info-tip"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="info-tip-button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setPinned((value) => !value)}
        onBlur={() => {
          setPinned(false);
          setHovered(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setPinned(false);
            setHovered(false);
          }
        }}
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`info-tip-content ${align === "end" ? "info-tip-end" : ""}`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
