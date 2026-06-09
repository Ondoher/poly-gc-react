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

## 3D Geometry Contract

Final-rendering SVGs are the current generated-asset input, so source-rendered
filled paths must be emitted in a form the Three-based cutter/inlay stages can
extrude without losing visual semantics. Final rendering preserves
`fill-rule="evenodd"` on emitted paint paths because glyph holes are part of
the artwork. When an evenodd source component contains degenerate zero-area
subpaths, the renderer prunes those subpaths and marks the result with
`data-geometry-normalized="degenerate-subpath-pruned"`.

Stroke-only source components are visible artwork, not a separate downstream
3D geometry contract. Final rendering converts them into filled path geometry
and marks the emitted path with `data-geometry-normalized="stroke-to-fill"`.
That conversion emits continuous outline loops with `fill-rule="evenodd"`
rather than one filled triangle subpath per stroke triangle; otherwise boolean
subtraction can leave carved seam walls where adjacent triangles meet.
Each original stroke subpath is emitted as a separate filled path so evenodd
fill evaluation is local to that stroked mark and cannot cancel unrelated
parallel lines or frame segments in the 2D review SVG.
Stroke-only components with an explicit non-positive `stroke-width` are not
visible artwork and are omitted from final rendering.
Generated cutter and inlay stages may keep defensive stroke handling for older
artifacts, but regenerated final-rendering SVGs should not require it.

Upstream source normalization may flatten distinct later opaque paint layers so
the generated asset pipeline does not receive overlapping solids. That
flattening is constrained to one identified source shape. It must not treat
fragments from the same original source element or source-use instance as
occluders for each other, and it must not subtract overlap between separate
identified source shapes such as repeated dot motifs.

If source normalization split one original source element into multiple
fragments, final rendering may recombine consecutive fragments that share the
same original source element, paint, fill rule, and output transform. Recombined
paths are marked with `data-geometry-normalized="source-element-recombined"`.
This keeps evenodd holes from being filled by independently painted sibling
fragments.

If another normalization also applies, such as degenerate evenodd subpath
pruning, final rendering combines the markers into one
`data-geometry-normalized` attribute. Emitted final-rendering SVGs must remain
valid XML because review PNG generation consumes the same SVG text through
Sharp.

This is a generic source-geometry normalization rule, not a face-specific
exception. The generated asset stages may still keep defensive triangulation
guards, but they should not be the primary place where known final-rendering
SVG geometry is made usable.

A planned Cutter SVG Simplification stage will own broad cutter-facing
geometry cleanup after accepted/rendered output and before `svg-cutter`.
Final Rendering should keep local SVG emission cleanup that is required for
valid, reviewable visual output, but new 3D-specific simplification work
belongs in that dedicated stage rather than in Source Normalization or Final
Rendering.

For generated cutter geometry, multi-component faces use merged path solids
with internal side-wall triangles removed where adjacent component footprints
touch. This is intentionally preferred over CSG-unioning the whole face:
traditional ornamental artwork can be under simple geometry-count limits and
still make CSG pathological. Single-component cutters remain direct extrusions.
High overlap is a reason to clean cutter geometry, not a reason to preserve
separate cutter walls.

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
The planned Cutter SVG Simplification stage will introduce a separate
cutter-facing SVG input for generated asset stages; until then, the rendered
color SVG remains the active generated-asset SVG handoff.

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
