# Stage 2 Source Normalization Prompt

Use this prompt when assigning an agent to recreate or substantially refactor
Stage 2 Source Normalization.

## Purpose

Stage 2 turns a raw source SVG into a trustworthy, explainable inventory of
source-side geometry and evidence.

Its purpose is to answer: what meaningful source artwork exists, where did it
come from, what does it look like, and what evidence should later stages
preserve or review?

It does not decide Mahjong semantics, final colors, final layout, or
cutter-ready geometry. Instead, it extracts normalized components, groups them
into source shapes, preserves provenance like source order, groups, classes,
source-use instances, paint, and transforms, flags unsupported or risky SVG
behavior, and writes a durable JSON artifact that downstream stages can use
for optional-part detection, alignment, binding, rendering, and review.

In short: Stage 2 is the evidence-preserving bridge between messy authored SVG
and the rest of the asset pipeline.

## Assignment

Recreate the existing Stage 2 Source Normalization behavior in a cleaner,
better-contracted implementation, and address the known normalizer weaknesses
without moving semantic, rendering, or cutter-specific responsibility into this
stage.

The new implementation should preserve the current normalizer's contract-level
results for the existing face set: useful visual units, provenance, grouping,
classification, and alignment eligibility should remain explainably equivalent
unless the contract is deliberately changed. Implementation details such as the
exact id string format, helper decomposition, ordering tie-breaks, or numeric
rounding may change when the new implementation provides the same or better
contract-level evidence.

Running Source Normalization invalidates all previously generated downstream
results for the normalized faces. Optional assignment, alignment, source
assignment, final rendering, generated asset state, fixtures, generated
artifacts, hashes, and docs must be recreated from the new normalization output
instead of preserved through legacy aliases or compatibility fallbacks. This
does not relax the identification requirement: the replacement should identify
the same source components and source shapes as the current implementation at
the visual/provenance level unless an intentional contract change is documented.

The requirements in this prompt are minimum requirements for a replacement
normalizer. They define the floor needed to rebuild Stage 2 safely and to keep
downstream stages explainable. They are not a comprehensive list of every
useful diagnostic, validation check, SVG feature, fixture, or implementation
strategy. Add stricter tests, richer diagnostics, and broader validation when a
change touches behavior beyond the cases named here.

## Required Context

Read these first:

- `agents/topics/3d-asset-pipeline/svg-stage-contracts.md`
- `agents/topics/3d-asset-pipeline/source-review-contract.md`
- `agents/topics/3d-asset-pipeline/stage-contracts.md`
- `agents/topics/3d-asset-pipeline/state-contract.md`
- `agents/topics/3d-asset-pipeline/summary.md`

Then inspect the current implementation and tests:

- `scripts/3d-assets/svg-preprocessor/SourceNormalizationRunner.js`
- `scripts/3d-assets/svg-preprocessor/source-svg-components.js`
- `scripts/3d-assets/svg-preprocessor/normalized-face-components.js`
- `scripts/3d-assets/svg-preprocessor/_tests/SourceNormalizationRunner.spec.js`
- `scripts/3d-assets/svg-preprocessor/_tests/source-svg-components.spec.js`
- `scripts/3d-assets/svg-preprocessor/_tests/source-normalization-domain.spec.js`

## Stage Contract

Stage 2 has three responsibilities:

- **SVG extraction**: interpret the supported SVG subset and convert supported
  visible geometry into path-based component records.
- **Evidence preservation**: keep source order, ids, groups, source-use
  instances, paint, fill rules, transforms, text/OCR hints, source-shape
  grouping, and enough provenance to explain each output component.
- **Limited early geometry repair**: remove or reshape authoring artifacts
  only when the evidence conditions are generic, auditable, and doing so does
  not erase source meaning needed by review stages.

Stage 2 owns non-semantic source geometry artifacts. Its gate is that a
normalized component artifact is available for the face, or the face is marked
unusable/needs review with diagnostics. Later stages may rely on named
normalized artifact fields and source-shape evidence, but not on component ids
as semantic meaning or on retained normalized geometry as cutter-ready.

Do not make normalization decide Mahjong meaning, final output policy, final
layout, final color, generated optional parts, base tile selection, GLB
generation, or broad cutter-facing simplification. Cutter-friendly cleanup is
owned by Cutter-2D Preparation. Its contract is inferred from cutter/inlay
needs, not from Stage 2 implementation details. Stage 2 work should only keep
enough evidence for later stages to make cutter-facing simplification
traceable.

## Canonical Inputs And Outputs

Input:

- Raw source SVG from
  `svgPipeline.faces[faceKey].artifacts.sourceSvg`.
- Face-level `configuration.sourceMetadata` when present.
- The active tileset state through `PipelineModel`.

Output:

- Normalized component JSON at:

```text
scripts/output/asset-pipeline/<tilesetId>/json/normalized-components/<faceKey>.json
```

- Artifact pointer recorded at:

```text
svgPipeline.faces[faceKey].artifacts.normalizedComponents
```

- Debug SVGs:

