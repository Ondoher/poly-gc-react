# Stage Contracts

This document owns stage order, stage ownership, and gates.

## Stage Order

```text
0. Reference setup
1. Tileset intake
2. Source normalization
3. Optional part assignment
4. Source alignment
5. Source assignment
6. Final rendering composition
7. Visual approval
8. Prepared SVG export
9. Base tile selection and asset planning
10. SVG cutter generation
11. Stamped body generation
12. Colored inlay generation
13. Asset review
```

## Stage Summary

| Stage | Owns | Gate |
| --- | --- | --- |
| 0. Reference setup | PNG-derived reference structure and semantic part bindings. | Required reference parts are resolved. |
| 1. Tileset intake | Source inventory, copied source SVGs, and initial `pipeline.json`. | Source attribution and face inventory are usable. |
| 2. Source normalization | Non-semantic source geometry artifacts. | Normalized component artifact is available or the face is marked unusable. |
| 3. Optional part assignment | Source-side optional label/glyph presence, absence, and reservations. | Optional parts are accepted as bound or source-absent. |
| 4. Source alignment | Visual correspondence between source candidates and reference parts. | Compact matches and placement fields are written. |
| 5. Source assignment | Accepted source bindings and accepted source absence. | Source bindings/parts are accepted for rendering. |
| 6. Final rendering composition | Output policy, layout, color, generated glyphs, and final rendered SVGs. | Rendered color SVG artifact pointers are current for accepted source state. |
| 7. Visual approval | Acceptance or correction routing for export-ready visual output. | Visual result is accepted for exact inputs. |
| 8. Prepared SVG export | Canonical prepared SVGs and validation artifacts. | Prepared SVGs pass validation. |
| 9. Base tile selection and asset planning | Selected base tile and queue planning. | Base tile is selected and build plan is known. |
| 10. SVG cutter generation | Cutter GLB and cutter metadata. | Cutter artifacts exist for the face hash. |
| 11. Stamped body generation | Carved/stamped body GLB and metadata. | Stamped body artifacts exist for the face hash. |
| 12. Colored inlay generation | Colored inlay GLB and metadata. | Inlay artifacts exist for the face hash. |
| 13. Asset review | Reviewable generated asset status and preview. | Generated output is ready, previewable, and reviewable. |

## Ownership Rules

- Stage 0 owns reference-local structure, not source tileset review state.
- Stages 1 through 8 own source review state under `svgPipeline`.
- Stages 9 through 13 own generated asset state under `assetPipeline`.
- Stage artifacts may carry source material, generated output, or review
  visuals; mutable review facts belong in `pipeline.json`.
- App pages gate human decisions. Stage runners and server routes own the
  persistent state mutations behind those pages.

## Current Implemented Pages

The pipeline app build includes Reference Approval, Optional Part Assignment,
Source Assignment, Final Rendering Options, Asset Base Tile Selection, and
Asset Review. Intake verification, visual approval, and prepared SVG QA remain
in [Future Work](future-work.md).

