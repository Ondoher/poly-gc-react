# 3D Asset Pipeline Summary

Use this summary when another topic needs brief context about the 3D asset
pipeline without loading the full topic.

## Owns

The `3d-asset-pipeline` topic owns the path from reference/source artwork to
reviewable generated 3D tile assets:

```text
reference setup
-> source manifest intake
-> source normalization
-> optional part assignment
-> source alignment
-> source assignment
-> final rendering
-> cutter SVG simplification
-> base tile selection
-> asset generation
-> asset review
```

It owns source/reference contracts, canonical pipeline state, stage gates,
artifact roles, final rendering output, generated asset hashes, queue behavior,
and generated GLB/PNG review artifacts.

It does not own the pipeline app shell/page architecture, except where server
routes and review payload contracts affect pipeline state. App feature/page
shape belongs to the `pipeline-app` topic. Renderer-only experiments belong to
`real-3d-rendering`.

## Mental Model

Reference images own Mahjong structure: semantic parts, target bounds, colors,
and generated glyph slots.

Source SVGs own donor style: paths, paint evidence, source geometry, and
visual details. Source component ids are extraction ids, not semantic meaning.

Review stages bind source geometry to reference semantic parts. Final
Rendering decides visible output policy, layout, and color. Generated asset
stages turn the rendered face into cutter, stamped body, colored inlay, and
preview assets.

## Canonical State

Each source tileset has one mutable state file:

```text
scripts/output/asset-pipeline/<tilesetId>/pipeline.json
```

Current schema version: `3`.

State ownership:

- `svgPipeline.faces[faceKey].state`: source review facts
- `state.bindings`: component-to-part bindings
- `state.parts`: accepted part/source-absence facts
- `state.alignment.matches`: compact alignment handoff
- `rendering`: final output policy/options
- `assetPipeline`: generated asset readiness, hashes, queue/build state, and
  generated artifact pointers

The tileset registry is routing-only:

```text
scripts/output/asset-pipeline/tilesets.json
```

It owns only `activeTilesetId` and known tilesets.

## Current Generated Asset Path

Generated asset stages currently consume the final-rendering color SVG recorded
at:

```text
svgPipeline.faces[faceKey].artifacts.finalRenderingColorSvg
```

Prepared SVG export is a later stage and future review/QA promotion surface.
It is not currently the canonical generated-asset input.

Cutter-2D Preparation is the active handoff before cutter generation. It owns
cutter-facing geometry cleanup so Source Normalization can remain
evidence-rich and Final Rendering can remain focused on accepted visual
output. Generated assets consume the prepared cutter-2D SVG recorded at
`assetPipeline.faces[faceKey].artifacts.cutterSvg`.

Generated stages:

```text
preview-svg -> cutter-2d -> svg-cutter -> stamped-body -> colored-inlay -> preview-png
```

Saving a base tile selection now stages all missing or stale generated-asset
faces into the persisted queue when the tileset is idle. Asset Review derives
queued cards from that queue plus `assetPipeline` state; cards without a
current asset and without queued/building/failed state are shown as
unavailable.

Asset Review synthesizes readiness from canonical hashes, required artifacts,
file existence, and live/persisted queue state. It does not save a separate
review status in `pipeline.json`.

## Current Checkpoint

As of 2026-05-20, the current SVG handoff contract is captured in
[SVG Stage Contracts](svg-stage-contracts.md). The current design pass is
turning that document into the checkpoint for SVG preprocessing stage
contracts: it now defines the pipeline purpose, SVG semantics, the active SVG
handoff chain, known handoff gaps, normalization weaknesses, coordinate spaces,
terms, and code-grounded expectations for each stage.

The key normalization meta-goal is a provenance-rich geometry inventory: make
source artwork legible, preserve origin evidence, avoid premature semantic
meaning, remove harmful authoring artifacts when doing so does not lose
evidence, and hand off enough information for later semantic inference,
alignment, recoloring, and eventual 3D generation.

The Stage 2 contract now names the normalizer's three responsibilities:
supported SVG extraction, evidence preservation, and limited early geometry
repair. It also separates guaranteed artifact fields from non-goals:
normalized component ids are internally unique extraction/provenance handles
inside one artifact snapshot, source shapes are cohesive visual-unit evidence,
unsupported SVG semantics must surface as diagnostics or review risk, and
retained normalized geometry is not guaranteed to be cutter-ready. Component
and shape ids are not guaranteed deterministic from source input or stable
across normalization runs. Stage 2's gate is a normalized component artifact or
a face marked unusable/needs-review with diagnostics. Source normalization may
flatten overlapping opaque paint layers only as limited early geometry repair
inside one identified source shape, preserving provenance and hole evidence.

