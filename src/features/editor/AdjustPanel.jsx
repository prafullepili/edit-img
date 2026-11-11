import React from "react";
import { useDispatch } from "react-redux";
import { actions } from "../../store";
import Icon from "../../components/Icon";
import Slider from "../../components/Slider";
import { controlGroups, presets } from "./editorData";
export default function AdjustPanel({ editor, change }) {
  const dispatch = useDispatch();
  const saveSnapshot = () => dispatch(actions.snapshot());
  return (
    <div className="inspector-scroll">
      <div className="adjustment-summary">
        <span>
          <i className="summary-dot" />{" "}
          {editor.preset === "Custom" ? "Custom adjustments" : editor.preset}
        </span>
        <button
          onClick={() => {
            saveSnapshot();
            dispatch(actions.reset());
          }}
        >
          Reset all
        </button>
      </div>
      {controlGroups.map((group) => (
        <section className="control-group" key={group.title}>
          <div className="group-heading">
            <span className="group-icon">
              <Icon name={group.icon} size={15} />
            </span>
            <span>{group.title}</span>
            <span className="group-line" />
          </div>
          {group.controls.map((item) => (
            <Slider
              key={item[0]}
              item={item}
              value={editor.adjustments[item[0]]}
              onChange={change}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
