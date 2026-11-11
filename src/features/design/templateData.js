import { newId } from "../../ids.js";
const common = {
  visible: true,
  opacity: 100,
  rotation: 0,
  scale: 1,
  blend: "normal",
  fillEnabled: true,
  color: "#ffffff",
};
export const builtinTemplates = [
  {
    id: "title",
    name: "Editorial title",
    design: {
      layers: [
        {
          ...common,
          type: "rectangle",
          name: "Title backing",
          x: 50,
          y: 80,
          width: 90,
          height: 24,
          color: "#151713",
          cornerRadius: 20,
          opacity: 85,
        },
        {
          ...common,
          type: "text",
          name: "Headline",
          x: 50,
          y: 79,
          width: 80,
          height: 12,
          text: "YOUR NEXT CHAPTER",
          size: 5,
          fontFamily: "Manrope",
          fontWeight: 800,
          textAlign: "center",
          letterSpacing: 3,
        },
        {
          ...common,
          type: "text",
          name: "Caption",
          x: 50,
          y: 87,
          width: 80,
          height: 5,
          text: "A story worth sharing",
          size: 2,
          fontWeight: 400,
          textAlign: "center",
        },
      ],
    },
  },
  {
    id: "sale",
    name: "Sale announcement",
    design: {
      layers: [
        {
          ...common,
          type: "rectangle",
          name: "Gradient card",
          x: 50,
          y: 50,
          width: 72,
          height: 70,
          cornerRadius: 80,
          gradient: {
            enabled: true,
            type: "linear",
            from: "#7446ee",
            to: "#eb6689",
            angle: 45,
          },
        },
        {
          ...common,
          type: "text",
          name: "Sale headline",
          x: 50,
          y: 38,
          width: 65,
          height: 16,
          text: "WEEKEND SALE",
          size: 6,
          fontWeight: 800,
          textAlign: "center",
        },
        {
          ...common,
          type: "text",
          name: "Offer",
          x: 50,
          y: 57,
          width: 65,
          height: 15,
          text: "UP TO 50% OFF",
          size: 4,
          textAlign: "center",
          letterSpacing: 2,
        },
        {
          ...common,
          type: "sticker",
          name: "Sale star",
          iconName: "star",
          x: 80,
          y: 20,
          width: 12,
          height: 18,
          color: "#ffd75a",
        },
      ],
    },
  },
  {
    id: "quote",
    name: "Quote card",
    design: {
      layers: [
        {
          ...common,
          type: "rectangle",
          name: "Quote panel",
          x: 50,
          y: 50,
          width: 85,
          height: 70,
          color: "#f4f0e5",
          cornerRadius: 45,
        },
        {
          ...common,
          type: "text",
          name: "Quote",
          x: 50,
          y: 48,
          width: 70,
          height: 40,
          text: "Make room for\nwhat inspires you.",
          size: 5,
          fontFamily: "Georgia",
          fontWeight: 400,
          textAlign: "center",
          color: "#263222",
          lineHeight: 1.4,
        },
        {
          ...common,
          type: "text",
          name: "Attribution",
          x: 50,
          y: 74,
          width: 65,
          height: 8,
          text: "— YOUR NAME",
          size: 2,
          textAlign: "center",
          color: "#536842",
          letterSpacing: 4,
        },
      ],
    },
  },
];
export function instantiateDesign(design, projectId) {
  const groups = new Map();
  return {
    ...design,
    layers: design.layers.map((layer) => {
      let groupId = null;
      if (layer.groupId) {
        if (!groups.has(layer.groupId)) groups.set(layer.groupId, newId());
        groupId = groups.get(layer.groupId);
      }
      return { ...layer, id: newId(), groupId };
    }),
  };
}
