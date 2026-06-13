# Future Work

This document owns unimplemented desired work for the 3D asset pipeline.

## Intake And Normalization Review

- Add an intake verification page for source attribution, face inventory,
  face-code mapping, and gross source-file problems.
- Add a normalization QA surface for component extraction and prepared SVG
  source material issues.
- Decide whether unsupported but visually meaningful SVG features such as
  masks, clip paths, filters, gradients, nested symbols, and unsupported
  transforms should be expanded during intake/normalization or rejected for
  focused source review.
- Add diagnostics that make paint-layer flattening decisions visible,
  especially source-shape id, occluding component ids, hidden residual layers,
  and whether flattening cleared a component transform.
- Improve correction routing when normalization changes invalidate source
  bindings.

## Visual Approval And Prepared SVG QA

- Add a visual approval gate for export-ready rendered output.
- Tie visual approval to exact source, reference, assignment, alignment,
  rendering, exporter, and validation inputs.
- Add prepared SVG export and validation review surfaces.
- Define the final prepared SVG promotion path once visual approval exists.

## Reference Setup Consolidation

- Clarify the long-term relationship between checked-in
  `scripts/data/asset-pipeline/references/<referenceSetId>/reference.json`
  data and the server's reference-structure review route.
- Decide whether reference-structure output should move under
  `scripts/output/asset-pipeline` or remain in the shared 3D output tree.

## Alignment And Assignment Improvements

- Add focused diagnostics for ambiguous repeated-member identity.
- Expand review affordances for low-confidence alignment cases.
- Improve correction routing from rendering failures back to the owning source
  or alignment decision.

## Rendering And Color Improvements

- Broaden generated glyph policy beyond the current house-label cases.
- Add richer diagnostics for color transfer and flattened complex source
  paints.
- Expand cutout review where negative-space source geometry affects generated
  inlay geometry.

## Asset Generation And Review

- Add publication or sync behavior for reviewed generated assets.
- Add stronger generated model validation before publication.
- Improve queue recovery and cancellation reporting.
- Fix generated asset preview PNG timeout/hang behavior so preview readiness
  can catch up after successful cutter, stamped body, and colored inlay stages.
- Decide where reviewed/published asset status should live once publication is
  implemented.

## Open Questions

- Should `assignment-scoring.md` stay standalone after more implementation
  notes are added, or merge into `source-review-contract.md`?
- Should rendering layout deserve its own doc if `rendering-contract.md`
  grows around transforms and viewBox policy?
- Should queue/review split from `generated-asset-contract.md` if publication
  adds more status vocabulary?