```text
scripts/output/asset-pipeline/<tilesetId>/images/identified-components-svg/<faceKey>.svg
scripts/output/asset-pipeline/<tilesetId>/images/identified-shapes-svg/<faceKey>.svg
```

- Source normalization report:

```text
scripts/output/asset-pipeline/<tilesetId>/reports/source-normalization-report[.<faceKey>].json
```

Missing source SVGs should report `missing-source-svg` and must not leave a
fresh normalized artifact pointer that downstream stages can mistake for
current data.

When a normalized artifact is written, all downstream results derived from the
previous normalized artifact for that face are stale. Downstream stages may use
component and shape ids as opaque handles inside the current normalized
artifact snapshot only.

## Downstream Invalidation And Recreation

Source Normalization is an invalidating stage. A successful run for a face
creates a new normalized artifact snapshot, and all source review and generated
asset results derived from the previous snapshot are stale for that face.

Use the existing invalidation mechanics instead of inventing a second reset
path. `SourceNormalizationRunner` should record successful artifacts through
`PipelineModel.recordNormalizationResult()`, which stores the new
`artifacts.normalizedComponents` pointer and applies the model's
post-normalization prune boundary. That prune boundary clears stale source
bindings and alignment handoff state for the face. For whole-tileset reset
behavior, follow the UI reset path: intake the source manifest, run source
normalization, then run optional part assignment. Do not hand-edit stale
bindings, alignment matches, final-rendering pointers, generated asset hashes,
or queue state as a substitute for the model-owned reset/recreation flow.

Do not add legacy id aliases, old-to-new component maps, fallback bindings, or
dual artifact readers merely to keep old downstream state alive. Instead,
recreate downstream outputs from the new normalized artifact. At minimum,
document which of these steps were rerun or refreshed for every affected face:

```text
node scripts/3d-assets/svg-preprocessor/intake-source-svg-manifest.js --tileset-id <tilesetId> --manifest <manifestPath>
node scripts/3d-assets/svg-preprocessor/run-source-normalization.js --tileset-id <tilesetId> [--face-key <faceKey>]
node scripts/3d-assets/svg-preprocessor/run-optional-part-assignment.js --tileset-id <tilesetId> [--face-key <faceKey>]
node scripts/3d-assets/svg-preprocessor/run-source-alignment.js --tileset-id <tilesetId> [--face-key <faceKey>]
node scripts/3d-assets/svg-preprocessor/run-source-semantic-assignment.js --tileset-id <tilesetId> [--face-key <faceKey>]
node scripts/3d-assets/svg-preprocessor/run-final-rendering-composition.js --tileset-id <tilesetId> [--face-key <faceKey>]
```

Generated asset readiness and artifact pointers under `assetPipeline` must be
treated as stale after final rendering changes. Recreate or requeue generated
assets through the existing asset generation flow for affected faces rather
than editing generated asset state by hand.

If a new normalizer changes only diagnostics or unsupported-feature reporting
and does not change normalized geometry, grouping, alignment eligibility, or
rendered SVG output, the implementation note may justify a narrower
recreation scope.

Downstream recreation is not a substitute for reproducing source
identification. The replacement normalizer must still identify the same visible
source components and cohesive source shapes as the current implementation for
the existing face set, except where an intentional contract change explains the
different decomposition and its downstream effects. Id strings may change, but
the component/shape evidence must be traceable to the same source artwork.

## Required Artifact Shape

Preserve the current artifact contract unless an intentional contract update is
made across docs, tests, and downstream consumers. The normalized JSON is a
Stage 2-owned artifact. For one normalization snapshot, downstream stages must
treat it as write-once/read-many: they may read it, parse it, and enrich the
parsed object in memory, but they must not persist enrichments back into the
normalized JSON or treat those enrichments as canonical Stage 2 output. A later
normalization run may replace the snapshot and invalidate downstream results.

The normalized face artifact should include:

- `schemaVersion`
- `tilesetId`
- `faceKey`
- `generatedOn`
- `sourceFile`
- `sourceMetadata`
- `viewBox`
- `status`
- `componentCount`
- `shapeCount`
- `alignmentComponentIds`
- `alignmentShapeIds`
- `alignmentBounds`
- `identifiedComponentsSvg`
- `identifiedShapesSvg`
- `paintSummary`
- `groups`
- `diagnostics`
- `sourceShapes`
- `components`

The fields below are the current downstream-used contract surface. They are the
minimum JSON fields whose presence and meaning must be preserved because
optional assignment, source alignment, final rendering, generated/review flows,
or review routes use them to do real work. Additive fields are allowed when
readers can ignore them. Removing these fields, changing their meaning, or
changing their coordinate/paint semantics is a contract change.

Top-level fields used for downstream behavior:

- `sourceFile`: lets later stages recover source definitions and source-panel
  evidence.
- `sourceMetadata`: feeds metadata-driven optional-part/source-search behavior.
- `viewBox`: defines the source coordinate frame for geometry, optional-part
  placement, review display, and downstream layout fallback.
