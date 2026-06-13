# SVG Stage Contracts

This document describes the SVG-shaped input and output contract at each stage
that reads, writes, previews, or consumes SVG geometry. It is intentionally
stricter than a visual description: the 3D asset pipeline depends on SVG
geometry being decomposed, reshaped, and emitted in forms that downstream
Three.js extrusion and cutter generation can handle.

The pipeline exists to preserve enough SVG structure for later stages to infer
semantic meaning, align donor artwork to project-owned reference structure,
recolor the artwork, and emit an SVG that can drive physical 3D geometry:
subtractive cutter volumes and correctly colored face inlay. The core tension
is that review and assignment need rich source evidence, while 3D generation
needs simpler, explicit, path-based geometry that can be extruded without
hidden browser-only SVG behavior.

Read each stage contract from the downstream need backward:

- A stage's input contract says what it must be able to rely on from previous
  stages.
- A stage's output contract says what later stages may rely on without
  reinterpreting earlier artifacts.
- A stage's boundary says what it must not decide, repair, or encode because a
  different stage owns that decision.

This document is therefore not just an artifact inventory. It defines the
minimum SVG information each stage needs and, from that, the required SVG or
SVG-derived output of the stages before it.

One important consequence is that early normalization does not have to output
geometry that is already acceptable to the cutter. Normalization may preserve
complex source evidence when that evidence is useful for meaning, alignment,
or color review. Cutter-friendly simplification will be owned by a dedicated
post-normalization, pre-cutter simplification stage instead of being hidden in
source normalization.

This contract is also a regression guard. Recent SVG fixes have often solved
one visible face or generated-asset problem while changing assumptions for
another stage. Future fixes should identify the stage that owns the problem,
update that stage's contract when needed, and avoid hidden one-off patches that
make later stages depend on accidental behavior.

## Table Of Contents

