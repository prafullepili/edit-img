import React from "react";
const shortcuts = [
  ["Ctrl / ⌘ Z", "Undo, including deleted layers"],
  ["Ctrl / ⌘ Shift Z · Ctrl Y", "Redo"],
  ["Ctrl / ⌘ S", "Open projects and version history"],
  ["Ctrl / ⌘ E", "Open export"],
  ["?", "Open this shortcut guide"],
  ["Esc", "Close dialogs"],
  ["Delete / Backspace", "Delete selected layer; confirm to delete a group"],
  ["Alt + drag", "Move without snapping to guides"],
  ["Shift + rotate", "Snap rotation to 15° steps"],
  ["Arrow keys on handles", "Resize or rotate a layer"],
  ["Arrow keys on text", "Move text; Shift moves farther"],
  ["Ctrl / ⌘ Enter", "Save text while editing on the image"],
];
export default function ShortcutList() {
  return (
    <dl className="shortcut-list">
      {shortcuts.map(([keys, action]) => (
        <div key={keys}>
          <dt>
            <kbd>{keys}</kbd>
          </dt>
          <dd>{action}</dd>
        </div>
      ))}
    </dl>
  );
}
