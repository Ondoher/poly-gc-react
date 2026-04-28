# Asset Review App Summary

Use this summary when another topic needs the app-side shape of the Asset
Review page without loading the full pipeline app topic.

Asset Review is implemented as `src/pipeline/features/asset-review`.

## Boundary

The `pipeline-app` topic owns the app page shape:

- feature boundary, route, tab registration, controller/view/component layout
- review-card presentation
- card preview images and on-demand interactive viewer
- page-level actions and user workflow
- navigation back to earlier owning stage tabs for corrections

The `3d-asset-pipeline` topic owns the asset contracts:

- generated asset hashes and invalidation rules
- server-side build queue semantics
- cutter/stamped/inlay GLB generation stages
- generated model metadata and publication/sync rules
- queue/build status vocabulary

## Page Behavior

- Render one card per tile/face using the same review-card language as the
  current pipeline pages.
- Show the latest generated review PNG when one exists.
- Open an interactive Three.js GLB viewer for the clicked tile preview.
- Mark a card stale when the generated asset exists but its recorded hashes no
  longer match the current canonical input.
- Show a spinning state icon in the card header when the live server-side
  asset generation queue reports that tile face as the active worker item.
- Show a queued/busy status only when the live server-side queue reports that
  tile face as waiting for its turn.
- Show a compact state icon in the card header using app-wide pipeline SVG
  assets under `src/pipeline/assets/images`: `circle-check` for ready,
  `loader-2` for building, `clock` for queued, `refresh-dot` for stale,
  `alert-circle` for failed, and `circle-off` for unavailable.
- Replace the preview with `Not available` when the final generated tile PNG
  does not exist yet.
- Reload the synthesized view when the server emits a per-face ready event so
  the card swaps to the final PNG as soon as it is available.
- Card previews are static images. The GLB viewer supports rotate and zoom
  through the same Three.js controls used by base tile selection, but it is
  mounted only when the user opens one tile.
- Corrections happen in earlier owning tabs: Optional Parts, Assignment, or
  Render Review. Asset Review should route there instead of becoming a second
  editor for source or rendering decisions.
- Asset Review owns the generate action and remains the page for queue
  observation and final asset review.

## Data Shape

- The server synthesizes `/api/pipeline/asset-review` from `PipelineModel`.
- Ready/stale/failed/unavailable are derived from canonical face hashes, stage
  hashes, final hash, generated artifact paths, and durable failure state.
  `stale` requires an existing generated GLB whose hashes no longer match;
  when no generated GLB exists, or when an old generated GLB predates the
  final-hash contract, the state is `unavailable`.
- Building and queued are runtime-only view states derived from the live asset
  generation queue snapshot, not from `pipeline.json`.
- Asset Review does not save a separate review status in `pipeline.json`.

## Transport Shape

- Keep normal HTTP service routes for canonical request/response actions such
  as loading status, enqueueing builds, retrying failed tiles, or marking review
  state.
- Add Socket.IO only as an additive live channel for queue snapshots, progress,
  completion, and failure events where spinner-level feedback is insufficient.
- Namespaces are useful as lightweight server feature boundaries, but this is a
  single-developer local tool. Do not add multi-user session, account,
  authorization, or cross-client ownership complexity.

## Deep Links

- [Pipeline App Summary](/c:/dev/poly-gc-react/agents/topics/pipeline-app/app-summary.md)
- [3D Asset Pipeline Summary](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/summary.md)
- [3D Asset Pipeline Current Contracts](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/current-contracts.md)
- [3D Asset Pipeline Stage Contracts](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/stage-contracts.md)
- [Generated Asset Contract](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/generated-asset-contract.md)
