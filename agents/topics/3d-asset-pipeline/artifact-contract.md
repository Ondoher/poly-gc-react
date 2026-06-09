# Artifact Contract

This document owns artifact roles and current path rules.

## Artifact Roles

Use these roles when deciding whether a file can be read by later stages:

- canonical state: mutable decisions in `pipeline.json`
- source input: external source material or hand-authored setup data
- durable fact artifact: large parsed facts referenced by canonical state
- human review output: SVG/PNG for inspection
- generated output: prepared SVGs, GLBs, generated metadata, and previews
- routing manifest: active/known tileset lists

Only canonical state owns mutable review decisions.

## Canonical Pointer Rule

When a later stage needs a durable fact artifact or generated output, canonical
state must point at it. Consumers should follow those pointers instead of
scanning directories.

Examples:

```text
svgPipeline.faces[faceKey].artifacts.sourceSvg
svgPipeline.faces[faceKey].artifacts.normalizedComponents
svgPipeline.faces[faceKey].artifacts.finalRenderingColorSvg
assetPipeline.faces[faceKey].artifacts.inlayModel
assetPipeline.faces[faceKey].artifacts.previewPng
```

## Current Artifact Map

| Artifact | Role | Owner |
| --- | --- | --- |
| `scripts/data/asset-pipeline/manifests/<tilesetId>.json` | source input | Tileset intake |
| `scripts/output/asset-pipeline/source-svgs/<tilesetId>/<faceKey>.svg` | generated source copy | Tileset intake |
| `scripts/output/asset-pipeline/<tilesetId>/pipeline.json` | canonical state | `PipelineModel` |
| `scripts/output/asset-pipeline/tilesets.json` | routing manifest | Tileset selection |
| `scripts/output/asset-pipeline/<tilesetId>/json/normalized-components/<faceKey>.json` | durable fact artifact | Source normalization |
| `scripts/output/asset-pipeline/<tilesetId>/images/identified-components-svg/<faceKey>.svg` | human review output | Source normalization |
| `scripts/output/asset-pipeline/<tilesetId>/images/identified-shapes-svg/<faceKey>.svg` | human review output | Source normalization |
| `scripts/output/asset-pipeline/<tilesetId>/images/final-rendering-add-optional-svg/<faceKey>.svg` | human review output | Final rendering |
| `scripts/output/asset-pipeline/<tilesetId>/images/final-rendering-layout-svg/<faceKey>.svg` | human review output | Final rendering |
| `scripts/output/asset-pipeline/<tilesetId>/images/final-rendering-color-svg/<faceKey>.svg` | generated/review output | Final rendering |
| `scripts/output/asset-pipeline/<tilesetId>/images/final-rendering-color-review-png/<faceKey>.png` | human review output | Final rendering |
| `scripts/output/asset-pipeline/prepared-svgs/<tilesetId>/<faceKey>.svg` | generated output | Prepared SVG export |
| `scripts/output/asset-pipeline/<tilesetId>/models/svg-cutter/<faceKey>.glb` | generated output | SVG cutter |
| `scripts/output/asset-pipeline/<tilesetId>/json/svg-cutter/<faceKey>.json` | generated output | SVG cutter |
| `scripts/output/asset-pipeline/<tilesetId>/models/stamped-body/<faceKey>.glb` | generated output | Stamped body |
| `scripts/output/asset-pipeline/<tilesetId>/json/stamped-body/<faceKey>.json` | generated output | Stamped body |
| `scripts/output/asset-pipeline/<tilesetId>/models/colored-inlay/<faceKey>.glb` | generated output | Colored inlay |
| `scripts/output/asset-pipeline/<tilesetId>/json/colored-inlay/<faceKey>.json` | generated output | Colored inlay |
| `scripts/output/asset-pipeline/<tilesetId>/images/generated-asset-preview-png/<faceKey>.png` | generated output | Asset preview |

## Durable Facts

Durable fact artifacts may contain large facts such as SVG geometry, paint
evidence, source ancestry, bounds, OCR evidence, reference components, model
metadata, or generated mesh metadata. They must not become mutable review
state.

## Review Outputs

Review SVGs and PNGs help humans inspect stage output. They can be regenerated
from canonical state and durable facts. They should not be used as the source
of a current binding, status, route, or output decision.
