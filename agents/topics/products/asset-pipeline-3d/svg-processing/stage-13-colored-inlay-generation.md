## Stage 13: Colored Inlay Generation

Description:

Colored Inlay Generation places colored geometry into the stamped recesses
using the final-rendering color SVG for paint/material regions and the
stamped/cutter artifacts produced from the cutter-2D SVG. It produces the
visible carved-and-inlaid tile asset.

Input SVG contract:

- Reads the final-rendering color SVG and the stamped body/cutter metadata.
- Uses the same prepared-face SVG viewBox-to-tile-face normalization as cutter
  generation.
- Filled final-rendering paths are the normal source of colored inlay meshes.
- Defensive stroke handling can remain for older artifacts, but current final
  SVGs should have converted visible stroke-only artwork to filled geometry.
- The current implementation parses visible fill paths and defensively parses
  visible stroke paths, ignores body-like colors, maps inlay geometry through
  the same target rect as cutter generation, and places physical inlay as
  filled inserts from just above the recess floor to a small inset below the
  tile face. It preserves painter order by subtracting later paint-order
  geometry from earlier inlay meshes instead of stacking layers at different
  depths. Generated labels/glyphs may use a lower curve-segment budget than
  source artwork to avoid tiny-triangle artifacts in small isolated marks.
- Colored inlay treats SVG paint order and paint color as material evidence.
  Source colors should already have been resolved by final rendering into the
  intended output colors; inlay generation should not infer color semantics
  from source provenance.

Output contract:

- Writes `models/colored-inlay/<faceKey>.glb`.
- Writes `json/colored-inlay/<faceKey>.json`.
- The GLB contains the stamped body plus colored inlay meshes.
- Inlay colors are solid material regions derived from final-rendering paint.

Boundary:

- Inlay generation should visually agree with cutter placement because both
  SVG inputs share the same prepared face coordinate contract.
- If the inlay and recess disagree, first check whether the final-rendering SVG
  and cutter-2D SVG used the same viewBox/coordinate contract, target rect, and
  stage hashes.
- Body-like colors such as tile white are ignored by the inlay SVG consumer.
  Visible white pigment needs an explicit rendering decision that distinguishes
  it from tile body/background or negative-space knockout behavior.
- Colored Inlay Generation should not infer source semantics or repair source
  assignment. It may only interpret the final SVG's explicit visible paint as
  material regions.
