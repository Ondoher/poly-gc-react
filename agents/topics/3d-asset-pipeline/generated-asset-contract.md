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

## Stages

Generated asset stages run in this order:

```text
preview-svg -> svg-cutter -> stamped-body -> colored-inlay -> preview-png
```

`preview-svg` records that the accepted rendered SVG is the current preview
input.

`svg-cutter` reads the final rendered color SVG and selected base tile, then
writes cutter GLB and metadata artifacts.

`stamped-body` reads cutter artifacts and the selected base tile, then writes
the stamped body GLB and metadata.

`colored-inlay` reads the final rendered SVG plus stamped/cutter artifacts,
then writes colored inlay GLB and metadata.

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