- `components`: canonical normalized component inventory.
- `sourceShapes`: canonical cohesive source-shape inventory.
- `alignmentComponentIds`: the normalized components eligible for source
  alignment.
- `alignmentShapeIds`: the source shapes eligible for source alignment. Keep
  this consistent with `sourceShapes` and `alignmentComponentIds` even when a
  consumer derives the effective set from shape membership.
- `alignmentBounds`: source alignment bounds and review/display evidence.

Component fields used for downstream behavior:

- `componentId`
- `sourceIndex`
- `pathData`
- `bounds`
- `center`
- `area`
- `fill`
- `stroke`
- `strokeWidth`
- `fillRule`
- `opacity`
- `className`
- `transform`
- `classification.tileLayerCandidate`
- `classification.negativeSpaceCandidate`
- `parentComponentId`
- `parentGroupIds`
- `textValue`
- `fontSize`
- `fontFamily`
- `fontPath`
- `labelOcr`
- `sourceShapeId`

Source shape fields used for downstream behavior:

- `shapeId`
- `componentIds`
- `bounds`
- `center`
- `area`
- `dominantColor`
- `parentGroupIds`
- `sourceElementIds`
- `sourceElementComponentIds`
- `cohesionReason`

The remaining currently emitted fields are still valuable provenance, review,
debug, reporting, and golden-comparison evidence. They should be preserved by a
replacement unless there is a documented reason to change them, but they are not
all equally downstream-algorithmic. Examples include `schemaVersion`,
`tilesetId`, `faceKey`, `generatedOn`, `status`, `componentCount`,
`shapeCount`, `identifiedComponentsSvg`, `identifiedShapesSvg`, `paintSummary`,
`groups`, `diagnostics`, raw `sourceElement` snapshots, source-use evidence,
layer roles, split strategies, display ids, and shape summary lists. If new UI
or downstream logic begins to rely on one of those fields for behavior, promote
that field into the downstream-used contract surface in this prompt.

Each component should also carry the current provenance/review fields when
available:

- `componentId`
- `sourceIndex`
- `sourceElementIndex`
- `sourceElementComponentId`
- `parentComponentId`
- `subcomponentIndex`
- `componentLevel`
- `splitStrategy`
- `sourceElementId`
- `tagName`
- `className`
- `fill`
- `stroke`
- `strokeWidth`
- `fillRule`
- `opacity`
- `textValue`
- `fontSize`
- `fontFamily`
- `fontPath`
- `bounds`
- `center`
- `area`
- `parentGroupIds`
- `sourceLayerRoles`
- `sourceUseId`
- `sourceUseInstanceId`
- `sourceUseInstances`
- `transform`
- `classification.tileLayerCandidate`
- `classification.negativeSpaceCandidate`
- `sourceElement`
- `pathData`

Each source shape should also carry the current provenance/review fields when
available:

- `shapeId`
- `sourceOrder`
- `componentIds`
- `componentCount`
- `sourceElementComponentId`
- `sourceElementComponentIds`
- `sourceElementIds`
- `parentGroupIds`
- `sourceLayerRoles`
- `sourceUseId` and `sourceUseInstanceId` when present
- `splitStrategies`
- `cohesionReason`
- `splittable`
- `classNames`
- `fills`
- `strokes`
- `dominantColor`
- `bounds`
- `center`
- `area`
- `classification.tileLayerCandidate`
- `classification.negativeSpaceCandidate`

Component ids are extraction/provenance ids. They must be internally unique
within one normalized artifact and usable by downstream stages as opaque
handles for that artifact snapshot. There is no guarantee that ids are
deterministic from the source input or stable across normalization runs. The
specific id string format is an implementation detail. Component ids are not
semantic part ids and not reusable identity across unrelated source files,
normalization runs, or artifact snapshots.

## Contract Behaviors To Preserve

The replacement should preserve these contract-level behaviors unless the
contract is updated and downstream results are recreated from the new
normalization output. Exact id strings and other implementation details may
change, but the same source components and source shapes should be identified
for existing faces unless an intentional contract change is documented.

- Run through `SourceNormalizationRunner` with an explicit `PipelineModel`.
- Process all faces or one requested `faceKey`.
- Resolve source SVG paths from canonical face artifacts.
- Write normalized artifacts, debug SVGs, reports, and canonical artifact
  pointers.
- Convert supported geometry tags to path data:
  `path`, `circle`, `ellipse`, `rect`, `polygon`, `polyline`, and `line`.
- Convert supported `text` to path data when an appropriate font can be
  resolved.
- Parse source `viewBox` and preserve it in the artifact.
- Track group nesting, parent group ids, group classes, transforms, paint,
  `data-source-layer`, and `data-source-use`.
- Support `matrix`, `translate`, `scale`, and `rotate`, including
  rotate-about-point.
- Preserve unsupported transform evidence as diagnostics instead of pretending
  it was evaluated.
- Resolve simple `.class { ... }` style rules, inline style, direct paint
  attributes, and inherited group paint with direct attributes winning.
