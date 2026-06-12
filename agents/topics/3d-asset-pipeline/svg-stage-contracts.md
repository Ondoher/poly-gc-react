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
- [Stage 0: Reference Setup](#stage-0-reference-setup)
- [Stage 1: Tileset Intake](#stage-1-tileset-intake)
- [Stage 2: Source Normalization](#stage-2-source-normalization)
- [Stage 3: Optional Part Assignment](#stage-3-optional-part-assignment)
- [Stage 4: Source Alignment](#stage-4-source-alignment)
- [Stage 5: Source Assignment](#stage-5-source-assignment)
- [Stage 6: Final Rendering Composition](#stage-6-final-rendering-composition)
- [Stage 7: Visual Approval](#stage-7-visual-approval)
- [Stage 8: Prepared SVG Export](#stage-8-prepared-svg-export)
- [Stage 9: Cutter-2D Preparation](#stage-9-cutter-2d-preparation)
- [Stage 10: Base Tile Selection And Asset Planning](#stage-10-base-tile-selection-and-asset-planning)
- [Stage 11: SVG Cutter Generation](#stage-11-svg-cutter-generation)
- [Stage 12: Stamped Body Generation](#stage-12-stamped-body-generation)
- [Stage 13: Colored Inlay Generation](#stage-13-colored-inlay-generation)
- [Stage 14: Asset Review And Preview](#stage-14-asset-review-and-preview)

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

## Stage 0: Reference Setup

Description:

Reference Setup establishes what each Mahjong tile face is supposed to contain
before any source SVG is considered. It creates the target structure that later
SVG stages align to and render into.

Input SVG contract:

- None. Reference setup currently starts from reference face images and
  reference metadata, not source SVGs.

Output contract:

- No source SVG is produced.
- Reference setup owns semantic target structure: part ids, target bounds,
  colors, and generated glyph slots.
- Later SVG stages may align or render into this structure, but the reference
  structure is not donor SVG geometry.
- The current implementation extracts reference components from reference
  images, auto-assigns them to semantic parts from bootstrap data, and records
  prepared-space `targetBounds` for parts using the reference set's prepared
  `viewBox`.

Boundary:

- Reference geometry is the target contract, not a cutter or inlay source.
- Do not infer source SVG splitting rules from reference parts. Source
  normalization owns source decomposition.
- Later source stages assume reference parts and components are semantically
  trustworthy enough to align against. If reference structure is wrong, fix
  Reference Setup rather than compensating in source normalization.

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

## Stage 2: Source Normalization

Description:

Source Normalization converts raw source SVG artwork into a provenance-rich
geometry inventory. It extracts visible components, records paint and transform
evidence, filters background scaffolding, and performs limited shaping so later
review and generation stages can work from explicit geometry.

The stage has three distinct responsibilities:

- **SVG extraction**: interpret the supported SVG subset and convert supported
  visible geometry into path-based component records.
- **Evidence preservation**: keep enough provenance, paint, transform, fill
  rule, source order, source-use, grouping, and OCR evidence for later stages
  to infer meaning, alignment, layout, and color without rereading raw SVG
  authoring structure.
- **Limited early geometry repair**: remove or reshape authoring artifacts only
  when the evidence conditions are generic, auditable, and doing so does not
  erase meaning needed by review stages.

Meta-goals:

- Make source artwork legible to the pipeline by turning arbitrary authored
  artwork into a form the system can inspect, compare, review, and transform.
- Preserve origin and intent evidence so later stages can distinguish separate
  things from fragments of one thing.
- Separate visual structure from semantic meaning. Normalization identifies
  usable visual units without deciding what they mean in Mahjong terms.
- Expose meaningful parts without damaging meaning. Splitting should help
  review and alignment while preserving holes, grouping, and visual
  relationships that carry meaning.
- Preserve hard-won source transformations discovered from real SVGs. Shape
  combining, source-use grouping, contained-layer grouping, compound-path
  island/band splitting, paint-layer flattening, and subcomponent separation
  are part of the normalization contract when their evidence conditions are
  met, not disposable implementation details.
- Remove authoring artifacts before they become downstream defects. SVG
  construction details that are visually invisible or harmless in 2D can be
  harmful for alignment, rendering, or 3D generation.
- Keep decisions generic and evidence-based, grounded in geometry, paint,
  provenance, and visibility rather than face-specific exceptions.
- Create trustworthy review surfaces so human review reflects the actual data
  later stages will consume.
- Constrain complexity at stage boundaries so each stage hands off data the
  next stage can reliably process.

Input SVG:

- Raw source SVG from intake.
- The SVG can contain nested transforms, reused symbols, compound paths,
  partially overlapping opaque paint layers, strokes, and invisible helper
  elements.
- The current extractor is a lightweight SVG tag scanner, not a full browser
  layout engine. It reads supported geometry/text tags and inherited group
  state from the SVG source text.
- Normalization must decide which SVG semantics it supports explicitly. It can
  rely on supported geometry tags, simple inherited paint, supported
  transforms, source grouping, source-use evidence, and fill/stroke visibility.
  It must not pretend unsupported SVG rendering semantics were faithfully
  evaluated.

Output contract:

- Normalization writes normalized component artifacts, not a final visible SVG.
- Each component should describe a visible source geometry candidate with:
  path data, paint evidence, bounds, area, center, source provenance, transform
  evidence, and enough identity to trace it back to the source extraction.
- Components are non-semantic. A normalized component is not yet a bamboo,
  digit, dot, character, frame, flower petal, or optional label.
- Components are review/alignment evidence first. They may retain complexity
  that would be unacceptable as direct cutter input when that complexity helps
  later stages infer meaning, preserve source provenance, or make color/layout
  decisions.
- The artifact records the source `viewBox`, source file, component ids that
  remain eligible for alignment, source-shape ids that remain eligible for
  alignment, diagnostics, and debug SVG paths for identified components and
  source shapes.
- Component ids are internally unique opaque handles within the current
  normalized artifact. There is no guarantee that ids are deterministic from
  the source input or stable across normalization runs.
- A normalized component should carry the practical fields later stages read:
  `componentId`, source order/index fields, parent/subcomponent ids, source
  element id, tag/class, paint fields, bounds, center, area, parent groups,
  source-use evidence, transform, classification, and `pathData`.
- Source shapes are records with internally unique shape ids, component ids,
  source order, provenance fields, cohesion reason, class/paint summaries,
  bounds, center, area, and classification. They are derived first for
  paint-layer flattening evidence and then again after flattening for later
  alignment/assignment.
- Running Source Normalization invalidates all previously generated downstream
  results for the normalized faces. Optional assignment, alignment, source
  assignment, final rendering, generated asset state, fixtures, generated
  artifacts, hashes, and docs must be recreated from the new normalized
  artifact snapshot.

Guaranteed artifact fields:

- Later stages may rely on the normalized artifact to provide internally
  unique component ids, path data for supported visible geometry, source
  order/index fields, source element provenance, parent/subcomponent
  relationships, bounds, center, area, paint evidence, fill-rule evidence,
  transform evidence, classification flags, source-use evidence, source-shape
  records, alignment component ids, alignment shape ids, diagnostics, and debug
  SVG artifact pointers.
- Later stages may rely on component ids only as extraction/provenance ids.
  They must not treat those ids as semantic part ids, reusable cross-source
  identity, deterministic source-derived ids, or proof that the component is a
  Mahjong dot, bamboo, label, glyph, frame, flower petal, or any other part.
- Later stages may rely on source-shape records as cohesive visual-unit
  evidence. They must preserve member component handles within the same
  artifact snapshot when making semantic bindings or rendering decisions.
- The artifact should expose named evidence for normalizing transformations
  that changed geometry or grouping, such as split strategy, source-shape
  cohesion reason, paint-layer flattening metadata, hidden-by-flattening state,
  and source-use instance evidence.

Contractual non-goals:

- Normalization does not assign Mahjong meaning.
- Normalization does not choose final output policy, generated/omitted optional
  parts, final color, final layout, or base-tile generated asset readiness.
- Normalization does not guarantee cutter-ready geometry. Retained components
  can be complex, fragmented, stroke-bearing, transformed, or otherwise richer
  than the downstream 3D generator ultimately wants when that richness is
  useful evidence for review, assignment, alignment, or recoloring.
- Normalization does not faithfully evaluate the full browser SVG rendering
  model. Unsupported SVG semantics must be surfaced as diagnostics or review
  risk rather than silently treated as complete visual truth.

Diagnostics and failure modes:

- Missing source SVGs are reported as `missing-source-svg` and should not leave
  a fresh normalized artifact pointer for downstream stages to consume.
- If no alignment-eligible components remain after supported filtering, the
  artifact status should become `needs-review` with a diagnostic such as
  `no-alignment-components`.
- When a visually important SVG feature is unsupported, the owning fix is to
  expand that feature into explicit normalized evidence, add focused source
  metadata or intake hints, or route the face to review. Downstream generated
  asset stages should not invent semantic repairs for normalization ambiguity.

Current extraction details:

- Supported geometry tags are `path`, `circle`, `ellipse`, `rect`, `polygon`,
  `polyline`, and `line`.
- `text` is converted to path data with `opentype.js` when a suitable font can
  be resolved. Font lookup uses configured asset fonts first, then common
  system font directories.
- `circle`, `ellipse`, `rect`, `polygon`, `polyline`, and `line` are converted
  into path data before normalization records are written.
- Group nesting is tracked with a stack. Parent group ids, class name, paint,
  transforms, `data-source-layer`, and `data-source-use` are inherited by
  child geometry.
- Supported transform functions are `matrix`, `translate`, `scale`, and
  `rotate`, including rotate-about-point. Unsupported transform functions are
  ignored by the transform parser rather than evaluated.
- Class paint is read from simple `.class { ... }` CSS rules in `<style>`
  blocks. Inline style and direct attributes override inherited/group paint.
- Paint fields currently tracked are fill, stroke, stroke width, fill rule,
  fill opacity, stroke opacity, opacity, font size, and font family.
- `<defs>` are preserved for identified debug SVG output, but normalization
  does not expand arbitrary paint servers, masks, filters, or clips into new
  geometry.
- `data-source-use` groups create source-use instance records. Structural
  source-use ids such as `facesize` and `rect2236` are ignored when deriving
  cohesive source shapes.

Splitting and shaping rules:

- The normalizer may split source geometry when a single authored element
  contains multiple independently useful visible shapes.
- Splitting must preserve source provenance so later stages can identify
  fragments from the same original source element or `use` instance.
- Every extracted source element and split child must receive internally
  unique component handles within the current artifact. The naming pattern is
  an implementation detail.
- Subcomponent separation is a required capability, not a lossy cleanup step.
  When a single path contains separable visible islands or bands, the
  normalized artifact should expose those subcomponents so later stages can
  align, assign, recolor, or omit them independently while still tracing them
  back to the original source element.
- Compound-path holes are real artwork. Normalization must preserve fill rule
  evidence and hole-bearing path structure wherever possible.
- Splitting a compound path should respect SVG fill semantics. A hole-bearing
  island remains one component with its contained subpaths; a detached island
  or separated band may become a separate subcomponent only when the split does
  not change the intended filled area.
- Compound paths with multiple top-level islands can split into
  `compound-path-island` subcomponents. Contained subpaths remain with their
  containing island so holes are not detached from their parent exterior.
- Compound paths with one outer contour and separated interior bands can split
  into `compound-path-band` subcomponents by intersecting the original compound
  path with inferred horizontal or vertical band rectangles.
- Band splitting is deliberately conservative: it requires multiple separated
  clusters, comparable cluster spans/counts, and non-trivial mass in each band.
  If those checks fail, the compound path remains one component.
- `compound-path-band` subcomponents are treated as separable when deriving
  source-use shapes; they should not force an entire reused source instance to
  stay one source shape.
- Shape combining is also a required capability. The normalizer should group
  components into source shapes when provenance and geometry show they belong
  together, especially source-use instances, contained paint layers, and
  single-component shapes. This grouping gives alignment and assignment a
  coherent visual unit without erasing the member component handles inside the
  current artifact snapshot.
- Later opaque paint layers may be subtracted from earlier opaque fill layers
  only inside one identified source shape. This prevents layered self-overlap
  from becoming stacked 3D solids.
- That flattening must not subtract fragments from the same original source
  element/use from each other. Sibling fragments may need recombination later
  to preserve holes.
- That flattening must not subtract between separate identified source shapes,
  such as repeated dots, bamboo leaves, or repeated ornamental marks. Those
  shapes may overlap in bounds without being the same shape.
- Paint-layer flattening only applies to visible filled components with no
  visible stroke, full opacity, no tile-layer classification, and no
  negative-space classification.
- Occluders are later components in source order whose bounds overlap, whose
  center is inside the earlier component, whose source paint element differs,
  whose source shape id matches, and which do not fully contain the earlier
  component.
- Flattening applies transforms through Paper.js, writes flattened geometry in
  transformed coordinate space, clears the component transform, and records
  `paintLayerFlattening` evidence. Fully hidden or tiny residual layers are
  marked hidden by paint-layer flattening.
- Invisible source geometry, including explicit non-positive stroke width,
  should not become visible normalized geometry.
- Normalization should remove or flag degenerate geometry that cannot produce a
  meaningful filled area, but it must not fill legitimate holes just because a
  path is complex.

Classification and filtering details:

- Tile-layer candidates are identified from `data-source-layer="tile-background"`,
  geometry outside the viewBox, viewBox outline rectangles, known `st0`-`st6`
  class names, large background rectangles, and tile/background-like paint
  server ids.
- Negative-space candidates are detected from literal white or near-white
  neutral fill or stroke.
- Alignment components exclude tile-layer candidates, negative-space
  candidates, and components without visible paint.
- Negative-space candidates can still be used later as knockouts against
  related painted source components. Treating a white source path as knockout
  evidence is the default; a real visible white paint requirement must be made
  explicit by the owning rendering policy rather than inferred from raw white
  source paint alone.
- Identified component debug SVGs can still include negative-space cutouts when
  they overlap retained artwork, so review can see meaningful holes/cutouts.
  They render those candidates as debug outlines rather than solid source
  paint, because white or near-white negative space is not retained artwork.
- Tiny path dust is discarded before component records are created. Very small
  low-opacity paths are treated as invisible dust.
- Source shapes are derived after initial component formatting, then again
  after paint-layer flattening. Shapes can be grouped by source-use instance,
  contained-layer relationship, or single component.

3D implications:

- Normalization may prevent obvious downstream 3D defects when the defect is
  an authoring artifact that can be removed without losing source evidence,
  such as contained opaque paint layers inside one identified source shape.
- Normalization is not required to make every retained component directly
  cutter-ready. It can preserve complex or fragmented evidence for assignment,
  alignment, and recoloring because Cutter-2D Preparation owns the later
  cutter-facing SVG.
- Normalization is not the place to merge semantically separate motifs into one
  object. Cutter-facing simplification may clean geometry later, but it should
  not erase semantic distinctions needed by review stages.
- Current normalization does not fully resolve arbitrary SVG features such as
  masks, clip paths, filters, gradients, nested symbols without explicit
  extracted geometry, or unsupported transforms. If one of those features
  visually matters, the source intake/normalizer must either expand it into
  explicit path geometry or mark the face for review instead of silently
  treating the visual result as complete.

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

## Stage 4: Source Alignment

Description:

Source Alignment compares normalized source geometry to reference target
structure and records plausible placements. It answers where source components
can fit, without deciding final meaning or paint policy.

Input SVG contract:

- Reads normalized source components and reference geometry.
- Uses source bounds, centers, areas, and shape evidence; it does not consume a
  final render SVG.

Output contract:

- No canonical output SVG is produced.
- Alignment writes compact match and placement facts that describe how source
  components can fit reference semantic targets.
- Diagnostic SVGs may show matches, boxes, and transforms, but those are not
  durable SVG inputs for generation.
- The current implementation reads normalized components and source shapes,
  source optional-part facts from canonical state, and reference components.
  It writes compact alignment matches plus placement fields such as source
  bounds, target bounds, aligned bounds, and transforms back onto canonical
  part state.
- Alignment may also write diagnostic alignment artifacts, but final rendering
  relies on the compact model handoff and part placement fields.

Boundary:

- Alignment answers "where could this source geometry fit?"
- It does not decide final color, whether a generated optional part appears, or
  whether source geometry should be flattened for 3D.
- Alignment assumes normalized source components and source shapes are useful
  visual units. It should not require them to be semantic units or
  cutter-ready geometry.

## Stage 5: Source Assignment

Description:

Source Assignment turns alignment candidates into reviewed semantic bindings.
It answers what the selected source components mean in Mahjong terms and which
accepted source facts final rendering may use.

Input SVG contract:

- Reads normalized component facts plus alignment handoff and optional part
  state.
- May display source SVG previews and normalized component overlays.

Output contract:

- No canonical output SVG is produced.
- The stage records accepted bindings from source components to semantic
  reference parts and accepted source absence.
- Diagnostic review SVGs can show selected/bound geometry, but final rendering
  owns the first canonical composed SVG output.
- The current implementation consumes compact alignment matches from model
  state, expects a match to resolve to one reference part when possible, writes
  a semantic-map diagnostic artifact, and reconciles accepted bindings back
  into `state.bindings` and `state.parts`.

Boundary:

- Assignment answers "what does this source geometry mean?"
- It does not reshape source paths for 3D except by selecting which normalized
  components are eligible for rendering.
- Assignment depends on Alignment for placement. If a source component cannot
  be positioned, fix alignment or source normalization rather than hiding a
  transform decision in assignment.

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

## Stage 7: Visual Approval

Description:

Visual Approval is the future human gate for accepting the composed SVG result
as visually correct for exact inputs. It is intended to approve or route
corrections, not to introduce hidden SVG mutations.

Input SVG contract:

- Future gate, expected to review final-rendering SVG output and associated
  rendered previews.
- It should consume the current final-rendering SVG and exact input hashes, not
  raw source SVGs.

Output contract:

- No new SVG shape is owned by this stage unless the future design explicitly
  promotes a reviewed SVG artifact.
- Approval should record that the visual result is accepted for exact inputs.

Boundary:

- Visual Approval should not mutate normalized source geometry or silently
  patch final-rendering SVG text.
- Corrections should route back to the owning stage: normalization for source
  decomposition, assignment for meaning, rendering for output policy.
- This gate is not active in the current implementation. Current accepted
  final-rendering output can initialize generated asset state without a
  separate visual-approval record.

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

## Stage 10: Base Tile Selection And Asset Planning

Description:

Base Tile Selection and Asset Planning choose the physical tile body variant
and stage generated-asset work. The same rendered SVG becomes a different
generated asset when carved into a different base tile.

Input SVG contract:

- Does not read SVG text directly.
- Planning hashes source/review/rendering state and the selected base tile,
  then stages generated asset work for the final-rendering SVG artifacts.

Output contract:

- No SVG is produced.
- The selected base tile variant and generated-asset queue are recorded under
  `assetPipeline` and the persisted queue file.

Boundary:

- Base tile selection changes the generated-asset input hash, because the same
  final-rendering SVG carved into a different body is a different generated
  asset.
- Planning should not rewrite final-rendering SVGs or prepared SVGs.
- The current implementation hashes source/review/rendering state together
  with the selected base tile variant and initializes or refreshes generated
  asset state under `assetPipeline`.
- Planning assumes the rendered SVG artifact already exists. If the SVG is
  missing or stale, rerun the SVG-owning stages rather than fabricating a build
  fallback.

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

## Stage 12: Stamped Body Generation

Description:

Stamped Body Generation subtracts the cutter from the selected reusable base
tile. It is where SVG-derived cutter defects become physical recess defects if
the cutter contract was not clean enough.

Input SVG contract:

- Does not read SVG directly.
- Reads the selected base tile GLB and the cutter GLB/metadata generated from
  the final-rendering SVG.

Output contract:

- Writes `models/stamped-body/<faceKey>.glb`.
- Writes `json/stamped-body/<faceKey>.json`.
- The stamped body is a base tile with the cutter geometry subtracted.

SVG boundary:

- Any visible SVG defect present in the cutter input will be carved into the
  body.
- Any cutter-side internal wall that survives Stage 11 can appear as unwanted
  recess walls after subtraction.
- Stamped body generation should not reinterpret SVG semantics. If it needs
  semantic knowledge, the contract is wrong upstream.
- The current implementation reads only the selected base tile and cutter
  artifacts. It does not read source SVGs or final-rendering SVGs directly.
- At this point SVG issues have become geometry issues. Fix bad source
  meaning, layout, color, or simplification upstream instead of adding
  semantic SVG logic to stamped body generation.

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

## Stage 14: Asset Review And Preview

Description:

Asset Review presents generated asset readiness and preview state. It
synthesizes status from hashes, artifacts, and queue state rather than
reinterpreting SVG geometry.

Input SVG contract:

- Asset Review does not own SVG state.
- Preview PNG generation consumes the generated GLB, not source SVG, but its
  readiness is hashed with the generated asset stage inputs.
- Final-rendering review PNGs consume the final-rendering SVG text through
  Sharp and therefore require valid XML.
- Final-rendering review PNGs and generated asset preview PNGs are separate
  preview surfaces. The first validates/render-previews SVG text; the second
  previews generated geometry.

Output contract:

- Asset Review synthesizes face state from `assetPipeline`, generated artifact
  existence, hashes, and live/persisted queue state.
- It should show queued/building/stale/ready based on generated asset state,
  not by reinterpreting SVGs.

Boundary:

- A stale preview PNG does not mean cutter/stamped/inlay geometry is stale.
  The stage hashes distinguish those facts.
- Preview renderer timeout issues should not cause SVG normalization or cutter
  contracts to drift.
- The current generated asset preview consumes the final colored-inlay GLB,
  not source SVG text. Preview failures should be handled as preview/runtime
  issues unless the generated model itself proves that an upstream SVG contract
  was violated.
