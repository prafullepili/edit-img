# Luma Image Studio

A local image editor built with React, JavaScript, Redux Toolkit, Tailwind CSS 4, and Vite.

## Run locally

```sh
npm install
npm run dev -- --port 5188 --strictPort
```

Open http://127.0.0.1:5188/. Use the same browser and address to restore your saved editing session.

## Production build

```sh
npm run build
npm run preview -- --port 5188
```

## Features

- Local image import and drag and drop (up to 24 MB)
- Light, color, detail, grain, and vignette controls
- Six presets, crop ratios, rotation, flips, zoom, and comparison
- Text and watermark overlay with color, size, opacity, position, and shadow
- Export sizing with aspect ratio locking and size presets
- JPEG, PNG, and WebP download with quality controls
- Multiple image, text, rectangle, and ellipse layers with drag positioning, ordering, duplication, visibility, opacity, and blend modes
- Autosaved past edits with local image assets
- Undo and redo
- Settings saved in localStorage and the uploaded source saved in IndexedDB

Uploaded images are edited in the browser. The starter photo and font files load from external providers. Clearing browser site data removes the saved project. Each project supports a base photo, the primary watermark, and additional image, text, and shape layers. Layers are placed above the cropped base photo and included in exports.

Layer regression checks: `node scripts/check-layers.mjs`.


## Layer workflow

- Use the lock beside a layer to prevent changes. Locking a grouped layer locks the whole group; unlock it before editing.
- Check at least two ungrouped layers and choose Group selected. Select a group member to move, resize, rotate, align, or reorder the group together. Choose Ungroup to edit members independently. Groups have one level.
- Select a layer and use Align to canvas for left, center, right, top, middle, or bottom alignment. Group alignment uses the full group bounds.
- Enable Snap to guides to snap dragged edges and centers to the canvas and other layers. Pink guides indicate a snap. Hold Alt while dragging to bypass it.
- Under Visibility mask, enable a rectangle or ellipse mask, set its position and size, and optionally invert it. Masks preserve original content and apply in exports. Masks are shape based; a painted brush mask is not included.
- These settings are autosaved. Grouping, locks, masks, alignment, and group transformations support undo and redo.


## Advanced photo tools

- **Crop:** choose Freeform crop, drag its corners or drag the crop region to move it, then choose Done cropping. Arrow keys on a focused crop corner nudge it by 1%.
- **Cutout:** runs IMG.LY's quantized background-removal model in a dedicated worker. The model/runtime download on first use and are cached by the browser. Photos are processed on-device. Cancel removal stops the worker. Restore original background or Undo restores the source. PNG/WebP retain transparency; JPEG exports flatten it onto white.
- **Retouch:** brush paints color; eraser removes alpha. Healing is sampled-source cloning with blended edges: choose a source or Alt-click, then paint the repair. Each stroke can be undone. These tools affect the base photo, not design layers.
- **Tone:** displays a processed RGB histogram, input black/white points, midtone gamma, and five-point curves for RGB or individual channels. Drag the curve or use the accessible point sliders.
- **Color:** eight hue ranges provide HSL controls and selective red/green/blue balance, blended into neighboring colors.
- **Detail:** sharpening increases local contrast; noise reduction uses an edge-aware 3×3 filter. This is conventional local denoising, not a generative AI restoration tool.

Preview processing uses a 1200px maximum edge. Export uses the same pipeline at higher resolution, bounded to 8192px per edge and 16 megapixels during processing. Originals remain in browser storage. Extreme noise and missing textures cannot be reconstructed by these local filters.

## React structure and code splitting