- Track fill, stroke, stroke width, fill rule, fill opacity, stroke opacity,
  opacity, font size, and font family.
- Preserve `<defs>` in identified debug SVG output, while not treating defs as
  expanded visual geometry unless they have been explicitly expanded.
- Preserve `data-source-use` instance evidence and ignore structural source-use
  ids such as `facesize` and `rect2236` when deriving cohesive source shapes.
- Mark tile/background candidates using supported source-layer, geometry,
  class, background-rectangle, viewBox-outline, and tile-paint evidence.
- Mark white fill or stroke as negative-space evidence by default.
- Exclude tile-layer candidates, negative-space candidates, and invisible
  components from `alignmentComponentIds`.
- Include meaningful negative-space cutouts in identified component debug SVGs
  when they overlap retained artwork.
- Drop tiny path dust and tiny low-opacity dust before component records are
  created.
- Split compound paths into island subcomponents when independent islands can
  be separated without detaching holes.
- Split compound paths into band subcomponents only under conservative cluster
  and mass checks.
- Preserve hole-bearing path structure and meaningful `fillRule` evidence.
- Keep `compound-path-band` subcomponents separable when deriving source-use
  shapes.
- Derive source shapes from source-use instances, contained paint-layer
  relationships, and single components.
- Use the innermost useful source-use instance as repeated-shape identity.
- Flatten later opaque paint layers from earlier opaque fills only inside one
  identified source shape.
- Never flatten fragments from the same original source element/use against
  each other.
- Never flatten between separate source shapes, including repeated motifs.
- Record paint-layer flattening evidence and hidden-by-flattening state.
- Treat visible paint-layer flattening as limited early geometry repair:
  it may prevent overlapping opaque fills from becoming stacked downstream
  solids, but only inside one identified source shape and only when provenance
  and hole evidence are preserved.
- Annotate expected-label OCR evidence when a face has an expected label.
- Mark artifacts `needs-review` when no alignment-eligible components remain.
- Write debug SVGs that draw normalized component paths directly, not clipped
  full-source SVG fragments.

## Current Implementation Reference

These details describe today's implementation and are useful for comparison,
but they are not permanent contract guarantees unless they also appear in the
contract sections above.

- Extraction currently runs through `SourceNormalizationRunner` and
  `extractSourceSvgComponents`.
- SVG extraction currently uses a scanner-like tag walk rather than full
  browser layout.
- Current component ids use `src.<faceKey>.<NNNN>` with child suffixes, and
  current shape ids use `shape.<faceKey>.<NNNN>`.
- Current source-use instance ids use `source-use.<NNNN>.<sourceUseId>`.
- Current bounds and areas are usually rounded to three decimals. Transform
  near-equality uses a smaller tolerance in helper code.
- Full normalization runs write `source-normalization-report.json`; focused
  runs write `source-normalization-report.<faceKey>.json`.
- Current successful artifact statuses are `ready` and `needs-review`;
  missing source SVGs are reported as `missing-source-svg` in the run report.
- Current artifact diagnostics use at least `{ level, code, message }`.
- Current text conversion resolves fonts from asset fonts, Windows fonts, and
  common Linux font directories with a serif fallback.
- Current paint-layer flattening uses `flattenedPaintLayer`,
  `paintLayerFlattening`, and `hiddenByPaintLayerFlattening` fields.

## Source Component Derivation Reference

This section describes the current source-component capability in enough
detail to recreate it without reading the existing implementation. Treat it as
required reproduction behavior for the current contract unless an intentional
contract change is documented.

A source component is one addressable normalized geometry fact derived from
source SVG evidence. It is the smallest durable source unit that downstream
stages can compare, align, bind, color, render, and explain without reparsing
the raw SVG. It is not a semantic Mahjong part, not necessarily one raw SVG DOM
node, and not guaranteed to be cutter-ready geometry.

Component derivation should:

- Walk the source SVG in source order while preserving group ancestry.
- Convert supported visible geometry elements into path-based records:
  `path`, `circle`, `ellipse`, `rect`, `polygon`, `polyline`, and `line`.
- Convert supported `text` into path data when a usable font can be resolved.
- Resolve simple presentation evidence before geometry is recorded: inherited
  group paint, class paint, inline style, direct fill/stroke attributes,
  fill-rule, opacity, stroke width, font size, and font family.
- Compose supported transforms from parent groups and the source element into
  the component transform and bounds evidence.
- Preserve source ancestry: source order, raw source element string, source
  element id, tag name, class, parent group ids, source-layer roles,
  source-use ancestry, and source-use instance ids.
- Preserve informative source structures even when they do not become
  components. Groups contribute ancestry and inherited state; they do not
  become components by themselves. `defs`, symbols, metadata-like source
  annotations, reusable source fragments, paint definitions, masks, clips,
  filters, and other non-component SVG structures should be captured as
  provenance, diagnostics, review risk, or debug SVG context when they can
  explain visible geometry or downstream decisions. They become component
  geometry only when explicitly expanded into visible source geometry.
