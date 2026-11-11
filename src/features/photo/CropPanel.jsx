import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { actions } from "../../store";
export default function CropPanel() {
  const dispatch = useDispatch(),
    editor = useSelector((s) => s.editor);
  const commit = (action) => {
    dispatch(actions.snapshot());
    dispatch(action);
  };
  return (
    <div className="inspector-scroll crop-panel">
      <p className="panel-description">
        Freeform cropping uses draggable corners. The crop changes the base
        photo; design layers stay relative to the finished canvas.
      </p>
      <button
        className="button primary w-full"
        onClick={() =>
          commit(
            actions.setFreeCrop({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }),
          )
        }
      >
        Freeform crop
      </button>
      <div className="ratio-grid">
        {["Original", "1:1", "4:5", "3:2", "16:9", "9:16"].map((ratio) => (
          <button
            key={ratio}
            className={
              !editor.freeCrop && editor.cropRatio === ratio ? "selected" : ""
            }
            onClick={() => commit(actions.setCropRatio(ratio))}
          >
            {ratio}
          </button>
        ))}
      </div>
      <div className="transform-buttons">
        <button onClick={() => commit(actions.rotate(-90))}>
          ↶ <span>Rotate left</span>
        </button>
        <button onClick={() => commit(actions.rotate(90))}>
          ↷ <span>Rotate right</span>
        </button>
        <button onClick={() => commit(actions.flip("flipX"))}>Flip H</button>
        <button onClick={() => commit(actions.flip("flipY"))}>Flip V</button>
      </div>
      <button
        className="button primary w-full mt-5"
        onClick={() => dispatch(actions.setTool("adjust"))}
      >
        Done cropping
      </button>
      <button
        className="button w-full mt-2"
        onClick={() => commit(actions.setCropRatio("Original"))}
      >
        Reset crop
      </button>
    </div>
  );
}
