# State Contract

This document owns canonical mutable state for the 3D asset pipeline.

## Tileset State

Each source tileset has one mutable state file:

```text
scripts/output/asset-pipeline/<tilesetId>/pipeline.json
```

Top-level state is normalized by `PipelineModel`:

```json
{
  "schemaVersion": 3,
  "tilesetId": "traditional",
  "referenceSetId": "default-large-faces",
  "currencyDate": "2026-05-16T00:00:00.000Z",
  "configuration": {},
  "rendering": {},
  "svgPipeline": {
    "faces": {}
  },
  "assetPipeline": {
    "schemaVersion": 1,
    "baseTileSelection": {
      "variantId": "..."
    },
    "faces": {}
  }
}
```

`assetPipeline` is omitted when it has no selected base tile and no face asset
state. Face identity comes from `svgPipeline.faces[faceKey]`; no canonical
per-face state files exist.

## Source Face State

Mutable source-side face decisions live under:

```text
svgPipeline.faces[faceKey].state
```

This state owns accepted part decisions, compact component bindings, and the
alignment data required by later stages. Large source geometry remains in
durable artifacts and is referenced from the face's `artifacts` object.

## Parts

`state.parts[partId]` owns part-level source review facts. A part can be
accepted without a binding, which means the source review accepted that no
source component is used for that part. That absence does not decide final
generated or omitted output; rendering options decide output.

Canonical part cleanup strips date/review scratch fields. A source review
status of accepted is normalized to the durable `accepted: true` flag.

## Bindings

Component-to-part relationships live only in:

```text
svgPipeline.faces[faceKey].state.bindings
```

Bindings are keyed by component id and carry the same `componentId` inside the
record for portability:

```json
{
  "src.b-1.0004": {
    "componentId": "src.b-1.0004",
    "partId": "mainArtwork",
    "strength": "accepted"
  }
}
```

Valid binding strengths are:

- `none`: not bound and not retained as meaningful assignment
- `tentative`: algorithmic proposal
- `strong`: reviewer-selected binding algorithms should preserve
- `accepted`: binding passed the relevant gate

Do not add a second durable binding status field.

## Alignment Handoff

Alignment writes compact selected matches into:

```text
svgPipeline.faces[faceKey].state.alignment.matches
```

It also applies final placement fields onto `state.parts[partId]` for the
renderer. Diagnostic candidates, alternatives, and scoring traces are not
canonical state.

## Configuration And Rendering

`configuration` owns expectations and search behavior, such as optional part
search settings and source assignment query defaults.

`rendering` owns final output policy, including generated/source/omitted
decisions, color policy, layout policy, and render-time transforms. Source
review records what the source provides; rendering records what the final
output should show.

Final rendering records the selected color SVG on each face:

```text
svgPipeline.faces[faceKey].artifacts.finalRenderingColorSvg
```

When present, review PNGs use
`finalRenderingColorReviewPng`.

## Generated Asset State

Generated 3D asset state lives under:

```text
assetPipeline.faces[faceKey]
```

`assetPipeline.baseTileSelection.variantId` records the reusable base tile
variant. Face asset state records `inputHash`, `finalHash`, `stageHashes`,
`status`, `queue`, `build`, `failure`, and generated artifact pointers.

The SVG review state remains under `svgPipeline`; generated asset state stores
build readiness and generated output references for the accepted rendered
inputs.

## Routing Manifest

The tileset registry is:

```text
scripts/output/asset-pipeline/tilesets.json
```

It owns `activeTilesetId` and the known `tilesets` list. It does not own
source paths, stage progress, face counts, review state, or generated asset
status.
