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
- Intaken source SVGs live in
  `scripts/data/asset-pipeline/source-svgs/<tilesetId>/<faceKey>.svg`.
- Prepared source SVGs, when produced, live in
  `scripts/data/asset-pipeline/prepared-svgs/<tilesetId>/<faceKey>.svg`.
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

## Doc Map

- [State Contract](state-contract.md) owns mutable state shape.
- [Stage Contracts](stage-contracts.md) owns stage order and gates.
- [Artifact Contract](artifact-contract.md) owns artifact roles and paths.
- [Runtime And Routes](runtime-and-routes.md) owns routes, CLIs, and queue behavior.
- [Future Work](future-work.md) owns unimplemented desired work.

