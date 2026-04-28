# Tile Metrics Model

## Purpose

Capture the current direction for centralizing runtime tile-size and metric
data behind one model-shaped interface.

This note is specifically about runtime ownership and naming. It intentionally
does not try to make the script generators the source of truth for live MJ
code.

## Problem

The current runtime surface still spreads tile-size information across more
than one place:

- [tile-metrics-model.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/models/tile-metrics-model.js)
  reads generated metric families and performs fit/scale selection
- [mjController.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/controller/mjController.jsx)
  still carries tile-size order, viewport thresholds, and max-size policy
- [tilesets.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/data/tilesets.js)
  still exports the runtime tile-size list used by UI components

That split creates two problems:

- the current service is named around `layout` and `scaling`, even though it
  now owns more of the tile-size inventory and metric contract than of board
  layout topology
- there is no single runtime source of truth for the tile-size list and its
  associated metadata

Within the MJ feature, `layout` already means board shape or topology. Using
the older `layout-scaling` name for tile-size inventory and metric-family
selection is therefore misleading.

## Naming Direction

The current discussion concluded that the best name for the live runtime
surface is:

- `tile-metrics-model`

That name fits the current responsibilities better than:

- the older `layout-scaling` name
- `layout`
- `tiles`
- `tile-sizing`

Why `tile-metrics-model` is preferred:

- `tile metrics` matches the current concrete contract: tile width, face
  width, cell width, depth offsets, canvas size, and related values
- `model` fits better than a narrow helper/service label because this code is
  increasingly acting as a state-free runtime model for tile-size families,
  metric-family lookup, and fit decisions
- it does not overload `layout`, which should keep meaning board shape/topology

Target runtime identity:

- file:
  [tile-metrics-model.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/models/tile-metrics-model.js)
- service/model name:
  `mj:tile-metrics`
- class:
  `TileMetricsModel`

## Intended Responsibility

The model should become the single runtime interface for tile-size and
metric-family data.

That includes:

- reading generated metric families from CSS custom properties
- reading generated logical-grid dimensions from CSS custom properties
- exposing the runtime tile-size inventory in stable order
- exposing per-size metadata needed by runtime policy
- projecting board and occupied-layout pixel sizes
- evaluating candidate metric families for one available-space box
- selecting the best metric family and final scale

What it should not own:

- board topology definitions or the meaning of one MJ layout
- tile instances on the board
- tile art or tile-body appearance selection

Those remain separate concerns.

## Single Runtime Source Of Truth

The current design direction is to keep one runtime source of truth for the
tile-size list by encoding tile-size metadata in CSS custom properties and
reading it through the existing
[css-vars service](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/css-vars.js).

This is specifically about runtime truth. The generator may still produce the
CSS, but the live feature should treat the CSS-backed model as authoritative.

### Why CSS Is Acceptable Here

This repo already uses the pattern:

- generated or authored CSS custom properties
- runtime reads those values back into JS through `mj:css-vars`

The current metric-family contract already follows that pattern in:

- [layouts.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/layouts.css)
- [tile-metrics-model.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/models/tile-metrics-model.js)

So extending CSS-backed metadata to include runtime tile-size inventory is an
architecturally consistent move rather than a new one-off trick.

### Metadata To Centralize

The tile-metrics model should ultimately be able to read:

- tile-size order
- default or largest metric-family id
- display label for each size
- optional viewport threshold metadata for each size
- metric-family values already present in `layouts.css`

Representative examples:

- `--mj-size-order`
- `--mj-size-default`
- `--tiny-label`
- `--tiny-minViewportWidth`
- `--tiny-minViewportHeight`
- `--tiny-tileWidth`
- `--tiny-cellWidth`
- `--tiny-canvasWidth`

The exact CSS variable names can still change, but the important point is that
the runtime should stop maintaining the same size inventory in multiple JS
modules.

## Migration Direction

The intended migration path is:

1. keep the existing generated metric-family contract working
2. move remaining tile-size inventory metadata behind the model
3. retire controller-owned tile-size order and viewport-threshold tables
4. stop treating `tilesets.js` as a second source of truth for size ids
5. keep the runtime service/model surface on `tile-metrics-model`

## Concrete Runtime Touchpoints

The current files most affected by this move are:

- [tile-metrics-model.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/models/tile-metrics-model.js)
- [css-vars.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/css-vars.js)
- [mjController.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/controller/mjController.jsx)
- [tilesets.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/data/tilesets.js)
- [ScalingCanvas.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/ScalingCanvas.jsx)
- [SettingsPreview.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/SettingsPreview.jsx)
- [SolveDialog.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/SolveDialog.jsx)

## Immediate Next Step

When implementation starts, the first useful move should be:

- define the CSS-backed runtime tile-size metadata contract
- add a dedicated `tile-metrics-model` surface that reads it
- switch one consumer path away from controller-owned tile-size lists

That gives the migration one honest runtime owner before broader renaming or
cleanup begins.
