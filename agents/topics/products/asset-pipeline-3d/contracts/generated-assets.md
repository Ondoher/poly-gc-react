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

Cutter-2D generation sits between accepted/rendered SVG output and SVG Cutter
Generation. The server queue writes a cutter-facing SVG with the Paper.js
`unite-all` pass at flatness `0.05`, then cutter and colored-inlay generation
consume that same SVG handoff so recess geometry and visible inlay agree.

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
preview-svg -> cutter-2d -> svg-cutter -> stamped-body -> colored-inlay -> preview-png
```

`preview-svg` records that the accepted rendered SVG is the current preview
input.

`cutter-2d` produces the cutter-facing SVG geometry handoff. The active queue
uses Paper.js `unite-all` at flatness `0.05`, writes
`images/cutter-2d-svg/<faceKey>.svg`, and records that path as
`assetPipeline.faces[faceKey].artifacts.cutterSvg`. The file is not a second
source of truth; it is a generated artifact from the accepted final-rendering
SVG. When build profiles are promoted, this stage should receive the selected
generated-asset build profile so fast/review and full-quality runs can make
different SVG-side union, flattening, simplification, and export-precision
choices intentionally.

`svg-cutter` reads the cutter-2D SVG and selected base tile, then
writes cutter GLB and metadata artifacts. Active queued generation invokes it
with `--skip-union` because the SVG-side handoff has already combined the
cutter solids enough for the downstream stamped-body boolean step.

While running, `svg-cutter` reports runtime-only progress on stdout as
newline-delimited JSON records with `event: "assetStageProgress"`. Current
phases are `parse`, `extrude`, `normalize`, `union`, and `export`. The queue
runner forwards these records to Asset Review as `stageProgress`; they are a
live progress signal only and are not persisted as readiness state. During
per-solid extrusion, normalization, and union work, cutter progress can mark
the current solid as active and emit heartbeat pings so Asset Review can show
a secondary indeterminate activity bar under the deterministic percent bar.
The cutter script keeps ownership of this liveness signal: blocking 3D union
work runs in a Node `worker_threads` worker launched by `export-svg-cutter.js`,
while the cutter main thread continues to emit stdout heartbeat records from
the same script invocation.

For focused cutter-shape experiments, `svg-cutter` can consume an explicit SVG
path and skip the 3D CSG union step, merging already simplified cutter solids
instead. The stamped-body, colored-inlay, and preview CLIs also accept
explicit input/output artifact overrides plus `--no-pipeline-state`, so
experiment runs can write complete GLB/metadata/PNG sets without mutating the
canonical face state.

When build profiles are promoted, the selected profile must participate in
`finalHash` and relevant stage hashes. The same final-rendering SVG and base
tile can produce both fast/review artifacts and full-quality artifacts, and
those outputs are not interchangeable readiness facts.

`stamped-body` reads cutter artifacts and the selected base tile, then writes
the stamped body GLB and metadata.

`colored-inlay` reads the final-rendering color SVG for paint/material
regions plus stamped/cutter artifacts, then writes colored inlay GLB and
metadata. It does not use the cutter-2D SVG as its color source because the
SVG-side union/flattening pass can collapse distinct colored regions.

`preview-png` reads the inlay model and writes a generated asset review PNG.
The renderer owns a shared Puppeteer browser per process so server queue runs
can render multiple faces without relaunching Chromium for every tile. CLI
entry points that render a single preview must close that shared renderer in a
`finally` block so queue stages do not appear stuck after the PNG has already
been written.

## Artifact Pointers

Generated asset face artifacts include:

- `renderedSvg`
- `cutterSvg`
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

Publication and sync behavior belong in [Future Work](../archive/future-work.md).

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

The source textures establish the final visual target. `Wood 124` identifies
the bamboo/backing role, and `Bone Texture` identifies the ivory/front role.
The delivered GLB keeps those material names but does not embed texture maps,
so the pipeline stores material preview PNGs as base-tile texture inputs and
embeds them into generated stamped/final GLBs.

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
- `scripts/data/3d-assets/models/base-tiles/mark-ii-textures/`
- manifest variant id `mark-ii`

Mark III follows the same generated-asset contract and is promoted as the
active selectable production variant, labeled "Ivory and Bamboo" in the app:

- `scripts/data/3d-assets/models/base-tiles/mark-iii.glb`
- `scripts/data/3d-assets/models/base-tiles/mark-iii.json`
- `scripts/data/3d-assets/models/base-tiles/mark-iii-textures/`
- manifest variant id `mark-iii`

The delivered Mark III artist GLB used X width, Y face height/depth, and Z
thickness. The promoted pipeline copy is rotated into the generated-asset
coordinate convention, validates at combined bounds X `0.79`, Y `0.50`, Z
`1.08`, and preserves the same two mesh names: `BaseTileBody_Ivory` as the
carving target and `baseTileBody_wood` as the support insert.

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
For multi-mesh base tiles, stamped-body generation must subtract only from the
configured carving mesh and carry configured support/preserve meshes into the
stamped output unchanged. Colored-inlay generation must preserve every stamped
support mesh while adding the visible inlay meshes.
Base tile meshes may carry authored node transforms. Stamped-body export must
bake each source mesh's world transform into cloned geometry before boolean
work or support export, because resetting the clone object's transform after
`Object3D.applyMatrix4()` loses the authored offset and moves the cutter,
recess, and inlay out of agreement with the visible tile body.
Stamped-body generation also applies base-tile texture maps declared in
metadata before cloning the carving/support meshes, so colored-inlay generation
inherits the embedded textured materials from the stamped GLB.
When a base tile declares embedded material sourcing, generated export should
preserve those embedded materials instead of replacing the base-color map with
a generated `DataTexture`; authored GLBs may rely on non-primary UV channels.
The stamped-body CSG evaluator must include UV attributes required by the
selected carving material's texture-map channels, and cutter geometry must
provide matching placeholder UV attributes when it lacks those channels. This
lets boolean-subtracted carving meshes retain `uv1`/secondary texture
coordinates needed by artist-authored materials.
The Node GLB export scripts install a small canvas/ImageData/FileReader shim
before invoking `GLTFExporter`, because embedded `DataTexture` maps require
browser-like image serialization even when generated from CLI scripts.

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
