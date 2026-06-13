## Stage 9: Cutter-2D Preparation

Description:

Cutter-2D Preparation is the active post-rendering, pre-cutter stage that turns
accepted rendered face artwork into geometry shaped for cutter and inlay
generation. It exists to remove cutter-specific pressure from Source
Normalization and Final Rendering.

Input SVG contract:

- Consumes accepted final-rendering SVG output in prepared face coordinates.
- May also read normalized component provenance and rendering diagnostics when
  needed to preserve traceability, but it must not reinterpret source meaning
  or reopen assignment decisions.
- Treats the final rendered SVG as the visual truth for accepted output. If the
  visual output is wrong, route the correction back to normalization,
  assignment, alignment, or final rendering.

Output SVG contract:

- Produces `images/cutter-2d-svg/<faceKey>.svg` and records it as
  `assetPipeline.faces[faceKey].artifacts.cutterSvg`.
- The cutter-2D SVG should be valid XML/SVG in the same prepared face
  coordinate contract as final rendering.
- Visible cutter/inlay geometry should be explicit filled paths with concrete
  paint and unambiguous holes. Stroke-only artwork should already be resolved
  or converted before cutter generation consumes it.
- The current implementation runs the Paper.js `unite-all` flattening pass with
  flatness `0.05`.
- Preparation may recombine, simplify, prune, union, subtract, or otherwise
  reshape geometry when doing so preserves accepted visual meaning and improves
  cutter/inlay robustness.
- Preparation should preserve diagnostics or provenance pointers sufficient to
  explain which rendered/source evidence produced each simplified output path.

Build profile notes:

- Cutter-2D Preparation should accept an explicit generated-asset build profile
  rather than hiding quality/speed choices in the cutter.
- A fast/review profile may union cutter-visible geometry at the SVG level,
  ignore color for the cutter footprint, use controlled curve flattening or
  simplification, and hand the cutter geometry that can skip expensive 3D CSG
  unioning.
- A full-quality profile should preserve the current high-detail rendering
  complexity and favor curve/detail fidelity over throughput, using the cutter
  and inlay paths needed for final reviewable assets.
- Curve quality should be a profile-controlled simplification concern:
  flattening tolerance, path simplification tolerance, and export precision
  should be tuned here before the SVG reaches 3D extrusion.
- Any profile used to prepare the cutter SVG must also be visible to downstream
  generated-asset hashing and to SVG Cutter Generation. Fast artifacts must not
  be treated as equivalent to full-quality artifacts.

Boundary:

- This stage owns cutter-facing geometry simplification, not source evidence
  extraction, semantic assignment, layout, color policy, or GLB generation.
- It may simplify accepted rendered geometry for physical generation, but it
  must not change which Mahjong parts are present, where they are placed, or
  what visible color policy final rendering selected.
- SVG Cutter Generation and Colored Inlay Generation consume the same cutter-2D
  SVG.
