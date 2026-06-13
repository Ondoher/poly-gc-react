## Stage 3: Optional Part Assignment

Description:

Optional Part Assignment decides how source evidence relates to semantic parts
that are not always drawn by every tileset. It records whether those parts are
available from source geometry, accepted as absent, or left for generated
output policy.

Input SVG contract:

- Uses normalized component geometry and source/source-preview SVGs as visual
  evidence.
- The stage must treat normalized component ids as candidate source geometry,
  not meaning.

Output contract:

- No canonical render SVG is produced.
- The stage records whether optional source parts are bound, unbound/source
  absent, or protected from being absorbed into ordinary artwork matching.
- Preview SVGs must draw normalized component paths directly when showing
  parts, so compound holes and normalization splits match the actual component
  artifact.

Boundary:

- Optional absence is an accepted source fact. Later alignment and assignment
  must not reserve components for optional parts that have already been
  accepted as unbound/source-absent unless new source evidence invalidates that
  fact.
- Optional Part Assignment does not decide whether the final SVG shows a
  generated or omitted part. Final Rendering owns final visibility and output
  policy.
- The current implementation scores optional label/glyph candidates from
  normalized alignment-eligible components, supports manual assignments, and
  writes optional part facts plus tentative/strong source bindings into
  canonical model state.
- Alignment relies on this stage to protect likely labels and flower/season
  glyphs from being absorbed into ordinary artwork matching.
