# Reference Setup Contract

This document owns Stage 0: building the reference-local structure that source
tilesets align to.

## Purpose

Reference setup converts a named reference bitmap set into accepted semantic
structure. Reference images own the Mahjong face structure: dot positions,
label slots, artwork bounds, colors, and semantic part ids.

Source SVG tilesets do not own that structure. They contribute style after
normalization and assignment.

## Checked-In Reference Data

The checked-in reference set used by the active pipeline lives at:

```text
scripts/data/asset-pipeline/references/default-large-faces/
```

It contains:

- `reference.json`
- per-face PNGs under `faces/`

`PipelineModel` resolves this data through `BASE_REFERENCE`.

## Reference Structure Route

The server also exposes reference-structure load/save routes for the Reference
Approval page. Those routes read and write:

```text
scripts/output/3d-assets/reference-structure/<referenceSetId>/reference-structure.json
```

That review structure is Stage 0 data. It uses reference-local vocabulary and
does not own `svgPipeline.faces[faceKey].state`.

## Inputs

Reference setup consumes:

- a reference bitmap descriptor
- PNG face images
- semantic bootstrap data for standard Mahjong face parts
- palette and segmentation settings
- reviewer corrections from Reference Approval

The semantic bootstrap defines intended parts and roles. It does not contain
reference-set-specific pixel geometry.

## Component Extraction

Reference setup extracts connected bitmap components from PNG faces. Components
are evidence: visible shapes, bounds, color, and provenance. They are bound to
semantic parts during auto-assignment and review.

Reference components are not source components. Source SVG normalization uses a
separate non-semantic component vocabulary.

## Reference Structure Owns

Accepted reference structure owns:

- stable face keys and semantic part ids
- family/value/role metadata
- reference component evidence
- component-to-part bindings
- reference-space bounds and target bounds
- default output colors and palette evidence
- generated label/glyph slots
- fit and layout hints used by alignment and rendering

It does not own source bindings, source absence, rendering overrides, generated
asset queue state, or generated GLB artifacts.

## Downstream Contract

Alignment consumes reference structure to know compatible targets and target
bounds. Final rendering consumes it for generated glyph placement, color
defaults, target boxes, and structural layout. Source review state records how
one source tileset maps onto that reference structure.

