# Settings Preview Area

## Purpose

Capture the preview-specific scaling decisions that matter now that the MJ
feature is moving from preset tile sizes to runtime layout fit.

This note is intentionally narrower than the broader MJ layout docs. It is
about the preview as a scaling and fit surface, not about the full settings
dialog composition.

## Current Live Status

The live preview now uses a mounted board canvas and the runtime scaling
service.

Current live behavior:

- `SettingsDialog` mounts
  [SettingsPreview.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/SettingsPreview.jsx)
- `SettingsPreview` builds preview tiles with the live engine and difficulty
  preset path
- `SettingsPreview` measures its preview surface with `ResizeObserver`
- `SettingsPreview` asks `mj:layout-scaling` for metric-family selection,
  occupied layout size, board-canvas offset, and final CSS `zoom`
- the preview renders a live
  [Canvas.jsx](/c:/dev/poly-gc-react/src/gc/features/mj/src/components/Canvas.jsx)
  instead of capturing a generated bitmap

## Still-Relevant Direction

These ideas still look correct:

- the preview box should stay stable while the user browses layouts
- different layouts should scale inside that stable box rather than resizing
  the box itself
- the preview should eventually use the same fit rules as the live board
- the preview should size from occupied layout bounds, not just a historical
  fixed canvas assumption

## Direction To Drop

These older assumptions should no longer be treated as target architecture:

- preview logic centered on a long-lived `tileSize` user setting
- preview fit centered on `maxTileSize` as the primary sizing model
- older builder sketches that assume a separate bespoke sizing model from the
  board

Those notes were useful while the preview was still completely tied to the
preset flow, but the scaling topic now has a real metric-family contract and a
real runtime fit service.

## Preferred End State

The preview should continue to work like this:

1. measure the available preview area
2. derive occupied layout bounds from the selected layout
3. evaluate the generated metric families from `layouts.css`
4. select the best metric family and final scale through
   `mj:layout-scaling`
5. render the preview from the same fit result the live board would use

That does not require the preview to be architecturally identical to the live
board, but it should use the same fit contract.

## Remaining Integration Work

- validate the mounted preview canvas in the settings dialog across layout,
  difficulty, and tile-style changes
- remove direct fallback dependence on `tileSize` once persisted tile-size
  state is retired
- keep preview centering and decorative placement in CSS rather than inside the
  scaling service

## Practical Next Step

The next preview step should be:

- verify the preview and live board choose the same family when given the same
  layout and available space
- remove stale callers and docs that still assume preview bitmap generation