- Drop invisible or dust geometry when the current evidence rules classify it
  as non-meaningful rather than source artwork.

The normal component correspondence is one supported renderable SVG element to
one normalized component. The exceptions are contract behavior, not incidental
implementation detail:

- A compound `path` may split into multiple subcomponents when independent
  islands or band-like contained subpaths need to remain separately selectable.
- A source element that is filtered as invisible, dust, unsupported, or
  non-meaningful may produce no component, but informative evidence from that
  element should still be preserved when it explains source artwork, review
  risk, or downstream behavior.
- A group may influence many components through ancestry, inherited paint, and
  transforms without producing a component itself.
- A repeated source-use instance may produce several components that later
  become one source shape.
- Text may produce path geometry whose `textValue`, font fields, and OCR
  evidence preserve the source text context.

Component ids are opaque handles inside one normalized artifact snapshot.
Current ids use `src.<faceKey>.<NNNN>` for whole-element components and append
`.NNNN` for split subcomponents, but that string format is implementation
detail. The contract is that ids are internally unique, stable within the
artifact snapshot, and usable by downstream state as handles until the next
normalization run invalidates downstream results.

Preserve the distinction between source-element identity and component
identity:

- `sourceIndex` and `sourceElementIndex` record source-order extraction
  position.
- `sourceElementComponentId` identifies the original extracted source element
  before subcomponent splitting.
- `componentId` identifies the normalized component or subcomponent.
- `parentComponentId`, `subcomponentIndex`, `componentLevel`, and
  `splitStrategy` explain whether the component is a whole source element or a
  split child.
- `sourceElementId`, `tagName`, `className`, `sourceElement`,
  `parentGroupIds`, `sourceLayerRoles`, `sourceUseId`,
  `sourceUseInstanceId`, and `sourceUseInstances` preserve source SVG
  correspondence and review evidence.

After extraction, components are classified rather than immediately discarded
when later stages may need review evidence:

- Tile/background candidates remain in `components` but are excluded from
  `alignmentComponentIds`.
- White fill or stroke is preserved as negative-space evidence and excluded
  from ordinary alignment eligibility by default.
- Components without visible paint, path data, or usable bounds are not
  alignment-eligible.
- Meaningful negative-space cutouts may still appear in identified component
  debug SVGs when they explain artwork cutouts.

The identified component debug SVG is a projection of normalized JSON
components, not the original SVG structure. It draws normalized component paths
with `data-component-id` and display paint/transform evidence. It should be
structurally faithful to the JSON component inventory being reviewed, but it is
not the canonical source of component identity.

## Source Shape Derivation Reference

This section describes the current source-shape capability in enough detail to
recreate it without reading the existing implementation. Treat it as required
reproduction behavior for the current contract unless an intentional contract
change is documented.

A source shape is a cohesive source-side visual unit built from one or more
normalized components. It is not a semantic Mahjong part. Later stages may use
source shapes as selection/alignment evidence, then expand back to member
components for binding and rendering.

Shape derivation runs over normalized components that have `pathData` and
`bounds`. It happens twice in the current flow:

- before paint-layer flattening, to annotate components with provisional
  `sourceShapeId` for same-shape flattening decisions
- after paint-layer flattening, to write the final `sourceShapes` artifact
  records and `alignmentShapeIds`

The current grouping order is:

1. **Source-use instance grouping**
   - Inspect each component's `sourceUseInstances` ancestry from innermost to
     outermost.
   - Pick the first instance that has both `sourceUseId` and
     `sourceUseInstanceId` and whose `sourceUseId` is not structural.
   - Structural source-use ids currently include `facesize` and `rect2236`.
   - Components with the same useful `sourceUseInstanceId` form one
     `source-use-instance` shape.
   - Ignore source-use groups that contain no visibly painted component.
   - `compound-path-band` subcomponents are separable and must not be forced
     into one shape merely because they share a source-use instance.

2. **Contained-layer grouping**
   - Consider only components not already consumed by source-use grouping.
   - Reject pairs when either component lacks bounds.
   - Reject pairs when either component is a tile-layer candidate or
     negative-space candidate.
   - Reject pairs unless their `parentGroupIds` arrays are exactly equal and
     in the same order.
   - One component must contain the other component's bounds with a current
     tolerance of `0.75` source units.
   - The inner component's area divided by the outer component's area must be
     at least `0.35` and at most `0.95`.
   - The normalized center distance between the outer and inner bounds must be
     at most `0.08`, where x/y deltas are divided by the larger bounds width
     and height before computing Euclidean distance.
   - A component with one or more contained partners forms one
     `contained-layer` shape with those partners, sorted by source order.

3. **Single-component fallback**
   - Any unconsumed component becomes one `single-component` shape.

After grouping:

- Sort source-shape groups by the earliest member `sourceIndex`.
- Assign internally unique shape ids for the artifact snapshot.
- Preserve ordered `componentIds`, `componentCount`, earliest `sourceOrder`,
  source element ids, source element component ids, parent group ids,
  source-layer roles, source-use evidence when present, split strategies,
  `cohesionReason`, class names, fills, strokes, dominant color, union bounds,
  center, summed component area, and classification flags.
