## Stage 1: Tileset Intake

Description:

Tileset Intake brings donor SVG files into the pipeline, associates each file
with a canonical face key, and records the raw source artifact. It does not try
to make the SVG geometrically safe or semantically meaningful.

Input SVG:

- Source SVG files are accepted as authored donor artwork.
- The source may contain paths, groups, symbols, uses, transforms, strokes,
  fills, paint servers, metadata, invisible layers, and author-specific ids.
- Intake does not assume source ids mean bamboo, dot, label, flower, season, or
  any semantic part.
- Intake preserves authoring SVG semantics as source evidence. It may add
  explicit source-layer hints, but it should not collapse groups, bake
  transforms, resolve paint, split paths, or convert strokes.

Output SVG contract:

- The source SVG is copied or referenced as the face's durable source artifact.
- The output remains raw source artwork. It is not safe for alignment,
  assignment, final rendering, or 3D extrusion by itself.
- Intake owns inventory and routing only: which face key has which source SVG.
- The current implementation requires a manifest `faces` object, verifies each
  face source exists, copies the source SVG into the model-owned source area,
  and can annotate configured tile-background group/element hints with
  `data-source-layer="tile-background"`.

Boundary:

- Intake does not validate whether the source SVG can be normalized, aligned,
  rendered, or extruded. Missing source files fail here; geometric usability is
  established by later stages.