```text
src/
  App.jsx                         # Workspace shell and feature composition
  components/                     # Shared icons and controls
  features/
    editor/
      editorSlice.js              # Redux Toolkit editor state and undo
      AdjustPanel.jsx             # Lazy-loaded adjustment panel
      PresetsPanel.jsx            # Lazy-loaded presets
      editorData.js               # Preset definitions
    photo/
      PhotoPanel.jsx              # Lazy-loaded tone/color/detail/retouch controls
      CropPanel.jsx               # Lazy-loaded crop controls
      CropOverlay.jsx             # Draggable crop handles
      RetouchCanvas.jsx           # Pointer input and normalized strokes
      usePhotoPreview.js          # Debounced preview lifecycle
      renderBase.js               # Shared preview/export raster pipeline
      client.js                   # Worker request/response bridge
      processor.worker.js         # Pixel processing off the UI thread
      processing.js               # Pure, regression-tested image algorithms
      geometry.js                 # Crop and coordinate transforms
      background.js               # Lazy AI worker lifecycle and cancellation
      background.worker.js        # On-device inference; loads only on request
      defaults.js                 # Photo-state defaults and migration
    export/
      ExportDialog.jsx            # Lazy-loaded dialog
      exportImage.js              # Loaded on export; renders photo and layers
  store.js                        # Store configuration and persistence
  imageStorage.js                 # IndexedDB originals, derived assets and drafts
  LayersPanel.jsx                 # Lazy-loaded layer controls
```

`React.lazy` and `Suspense` load feature panels on demand. Vite emits separate panel, export, renderer and worker chunks. The large AI/ONNX runtime is outside the initial app bundle. JavaScript/JSX is used throughout.

```sh
npm run check
npm run build
npm run format
```

