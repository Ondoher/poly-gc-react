# 3D Asset Pipeline Current Contracts

This is the compact factual anchor for the active 3D asset pipeline docs.
Deeper details live in the linked domain docs.

## Canonical Facts

- Mutable tileset state lives in
  `scripts/output/asset-pipeline/<tilesetId>/pipeline.json`.
- Current pipeline state schema version is `3`.
- The active/known tileset registry lives in
  `scripts/output/asset-pipeline/tilesets.json`.
- Source SVG manifests live in
  `scripts/data/asset-pipeline/manifests/<tilesetId>.json`.
- Intaken source SVG copies live in
  `scripts/output/asset-pipeline/source-svgs/<tilesetId>/<faceKey>.svg`.
- Prepared source SVGs, when produced, live in
  `scripts/output/asset-pipeline/prepared-svgs/<tilesetId>/<faceKey>.svg`.
- Stage outputs live under `scripts/output/asset-pipeline/<tilesetId>/`.

## State Ownership

`PipelineModel` is the canonical state interface for stage runners and server
routes.

- Source review state lives under `svgPipeline.faces[faceKey].state`.
- Component bindings live under `state.bindings`.
- Part state lives under `state.parts`.
- Compact alignment handoff matches live under `state.alignment.matches`.
- Final rendering options live under `rendering`.
- Generated 3D asset state lives under `assetPipeline`.

Binding records use the compact tuple:

```json
{
  "componentId": "src.b-1.0001",
  "partId": "label",
  "strength": "tentative"
}
```

Valid strengths are `none`, `tentative`, `strong`, and `accepted`.

## Implemented Flow

The pipeline app build includes Reference Approval, Optional Part Assignment,
Source Assignment, Final Rendering Options, Asset Base Tile Selection, and
Asset Review.

The server route surface includes state loading, tileset selection, metadata
recreation, source preprocessing, reference-structure load/save, optional
parts, source assignment, final rendering, base tile selection, asset
generation, and asset review.

## Generated Asset Facts

Generated asset stages are:

```text
preview-svg -> svg-cutter -> stamped-body -> colored-inlay -> preview-png
```

Generation requires a selected base tile variant at
`assetPipeline.baseTileSelection.variantId`. Generated asset readiness is
derived from the current face input hash, selected base tile, rendered SVG,
required artifacts, and per-stage hashes.

The generated stages currently consume the final-rendering color SVG. That SVG
is expected to preserve filled `fill-rule="evenodd"` semantics for visual
holes while pruning degenerate evenodd subpaths that can break Three
triangulation.

The Mark II base tile artist delivery has been promoted as base tile variant
`mark-ii` at `scripts/data/3d-assets/models/base-tiles/mark-ii.glb` with
metadata in `mark-ii.json`. It is a two-mesh GLB: `BaseTileBody_Ivory` is the
ivory/front carving target, and `baseTileBody_wood` is the bamboo/back insert
that is carried through unchanged. The promoted pipeline copy is normalized to
generated-asset coordinates with X as width, Y as carving thickness, and Z as
face depth. Combined bounds validate at width `0.79`, thickness `0.50`, and
depth `1.08`, centered at origin. Carving remains inset on the ivory face,
uses a straight projected `-Y` direction from the `+Y` front face, and keeps
safe engraving depth between `0.025` and `0.035` units.

## Current Checkpoint

As of 2026-06-09:

- [SVG Stage Contracts](svg-stage-contracts.md) is the focused per-stage SVG
  handoff document. It records normalization meta-goals, current normalizer
  behavior for complex SVGs, final-rendering shaping rules, and cutter
  limitations.
- Source normalization is understood as a provenance-rich geometry inventory
  stage. It should make source artwork legible, preserve origin evidence,
  separate visual structure from semantic meaning, avoid face-specific rules,
  and hand off data the next stage can reliably consume.
- The current normalizer is intentionally not a full browser SVG engine. It
  handles supported geometry/text tags, group inheritance, simple class paint,
  limited transforms, compound-path island/band splitting, source-use grouping,
  tile/background filtering, literal-white and near-white neutral
  negative-space filtering, and bounded opaque paint-layer flattening.
- Generated asset stages currently use final-rendering color SVGs, not prepared
  SVGs. Prepared SVG export remains future work behind visual approval.
- Mark II base tile assets remain promoted in
  `scripts/data/3d-assets/models/base-tiles/mark-ii.glb` and `mark-ii.json`,
  with the manifest entry preserved.
- The Mark II generated-asset code experiments for cutter clustering,
  multi-mesh stamped output, inlay depth/overlap handling, and hole-fill
  synthesis were reverted back to the last committed pipeline code after
  visual review showed they had become too aggressive. The key unresolved
  design issue is that the bird body should not be carved as a filled region;
  only the visible blue linework/details should become recess geometry.
- Traditional generated 3D outputs were cleared after the failed Mark II
  queue runs: `models/svg-cutter`, `models/stamped-body`,
  `models/colored-inlay`, `json/svg-cutter`, `json/stamped-body`,
  `json/colored-inlay`, and `images/generated-asset-preview-png` are empty.
- The `traditional` `assetPipeline` state was reset to an empty generated-asset
  section with `baseTileSelection.variantId` still set to `mark-ii`, and the
  persisted generation queue is empty.
- Base tile selection stages missing/stale generated assets into the persisted
  queue when the tileset is idle.
- Asset Review now has Cancel and Reset controls. Cancel stops queued
  generated-asset work by clearing the persisted queue, live queue snapshot,
  and `assetPipeline` runtime queue/build fields. Reset performs the same
  cancel work, clears only generated 3D asset folders, and resets only
  `assetPipeline` generated face state to ungenerated while preserving the
  selected base tile variant and all SVG preprocessing state.
- `svg-cutter` now emits structured stdout progress for parse, extrude,
  normalize, union, and export phases. The queue runner streams those records
  into Asset Review as live `stageProgress` so long cutter runs show active
  phase/count/percent without changing generated geometry or persisted
  readiness contracts.
- A focused Paper.js SVG-side union experiment is available for generated
  asset validation. The `default/season-1` face has been pointed at
  `paper-united-all` experiment artifacts generated with `svg-cutter
  --skip-union`, with stamped body, colored inlay, and preview outputs written
  under `scripts/output/asset-pipeline/default/experiments/paper-flatten/`.
- Known unresolved risk: generated asset preview PNG rendering can still time
  out independently of successful cutter, stamped body, and colored inlay
  generation.

## Doc Map

- [State Contract](state-contract.md) owns mutable state shape.
- [Stage Contracts](stage-contracts.md) owns stage order and gates.
- [SVG Stage Contracts](svg-stage-contracts.md) owns per-stage SVG input/output
  boundaries.
- [Artifact Contract](artifact-contract.md) owns artifact roles and paths.
- [Runtime And Routes](runtime-and-routes.md) owns routes, CLIs, and queue behavior.
- [Future Work](future-work.md) owns unimplemented desired work.
