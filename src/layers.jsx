import React, { useEffect, useState, useId } from "react";
import { readImage } from "./imageStorage";
import { isShape, shapePoints } from "./features/design/shapeGeometry";
import TextArtwork from "./features/design/TextArtwork";
import {
  gradientEndpoints,
  roundedRect,
  canvasFill,
  drawStyledText,
} from "./features/design/styles";
import { iconSvg } from "./features/design/catalog";
import {
  isLayerLocked,
  snapSelection,
  maskSvgPath,
  clipLayerMask,
} from "./layerEditing";

export const layerDefaults = {
  visible: true,
  opacity: 100,
  x: 50,
  y: 50,
  width: 40,
  height: 25,
  rotation: 0,
  scale: 1,
  blend: "normal",
  color: "#c8ef69",
  size: 5,
  fillEnabled: true,
  borderEnabled: false,
  borderColor: "#ffffff",
  borderWidth: 4,
};

export function getLayerScale(layer) {
  return Number.isFinite(layer.scale)
    ? Math.max(0.1, Math.min(4, layer.scale))
    : 1;
}

export function shapePaint(layer, width, height, scale = 1) {
  const borderWidth = layer.borderEnabled
    ? Math.max(0, Math.min(width, height, (layer.borderWidth ?? 4) * scale))
    : 0;
  return {
    fill: layer.fillEnabled !== false ? layer.color : "none",
    stroke: borderWidth > 0 ? layer.borderColor || "#ffffff" : "none",
    borderWidth,
    inset: borderWidth / 2,
    width: Math.max(0, width - borderWidth),
    height: Math.max(0, height - borderWidth),
  };
}

