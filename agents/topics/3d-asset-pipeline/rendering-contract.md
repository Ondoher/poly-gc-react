# Rendering Contract

This document owns Stage 6 final rendering as a pipeline stage.

## Purpose

Final Rendering consumes accepted source review state and rendering options to
produce reviewable, prepared-space SVG output. It decides what should be
visible, where it should appear, and which output policy applies before 3D
asset generation.

Color details live in [Color Handling](color-handling.md).

## Inputs

Final Rendering reads:

- canonical `pipeline.json`
- accepted bindings in `state.bindings`
- accepted source absence in `state.parts`
- alignment placement fields on parts
- normalized component artifacts through `artifacts.normalizedComponents`
- reference data through the active reference set
- effective rendering options

It does not use diagnostic stage JSON as active review state.

## Effective Options

Rendering options merge defaults and overrides into a face-specific effective
option set. The same effective option set participates in generated asset input
hashing for that face.

Options can control:

- optional part output as source, generated, or omitted
- artwork color preservation
- generated label/glyph policy
- cutout handling
- layout behavior such as `scaleMode`
- render-time transforms such as `reflectX`

## Step Flow

The runner builds final rendering output in three conceptual steps:

```text
addOptional -> layout -> color
```

`addOptional` decides which optional parts are source-rendered, generated, or
omitted for the current effective options.

`layout` owns movement and scaling. It places accepted source geometry using
alignment placement and places generated geometry into reference target bounds.

`color` owns final paint decisions. It should not move geometry.

## Output Paths

Final Rendering writes review SVGs to:

```text
scripts/output/asset-pipeline/<tilesetId>/images/final-rendering-add-optional-svg/<faceKey>.svg
scripts/output/asset-pipeline/<tilesetId>/images/final-rendering-layout-svg/<faceKey>.svg
scripts/output/asset-pipeline/<tilesetId>/images/final-rendering-color-svg/<faceKey>.svg
```

When review PNGs are requested, they live at:

```text
scripts/output/asset-pipeline/<tilesetId>/images/final-rendering-color-review-png/<faceKey>.png
```

The selected color SVG path is recorded on the face artifact pointer:

```text
svgPipeline.faces[faceKey].artifacts.finalRenderingColorSvg
```

The current generated-asset path consumes this final-rendering color SVG
directly. Prepared SVG export is a later stage and future review/QA promotion
surface; until that gate is implemented, prepared SVGs should not be treated as
the canonical input for cutter, stamped body, or colored inlay generation.

## Layout Rules

Source-rendered parts use accepted source bindings and alignment placement.
Generated optional parts use reference target bounds. Omitted parts do not
render. Unresolved parts should fail visibly or produce review diagnostics
instead of inventing a hidden fallback.

`layout.scaleMode: "largest-containing-box"` uses the largest containing
reference box for a suit's rendered artwork and applies the same frame across
the relevant faces.

## Acceptance Boundary

Render Review acceptance currently initializes generated asset state from the
current rendered SVG artifacts. This is not the future Visual Approval gate.
The rendered SVG remains owned by `svgPipeline`; build readiness and generated
models live under `assetPipeline`.
