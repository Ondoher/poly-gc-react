# Scaling Status

## Summary

Mahjongg scaling is now in a partially integrated transition state.

The repo already has real layout-metric generation and a real runtime
`mj:layout-scaling` service. The shell board and settings preview now use that
service for automatic metric-family selection and scaling, while persistence
and controller state still carry some of the older preset-driven tile-size
model.

## Implemented Groundwork

The following pieces now exist in live code:

- shared metric math in
  [metrics.js](/c:/dev/poly-gc-react/scripts/tile-css/metrics.js)
- generated layout-metric CSS in
  [layouts.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/layouts.css)
- a dedicated layout CSS generator in
  [generate-layouts.js](/c:/dev/poly-gc-react/scripts/tile-css/generate-layouts.js)
- runtime metric ingestion and candidate selection in
  [layout-scaling.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/layout-scaling.js)
- shared scaled canvas hosting in
  [ScalingCanvas.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/ScalingCanvas.jsx)
- live shell-board consumption in
  [Board.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/Board.jsx)
- expanded service coverage in
  [layout-scaling.spec.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/_tests/layout-scaling.spec.js)
- settings tab cleanup in
  [SettingsDialog.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/SettingsDialog.jsx)
- live settings preview fitting in
  [SettingsPreview.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/SettingsPreview.jsx)
- solution playback dialog fitting in
  [SolveDialog.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/SolveDialog.jsx)

What that means in practice:

- generated metric families are now a concrete runtime contract
- runtime code can already read full metric-family objects from CSS vars
- metric-family comparison and fit scoring are no longer just planning notes
- shell-mode board render now receives selected `metricSetId`, fitted canvas
  size, board-canvas offset, and CSS `zoom` scale from `mj:layout-scaling`
- settings preview and solution playback now delegate the repeated fit-state,
  resize-observer, CSS-variable, and canvas-offset plumbing to `ScalingCanvas`
- auto-fit is currently triggered on startup, game generation, layout-mode
  transitions, portrait/landscape transitions, and debounced resize
- the `Tile Size` settings tab has been removed
- the settings preview now renders a mounted canvas and fits it through
  `mj:layout-scaling` instead of generating a bitmap

## Still True In The Live MJ Flow

The shell board no longer relies on the old viewport-threshold tile-size flow,
but these older pieces still exist:

- `mjController` still tracks `tileSize`, `allowedTileSizes`, and
  `maxTileSize`
- viewport-threshold clamping has been deactivated, but the state shape has not
  been retired
- `Board` still reads and persists `tilesizeKey` as legacy state
- some layout-scaling tests still need expectation updates after the
  board-center pixel extent change

So the current system is neither purely old nor purely new:

- live shell-board scaling follows the new runtime model
- settings preview scaling follows the new runtime model
- settings no longer exposes tile-size selection
- persistence and some controller state still follow the old model

## Current Reading Rule

When the scaling docs talk about the "current live flow," prefer this split:

- current runtime substrate:
  - `layouts.css`
  - `mj:layout-scaling`
  - generated metric families
- current live feature wiring:
  - automatic shell-board fit via `mj:layout-scaling`
  - mounted settings preview fit via `mj:layout-scaling`
  - legacy tile-size state retained around controller/persistence
  - persisted tile-size preference

If two notes disagree, the live code wins.

## Most Likely Next Steps

1. refresh the stale layout-scaling tests for the board-center pixel extent
   model
2. decide when to remove persisted `tilesizeKey`
3. simplify or retire controller-facing tile-size state now that shell board
   and settings preview no longer depend on user tile-size selection
4. expand `ScalingCanvas` so the main shell board can opt into pan/zoom
   hosting through props instead of keeping separate scaling plumbing

## Upgrade Note: ScalingCanvas Pan/Zoom

`ScalingCanvas` is currently used by settings preview and solution playback,
where the scaled canvas is not manually panned or zoomed.

The main game board still has its own scaling adapter code because it also
wraps the fitted canvas in `react-zoom-pan-pinch` and uses a React `key` to
reset transform state when expanded mode, portrait mode, or fitted geometry
changes.

Future work should make pan/zoom an opt-in capability of `ScalingCanvas`.
The component should own the fit-derived pieces of the reset key
(`metricSetId`, canvas width, canvas height, and scale), while callers provide
contextual reset-key parts such as `expanded` versus `normal` and `portrait`
versus `landscape`.

That would let `Board` use the same scaled-canvas host as the settings preview
and solution playback without leaking fit state back out just to reset the
transform wrapper.

## Current Policy Note

The intended auto-fit trigger policy now lives in
[canvas-rescaling-policy.md](/c:/dev/poly-gc-react/agents/topics/scaling/canvas-rescaling-policy.md).

Short version:

- auto-fit should run on startup, generation, layout-mode transitions, and
  resize
- manual zooming and canvas navigation should not trigger a new auto-fit pass
