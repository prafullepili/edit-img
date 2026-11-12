import React from "react";
const Icon = ({ name, size = 18 }) => {
  const paths = {
    text: (
      <>
        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3" />
        <path d="M2 14h4m4-6h4m4 8h4" />
      </>
    ),
    crop: (
      <>
        <path d="M6 3v12a3 3 0 0 0 3 3h12" />
        <path d="M18 21V9a3 3 0 0 0-3-3H3" />
      </>
    ),
    wand: (
      <>
        <path d="m15 4 5 5M4 20l11-11M3 6l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 15l1.4 2.6L23 19l-2.6 1.4L19 23l-1.4-2.6L15 19l2.6-1.4z" />
        <path d="m13 2 .7 1.3L15 4l-1.3.7L13 6l-.7-1.3L11 4l1.3-.7z" />
      </>
    ),
    assets: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <path d="m17.5 2.5 4 4-4 4-4-4z" />
        <circle cx="6.5" cy="17.5" r="3.5" />
        <path d="M14 14h7v7h-7z" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m17 8-5-5-5 5M12 3v12" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5M12 15V3" />
      </>
    ),
    undo: (
      <>
        <path d="M3 7v6h6" />
        <path d="M5.6 18a9 9 0 1 0-.1-9.9L3 13" />
      </>
    ),
    redo: (
      <>
        <path d="M21 7v6h-6" />
        <path d="M18.4 18a9 9 0 1 1 .1-9.9L21 13" />
      </>
    ),
    reset: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    zoomIn: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4M11 8v6m-3-3h6" />
      </>
    ),
    zoomOut: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4M8 11h6" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18m6-18v18" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2z" />
        <path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2z" />
      </>
    ),
    arrow: (
      <>
        <path d="M7 17 17 7M7 7h10v10" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    close: (
      <>
        <path d="m18 6-12 12M6 6l12 12" />
      </>
    ),
    compare: (
      <>
        <path d="M12 3v18M3 7h6v10H3zM15 7h6v10h-6z" />
      </>
    ),
    save: (
      <>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8M7 3v5h8" />
      </>
    ),
    flip: (
      <>
        <path d="M12 3v18M3 8h6v8H3zM15 8h6v8h-6z" />
      </>
    ),
    move: (
      <>
        <path d="m5 9-3 3 3 3M9 5l3-3 3 3m4 4 3 3-3 3m-4 4-3 3-3-3M2 12h20M12 2v20" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};

export default Icon;
