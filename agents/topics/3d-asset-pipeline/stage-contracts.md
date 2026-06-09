# Stage Contracts

This document owns stage order, stage ownership, and gates.

The SVG-shaped input/output boundary for each SVG-consuming stage lives in
[SVG Stage Contracts](svg-stage-contracts.md).

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
9. Cutter SVG simplification
10. Base tile selection and asset planning
11. SVG cutter generation
12. Stamped body generation
13. Colored inlay generation
14. Asset review
```

## Stage Summary

| Stage | Owns | Gate |
| --- | --- | --- |
| 0. Reference setup | PNG-derived reference structure and semantic part bindings. | Required reference parts are resolved. |
| 1. Tileset intake | Source inventory, copied source SVGs, and initial `pipeline.json`. | Source attribution and face inventory are usable. |
| 2. Source normalization | Non-semantic source geometry artifacts, including visible paint-layer flattening for distinct overlapping opaque fills. | Normalized component artifact is available or the face is marked unusable. |
| 3. Optional part assignment | Source-side optional label/glyph presence, absence, and reservations. | Optional parts are accepted as bound or source-absent. |
| 4. Source alignment | Visual correspondence between source candidates and reference parts. | Compact matches and placement fields are written. |
| 5. Source assignment | Accepted source bindings and accepted source absence. | Source bindings/parts are accepted for rendering. |
| 6. Final rendering composition | Output policy, layout, color, generated glyphs, and final rendered SVGs. | Rendered color SVG artifact pointers are current for accepted source state. |
| 7. Visual approval | Acceptance or correction routing for export-ready visual output. | Visual result is accepted for exact inputs. |
| 8. Prepared SVG export | Canonical prepared SVGs and validation artifacts. | Prepared SVGs pass validation. |
| 9. Cutter SVG simplification | Cutter-facing SVG geometry cleanup after accepted/rendered output. | Simplified SVG is valid and traceable to rendered/source evidence. |
| 10. Base tile selection and asset planning | Selected base tile and queue planning. | Base tile is selected and build plan is known. |
| 11. SVG cutter generation | Cutter GLB and cutter metadata. | Cutter artifacts exist for the face hash. |
| 12. Stamped body generation | Carved/stamped body GLB and metadata. | Stamped body artifacts exist for the face hash. |
| 13. Colored inlay generation | Colored inlay GLB and metadata. | Inlay artifacts exist for the face hash. |
| 14. Asset review | Reviewable generated asset status and preview. | Generated output is ready, previewable, and reviewable. |

## Ownership Rules

- Stage 0 owns reference-local structure, not source tileset review state.
- Stages 1 through 8 own source review state under `svgPipeline`.
- Stages 9 through 14 own generated asset state under `assetPipeline`.
- Stage artifacts may carry source material, generated output, or review
  visuals; mutable review facts belong in `pipeline.json`.
- App pages gate human decisions. Stage runners and server routes own the
  persistent state mutations behind those pages.

## Current Validation Notes

- As of 2026-05-19, `npm run test:pipeline`, `npm run test:scripts`, and
  `npm run test:engines` pass against the current model-owned
  `pipeline.json` contract.
- Source normalization, optional assignment, alignment, semantic assignment,
  and final rendering tests now exercise the current `scripts/output/asset-pipeline/<tileset>`
  artifact layout instead of the retired `svg-preprocessor/<tileset>/tileset.json`
  layout.
- Alignment treats canonical optional assignment state as a valid handoff, and
  source metadata can reconsider an older source-absent optional marker when it
  identifies source components.
- Source normalization can subtract later opaque paint layers from earlier
  layers to prevent overlapping solids from entering 3D generation, but
  only inside one identified source shape. Fragments that came from the same
  original source element/use stay independent and keep their evenodd holes,
  and overlap between separate identified source shapes is preserved.
- The Stage 2 normalizer contract now separates supported SVG extraction,
  evidence preservation, and limited early geometry repair. Later stages may
  rely on named normalized artifact fields and source-shape evidence, but not
  on component ids as semantic meaning or on retained geometry as cutter-ready.
- A new Stage 9 Cutter SVG Simplification stage is the planned owner of
  cutter-facing geometry cleanup. This moves broad cutter-readiness pressure
  out of Source Normalization and Final Rendering while keeping the current
  final-rendering color SVG as the active generated-asset input until the new
  stage is implemented and promoted.
- Final rendering writes diagnostic final-rendering map and report artifacts
  while keeping durable render pointers in `svgPipeline.faces[*].artifacts`.
- Final rendering now normalizes filled evenodd source paths for generated
  assets by preserving `fill-rule="evenodd"` and pruning only degenerate
  subpaths before cutter generation.
- Final rendering also recombines consecutive same-source/same-paint fragments
  before SVG emission so evenodd holes are not filled by sibling fragments from
  the same original source element.
- When more than one geometry normalization applies to an emitted path, the
  markers are combined into a single `data-geometry-normalized` attribute so
  review PNG rendering receives valid XML.
- Optional Part Assignment preview "Parts" mode draws normalized component
  paths directly instead of clipping the full source SVG by component bounds, so
  compound-path holes shown during review match the actual component geometry.
- Assignment Review accept saves pending binding edits, refreshes
  alignment/semantic assignment when needed, reloads the model, then marks the
  source assignment accepted and runs final rendering.
- `dragon-g` and `season-3` were regenerated through final rendering,
  svg-cutter, stamped-body, and colored-inlay on 2026-05-19 after that
  geometry normalization; all three generated asset stages completed.
- Generated asset stage hashes were bumped on 2026-05-19 after cutter fallback
  behavior changed: multi-component cutters now avoid whole-face CSG union and
  remove internal side-wall triangles where adjacent component footprints touch
  instead of preserving raw merged cutter walls. The affected stages are
  `svg-cutter`, `stamped-body`, `colored-inlay`, and `preview-png`.
- Mark II base tile support was added on 2026-06-09. The production base tile
  variant uses one carving mesh plus preserved support meshes; stamped-body
  subtracts only from the carving mesh, colored-inlay carries preserved support
  meshes forward, and the affected generated stages were hash-bumped
  (`stamped-body`, `colored-inlay`, and `preview-png`).
- The default `npm test` browser leg was attempted on 2026-05-19 but Chrome
  launch failed in the sandbox with `spawn EPERM`; escalated rerun approval was
  not granted in that session.

## Current Implemented Pages

The pipeline app build includes Reference Approval, Optional Part Assignment,
Source Assignment, Final Rendering Options, Asset Base Tile Selection, and
Asset Review. Intake verification, visual approval, and prepared SVG QA remain
in [Future Work](future-work.md).