Background removal uses [`@imgly/background-removal`](https://github.com/imgly/background-removal-js), distributed under AGPL. Its model assets are fetched from IMG.LY on first use. The package uses Zod's v3 API; this project supplies the maintained v3 compatibility export from Zod 4 through a Vite alias and npm override.


## Typography, shapes, assets, and templates

- **Text / Layers:** Font family, weight, letter spacing, line spacing, and alignment are under Typography & effects. Choose an outline width/color and enable a shadow to control its color, opacity, blur, and X/Y offsets. These controls work on the primary text overlay and additional text layers.
- **Layers → rectangle / ellipse:** Gradient & corners provides linear or radial fills, start/end colors, and a linear-gradient angle. Rectangles also have a corner radius measured in source pixels. Solid fill and border controls remain available.
- **Assets:** Add recolorable vector stickers and icons. They remain editable layers with transform, lock, group, and mask support.
- **Assets → templates:** Start with Editorial title, Sale announcement, or Quote card. Templates append editable design layers to the current photo. Save reusable templates from your current design; those copies persist independently of past edits and include their own copies of image-layer assets. Applying a saved design restores its primary text overlay and adds fresh layer/group IDs.
- Templates store design elements, not the base photo or photo-processing settings. They remain on this browser/device until deleted or browser site data is cleared.

Design code is split into `src/features/design/`: `TextControls.jsx`, `ShapeControls.jsx`, `TextArtwork.jsx`, `styles.js`, `catalog.js`, `templateData.js`, and the lazy-loaded `DesignLibrary.jsx`. Text and shape appearance rules are shared with the export renderer. Add `node scripts/check-design.mjs` to run only design regressions; `npm run check` runs all checks.


## Project management

Open **Projects** for named versions, deleted-project recovery, individual-layer PNG export, and batch resizing. Past edits also shows **Undo delete** after removing a project. Deleted projects and their assets stay in local storage until recovered or browser site data is cleared.

Named versions are explicit local snapshots with date/time labels. Individual layers export on a transparent canvas at the project output dimensions. Batch resizing preserves aspect ratio, avoids upscaling, and provides per-file download links plus Download all (the browser may request permission for multiple downloads). Batch processing resizes source images without applying the current project's edits.

Press **?** to open the shortcut guide, **Ctrl/⌘ S** to open project history, or **Ctrl/⌘ E** for the export dialog. Text inputs retain normal typing shortcuts.

Preview performance: obsolete preview renders are cancelled when settings change. Preview and export use separate workers; neutral color processing and unused HSL bands are skipped. Adjustment changes paint an exact-color 480px interactive preview on the next animation frame, then silently refine to 1200px after 180ms of inactivity. There is no processing badge during edits; only initial image loading shows a loading label. Export continues to use the full-resolution pipeline. Run node scripts/check-preview.mjs for cancellation and worker-isolation regressions.


## Phone layout

On phones the photo preview stays above a horizontal tool strip while the inspector scrolls independently. Opacity and other adjustments stay visible together with the photo. Expand photo and Expand controls change the split; Split view restores it. Past edits opens from the preview toolbar as a dismissible drawer. In phone landscape, the preview and controls appear side by side. Desktop layout is unchanged.


Brush feedback now uses the photo renderer while the pointer is down, rather than a fixed-width SVG guide. Retouch previews keep the same rendering resolution while drawing and on release. Diameter remains stored in source-image units; hardness adjusts edge falloff. The information button beside Brush hardness supports hover, click/tap, and Escape dismissal.


Live brush/eraser feedback uses an imperative canvas and a cached radial brush stamp. Pointer movements draw only the new segment and do not dispatch Redux actions, replay old strokes, process the full photo, or encode previews. A stroke commits once on release, with the full photo pipeline in a worker. The temporary canvas remains visible until the matching processed image has loaded. Healing also draws incremental, feathered samples from a fixed canvas snapshot. Its source mapping handles crop, rotation and flips, including source areas outside the visible crop.


Text layers and the watermark share TextEditorControls and the same canvas drawStyledText renderer for preview/export. Font sizes are shown in source pixels, with existing percentage layer sizes converted at the UI boundary. Text blur and shadow padding prevent effects from being clipped by layer boxes. The Text panel edits the selected text layer; Watermark switches back to the primary overlay. Select text and tap Edit text on the photo, or double-click it, to open the on-image editor; Done commits one undoable edit and Cancel discards typing. Project/layer IDs use a UUID fallback on local HTTP phone connections without crypto.randomUUID.


On touch devices, sliders use a gesture surface with native vertical scrolling. Touch-down never changes the value. Horizontal drags activate after an 8px direction threshold, vertical/ambiguous swipes do not apply changes, and short taps apply on release. Mouse, keyboard and editable numeric inputs remain supported.


Slider movement keeps a local thumb/value preview, coalesces editor changes to once per animation frame, and flushes the final value on release. Phone drags preserve the initial thumb grip instead of jumping to the finger position. Pixel previews run in a worker so photo processing does not block slider movement; scroll-safe vertical gestures are unchanged.


## GitHub Pages

Repository: https://github.com/prafullepili/edit-img

The GitHub Actions workflow in `.github/workflows/pages.yml` installs the locked dependencies with Node 22, runs all regression checks, builds for `/edit-img/`, and deploys the `dist` artifact to GitHub Pages on pushes to `main`. It also supports manual runs from Actions. The repository Pages publishing source is GitHub Actions.

Live URL: https://prafullepili.github.io/edit-img/

Use `npm run build:pages` to produce the Pages build locally. Standard `npm run dev` and `npm run build` retain the root `/` base for local use. Site photos/projects stay in the visitor's browser storage, independently for each site origin.


Text previews render only the glyph bounds plus blur/shadow padding, at the displayed size (up to 2x pixel density), instead of a photo-sized 1600px canvas. Text wrapping is cached across line-spacing/outline/blur changes and passed into the shared renderer. Moving a layer reuses its painted text when its style is unchanged. Export continues to use full-resolution text rendering.


Deleting a grouped layer prompts for confirmation and removes the entire group in one undoable operation. This applies to the row trash icon, Delete group button, and Delete/Backspace shortcuts. Cancel does not change layers or history. Locked groups cannot be deleted; ungroup first to remove only one member.