[Stage 2 Source Normalization Prompt](stage-2-source-normalization-prompt.md)
is the implementation handoff prompt for recreating the current normalizer
behavior while addressing the known weaknesses. It now opens with Stage 2's
abstract purpose as the evidence-preserving bridge between raw authored SVG and
the rest of the asset pipeline. It lists required context, artifact fields,
downstream invalidation/recreation rules, contract behaviors to preserve,
current implementation reference details, golden comparison scope, diagnostics
shape, weaknesses to improve, design rules, acceptance tests, and deliverables.
Those requirements are a minimum rebuild and validation floor, not a
comprehensive ceiling. Additional diagnostics, fixtures, tests, and validation
are expected when a replacement touches SVG semantics, artifact fields, review
behavior, alignment behavior, rendering behavior, or generated assets beyond
the cases named in the prompt.
It also includes self-contained source-component and source-shape derivation
references so Stage 2 behavior can be recreated without reading the existing
code. The component reference defines components by intent as addressable
normalized geometry facts, covers supported SVG element/text extraction,
source ancestry, component-vs-source-element identity, split subcomponents,
classification, alignment eligibility, and identified debug SVG
correspondence. The shape reference covers source-use grouping,
contained-layer grouping, single-component fallback, shape record fields, and
alignment-shape eligibility.
The weaknesses list has been re-scoped around that contract: parser upgrades
must preserve component/source-element correspondence, informative SVG
structures that are currently skipped should become component geometry,
provenance, diagnostics, review risk, or debug context as appropriate,
unsupported visible SVG features must become support or diagnostics,
splitting/filtering/grouping must remain auditable, and identified debug SVGs
should stay structurally faithful to the normalized JSON they project.
The prompt now distinguishes the downstream-used normalized JSON contract from
broader emitted provenance: `sourceFile`, `sourceMetadata`, `viewBox`,
`components`, `sourceShapes`, alignment eligibility/bounds, behavior-used
component geometry/paint/classification/provenance fields, and behavior-used
source-shape membership/bounds/color/provenance fields are contractual because
later stages currently consume them. Other emitted fields remain important
review/debug/golden evidence, but are not all downstream-algorithmic unless a
consumer promotes them. Normalized JSON is Stage 2-owned and
write-once/read-many for a normalization snapshot; downstream stages may enrich
parsed objects in memory, but must not write those enrichments back as
canonical Stage 2 output.
It requires golden comparison against the existing face set as a regression and
migration report, not as a requirement to preserve every implementation detail.
Running Source Normalization invalidates all previously generated downstream
results for the normalized faces. Downstream source review state, fixtures,
generated data, hashes, artifacts, and docs should be recreated from the new
normalized outputs instead of preserved through legacy aliases or compatibility
fallbacks. That invalidation does not relax the source identification
requirement: the replacement normalizer should identify the same visible source
components and cohesive source shapes as the current implementation at the
visual/provenance level unless an intentional contract change is documented.
Invalidation should use the existing model/UI path:
`PipelineModel.recordNormalizationResult()` stores the new artifact pointer and
prunes stale source bindings/alignment, while whole-tileset reset follows
intake -> normalization -> optional part assignment.
The next implementation pass should begin by capturing current output as a
golden baseline for the full current normalized output of the `wiki`,
`classic`, `traditional`, and `default` tilesets. Normalized component JSON is
the primary old-vs-new Stage 2 parity source, either compared directly or
through a canonical summary/geometry fixture derived from that JSON:
component/source-shape handle uniqueness and membership, grouping,
classifications, alignment eligibility, path identity, bounds, paint evidence,
source-use evidence, and downstream-used diagnostics. A secondary SVG-structure
comparison should check meaningful identified/debug SVG structure such as
element presence/order, grouping, provenance annotations, path geometry,
viewBox, and defs preservation, while ignoring harmless formatting and
serialization differences. Optional bitmap visual comparison can be used as a
testing lever for changes likely to affect rendered appearance, rendering old
and new debug SVGs with the same renderer and tolerance to catch missing paths,
bad transforms, viewBox drift, text-to-path failures, fill-rule mistakes, and
lost defs/clip/mask context; it remains secondary to JSON parity. The current
Stage 2 implementation may be updated to emit validation/support artifacts
such as canonical summaries, normalized geometry exports, debug manifests,
rendered PNG baselines, or per-face comparison metadata when those artifacts
make before/after comparison easier. They must be derived from canonical source
SVG plus normalized JSON and must not become a second source of truth or
compatibility bridge. The comparison may live in integration tests or a
dedicated script invoked by tests/workflow, and should call out every
intentional difference and downstream recreation performed. Contract-level
equivalence means the same source geometry is identified by default; different
splitting, combining, path geometry, or alignment eligibility is a contract
change unless explicitly justified.
An additional smaller validation set is required: representative tiles with
enough metadata and saved review decisions to emulate UI gates must run through
the downstream pipeline and compare end-to-end output. The exact face list is
TBD, and this validation complements rather than replaces normalized geometry
comparison.
The prompt treats the richer diagnostic schema as an open question. Until that
is settled, diagnostics should provide at least `{ level, code, message }`,
with optional focused source context fields when available.