- [General Rules](#general-rules)
- [SVG Semantics](#svg-semantics)
- [Current SVG Handoff](#current-svg-handoff)
- [Known Handoff Gaps](#known-handoff-gaps)
- [Normalization Weaknesses To Track](#normalization-weaknesses-to-track)
- [Coordinate Spaces](#coordinate-spaces)
- [Pipeline Terms](#pipeline-terms)

## Stage Groups

### Intake

Intake stages establish the source/reference facts that later SVG processing
must preserve and explain.

- [Stage 0: Reference Setup](stage-00-reference-setup.md)
- [Stage 1: Tileset Intake](stage-01-tileset-intake.md)

### SVG Pre-Processing

SVG pre-processing stages turn raw donor artwork into reviewed, aligned, and
rendered SVG output without yet treating it as physical 3D geometry.

- [Stage 2: Source Normalization](stage-02-source-normalization.md)
- [Stage 3: Optional Part Assignment](stage-03-optional-part-assignment.md)
- [Stage 4: Source Alignment](stage-04-source-alignment.md)
- [Stage 5: Source Assignment](stage-05-source-assignment.md)
- [Stage 6: Final Rendering Composition](stage-06-final-rendering-composition.md)

### Handoff

Handoff stages accept or promote rendered SVG output, prepare cutter-facing SVG
geometry, and plan generated-asset work for the selected base tile.

- [Stage 7: Visual Approval](stage-07-visual-approval.md)
- [Stage 8: Prepared SVG Export](stage-08-prepared-svg-export.md)
- [Stage 9: Cutter-2D Preparation](stage-09-cutter-2d-preparation.md)
- [Stage 10: Base Tile Selection And Asset Planning](stage-10-base-tile-selection-and-asset-planning.md)

### 3D Generation

3D generation stages consume the accepted SVG handoffs and base-tile selection
to produce cutter, stamped body, colored inlay, and review preview artifacts.

- [Stage 11: SVG Cutter Generation](stage-11-svg-cutter-generation.md)
- [Stage 12: Stamped Body Generation](stage-12-stamped-body-generation.md)
- [Stage 13: Colored Inlay Generation](stage-13-colored-inlay-generation.md)
- [Stage 14: Asset Review And Preview](stage-14-asset-review-and-preview.md)

## General Rules

- SVG artwork is visual evidence until a stage makes it canonical for its own
  purpose.
- Raw source ids are extraction ids, not semantic ids.
- SVG element structure is authoring structure, not automatically visual or
  semantic structure. Groups, ids, classes, symbols, and use instances are
  evidence that can help preserve provenance, but visible geometry, paint,
  transform, and fill behavior determine what downstream stages may treat as
  actual artwork.
- Review stages may show diagnostic SVGs, but mutable decisions live in
  `pipeline.json`.
- Generated asset stages consume the cutter-2D SVG prepared from the
  final-rendering color SVG and recorded at
  `assetPipeline.faces[faceKey].artifacts.cutterSvg`.
- Prepared SVG export is a future QA/promotion surface. It is not currently the
  generated-asset input.
- Cutter-2D Preparation owns cutter-friendly geometry cleanup between
  accepted/rendered SVG output and SVG Cutter Generation.
- Stages should fail loudly when required geometry or artifacts are missing.
  Silent fallback SVGs create stale hidden contracts.
- Rich review geometry and cutter-ready geometry are not the same artifact
  unless a stage explicitly declares that they are. Do not make normalization
  discard useful semantic/alignment evidence merely because the cutter would
  prefer simpler geometry.

## SVG Semantics

The pipeline treats SVG as a vector graphics language with authoring
provenance, not as a semantic markup language for Mahjong tiles. Stage
contracts should be grounded in these SVG semantics:

- **Visible geometry** comes from drawable elements after supported transforms,
  paint, opacity, and visibility-like evidence are considered. A path that is
  present in source text but has no visible fill or stroke is not visible
  artwork.
- **Path data** is the preferred durable geometry handoff. Shapes such as
  circles, ellipses, rectangles, polygons, polylines, lines, and text should be
  converted to path data when a later stage needs geometry rather than author
  intent.
- **Fill and stroke are different geometry contracts.** Filled paths describe
  areas. Strokes describe outlines around a centerline. A stroke that should
  become physical cutter or inlay geometry must eventually become explicit
  filled path geometry or be handled by a stage that declares stroke support.
- **Fill rule is geometry, not styling trivia.** `evenodd` and nonzero fill
  behavior control holes and compound path interiors. Stages must preserve
  meaningful fill-rule evidence until they explicitly resolve it into path
  geometry.
- **Compound paths can contain multiple visual units.** Multiple islands,
  holes, and separated bands may be one authored path but several useful visual
  units. Splitting those units is valid only when the split preserves the
  source-element provenance and does not detach real holes from their parent
  exterior.
- **Transforms are part of the geometry contract.** Bounds, centers,
  alignment, and rendering must know whether path data is still in source-local
  coordinates with a transform, or has been baked into transformed
  coordinates.
- **Groups and ids are provenance evidence.** They can identify parentage,
  source layers, reuse, and authored organization, but they do not prove that a
  component is a dot, label, bamboo mark, or any other semantic part.
- **`use`/symbol-style reuse creates source instances.** Repeated visual units
  may share authoring provenance while appearing at different positions.
  Normalization should preserve instance evidence so later stages can align and
  assign repeated motifs without confusing one occurrence for another.
- **Paint servers and CSS are visual evidence.** Simple inherited paint should
  be resolved where possible. Unsupported gradients, masks, clips, filters, or
  CSS features must either be expanded into explicit geometry/paint evidence by
  an owning stage or treated as a review risk.
- **White paint is ambiguous in this project.** In ordinary SVG semantics,
  white is visible paint. In Mahjong face sources, white often represents tile
  body, background, or negative space. The pipeline therefore treats raw white
  and near-white neutral source geometry as negative-space evidence by default,
  unless a rendering policy explicitly declares that a part needs visible white
  pigment.
- **`viewBox` defines the SVG coordinate frame.** Source SVG `viewBox` values
  describe donor artwork space. Final-rendering SVG `viewBox` values describe
  prepared face space. Generated SVG consumers map the final `viewBox` into
  physical tile-face dimensions.

## Current SVG Handoff

The active SVG-processing chain is:

```text
source SVG
-> normalized component JSON
-> add-optional diagnostic SVG
-> layout diagnostic SVG
-> final-rendering color SVG
-> cutter-2D SVG
-> SVG Cutter Generation / Colored Inlay Generation
```

The active cutter-facing SVG chain has an explicit simplification handoff:

```text
final-rendering color SVG
-> cutter-2D SVG
-> SVG Cutter Generation / Colored Inlay Generation
```

The durable SVG-stage handoffs are:

- `svgPipeline.faces[faceKey].artifacts.sourceSvg` points at the raw donor
  SVG copied or referenced by intake.
- `svgPipeline.faces[faceKey].artifacts.normalizedComponents` points at the
  normalized source-geometry inventory JSON.
- `svgPipeline.faces[faceKey].artifacts.finalRenderingColorSvg` points at the
  rendered visual output.
- `assetPipeline.faces[faceKey].artifacts.cutterSvg` points at
  `images/cutter-2d-svg/<faceKey>.svg`, the cutter geometry SVG handoff.

The add-optional and layout SVGs are diagnostic review surfaces. They help
explain the final-rendering composition steps, but generated asset stages
should not consume them as canonical input. Prepared SVGs are also not active
generated-asset inputs yet.

Generated assets preserve two SVG handoffs: the cutter-2D SVG is the active
cutter geometry input, while the final-rendering color SVG remains the
colored-inlay paint/material input. Both live in prepared face coordinates so
recesses and inlay stay aligned without forcing the inlay stage to consume the
unioned cutter geometry.

## Known Handoff Gaps

This section records current places where one stage's output is useful but not
yet sufficient for the next stage's needs. Treat these as pressure points for
future design work, not as permission to add hidden downstream patches.

- **Reference Setup -> Source Alignment**: reference parts and target bounds
  are semantically useful, but their component decomposition may not match
  source decomposition. Alignment still has to bridge mismatched grouping and
  repeated motifs with analog matching.
- **Tileset Intake -> Source Normalization**: intake preserves source SVGs and
  may add explicit background hints, but it does not declare all unsupported
  SVG semantics up front. Normalization can still encounter masks, clips,
  filters, complex CSS, gradients, or unsupported transforms that are only
  partially represented. In SVG terms, the raw DOM may depend on rendering
  semantics that are not visible from supported path/paint extraction alone.
- **Source Normalization -> Optional Part Assignment**: normalized components
  expose geometry, paint, provenance, and OCR evidence, but they do not provide
  a fully reliable "this is a label" or "this is a glyph" signal. Optional
  assignment still relies on scoring and review. SVG text, paths converted
  from text, and hand-drawn label paths can all be visually equivalent while
  carrying very different source evidence.
- **Source Normalization -> Source Alignment**: source shapes are useful visual
  units, but not guaranteed semantic units. Some source geometry may be split
  more finely than alignment wants, while other source shapes may still combine
  visual units that alignment would prefer separate. This is a direct SVG
  semantics problem: one authored path can contain several filled islands, and
  several authored paths can visually form one motif.
- **Optional Part Assignment -> Source Alignment**: accepted or reserved
  optional parts protect labels and glyphs, but unresolved optional parts can
  still leave alignment guessing whether small corner marks are labels/glyphs
  or ordinary artwork.
- **Source Alignment -> Source Assignment**: compact alignment matches are not
  always semantically precise enough. When a match resolves to zero or multiple
  reference parts, Source Assignment has to warn or route review instead of
  accepting a clean binding.
- **Source Assignment -> Final Rendering**: accepted meaning is not enough by
  itself. Final Rendering still needs usable component geometry, meaningful
  fill rules, related negative-space evidence, and placement transforms.
- **Final Rendering -> SVG Cutter Generation / Colored Inlay Generation**:
  the final-rendering color SVG is currently both the review/composition
  output and the generated-asset SVG input. This is the largest active tension:
  a visually correct SVG is not always the same thing as cutter-ready SVG
  geometry. SVG permits valid visual output through strokes, compound fill
  rules, transforms, paint order, and opacity; cutter/inlay generation prefers
  explicit filled areas with unambiguous holes and concrete colors.
- **Final Rendering -> SVG Cutter Generation**: final rendering now converts
  visible strokes, preserves fill rules, prunes degenerate subpaths, recombines
  fragments, and handles knockouts, but cutter generation still keeps
  defensive stroke and geometry cleanup. That defensive code is evidence that
  the handoff is not yet a fully explicit cutter-ready SVG contract.
- **Final Rendering -> Colored Inlay Generation**: inlay generation relies on
  final rendering to make color policy explicit. White/body/negative-space
  ambiguity must be resolved before this handoff, or inlay will have to guess
  whether white means visible pigment or tile body. Ordinary SVG semantics say
  white is visible paint; this project often treats white as body/negative
  space, so the ambiguity must be intentionally resolved.
- **SVG Cutter Generation -> Stamped Body Generation**: any SVG-side defect
  that survives cutter generation becomes physical geometry. Stamped Body
  Generation cannot tell whether internal walls, over-fragmentation, bad
  stroke handling, or bad path cleanup are intentional.
- **Stamped Body Generation -> Colored Inlay Generation**: both stages depend
  on the same final SVG coordinate contract. If cutter cleanup changes geometry
  differently from inlay geometry, recesses and colored inlay can diverge.
- **Colored Inlay Generation -> Asset Review And Preview**: preview consumes
  the generated GLB, not the SVG stage history. A bad preview cannot by itself
  identify whether the cause was normalization, assignment, rendering, cutter
  cleanup, material placement, or preview runtime behavior.

The main structural gap was the missing explicit cutter-readiness handoff.
Final Rendering now owns the visual-review output, and Cutter-2D Preparation
owns the generated-asset SVG input. That separation keeps 3D geometry cleanup
out of source normalization so fixes for physical generation do not damage
source evidence or review semantics.

## Normalization Weaknesses To Track

The current normalizer deliberately handles a practical subset of SVG rather
than full browser rendering. These weaknesses are important because they can
cause ambiguity to survive into later stages, or can make normal source SVG
constructions appear simpler, flatter, or more fragmented than they really
are.

- **Scanner instead of full SVG DOM/layout**: normalization reads tags and
  inherited group state from source text. It does not evaluate the full SVG
  rendering model. This can miss meaning encoded through DOM ordering,
  external styles, nested definitions, inherited presentation attributes beyond
  the supported set, or browser-specific rendering behavior.
- **Limited transform support**: only `matrix`, `translate`, `scale`, and
  `rotate` are supported. SVG constructions using `skewX`, `skewY`, transform
  lists with unsupported functions, transform origins expressed through CSS,
  or transforms hidden inside unsupported containers can produce wrong bounds,
  centers, or alignment evidence.
- **Limited CSS support**: simple class rules and direct/inline presentation
  attributes are handled, but general CSS selectors, specificity, cascades,
  media rules, inherited custom properties, and external stylesheets are not a
  full contract. A visually painted element may be under-painted,
  mis-painted, or treated as invisible if its paint depends on unsupported CSS.
- **Paint servers are not expanded into geometry**: gradients and other paint
  servers can carry useful color evidence, but normalization does not fully
  render them. Later stages may see only representative or unresolved paint
  evidence, which weakens color inference and recoloring.
- **Masks, clips, and filters are not resolved**: SVG masks, clip paths, and
  filters can radically change visible geometry. If they matter visually but
  are not expanded before or during normalization, component bounds and path
  areas can describe authored geometry rather than visible geometry.
- **`defs`, `symbol`, and `use` expansion is partial**: source-use evidence is
  preserved when explicit `data-source-use` grouping exists, but arbitrary
  `<use>`/`symbol` indirection is not a guaranteed full expansion contract.
  Reused motifs can therefore lose instance-level clarity unless intake or
  earlier preparation makes reuse explicit.
- **Stroke semantics are evidence, not final area geometry**: normalization can
  preserve stroke paint and stroke width, but a visible stroke is not the same
  as an explicit filled region. Until final rendering or a simplification stage
  converts strokes to filled paths, later stages may still disagree about
  bounds, joins, caps, and physical area.
- **Compound-path splitting is heuristic**: island and band splitting preserve
  important real-world SVG structure, but SVG fill semantics can be subtle.
  Complex self-intersections, nested contours, mixed fill rules, or tiny
  degenerate subpaths can still create ambiguity about which subpaths are
  independent visual units and which are holes.
- **White/negative-space classification is project-specific**: SVG itself
  treats white fill or stroke as visible paint. The pipeline marks literal white
  and near-white neutral paint as negative-space evidence by default because
  Mahjong sources often use those colors for tile body or cutouts. This can
  misclassify real white pigment unless rendering policy or source metadata
  makes the exception explicit.
- **Authoring groups are not semantics**: parent groups, ids, classes, and
  layer names can help recover provenance, but they may reflect illustrator
  workflow rather than visual or Mahjong meaning. Shape combining based on
  source-use or contained layers must preserve the member component handles
  inside the current normalized artifact because the group may later prove
  semantically mixed.
- **Bounds are approximations of supported visible geometry**: bounds and
  centers are computed from supported path geometry after supported
  transforms. They may not match browser-visible bounds when strokes, filters,
  masks, clips, unsupported transforms, or paint server effects matter.
- **Opacity and visibility are simplified**: opacity fields are tracked, and
  tiny low-opacity dust is discarded, but the full interaction of group
  opacity, display/visibility, masks, and compositing is not a complete SVG
  rendering model. A component can therefore remain as evidence even when a
  browser would hide it, or be dropped even when it was visually meaningful.
- **Text conversion depends on available fonts**: SVG `text` can be converted
  to paths only when a suitable font can be resolved. Missing or substituted
  fonts can change glyph shape, bounds, OCR evidence, and optional label/glyph
  scoring.
- **Paint-layer flattening is intentionally bounded**: flattening removes
  later opaque layers from earlier opaque fills only inside one identified
  source shape. This prevents some stacked 3D solids, but overlapping layers
  between separate source shapes intentionally survive so repeated motifs are
  not accidentally merged.

When one of these weaknesses affects a face, the preferred fix is to identify
which SVG semantic is missing from the contract, then either expand that
semantic into explicit normalized evidence, add source metadata/hints, or route
the correction to a later rendering/simplification stage. Avoid patching a
downstream generated asset stage to compensate for normalization ambiguity
unless the downstream stage truly owns that SVG semantic.

## Coordinate Spaces

The SVG pipeline currently uses these named coordinate spaces:

- **Raw source space**: the donor SVG's own `viewBox` and source transforms.
  Intake preserves it. Normalization records component geometry and transform
  evidence from it.
- **Normalized source space**: normalized component artifacts still describe
  source-derived geometry with source bounds, centers, and transforms. They are
  suitable for review, alignment, and assignment, but they are not final tile
  face output.
- **Prepared face space**: final layout and color SVGs are emitted in the
  prepared tile-face `viewBox` `0 0 94 136`.
- **Base tile face rectangle**: generated SVG consumers normalize the
  final-rendering color SVG `viewBox` into the selected base tile's physical
  face rectangle before cutter or inlay geometry is created.

When SVG geometry moves between these spaces, the owning stage should record
the placement evidence it used. Later stages should consume the recorded
artifact and placement contract instead of reinterpreting earlier diagnostic
SVGs.

## Pipeline Terms

- **Face key**: canonical tile-face id such as `b-1`, `dragon-w`, or
  `flower-1`.
- **Reference**: the project-owned target structure for a face. Reference data
  owns intended Mahjong parts, target bounds, and colors.
- **Source**: donor SVG artwork from a tileset. Source data owns visual style,
  but its ids and grouping are not trusted as semantic truth.
- **Part**: a semantic reference unit, such as a dot, bamboo mark, label,
  dragon mark, wind glyph, or main artwork region.
- **Optional part**: a semantic part that may be source-rendered, generated by
  the pipeline, or omitted depending on the source and rendering policy.
  Examples include small labels or helper glyphs that some source tilesets
  draw and others do not.
- **Component**: a normalized source geometry candidate extracted from the SVG.
  Components are visual units, not semantic meanings.
- **Source shape**: a cohesive group of one or more components that appear to
  belong together because of provenance, reuse, or contained-layer structure.
  Source shapes are still non-semantic; they are selection/alignment units, not
  Mahjong meanings.
- **Binding**: a reviewed association between a source component and a
  semantic part.
- **Source absence**: an accepted fact that the source does not provide a
  particular optional or semantic part.
- **Generated glyph**: pipeline-created SVG geometry used when the source does
  not supply an accepted part but rendering policy still wants it visible.
- **Final-rendering color SVG**: the current canonical SVG input for generated
  3D assets.
- **Prepared SVG**: future promoted/validated SVG output. It is not currently
  the generated-asset input.
- **Cutter-ready SVG geometry**: SVG path geometry that has been simplified or
  normalized enough for downstream extrusion and subtraction. This is a later
  handoff requirement, not a blanket requirement for source normalization.
- **Cutter**: a 3D volume generated from SVG artwork and subtracted from the
  base tile body to create recesses.
- **Stamped body**: the base tile body after cutter subtraction.
- **Colored inlay**: colored 3D geometry placed into the stamped recesses.
