## Stage 8: Prepared SVG Export

Description:

Prepared SVG Export is the future promotion step that will turn accepted visual
output into stricter, validated SVG artifacts. It is separate from today's
generated-asset input path.

Input SVG contract:

- Future stage, expected to consume accepted/reviewed final-rendering output.

Output SVG contract:

- Should produce promoted prepared SVGs plus validation artifacts.
- Prepared SVGs should be stricter than review SVGs: stable viewBox,
  deterministic element order where possible, valid XML, explicit paint, and no
  hidden dependency on source authoring quirks.
- Prepared SVG export is not the owner of cutter-friendly simplification.
  Cutter-2D Preparation owns that 3D-facing geometry handoff.

Current boundary:

- Prepared SVGs are not currently the generated-asset input.
- Do not make generated stages read prepared SVGs until the Visual Approval and
  Prepared SVG gates are promoted into the canonical flow.
- The current generated asset path skips this stage. Until it is active, the
  final-rendering color SVG is both the review/composition result and the SVG
  handoff consumed by generated asset stages.
