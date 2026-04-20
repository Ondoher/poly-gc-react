# Mahjongg Tile Size Scaling

## Goal

Replace the user-selectable tile-size flow with an automatic board-fit system
that derives render scale from:

- the active layout bounds
- the space actually available to the board or preview
- the generated tile metric families exported through CSS

Target outcome:

- tile size is no longer a saved gameplay preference
- runtime chooses the best generated metric family for the current space
- final board scale is derived from real available space, not only from
  viewport presets
- the settings preview follows the same fit model as the live board

## Current Status

This work is now partially wired into the live MJ feature. The board and
settings preview use the runtime scaling service for render size and
metric-family choice, but persistence and controller state still carry some
older tile-size assumptions.

### Implemented Now

- the tile CSS pipeline now generates a shared metric surface in
  [layouts.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/layouts.css)
- the generator path now includes:
  - [metrics.js](/c:/dev/poly-gc-react/scripts/tile-css/metrics.js)
  - [generate-layouts.js](/c:/dev/poly-gc-react/scripts/tile-css/generate-layouts.js)
- the runtime now has a real
  [layout-scaling service](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/layout-scaling.js)
  that:
  - reads metric-family objects from `mj:css-vars`
  - reads generated logical-grid dimensions from CSS vars
  - projects occupied tile pixels against a stable board center
  - scores candidate metric families
  - selects the best family and scale
- the service now has broad direct coverage in
  [layout-scaling.spec.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/_tests/layout-scaling.spec.js)
- the shell board now consumes `mj:layout-scaling` from
  [Board.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/Board.jsx)
  to select:
  - the generated metric family CSS class
  - the fitted canvas width and height
  - the CSS `zoom` scale
  - the full generated board-canvas offset inside the occupied layout viewport
- auto-fit currently runs on startup, game generation, expanded-mode changes,
  portrait/landscape switches, and debounced resize
- the settings dialog no longer exposes user-selectable tile size
- the settings preview now consumes `mj:layout-scaling` from
  [SettingsPreview.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/SettingsPreview.jsx)
  and renders a mounted `Canvas` instead of a generated bitmap
- viewport-based allowed-size clamping in `mjController` has been deactivated
  so the scaler can evaluate all generated metric families

### Still Live Today

- `mjController` still tracks `tileSize`, `allowedTileSizes`, and
  `maxTileSize`, even though viewport clamping is no longer the active sizing
  decision
- `Board` still reads and persists `tilesizeKey` as legacy state
- layout-scaling tests need another expectation pass after the move from
  occupied-bounds sizing to board-center pixel extents

So the repo is in a transition state:

- the new scaling system drives the shell board and settings preview fit paths
- the old preset-driven state still exists around controller state,
  persistence, and fallback/default tile-size values

## Runtime Sizing Model

The desired runtime fit path needs four concrete inputs.

### 1. Active Layout Bounds

The runtime sizes from the occupied tile pixels of the selected layout, but it
anchors those pixels against the stable center of the generated logical board.
This keeps sparse or lopsided layouts growing around the same board center
instead of centering only the occupied bounding box.

Needed values:

- `minX`
- `maxX`
- `minY`
- `maxY`
- `minZ`
- `maxZ`
- occupied layout width in grid units
- occupied layout height in grid units
- generated logical board width, height, and depth from `layouts.css`
- projected tile-pixel rectangles for the selected metric family

### 2. Available Space

The runtime should measure the actual inner playfield box available to the
board or preview surface.

Needed values:

- available width
- available height
- any explicit padding that should be removed before fit math

### 3. Generated Base Metrics

The runtime should compare more than one generated metric family rather than
assuming a single incoming tile size.

The current runtime metric-family contract is defined by
`LAYOUT_METRIC_CSS_VAR_NAMES` in
[layout-scaling.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/layout-scaling.js)
and by the generated values in
[layouts.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/layouts.css).

Current metric fields:

- `tileWidth`
- `tileHeight`
- `faceWidth`
- `faceHeight`
- `rightPad`
- `bottomPad`
- `cellWidth`
- `cellHeight`
- `depthX`
- `depthY`
- `canvasWidth`
- `canvasHeight`

Under the current naming convention, one metric-family prefix such as `tiny`
produces CSS vars such as:

- `--tiny-tileWidth`
- `--tiny-cellWidth`
- `--tiny-depthX`
- `--tiny-canvasWidth`

This replaces the older naming proposal that used a `--mj-layout-*` prefix.
The live code now reads the concrete generated contract above.

### 4. Final Fit Scale

Once layout bounds, available space, and base metrics are known, runtime can
derive:

- unscaled layout pixel width
- unscaled layout pixel height
- `scaleX`
- `scaleY`
- final chosen `scale = min(scaleX, scaleY)`

## Candidate Selection Rules

The current chooser policy in `layout-scaling.js` is:

1. prefer candidates inside the hard valid range
2. where valid families overlap, prefer the larger base geometry
3. if size is still tied, prefer the candidate closest to `1`
4. if distance from `1` is equal, prefer downscale over upscale

Current hard defaults:

- preferred range: `0.85` to `1.2`
- hard range: `0.75` to `2`

These values are now real service defaults, not only planning notes.

The hard upper scale is applied as an absolute rendered-size ceiling against
the `normal` metric family. In practice, this means sparse or tiny layouts may
upscale, but no selected metric family should render tiles larger than
`normal` at `2x`.

## What Is Still Missing

The remaining work is mostly integration work, not just design.

### 1. Harden The Live Board Integration

- keep validating the shell board fit in normal, expanded, and portrait modes
- keep gesture pan/zoom isolated to expanded and portrait modes so normal mode
  does not receive injected transform offsets
- decide whether `boardPixelCenter` should remain diagnostic-only or become
  part of the formal service return type
- refresh stale layout-scaling spec expectations for the board-center pixel
  extent model

### 2. Harden The Settings Preview Integration

- keep validating the mounted preview canvas across layout, difficulty, and
  tile-style changes
- decide whether the preview should keep `tilesize` as only a fallback metric
  or move to a completely neutral default
- remove any remaining obsolete preview-generator documentation and pathways

### 3. Remove Tile Size As A Persisted Preference

- stop persisting `tilesizeKey`
- remove or downgrade controller-facing `tileSize` state once preview no
  longer needs it
- remove dead `onSelectTilesize` UI pathways if they are no longer needed by
  any non-settings caller

## Tracking Checklist

- [x] Shared generated layout metrics exist in `layouts.css`
- [x] Runtime metric-family ingestion exists in `mj:layout-scaling`
- [x] Candidate selection and fit scoring exist in live code
- [x] Live shell board fit uses `mj:layout-scaling`
- [x] Tile size removed from settings UI
- [x] Preset viewport threshold logic deactivated for live board sizing
- [x] Preview fit uses `mj:layout-scaling`
- [ ] Tile size removed from persisted preferences
- [ ] Controller tile-size state simplified or retired
- [ ] Layout-scaling tests refreshed for board-center pixel extents

## Immediate Next Step

Next work session should:

- update the remaining stale layout-scaling specs to match the board-center
  pixel extent model
- decide whether to remove persisted `tilesizeKey` now or keep it temporarily
  for fallback/default metric selection
- validate the live settings preview canvas across representative layouts and
  tile styles