function ShapePreview({ layer, dimensions }) {
  const width = (dimensions.width * layer.width) / 100,
    height = (dimensions.height * layer.height) / 100;
  const paint = shapePaint(layer, width, height);
  const id = useId().replace(/[^a-z0-9]/gi, ""),
    g = layer.gradient,
    p = gradientEndpoints(g?.angle || 0, width, height);
  const fill =
    paint.fill !== "none" && g?.enabled ? `url(#gradient-${id})` : paint.fill;
  const radius = Math.max(0, (layer.cornerRadius || 0) - paint.inset);
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <defs>
        {g?.enabled &&
          (g.type === "radial" ? (
            <radialGradient
              id={`gradient-${id}`}
              gradientUnits="userSpaceOnUse"
              cx={width / 2}
              cy={height / 2}
              r={Math.max(width, height) / 2}
            >
              <stop offset="0%" stopColor={g.from || layer.color} />
              <stop offset="100%" stopColor={g.to || "#725cff"} />
            </radialGradient>
          ) : (
            <linearGradient
              id={`gradient-${id}`}
              gradientUnits="userSpaceOnUse"
              x1={p.x1}
              y1={p.y1}
              x2={p.x2}
              y2={p.y2}
            >
              <stop offset="0%" stopColor={g.from || layer.color} />
              <stop offset="100%" stopColor={g.to || "#725cff"} />
            </linearGradient>
          ))}
      </defs>
      {layer.type === "rectangle" ? (
        <rect
          rx={radius}
          x={paint.inset}
          y={paint.inset}
          width={paint.width}
          height={paint.height}
          fill={fill}
          stroke={paint.stroke}
          strokeWidth={paint.borderWidth}
        />
      ) : layer.type === "ellipse" ? (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={paint.width / 2}
          ry={paint.height / 2}
          fill={fill}
          stroke={paint.stroke}
          strokeWidth={paint.borderWidth}
        />
      ) : (
        <polygon
          points={shapePoints(layer.type)
            .map(
              ([x, y]) =>
                `${paint.inset + x * paint.width},${paint.inset + y * paint.height}`,
            )
            .join(" ")}
          fill={fill}
          stroke={paint.stroke}
          strokeWidth={paint.borderWidth}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function useLayerImages(layers) {
  const [images, setImages] = useState({});
  const assetKey = layers
    .filter((l) => l.type === "image")
    .map((l) => l.assetId)
    .sort()
    .join("|");
  useEffect(() => {
    let active = true;
    const urls = [];
    Promise.all(
      assetKey
        .split("|")
        .filter(Boolean)
        .map(async (id) => {
          const blob = await readImage(id);
          if (!blob) return [id, null];
          const url = URL.createObjectURL(blob);
          urls.push(url);
          return [id, url];
        }),
    )
      .then((entries) => {
        if (active) setImages(Object.fromEntries(entries));
        else urls.forEach(URL.revokeObjectURL);
      })
      .catch(() => {
        if (active) setImages({});
      });
    return () => {
      active = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [assetKey]);
  return images;
}

export function LayerPreview({
  layers,
  images,
  selectedId,
  onSelect,
  onMove,
  dimensions,
  snapEnabled,
  onGuides,
  onEditText,
  editingTextId,
}) {
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <>
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        aria-hidden="true"
      >
        <defs>
          {layers
            .filter((l) => l.mask?.enabled)
            .map((layer) => (
              <clipPath
                id={`${prefix}-${layer.id}`}
                key={layer.id}
                clipPathUnits="objectBoundingBox"
              >
                <path
                  d={maskSvgPath(layer.mask)}
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </clipPath>
            ))}
        </defs>
      </svg>
      {layers
        .filter((l) => l.visible)
        .map((layer) => (
          <div
            key={layer.id}
            role="button"
            tabIndex={0}
            aria-label={`Select layer ${layer.name}`}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect(layer.id);
            }}
            onDoubleClick={(event) => {
              if (layer.type === "text" && !isLayerLocked(layer, layers)) {
                event.stopPropagation();
                onEditText?.(layer.id);
              }
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(layer.id);
              if (isLayerLocked(layer, layers)) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const frame =
                e.currentTarget.parentElement.getBoundingClientRect();
              e.currentTarget.dataset.drag = JSON.stringify({
                x: e.clientX,
                y: e.clientY,
                lx: layer.x,
                ly: layer.y,
                width: frame.width,
                height: frame.height,
              });
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const d = JSON.parse(e.currentTarget.dataset.drag);
              const changes = {
                x: Math.max(
                  0,
                  Math.min(100, d.lx + ((e.clientX - d.x) / d.width) * 100),
                ),
                y: Math.max(
                  0,
                  Math.min(100, d.ly + ((e.clientY - d.y) / d.height) * 100),
                ),
              };
              const result =
                snapEnabled && !e.altKey
                  ? snapSelection(layer, changes, layers, {
                      width: d.width,
                      height: d.height,
                    })
                  : { changes, guides: [] };
              onGuides(result.guides);
              onMove(layer.id, result.changes);
            }}
            onPointerUp={(e) => {
              onGuides([]);
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => onGuides([])}
            onLostPointerCapture={() => onGuides([])}
            style={{
              position: "absolute",
              left: `${layer.x}%`,
              top: `${layer.y}%`,
              width: `${layer.width}%`,
              height: `${layer.height}%`,
              transform: `translate(-50%,-50%) rotate(${layer.rotation}deg) scale(${getLayerScale(layer)})`,
              opacity: layer.opacity / 100,
              mixBlendMode: layer.blend,
              outline:
                selectedId === layer.id ? "1px dashed #c8ef69" : undefined,
              clipPath: layer.mask?.enabled
                ? `url(#${prefix}-${layer.id})`
                : undefined,
              cursor: isLayerLocked(layer, layers) ? "default" : "move",
              touchAction: "none",
              background: "transparent",
              color: layer.color,
              fontSize: `${layer.size}cqw`,
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 700,
              lineHeight: 1.2,
              whiteSpace: "pre-wrap",
              overflow: layer.type === "text" ? "visible" : "hidden",
              wordBreak: "break-all",
              userSelect: "none",
            }}
          >
            {isShape(layer.type) && (
              <ShapePreview layer={layer} dimensions={dimensions} />
            )}
            {layer.type === "image" &&
              (images[layer.assetId] ? (
                <img
                  src={images[layer.assetId]}
                  alt={layer.name}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "fill",
                    pointerEvents: "none",
                  }}
                />
              ) : (
                <span style={{ fontSize: 10 }}>Loading image…</span>
              ))}
            {layer.type === "text" && layer.id !== editingTextId && (
              <TextArtwork
                value={layer}
                width={(dimensions.width * layer.width) / 100}
                height={(dimensions.height * layer.height) / 100}
                size={(dimensions.width * layer.size) / 100}
              />
            )}
            {["icon", "sticker"].includes(layer.type) && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                }}
                dangerouslySetInnerHTML={{
                  __html: iconSvg(layer.iconName, layer.color),
                }}
              />
            )}
          </div>
        ))}
    </>
  );
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("A layer image is unavailable"));
    img.src = url;
  });
}

