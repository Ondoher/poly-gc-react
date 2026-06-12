# Runtime And Routes

This document owns CLI, server route, stream, and queue behavior.

## Pipeline Model

Stage runners and server routes resolve mutable state through
`PipelineModel`. Runners should load canonical `pipeline.json`, read durable
fact artifacts through canonical pointers, write the owned stage result, and
save through the model.

## CLI Surfaces

Important source-side CLIs:

- `intake-source-svg-manifest.js` intakes a source SVG manifest.
- `run-source-normalization.js` runs source normalization.
- `run-optional-part-assignment.js` runs optional part assignment.
- `run-source-alignment.js` runs source alignment.
- `run-source-semantic-assignment.js` runs source assignment.
- `run-final-rendering-composition.js` runs final rendering.

Important generated asset CLIs:

- `experiment-paper-flatten-svg.js`
- `export-svg-cutter.js`
- `export-stamped-tile-pair.js`
- `export-stamped-tile-inlay.js`
- `export-generated-asset-preview.js`
- `generated-asset-preview-renderer.js`

Stage CLIs require explicit tileset arguments. Focused source-side and asset
generation runners accept explicit face keys for targeted reruns.
Generated asset CLIs also support focused experiment output overrides for
single-face investigations: `experiment-paper-flatten-svg.js` can write an
explicit simplified SVG, `export-svg-cutter.js` can read an explicit
`--svg-path`, write explicit cutter outputs, and optionally use `--skip-union`;
`export-stamped-tile-pair.js`, `export-stamped-tile-inlay.js`, and
`export-generated-asset-preview.js` can read/write explicit artifacts. The
experiment path passes `--no-pipeline-state` so those focused outputs do not
mutate canonical generated face state.

## Server Routes

The pipeline server exposes:

- `GET /api/pipeline/state`
- `GET /api/pipeline/tilesets`
- `POST /api/pipeline/tilesets/active`
- `POST /api/pipeline/recreate`
- `POST /api/pipeline/save`
- `POST /api/pipeline/preprocess`
- `GET /api/pipeline/reference-structure`
- `POST /api/pipeline/reference-structure/save`
- `GET /api/pipeline/source-assignment`
- `POST /api/pipeline/source-assignment/regenerate`
- `POST /api/pipeline/source-assignment/accept`
- `POST /api/pipeline/source-assignment/bindings`
- `GET /api/pipeline/optional-parts`
- `POST /api/pipeline/optional-parts/rebuild`
- `POST /api/pipeline/optional-parts/bindings`
- `POST /api/pipeline/optional-parts/reset`
- `POST /api/pipeline/optional-parts/accept`
- `GET /api/pipeline/final-rendering-options`
- `POST /api/pipeline/final-rendering-options/rerender`
- `POST /api/pipeline/final-rendering-options/accept`
- `GET /api/pipeline/base-tile-selection`
- `POST /api/pipeline/base-tile-selection`
- `POST /api/pipeline/asset-generation/start`
- `POST /api/pipeline/asset-generation/cancel`
- `POST /api/pipeline/asset-generation/reset`
- `GET /api/pipeline/asset-review`
- `GET /api/pipeline/reference/:fileName`
- `GET /api/pipeline/asset`

The focused cutter-simplification experiment endpoints still exist in the
server for manual investigation, but the Experiments app page is currently
disabled and is not part of the active route/navigation surface.

Routes synthesize UI-facing views from canonical state and durable artifacts.
The synthesized response is not another source of truth.

## Asset Queue

Asset generation queue files live at:

```text
scripts/output/asset-pipeline/<tilesetId>/json/asset-generation-queue/queue.json
```

The server resumes pending queues on startup. A queue records selected base
tile variant and remaining face keys. Queue execution emits stream events on
the asset pipeline stream and updates generated asset state through
`PipelineModel`.

During `svg-cutter`, the cutter child process emits newline-delimited JSON
progress records on stdout. The server parses records with
`event: "assetStageProgress"` and forwards them as `assetGenerationProgress`
socket events with a `stageProgress` object. Asset Review treats this as
runtime observability only: it shows cutter phase/count/percent for the active
face, but durable readiness still comes from generated artifacts and hashes.

Selecting a base tile stages missing or stale generated-asset faces into the
persisted queue when no generation run is active. Asset Review then reports
those faces as queued from the queue file plus canonical model state instead
of treating them as unavailable.

Only one active generation run is allowed per tileset. Changing the selected
base tile clears the persisted queue and cancels an active run. If a run is
active, the selection route defers new queue staging so the cancelling run
cannot race and remove the newly selected queue.

Asset Review exposes Cancel and Reset controls. Cancel clears the persisted
queue, live queue snapshot, and generated-asset runtime queue/build fields
through `PipelineModel` without touching source SVG preprocessing state. Reset
does the same cancellation work, then clears only generated 3D asset output
folders and resets only `assetPipeline` face state to ungenerated while
preserving the selected base tile variant.

Queued generated-asset work now runs a `cutter-2d` step before `svg-cutter`:
the server invokes `experiment-paper-flatten-svg.js` in `unite-all` mode at
flatness `0.05`, stores the generated handoff under `images/cutter-2d-svg/`,
records it as `assetPipeline.faces[faceKey].artifacts.cutterSvg`, then invokes
`svg-cutter` with `--svg-path` and `--skip-union`. Colored-inlay generation
uses the final-rendering color SVG for paint/material regions while reusing
the stamped body and cutter metadata produced from the cutter-2D SVG.

The cutter-simplification experiment endpoints synthesize a view of local
experiment artifacts and can generate the `flower-3` flatness range under
`scripts/output/asset-pipeline/<tilesetId>/experiments/cutter-simplification/`.
Those endpoints are investigation-only and do not publish readiness facts to
`assetPipeline.faces`.

## Asset Serving

The server can serve reference files and generated assets for review. Asset
paths are resolved under the repo root and must remain inside that root.
