import React from "react";
const paths = {
  left: "M4 3v18M8 7h12M8 12h8M8 17h12",
  center: "M12 3v18M4 7h16M7 12h10M4 17h16",
  right: "M20 3v18M4 7h12M8 12h8M4 17h12",
  top: "M3 4h18M7 8v12M12 8v8M17 8v12",
  middle: "M3 12h18M7 4v16M12 7v10M17 4v16",
  bottom: "M3 20h18M7 4v12M12 8v8M17 4v12",
};
export const alignmentLabels = {
  left: "Align left",
  center: "Align horizontal center",
  right: "Align right",
  top: "Align top",
  middle: "Align vertical center",
  bottom: "Align bottom",
};
export default function AlignmentIcon({ mode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d={paths[mode]} />
    </svg>
  );
}
