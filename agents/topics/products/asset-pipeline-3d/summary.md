# Asset Pipeline 3D Summary

Use this summary when another topic needs brief context about the 3D asset
pipeline without loading the full topic.

## Owns

Asset Pipeline 3D owns the path from reference/source artwork to reviewable
generated 3D tile assets:

```text
reference setup
-> source manifest intake
-> source normalization
-> optional part assignment
-> source alignment
-> source assignment
-> final rendering
-> cutter-2D preparation
-> base tile selection
-> asset generation
-> asset review
```

It owns source/reference contracts, canonical pipeline state, stage gates,
artifact roles, final rendering output, generated asset hashes, queue behavior,
and generated GLB/PNG review artifacts.

The pipeline app shell/page architecture lives under
[Pipeline App](pipeline-app/README.md). Renderer diagnostics for generated GLBs
live under [Generated Models](generated-models/README.md). Both are subordinate
to the Asset Pipeline 3D product area.

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

## Current Generated Asset Path

Generated asset stages start from the final-rendering color SVG. Cutter-2D
Preparation creates the active cutter-facing SVG handoff recorded at
`assetPipeline.faces[faceKey].artifacts.cutterSvg`.

Generated stages:

```text
preview-svg -> cutter-2d -> svg-cutter -> stamped-body -> colored-inlay -> preview-png
```

`colored-inlay` uses the final-rendering color SVG for material regions because
the cutter-2D union pass can collapse distinct colors. `svg-cutter` consumes
the cutter-2D SVG and currently runs with `--skip-union`.

## Current Checkpoint

As of the migrated Phase 2 pass, Mark III is the active selectable production
base tile, shown in the app as "Ivory and Bamboo". The generated asset path
preserves embedded/secondary-UV texture materials, carves only the configured
ivory/front mesh, carries support meshes through stamped/final exports, and
uses the explicit `cutter-2d` SVG handoff before cutter generation.

## Detail Map

- One-page facts: [Status](status.md)
- Mutable state shape: [State](contracts/state.md)
- Stage order and gates: [Stage Order](contracts/stage-order.md)
- Per-stage SVG input/output boundaries:
  [SVG Processing](svg-processing/README.md)
- Artifact roles and paths: [Artifacts](contracts/artifacts.md)
- Source manifests and tileset registry:
  [Source Manifest](contracts/source-manifest.md)
- Reference setup: [Reference Setup](contracts/reference-setup.md)
- Source review and optional parts: [Source Review](contracts/source-review.md)
- Assignment scoring and OCR evidence:
  [Assignment Scoring](svg-processing/assignment-scoring.md)
- Alignment handoff: [Assignment](svg-processing/assignment.md)
- Alignment model: [Alignment](svg-processing/alignment.md)
- Final rendering: [Rendering](contracts/rendering.md)
- Color policy: [Color Handling](svg-processing/color-handling.md)
- Generated assets and hashes: [Generated Assets](contracts/generated-assets.md)
- Routes, CLIs, queues, streams:
  [Routes And Queue](pipeline-runtime/routes-and-queue.md)
- Deferred work: [Future Work](archive/future-work.md)
- Terms: [Glossary](glossary.md)
