# Source Review Contract

This document owns source-side stages before final rendering: intake,
normalization, optional part assignment, OCR evidence, and Source Assignment
review behavior.

## Intake

Intake reads a source manifest, copies per-face SVGs into the pipeline source
workspace, builds schema version 3 `pipeline.json`, and records
`artifacts.sourceSvg` for each face.

Detailed manifest rules live in [Source Manifest Contract](source-manifest-contract.md).

## Source Normalization

Source Normalization reads each face's canonical `artifacts.sourceSvg` and
writes a normalized component artifact:

```text
scripts/output/asset-pipeline/<tilesetId>/json/normalized-components/<faceKey>.json
```

The runner records the artifact pointer in
`svgPipeline.faces[faceKey].artifacts.normalizedComponents`.

Normalization owns non-semantic source decomposition:

- source components and source shapes
- source order and ancestry
- transform and path data
- paint evidence
- tile/background filtering
- negative-space candidates
- source-use expansion provenance
- label OCR evidence

Normalization does not decide which source component is a Mahjong dot, glyph,
label, or artwork part.

Review SVGs are written to:

```text
scripts/output/asset-pipeline/<tilesetId>/images/identified-components-svg/<faceKey>.svg
scripts/output/asset-pipeline/<tilesetId>/images/identified-shapes-svg/<faceKey>.svg
```

## Label OCR Evidence

Normalization annotates components and shapes with expected-label OCR evidence
when a face has an expected label. The evidence is used by optional part
candidate scoring; it is not a separate review decision.

OCR compares candidate rendered masks against generated label templates. SVG
text evidence can also contribute to label candidate scoring when present in
the source data.

## Optional Part Assignment

Optional Part Assignment runs before alignment so label/glyph components do
not get absorbed into ordinary artwork matching.

It owns source-side optional facts for:

- `label` on every face
- `glyph` on flower and season faces

For each optional part, the accepted source-side decision is either:

- source-provided and bound to one or more source components
- source-absent and accepted on the part

Generated or omitted output is not decided here. Final rendering decides
whether an accepted-absent optional part becomes generated, omitted, or handled
another way.

Accepting optional parts promotes retained optional bindings to `accepted`,
marks optional parts accepted, clears non-optional source bindings, and
regenerates alignment and source assignment.

## Source Assignment

Source Assignment reviews the aligned proposal in reference context. It owns
the final source-side meaning used by rendering:

- accepted component-to-part bindings
- accepted source absence
- manual bind and unbind actions
- source assignment configuration changes
- rerun behavior

Accepted source bindings use `strength: "accepted"`. Part acceptance is stored
on `state.parts[partId]`.

Source Assignment does not own rendering output policy, colors, generated
labels, omitted labels, layout options, generated asset state, or publication.

## UI Boundary

The server synthesizes page view models from canonical state and durable
artifacts. The UI may keep draft selections while the user edits a page, but
server routes reconcile user actions back into `pipeline.json`.