- Shape classification flags are true only when every member component has the
  corresponding classification flag.
- `alignmentShapeIds` contains shapes that include at least one
  alignment-eligible component. Alignment-eligible components have path data
  and bounds, are not tile-layer candidates, are not negative-space
  candidates, and have visible fill or stroke paint.

## Existing Face Comparison Requirement

Before changing behavior, capture a golden baseline for the existing source
face set from the current implementation. Use that baseline as a regression
comparison and migration report, not as a requirement to preserve every
implementation detail.

Unless the task explicitly narrows the scope, the golden face set is the full
current normalized output for these tilesets:

- `wiki`
- `classic`
- `traditional`
- `default`

For each tileset, compare every face in the canonical
`scripts/output/asset-pipeline/<tilesetId>/pipeline.json`. For focused work, a
single `--face-key` comparison is acceptable only when the implementation note
explains why neighboring faces, shared extractor behavior, and the other
golden tilesets are not affected.

Keep the baseline outside canonical mutable pipeline state. The normalized
component JSON artifacts are the primary parity source for old-vs-new Stage 2
comparison because they already carry the downstream-used contract surface:
component records, source-shape records, path data, bounds, paint evidence,
transforms, classifications, source-use evidence, alignment ids, and
diagnostics. A comparison may project those JSON artifacts into a normalized
summary or geometry fixture to avoid coupling to nonfunctional field ordering or
incidental metadata, but that projection should be derived from the JSON rather
than replacing it as the major oracle. The important fact is that the baseline
captures the current normalized SVG-derived geometry and source-shape
decomposition for the four golden tilesets before replacement work changes the
normalizer.

The comparison must be automated. It may be implemented as part of the
integration test suite or as a dedicated script invoked by tests and by the
implementation workflow. The main comparison should be JSON-based, either
directly against normalized component JSON or against a canonical summary
exported from that JSON. Compare component/source-shape membership, path
geometry, bounds, paint/fill-rule/transform evidence, classification, and
alignment eligibility. Add a secondary SVG-structure comparison for the
identified/debug SVG outputs at a structural level: compare meaningful element
presence/order, source ids/classes/provenance annotations, path geometry
references, grouping, and viewBox/defs preservation where those structures are
expected to explain or display the JSON. Debug SVG whitespace, attribute
ordering, serialization style, and other formatting may change without failing
the comparison when the JSON parity check and meaningful SVG structure are
equivalent.

Optional testing lever: add bitmap visual comparison when a change is likely to
affect rendered appearance or when JSON/structure diffs are hard to inspect.
Render old and new identified/debug SVGs with the same renderer, size, fonts,
background, and viewBox handling, then compare pixels with an explicit
anti-aliasing/perceptual tolerance. This can also compare original source SVG
renders against the new debug projection as a human-review aid. Bitmap
comparison is useful for catching missing paths, bad transforms, viewBox drift,
text-to-path failures, fill-rule mistakes, lost defs context, and clipping or
masking regressions. It is not the contract oracle and must not replace JSON
parity, because visually identical bitmaps can still hide wrong provenance,
component/source-shape grouping, alignment eligibility, diagnostics, or
downstream handles.

It is permissible to add comparison-support artifacts to the current Stage 2
implementation before replacement work if doing so makes before/after parity
easier to automate or review. Examples include canonical JSON summaries,
normalized geometry exports, debug SVG manifests, rendered PNG baselines, or
per-face comparison metadata derived from the normalized artifact. These
artifacts must be clearly marked as validation/support outputs, must be
derivable from canonical source SVG plus normalized JSON, and must not become a
second source of truth, a compatibility bridge, or a downstream requirement.
When added, document their path, schema, generation command, and intended
comparison use.

The comparison should ignore `generatedOn`, local absolute path spelling, and
debug SVG formatting unless those fields are the change under review. Numeric
geometry comparisons should use the artifact's practical precision: current
artifacts round most bounds and areas to three decimals, so use an explicit
tolerance no looser than `0.001` for rounded bounds/centers/areas unless the
implementation note justifies a different tolerance for a changed geometry
engine. Path geometry should be compared through normalized/exported geometry
at comparable precision rather than by raw string formatting alone.

The comparison should cover, per face:

- component count, internally unique component ids, and component ordering
- source element component ids, if present, and parent/subcomponent
  relationships
- split strategies and component levels
- source order/index fields
- source element ids, tag names, classes, parent group ids, and source layer
  roles
- source-use ids, source-use instance ids, and source-use instance ancestry
- path presence and path identity at the practical precision used by current
  artifacts
- bounds, center, and area within the current artifact precision/tolerance
- fill, stroke, stroke width, fill rule, opacity, and text/font evidence
- tile-layer and negative-space classification flags
- `alignmentComponentIds` membership against the current artifact's component
  ids