Contractor handoff package:

- [contractor-svg-face-artwork-package](contractor-svg-face-artwork-package/)
  contains the custom SVG face artwork handoff README, palette files, visual
  palette SVG, and `large-faces-pngs.zip`.
- [contractor-svg-face-artwork-package.zip](contractor-svg-face-artwork-package.zip)
  is the sendable package.

Important design clarification: Source Normalization is not required to output
geometry that is already acceptable to the cutter. It may preserve complex SVG
evidence that helps meaning, alignment, or color review. Cutter-friendly
simplification is assigned to Cutter-2D Preparation, not to the Stage 2
normalizer.

Important current implementation facts:

- The normalizer supports explicit geometry/text extraction, limited transform
  parsing, simple class/inline/direct paint inheritance, compound-path
  island/band splitting, source-use grouping, tile/background filtering,
  negative-space filtering, and bounded same-shape opaque paint-layer
  flattening.
- These normalization transformations are now treated as contract behavior
  discovered from real SVG sources, not disposable implementation details:
  source-use grouping, contained-layer grouping, shape combining,
  compound-path island/band splitting, subcomponent separation, and bounded
  paint-layer flattening preserve provenance and review/alignment evidence.
- Final rendering is responsible for regenerated SVGs that are usable by 3D
  stages, including evenodd preservation, degenerate subpath pruning,
  same-source recombination, and stroke-to-fill conversion.
- The final-rendering color SVG is the visual review/composition output, while
  the cutter-2D SVG is the generated-asset SVG input. A visually correct SVG is
  not always cutter-ready SVG geometry.
- Cutter-2D Preparation creates the explicit cutter-readiness handoff before
  `svg-cutter`, reducing pressure on the normalizer and final renderer to
  solve 3D-specific geometry concerns.
- Multi-component cutter generation now avoids whole-face CSG union and uses
  merged path solids with internal side-wall cleanup for adjacent footprints.
- Base tile selection stages missing/stale generated assets into the persisted
  queue when idle.
- Preview PNG generation remains the main unresolved generated-asset stability
  issue; cutter/stamped/inlay stages can be current while `preview-png` is
  stale.

## Key Boundaries

- Source review state stays under `svgPipeline`.
- Generated 3D asset state stays under `assetPipeline`.
- Diagnostic candidates, score traces, review SVGs, and preview PNGs are not
  canonical mutable state.
- Server route responses are synthesized UI view models, not another source of
  truth.
- Rendering decides generated/source/omitted output; source review only records
  what the source provides or lacks.
- Alignment answers how source geometry can fit reference structure. Source
  Assignment answers what source geometry means. Final Rendering answers what
  should be output.

## Detail Map

- One-page facts: [Current Contracts](current-contracts.md)
- Mutable state shape: [State Contract](state-contract.md)
- Stage order and gates: [Stage Contracts](stage-contracts.md)
- Per-stage SVG input/output boundaries:
  [SVG Stage Contracts](svg-stage-contracts.md)
- Artifact roles and paths: [Artifact Contract](artifact-contract.md)
- Source manifests and tileset registry:
  [Source Manifest Contract](source-manifest-contract.md)
- Reference setup: [Reference Setup Contract](reference-setup-contract.md)
- Source review and optional parts: [Source Review Contract](source-review-contract.md)
- Assignment scoring and OCR evidence: [Assignment Scoring](assignment-scoring.md)
- Alignment handoff:
  [Alignment Assignment Contract](alignment-assignment-contract.md)
- Alignment model: [Alignment Engine](alignment-engine.md)
- Final rendering: [Rendering Contract](rendering-contract.md)
- Color policy: [Color Handling](color-handling.md)
- Generated assets and hashes: [Generated Asset Contract](generated-asset-contract.md)
- Routes, CLIs, queues, streams: [Runtime And Routes](runtime-and-routes.md)
- Deferred work: [Future Work](future-work.md)
- Terms: [Glossary](glossary.md)