export async function drawLayers(
  ctx,
  layers,
  images,
  width,
  height,
  sourceWidth = width,
) {
  await document.fonts.ready;
  for (const layer of layers) {
    if (!layer.visible) continue;
    const w = (width * layer.width) / 100,
      h = (height * layer.height) / 100;
    ctx.save();
    try {
      ctx.translate((width * layer.x) / 100, (height * layer.y) / 100);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      const scale = getLayerScale(layer);
      ctx.scale(scale, scale);
      clipLayerMask(ctx, layer.mask, w, h);
      ctx.globalAlpha = layer.opacity / 100;
      ctx.globalCompositeOperation =
        layer.blend === "normal" ? "source-over" : layer.blend;
      ctx.fillStyle = layer.color;
      if (layer.type === "image") {
        if (!images[layer.assetId])
          throw new Error("Wait for image layers to load");
        ctx.drawImage(
          await loadImage(images[layer.assetId]),
          -w / 2,
          -h / 2,
          w,
          h,
        );
      } else if (["icon", "sticker"].includes(layer.type)) {
        const svg = iconSvg(layer.iconName, layer.color),
          url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        try {
          ctx.drawImage(await loadImage(url), -w / 2, -h / 2, w, h);
        } finally {
          URL.revokeObjectURL(url);
        }
      } else if (isShape(layer.type)) {
        const paint = shapePaint(layer, w, h, width / sourceWidth);
        ctx.beginPath();
        if (layer.type === "ellipse")
          ctx.ellipse(
            0,
            0,
            paint.width / 2,
            paint.height / 2,
            0,
            0,
            Math.PI * 2,
          );
        else if (layer.type === "rectangle")
          roundedRect(
            ctx,
            -w / 2 + paint.inset,
            -h / 2 + paint.inset,
            paint.width,
            paint.height,
            Math.max(
              0,
              ((layer.cornerRadius || 0) * width) / sourceWidth - paint.inset,
            ),
          );
        else {
          const points = shapePoints(layer.type);
          points.forEach(([x, y], index) => {
            const px = -w / 2 + paint.inset + x * paint.width;
            const py = -h / 2 + paint.inset + y * paint.height;
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.lineJoin = "round";
        }
        if (paint.fill !== "none") {
          ctx.fillStyle = canvasFill(ctx, layer, w, h);
          ctx.fill();
        }
        if (paint.stroke !== "none") {
          ctx.lineWidth = paint.borderWidth;
          ctx.strokeStyle = paint.stroke;
          ctx.stroke();
        }
      } else if (layer.type === "text") {
        drawStyledText(ctx, layer, {
          x: -w / 2,
          y: -h / 2,
          width: w,
          height: h,
          size: (width * layer.size) / 100,
          scale: width / sourceWidth,
        });
      }
    } finally {
      ctx.restore();
    }
  }
}