- source shape count, internally unique shape ids, and shape ordering
- source shape component membership, cohesion reason, source-use evidence,
  source element provenance, bounds, center, area, classification, and
  `alignmentShapeIds`
- paint summary and diagnostics that affect downstream behavior

Golden comparison may ignore intentionally non-functional fields such as
`generatedOn`, absolute machine path spelling, and debug SVG formatting, but it
must not ignore fields used by optional assignment, alignment, source
assignment, final rendering, or generated asset hashing. Because running
normalization invalidates downstream outputs, any fields that differ from the
baseline require downstream recreation in the same work rather than
compatibility aliases.

Any intentional difference for an existing face must be called out in the
implementation note with the reason, contract-level effect, downstream
recreation performed, tests updated, and docs updated. Do not accept broad
unexplained diffs in normalized components or source shapes.

Contract-level equivalence means the same source geometry is identified by
default. Unless the work explicitly records a different design decision, the
replacement should identify the same visible components, same cohesive source
shapes, same component-to-shape membership, and same alignment eligibility as
the current implementation, even when ids or helper implementation details
change.

Changing decomposition is a contract change, not merely an implementation
choice. A source shape that splits differently, combines differently, gains or
loses alignment eligibility, or changes visible path geometry may be accepted
only when the implementation note explains why the old identification was
wrong or insufficient, what new contract behavior is being adopted, and which
downstream state/artifacts/tests/docs were recreated. Improved downstream
scores or easier alignment are useful evidence, but they are not by themselves
permission to identify different geometry.

Validation must also include an end-to-end representative subset. The exact
face list is TBD, but the subset should contain enough metadata and saved
review decisions to emulate the UI gates. That subset must run normalization
through optional assignment, alignment, source assignment, final rendering, and
generated asset planning/generation, then compare the end result. This
end-to-end subset complements the four-tileset normalization golden comparison;
it does not replace the requirement to compare normalized geometry.

## Diagnostics Contract

Diagnostics are the stage's way to make unsupported or simplified SVG behavior
visible. They should be machine-readable enough for tests and review pages, and
human-readable enough to explain the risk.

Open question: the final diagnostic schema is not yet settled. Until it is,
artifact diagnostics should include at least:

- `level`: `info`, `warning`, or `error`
- `code`: stable kebab-case diagnostic code
- `message`: short human-readable explanation

When the diagnostic is tied to source evidence, include focused context fields
where available:

- `sourceElementId`
- `tagName`
- `feature`
- `attribute`
- `sourceUseInstanceId`
- `componentId`
- `reviewRisk`

Use `warning` when the artifact can still be produced but review should know
that visible geometry, bounds, paint, grouping, or OCR evidence may be
incomplete. Use `error` when the face cannot produce a trustworthy normalized
artifact. Use `info` only for auditable transformations that do not require
review attention.

Unsupported visual-affecting SVG features such as unsupported transforms,
masks, clips, filters, unresolved paint servers, external stylesheets, complex
CSS selectors, CSS variables, or unexpanded `use`/`symbol` indirection must not
be silently ignored. Either support the feature, emit a diagnostic/review risk,
or mark the face `needs-review` or unusable when the missing feature prevents a
trustworthy artifact.

The unresolved schema decision is whether diagnostics should standardize richer
fields such as severity taxonomy, source DOM location, affected geometry ids,
review-risk category, machine actionability, and stage ownership. Track that as
an open design question before building UI or downstream logic that relies on
more than the minimum `{ level, code, message }` shape.

## Weaknesses To Address

Improve the normalizer by turning current weak spots into explicit diagnostics,
supported behavior, or documented review risk. Do not silently expand the
stage beyond its contract.

- Replace or constrain scanner-like behavior where it loses required SVG
  context. If a full DOM parser is introduced, preserve source order,
  group-stack provenance, source-use instance ancestry, source-element to
  component correspondence, and the downstream-used artifact contract surface.
- Improve support for informative SVG structures that are currently skipped.
  Some source elements should become components; others should remain
  provenance, diagnostics, review risk, or debug context. The replacement
  should make that distinction explicit instead of losing useful source
  evidence.
- Report unsupported SVG constructs that can affect visible geometry or explain
  source intent instead of silently skipping them: unsupported renderable
  elements, unsupported transform functions, masks, clip paths, filters,
  `display`/`visibility` cases, complex `defs`/`symbol`/`use` indirection,
  external stylesheets, complex selectors, CSS variables, metadata-like source
  annotations, and paint servers that cannot be resolved.
- Distinguish "not a component source" from "unsupported component source".
  Non-rendering containers such as groups may remain ancestry-only, but visible
  SVG element types outside the supported extraction subset should either be
  implemented or produce diagnostics/review risk.
- Improve transform handling only when the result remains auditable. Supported
  transforms should produce correct bounds and path placement evidence. Unknown
  or partially parsed transform strings should produce diagnostics rather than
  being silently treated as identity or partial success.
- Improve CSS handling carefully. Support more CSS only with tests for
  precedence, inheritance, presentation attributes, inline style, class
  selectors, and source-order behavior. Unsupported selector forms or external
  styles that can affect visible geometry should produce diagnostics.
