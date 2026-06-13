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
