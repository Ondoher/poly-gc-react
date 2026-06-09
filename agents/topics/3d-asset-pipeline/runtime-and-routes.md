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

- `export-svg-cutter.js`
- `export-stamped-tile-pair.js`
- `export-stamped-tile-inlay.js`
- `generated-asset-preview-renderer.js`

Stage CLIs require explicit tileset arguments. Focused source-side and asset
generation runners accept explicit face keys for targeted reruns.

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

## Asset Serving

The server can serve reference files and generated assets for review. Asset
paths are resolved under the repo root and must remain inside that root.