- Preserve paint server evidence even when gradients or patterns are not
  converted to solid geometry.
- Preserve mask/clip/filter evidence and flag affected geometry as review risk
  unless the feature is explicitly expanded into paths.
- Keep stroke semantics as evidence. Do not make Stage 2 responsible for final
  stroke-to-fill cutter geometry.
- Make compound-path splitting safer around nested holes, self-intersections,
  mixed fill rules, degenerate subpaths, island/band ambiguity, and source-use
  instances. A split must preserve parent/source-element provenance and explain
  itself through `splitStrategy`, child ids, and diagnostics when uncertain.
- Keep white/negative-space classification explicit and reversible by later
  rendering policy. Do not infer visible white pigment from raw white source
  paint alone.
- Improve diagnostics for opacity, visibility, display, blending, and
  compositing cases that are simplified rather than fully rendered.
- Keep text conversion deterministic. Missing or substituted fonts should be
  recorded as diagnostics that explain OCR, path geometry, or bounds
  uncertainty. Preserve source text context even when conversion fails or is
  approximate.
- Keep tile-layer, dust, and negative-space filtering explainable. If a source
  element is dropped or excluded from alignment, the reason should be
  recoverable from fields, diagnostics, reports, or review output.
- Keep identified component/debug SVGs structurally faithful to the normalized
  JSON they project. They do not need stable formatting, but they should not
  hide component/source-shape membership, source ids/classes/provenance
  annotations, viewBox, or defs evidence that reviewers need.
- Keep source-shape derivation tied to component evidence. Improvements to
  grouping, paint-layer flattening, or alignment eligibility should be judged
  against the JSON parity baseline and treated as contract changes when they
  alter existing component/shape decomposition.
- Make every geometry-changing transformation auditable through named fields
  or diagnostics.

## Design Rules

- Single source of truth: durable source review facts live in `pipeline.json`;
  large geometry lives in artifacts referenced from face `artifacts`.
- Do not add sidecar mutable state for normalized facts.
- Do not preserve old aliases or fallback shapes unless explicitly required.
- Running normalization invalidates all previously generated downstream
  results for the normalized faces. Do not preserve downstream results for
  compatibility with the old normalizer; recreate downstream review state,
  fixtures, generated data, hashes, and artifacts from the new normalized
  outputs.
- Do not silently fabricate geometry for missing or unsupported source
  features.
- Prefer failing visibly, emitting diagnostics, or marking `needs-review` over
  hidden downstream repair.
- Keep source normalization generic and evidence-based. Avoid face-specific
  exceptions.
- Keep debug SVGs faithful to the normalized artifact, because review pages
  should show the data later stages consume.
- Any change to artifact schema must update downstream consumers, fixtures,
  docs, and tests in the same work.

## Suggested Implementation Shape

A cleaner implementation can split the stage into explicit internal units:

- SVG document intake and feature discovery.
- Supported CSS and presentation-attribute resolution.
- Transform parsing and transform diagnostics.
- Geometry extraction and path conversion.
- Text-to-path conversion and font diagnostics.
- Visibility, dust, tile-layer, and negative-space classification.
- Compound path splitting.
- Source-shape derivation.
- Paint-layer flattening.
- OCR evidence annotation.
- Artifact/report/debug SVG writing.
- PipelineModel state mutation.

These helpers can use constructor-time dependency injection for testability,
but app-facing state and persistence should continue through `PipelineModel`.

## Acceptance Criteria

These criteria are the minimum acceptance bar, not the full verification
ceiling. A change that touches additional SVG semantics, artifact fields,
review behavior, alignment behavior, rendering behavior, or generated assets
must add focused validation for that touched surface even if the checks below
pass.

- Existing source normalization tests pass.
- Golden comparison against current normalized component and source-shape
  identification is reviewed for all existing faces, with every intentional
  difference documented and downstream state/artifacts recreated as needed.
- Existing alignment, optional assignment, source assignment, final rendering,
  and generated asset tests that consume normalized artifacts pass after their
  fixtures or generated data are recreated from the new normalized outputs.
- End-to-end representative subset validation runs through normalization,
  optional assignment, alignment, source assignment, final rendering, and
  generated asset planning/generation with metadata and saved review decisions
  that emulate the UI gates. The exact face list is TBD and should be recorded
  with the validation fixture or script.
- Add focused tests for each newly supported SVG feature or diagnostic.
- Add regression tests for unsupported features that must surface as
  diagnostics instead of silent success.
- Run at least:

```text
npm run test:pipeline
npm run test:scripts
```

If broad behavior changed, also run:

```text
npm run test:engines
npm run build
```

## Deliverables

- Updated Stage 2 implementation.
- Updated tests and fixtures.
- Updated docs if the contract changes.
- A short implementation note listing:
  - contract behaviors preserved,
  - weaknesses addressed,
  - intentional normalized output differences and downstream recreation
    performed,
  - remaining unsupported SVG semantics,
  - commands run and results.
