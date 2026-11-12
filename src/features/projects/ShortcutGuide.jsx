import React, { useEffect, useRef } from "react";
import Icon from "../../components/Icon";
import ShortcutList from "./ShortcutList";
export default function ShortcutGuide({ onClose }) {
  const dialog = useRef(null),
    close = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    return () => previous?.focus?.({ preventScroll: true });
  }, []);
  return (
    <div className="modal-backdrop shortcut-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        data-shortcut-guide
        className="shortcut-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-heading"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Tab") {
            event.preventDefault();
            close.current?.focus();
          }
        }}
      >
        <div className="modal-top">
          <div>
            <h2 id="shortcut-heading">Keyboard shortcuts</h2>
            <p>
              Use Ctrl on Windows or ⌘ on Mac. Typing fields keep their normal
              shortcuts.
            </p>
          </div>
          <button
            ref={close}
            className="modal-close"
            aria-label="Close shortcut guide"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <ShortcutList />
      </section>
    </div>
  );
}
