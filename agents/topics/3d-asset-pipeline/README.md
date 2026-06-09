# 3D Asset Pipeline

This topic is the re-entry point for the Mahjong 3D asset pipeline: the path
from reference images and source SVG tilesets to reviewable generated GLB tile
assets.

## Problem Shape

The project needs tile-face artwork that is clean enough for physical 3D asset
generation. Raw bitmap faces are useful as canonical reference structure, but
they are not ideal geometry sources. Source SVG tilesets provide scalable
artwork style, but their internal structure is inconsistent and often has no
semantic meaning.

The pipeline joins those two sources:

- reference images own Mahjong structure
- source SVGs own donor style
- review bindings connect source components to semantic reference parts
- final rendering turns accepted source/reference facts into flat prepared
  SVG output
- generated asset stages turn that prepared face into cutter, stamped body,
  colored inlay, and preview artifacts

## Core Flow

```text
reference setup
-> source manifest intake
-> source normalization
-> optional part assignment
-> source alignment
-> source assignment
-> final rendering
-> cutter SVG simplification
-> base tile selection
-> asset generation
-> asset review
```

Reference setup creates the structural target. Intake creates a tileset state
file and copies per-face source SVGs. Normalization decomposes SVGs into
non-semantic geometry. Optional Part Assignment reserves labels and glyphs
before alignment. Alignment fits source geometry against reference structure.
Source Assignment accepts or corrects source meaning. Final Rendering chooses
output policy, layout, and color. Cutter SVG Simplification is the planned
handoff for cutter-facing geometry cleanup before generated assets consume the
accepted face. Asset generation builds 3D outputs from the accepted rendered
face and selected base tile.

The exact stage contract lives in [Stage Contracts](stage-contracts.md).
The per-stage SVG input/output contract lives in
[SVG Stage Contracts](svg-stage-contracts.md).

## Hard Parts

Source SVG ids are not semantic. A path named by the SVG author might be a
layer, a visual component, a reused symbol, or an implementation detail. The
pipeline treats normalized source ids as extraction ids and asks later stages
to infer or review meaning.

Alignment is non-obvious because source and reference decomposition rarely
match one-to-one. A single source component can represent several reference
parts, several source components can represent one part, and repeated artwork
may need separate geometric fit and identity resolution. The deep aligner
model lives in [Alignment Engine](alignment-engine.md).

Color needs its own policy because the output is physical inlay geometry.
Gradients and paint servers can inform shade selection, but generated assets
need discrete solid regions. Repeated elements add another wrinkle: source dot
or bamboo colors can be arranged differently from the reference colors, so the
renderer must transfer reference hue identity while preserving source detail
contrast inside each repeated part. The color model lives in
[Color Handling](color-handling.md).

Generated assets have a separate state namespace because source review edits
and 3D build readiness are different facts. The generated asset model lives in
[Generated Asset Contract](generated-asset-contract.md).

## Canonical State

Each source tileset has one mutable state file:

```text
scripts/output/asset-pipeline/<tilesetId>/pipeline.json
```

Current schema version is `3`.

Source review state lives under `svgPipeline.faces[faceKey].state`. Generated
3D asset state lives under `assetPipeline`. The tileset routing manifest is:

```text
scripts/output/asset-pipeline/tilesets.json
```

The compact fact sheet is [Current Contracts](current-contracts.md). The full
state shape is [State Contract](state-contract.md).

## Code Map

Important source files:

- `scripts/3d-assets/svg-preprocessor/PipelineModel.js`
- `scripts/3d-assets/svg-preprocessor/SourceNormalizationRunner.js`
- `scripts/3d-assets/svg-preprocessor/OptionalPartAssignmentRunner.js`
- `scripts/3d-assets/svg-preprocessor/SourceAlignmentRunner.js`
- `scripts/3d-assets/svg-preprocessor/SourceSemanticAssignmentRunner.js`
- `scripts/3d-assets/svg-preprocessor/FinalRenderingCompositionRunner.js`
- `scripts/3d-assets/svg-preprocessor/intake-source-svg-manifest.js`
- `scripts/3d-assets/svg-preprocessor/tileset-manifest.js`
- `scripts/3d-assets/asset-pipeline/export-svg-cutter.js`
- `scripts/3d-assets/asset-pipeline/export-stamped-tile-pair.js`
- `scripts/3d-assets/asset-pipeline/export-stamped-tile-inlay.js`
- `scripts/3d-assets/asset-pipeline/generated-asset-preview-renderer.js`
- `server/pipeline/index.js`

## Where To Go

- Need brief context from another topic? Read [Summary](summary.md).
- Need the one-page facts? Read [Current Contracts](current-contracts.md).
- Changing `pipeline.json` state? Read [State Contract](state-contract.md).
- Changing stage order or gates? Read [Stage Contracts](stage-contracts.md).
- Changing SVG geometry crossing stage boundaries? Read
  [SVG Stage Contracts](svg-stage-contracts.md).
- Rebuilding Stage 2 source normalization? Use
  [Stage 2 Source Normalization Prompt](stage-2-source-normalization-prompt.md).
- Changing source manifests? Read [Source Manifest Contract](source-manifest-contract.md).
- Changing reference setup? Read [Reference Setup Contract](reference-setup-contract.md).
- Changing optional/source review? Read [Source Review Contract](source-review-contract.md).
- Changing scoring or OCR evidence? Read [Assignment Scoring](assignment-scoring.md).
- Changing alignment handoff? Read [Alignment Assignment Contract](alignment-assignment-contract.md).
- Changing aligner behavior? Read [Alignment Engine](alignment-engine.md).
- Changing rendering? Read [Rendering Contract](rendering-contract.md).
- Changing color? Read [Color Handling](color-handling.md).
- Changing generated assets? Read [Generated Asset Contract](generated-asset-contract.md).
- Changing routes or queues? Read [Runtime And Routes](runtime-and-routes.md).
- Need terms? Read [Glossary](glossary.md).
- Looking for deferred work? Read [Future Work](future-work.md).
