## Stage 6: Final Rendering Composition

Description:

Final Rendering composes the accepted source and reference facts into the
current canonical SVG face. It chooses what appears, where it appears, and how
it is painted before generated asset stages consume the result.

Input SVG contract:

- Consumes accepted source bindings, accepted source absence, alignment
  placement fields, normalized component artifacts, reference structure, and
  effective rendering options.
- Source-rendered geometry comes from normalized components, not raw source
  SVGs.

Output SVG contract:

- Writes the canonical current generated-asset SVG:
  `images/final-rendering-color-svg/<faceKey>.svg`.
- Also writes diagnostic step SVGs for optional-output and layout review.
- The color SVG must be valid XML and valid SVG, because review PNG generation
  and 3D generation both consume it.
- Emitted paths must preserve meaningful `fill-rule`, especially `evenodd`.
- Emitted source geometry must be transformed into final tile-face coordinates
  and painted according to the selected color policy.
- The final color SVG should make SVG semantics explicit for later consumers:
  visible geometry should be path-based, paint should be concrete enough for
  color extraction, transforms should be intentional, and holes should be
  represented by valid path/fill-rule behavior or baked geometry.
- The add-optional diagnostic SVG may remain in normalized source space. The
  layout and color SVGs are emitted in prepared face space with `viewBox`
  `0 0 94 136`.
- The final-rendering color SVG is today's active production SVG handoff. It
  is the SVG consumed by current generated asset stages; prepared SVG export is
  not in that active handoff.

Shaping rules:

- If normalization split one original source element into multiple fragments,
  final rendering may recombine consecutive fragments that share original
  source provenance, paint, fill rule, and output transform.
- Recombined paths should be marked with
  `data-geometry-normalized="source-element-recombined"`.
- Filled evenodd paths should prune degenerate zero-area subpaths without
  removing legitimate holes. Pruned paths should be marked with
  `data-geometry-normalized="degenerate-subpath-pruned"`.
- Stroke-only visible artwork should be converted to filled path geometry.
  Regenerated final SVGs should not require downstream stages to understand
  stroke-only artwork.
- Stroke-to-fill conversion should emit continuous outline loops with
  `fill-rule="evenodd"`, not one triangle subpath per stroke triangle.
- Each original stroke subpath should become a separate filled path so evenodd
  evaluation stays local to that mark.
- Explicit non-positive-width stroke-only components are invisible and should
  be omitted.
- When multiple geometry normalizations apply, markers should be combined into
  one `data-geometry-normalized` attribute.
- Negative-space components related to painted source components may be
  subtracted from the emitted path geometry as knockouts. Emitted knockout
  paths should mark that evidence rather than leaving white paint paths for
  downstream stages to reinterpret.
- Final rendering may perform local SVG emission cleanup needed for visual
  correctness and valid review output, but broad cutter-facing simplification
  belongs to Cutter-2D Preparation rather than this stage.

Boundary:

- Final rendering owns visual output policy: source-rendered, generated, or
  omitted optional parts; layout; color; and generated glyphs.
- It should produce SVGs that are usable by the 3D pipeline, but it does not
  own cutter CSG behavior or GLB generation.
- Generated asset stages consume the cutter-2D SVG prepared from this color
  SVG. Broad cutter-facing simplification work should target Cutter-2D
  Preparation instead of becoming an implicit final-rendering side effect.
