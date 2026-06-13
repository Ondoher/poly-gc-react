# Asset Pipeline 3D

This product area owns the path from reference images and source SVG tilesets
to reviewable generated GLB tile assets.

## Core Flow

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

Reference setup creates the structural target. Intake creates source tileset
state and copies per-face SVGs. Normalization decomposes SVGs into
non-semantic geometry. Review and alignment stages connect source components
to reference parts. Final rendering creates the accepted visual SVG.
Cutter-2D preparation creates the cutter-facing SVG. Generated model stages
build cutter, stamped body, colored inlay, and preview artifacts from the
accepted SVG state and selected base tile.

## Current Status

Read [Status](status.md) for the current checkpoint. As of the migrated Phase 2
pass, Mark III is the active selectable production base tile, shown in the app
as "Ivory and Bamboo".

## Main Areas

- [Contracts](contracts/README.md): state, artifacts, stage order, source
  review, rendering, and generated asset contracts.
- [SVG Processing](svg-processing/README.md): per-stage SVG handoffs,
  normalization, alignment, assignment, color, final rendering, and cutter-2D.
- [Generated Models](generated-models/README.md): cutter, stamped body,
  colored inlay, preview PNGs, base tiles, and diagnostic viewing.
- [Pipeline Runtime](pipeline-runtime/README.md): server routes, queues,
  progress events, and Chromium preview rendering.
- [Pipeline App](pipeline-app/README.md): approval app shell, pages, and
  review data boundaries.
- [Contractor Handoff](contractor-handoff/README.md): contractor-facing briefs
  and palette/package docs.
- [Experiments](experiments/README.md): focused generated-asset experiments.
- [Archive](archive/README.md): historical notes not treated as active
  contract.
- [Glossary](glossary.md): domain terms.

## Important Source Files

- `scripts/3d-assets/svg-preprocessor/PipelineModel.js`
- `scripts/3d-assets/svg-preprocessor/SourceNormalizationRunner.js`
- `scripts/3d-assets/svg-preprocessor/OptionalPartAssignmentRunner.js`
- `scripts/3d-assets/svg-preprocessor/SourceAlignmentRunner.js`
- `scripts/3d-assets/svg-preprocessor/SourceSemanticAssignmentRunner.js`
- `scripts/3d-assets/svg-preprocessor/FinalRenderingCompositionRunner.js`
- `scripts/3d-assets/asset-pipeline/export-svg-cutter.js`
- `scripts/3d-assets/asset-pipeline/export-stamped-tile-pair.js`
- `scripts/3d-assets/asset-pipeline/export-stamped-tile-inlay.js`
- `scripts/3d-assets/asset-pipeline/generated-asset-preview-renderer.js`
- `server/pipeline/index.js`

## Migration Note

This topic was migrated from `agents/topics.bak/3d-asset-pipeline` during
Phase 2. Detailed contract files were copied mostly as-is for the first pass;
later content passes should rebalance wording and remove stale historical
detail.
