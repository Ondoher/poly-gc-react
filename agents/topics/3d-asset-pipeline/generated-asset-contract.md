# Generated Asset Contract

This document owns downstream 3D asset generation after final rendering.

## Inputs

Generated asset planning requires:

- accepted final rendering SVG artifacts
- a selected base tile variant at `assetPipeline.baseTileSelection.variantId`
- generated asset state under `assetPipeline.faces`
- base tile model metadata from the base tile manifest

The current generated-asset stages consume the final-rendering color SVG
recorded under `svgPipeline.faces[faceKey].artifacts.finalRenderingColorSvg`.
Prepared SVG export remains a separate later stage and is not the canonical
generated-asset input until that review/QA gate is implemented. The SVG review
state remains under `svgPipeline`.

A planned Cutter SVG Simplification stage will sit between accepted/rendered
SVG output and SVG Cutter Generation. Once implemented and promoted, cutter
and colored-inlay generation should consume the same cutter-simplified SVG so
recess geometry and visible inlay agree. Until then, generated asset stages
continue to consume the final-rendering color SVG directly.

## Hashes

`PipelineModel` computes:

- `inputHash` from the stripped face state and effective rendering options
- `finalHash` from `inputHash` and selected base tile variant
- `stageHashes` for each generated asset stage

Readiness requires matching hashes, a rendered SVG, required artifacts, and all
generated asset stage hashes.

## Queue

Queue files live at:

```text
scripts/output/asset-pipeline/<tilesetId>/json/asset-generation-queue/queue.json
```

Queue planning includes missing, stale, failed, queued, building, or otherwise
not-ready faces. The server resumes pending queues on startup and allows one
active run per tileset.

Asset Review can cancel or reset queue work. Cancel clears the persisted queue,
live queue snapshot, and `assetPipeline` runtime queue/build fields. Reset
also clears generated 3D asset output folders and resets generated face state
to ungenerated. These operations are generated-asset scoped: they preserve the
selected base tile variant and do not reset `svgPipeline`, source review,
bindings, rendering options, or source/final-rendering SVG artifacts.

## Stages

Current generated asset stages run in this order:

```text
preview-svg -> svg-cutter -> stamped-body -> colored-inlay -> preview-png
```

The planned SVG-side order after Cutter SVG Simplification is promoted is:

```text
preview-svg -> cutter-svg-simplification -> svg-cutter -> stamped-body -> colored-inlay -> preview-png
```

`preview-svg` records that the accepted rendered SVG is the current preview
input.

`cutter-svg-simplification` is planned and not yet the active generated-asset
input. It will produce the cutter-facing SVG geometry handoff once promoted.

`svg-cutter` reads the cutter-simplified SVG once that stage is promoted.
Until then, it reads the final rendered color SVG and selected base tile, then
writes cutter GLB and metadata artifacts.

`stamped-body` reads cutter artifacts and the selected base tile, then writes
the stamped body GLB and metadata.

`colored-inlay` reads the same SVG handoff used by `svg-cutter` plus
stamped/cutter artifacts, then writes colored inlay GLB and metadata.

`preview-png` reads the inlay model and writes a generated asset review PNG.

## Artifact Pointers

Generated asset face artifacts include:

- `renderedSvg`
- `cutterModel`
- `cutterMetadata`
- `stampedModel`
- `stampedMetadata`
- `inlayModel`
- `inlayMetadata`
- `previewPng`

The final reviewable GLB is the inlay model. Asset Review synthesizes status
from canonical state, queue state, file existence, and hash readiness.

## Asset Review

`GET /api/pipeline/asset-review` returns per-face review view state and summary
counts: ready, building, queued, stale, failed, and unavailable. Ready faces
include current GLB, metadata, preview PNG, and a cache key based on
`finalHash`.

Publication and sync behavior belong in [Future Work](future-work.md).

## Mark II Base Tile Contract

The delivered Mark II base tile is a two-mesh assembled GLB, not a single
boolean target. The canonical physical dimensions are width `0.79`, thickness
`0.50`, and height/depth `1.08` project units. Its axes are:

- X: physical width
- Y: physical thickness/depth
- Z: physical tile height/depth

The large white ivory face is the artwork face. Artwork/cutter geometry should
stay inset from the bevels and must be clipped to the white ivory face rather
than crossing into the bamboo side/back area.

Carving subtracts only from the ivory/front mesh. The bamboo/back insert is
carried through unchanged into stamped and final generated models. The safe
engraving depth range is `0.025` to `0.035` units so the cutter does not reach
or weaken the internal dovetail insert.

Carving follows a single straight projected direction into the flat front face,
not local surface normals. In generated-asset coordinates, the promoted
pipeline copy uses X/Z as the artwork face plane and Y as carving thickness;
the cutter enters from the `+Y` front face along `-Y`. The visible dovetail or
locking seam is production geometry and must be preserved exactly by carrying
the bamboo mesh through unchanged.

The source textures establish the final visual target, but pipeline generation
may use solid material colors. `Wood 124` identifies the bamboo/backing role,
and `Bone Texture` identifies the ivory/front role.

The inspected delivery at `Designs/3d-assets/Base Tile_mark_II.zip` contains
`BaseTileBody NEW.glb` with two top-level mesh nodes:

- `BaseTileBody. Ivory`: ivory/front mesh and carving target
- `baseTileBody. wood`: bamboo/back insert to preserve unchanged

The referenced Blender screenshot at
`Designs/3d-assets/contractor/Master tile.jpg` confirms the assembled tile is
centered at origin with zero rotation, scale `1.000`, and dimensions X `0.79`,
Y `0.50`, Z `1.08`.

The promoted pipeline asset is:

- `scripts/data/3d-assets/models/base-tiles/mark-ii.glb`
- `scripts/data/3d-assets/models/base-tiles/mark-ii.json`
- manifest variant id `mark-ii`

The pipeline GLB is normalized from the artist's Blender delivery into the
repo's generated-asset coordinate convention: X width, Y carving thickness,
and Z face depth. Its combined bounds validate at X `0.79`, Y `0.50`, Z
`1.08`, centered at origin.

Implementation note: generated `svg-cutter` artifacts depend on the selected
base tile, because cutter metadata records target dimensions and selected
variant evidence. Stamped-body must prefer the currently selected base tile
body over any historical `baseTileVariant` body recorded in cutter metadata,
otherwise stale cutter metadata can place Mark II cutters above the actual
ivory surface.

Mark II cutter/inlay tuning:

- default carve depth is `0.025`, the shallow end of the artist-approved safe
  range
- cutter placement starts `0.002` units above the `+Y` face surface so CSG is
  not coplanar with the ivory top face
- cutter geometry uses clustered unioning instead of raw merged solids for a
  more reliable boolean input
- clustered unioning is capped at 10 geometries and 6000 triangles; larger
  clusters fall back to cleaned merged solids so one complex face cannot stall
  the queue inside CSG
- colored inlay sits nearly flush with a tiny preview clearance above the face
  surface using surface inset `-0.0006`
- physical inlay must not use per-shape Y stacking; all inlay regions share one
  Y plane so the artwork does not look slanted or progressively deeper across
  the face
