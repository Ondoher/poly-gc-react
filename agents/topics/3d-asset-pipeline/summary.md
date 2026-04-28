# 3D Asset Pipeline Summary

Use this summary when another topic needs brief context about the 3D asset
pipeline without loading the full topic.

## Owns

The `3d-asset-pipeline` topic owns the path from reference/source artwork to
reviewable generated 3D tile assets:

```text
reference setup
-> source manifest intake
-> source normalization
-> optional part assignment
-> source alignment
-> source assignment
-> final rendering
-> base tile selection
-> asset generation
-> asset review
```

It owns source/reference contracts, canonical pipeline state, stage gates,
artifact roles, final rendering output, generated asset hashes, queue behavior,
and generated GLB/PNG review artifacts.

It does not own the pipeline app shell/page architecture, except where server
routes and review payload contracts affect pipeline state. App feature/page
shape belongs to the `pipeline-app` topic. Renderer-only experiments belong to
`real-3d-rendering`.

## Mental Model

Reference images own Mahjong structure: semantic parts, target bounds, colors,
and generated glyph slots.

Source SVGs own donor style: paths, paint evidence, source geometry, and
visual details. Source component ids are extraction ids, not semantic meaning.

Review stages bind source geometry to reference semantic parts. Final
Rendering decides visible output policy, layout, and color. Generated asset
stages turn the rendered face into cutter, stamped body, colored inlay, and
preview assets.

## Canonical State

Each source tileset has one mutable state file:

```text
scripts/output/asset-pipeline/<tilesetId>/pipeline.json
```

Current schema version: `3`.

State ownership:

- `svgPipeline.faces[faceKey].state`: source review facts
- `state.bindings`: component-to-part bindings
- `state.parts`: accepted part/source-absence facts
- `state.alignment.matches`: compact alignment handoff
- `rendering`: final output policy/options
- `assetPipeline`: generated asset readiness, hashes, queue/build state, and
  generated artifact pointers

The tileset registry is routing-only:

```text
scripts/output/asset-pipeline/tilesets.json
```

It owns only `activeTilesetId` and known tilesets.

## Current Generated Asset Path

Generated asset stages currently consume the final-rendering color SVG recorded
at:

```text
svgPipeline.faces[faceKey].artifacts.finalRenderingColorSvg
```

Prepared SVG export is a later stage and future review/QA promotion surface.
It is not currently the canonical generated-asset input.

Generated stages:

```text
preview-svg -> svg-cutter -> stamped-body -> colored-inlay -> preview-png
```

Asset Review synthesizes readiness from canonical hashes, required artifacts,
file existence, and live/persisted queue state. It does not save a separate
review status in `pipeline.json`.

## Key Boundaries

- Source review state stays under `svgPipeline`.
- Generated 3D asset state stays under `assetPipeline`.
- Diagnostic candidates, score traces, review SVGs, and preview PNGs are not
  canonical mutable state.
- Server route responses are synthesized UI view models, not another source of
  truth.
- Rendering decides generated/source/omitted output; source review only records
  what the source provides or lacks.
- Alignment answers how source geometry can fit reference structure. Source
  Assignment answers what source geometry means. Final Rendering answers what
  should be output.

## Detail Map

- One-page facts: [Current Contracts](current-contracts.md)
- Mutable state shape: [State Contract](state-contract.md)
- Stage order and gates: [Stage Contracts](stage-contracts.md)
- Artifact roles and paths: [Artifact Contract](artifact-contract.md)
- Source manifests and tileset registry:
  [Source Manifest Contract](source-manifest-contract.md)
- Reference setup: [Reference Setup Contract](reference-setup-contract.md)
- Source review and optional parts: [Source Review Contract](source-review-contract.md)
- Assignment scoring and OCR evidence: [Assignment Scoring](assignment-scoring.md)
- Alignment handoff:
  [Alignment Assignment Contract](alignment-assignment-contract.md)
- Alignment model: [Alignment Engine](alignment-engine.md)
- Final rendering: [Rendering Contract](rendering-contract.md)
- Color policy: [Color Handling](color-handling.md)
- Generated assets and hashes: [Generated Asset Contract](generated-asset-contract.md)
- Routes, CLIs, queues, streams: [Runtime And Routes](runtime-and-routes.md)
- Deferred work: [Future Work](future-work.md)
- Terms: [Glossary](glossary.md)
