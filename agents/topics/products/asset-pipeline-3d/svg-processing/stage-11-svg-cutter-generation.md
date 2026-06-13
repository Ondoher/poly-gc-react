## Stage 11: SVG Cutter Generation

Description:

SVG Cutter Generation turns the cutter-2D SVG artwork into 3D cutter volumes.
Its job is to produce subtractive geometry that can carve recesses in the
selected base tile without preserving unwanted internal walls.

Input SVG contract:

- Reads the cutter-2D SVG path recorded at
  `assetPipeline.faces[faceKey].artifacts.cutterSvg`.
- Expects visible artwork paths in prepared face SVG coordinates.
- White tile body/background paths are ignored as non-cutter artwork.
- Filled paths are the normal cutter source.
- Defensive stroke handling can remain for older artifacts, but current final
  rendering should emit visible strokes as filled paths.
- The current implementation parses the cutter-2D SVG with `SVGLoader`, consumes
  visible fill paths and defensively consumes visible stroke paths, ignores
  tile-body white, and normalizes from the SVG `viewBox` into the
  selected base tile face rectangle.
- Cutter generation treats SVG fills as area geometry for extrusion. Stroke
  support is defensive compatibility; the preferred semantic handoff is filled
  path geometry whose holes and islands are already explicit.

Output contract:

- Writes `models/svg-cutter/<faceKey>.glb`.
- Writes `json/svg-cutter/<faceKey>.json` with source SVG, placement, target
  rect, selected base tile, cutter depth, geometry mode, and diagnostics.
- Cutter geometry is normalized from the final SVG `viewBox`/full-face space
  into the selected base tile face rectangle.
- Cutter extrusion direction is `-Y`, with top surface placement recorded in
  metadata.

Cutter limitations:

- Whole-face CSG union is not reliable for traditional ornamental artwork.
  A face can be under simple path-count or triangle-count limits and still
  make CSG generation hang or produce unusable geometry.
- Multi-component faces may use clustered unions plus closed merged path
  solids when whole-face CSG union is too expensive.
- Single-component cutters may remain direct extrusions.
- Cleaning adjacent side walls is a risky geometry fallback, not a semantic
  merge. It must not be used when it opens the cutter mesh or removes true
  exterior walls and legitimate holes.
- Bounding-box overlap alone is not enough to decide adjacency. Large concave
  or diagonal shapes can overlap in bounds while their painted footprints do
  not touch.
- Cutter cleanup should use projected footprint contact where possible.
- The cutter should not repair source-layer overlap that normalization could
  have removed with source provenance. It only cleans the geometry it receives.
- Generated labels/glyphs may use a lower curve-segment budget than source
  artwork during cutter extrusion so small isolated text marks do not create
  excessive tiny triangles for CSG.
- Cutter generation assumes the incoming SVG is already explicit enough to be
  parsed into paths and shapes. If it cannot consume the SVG without broad
  repair, the missing work belongs in Cutter-2D Preparation rather than in
  cutter generation.
