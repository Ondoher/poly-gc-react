# Assignment Scoring

This document owns candidate scoring concepts used by Optional Part Assignment
and Source Assignment proposals.

## Scope

Scoring proposes likely source components. It does not create durable truth by
itself. Durable truth is written only when the relevant stage accepts bindings
or part state into `pipeline.json`.

## Optional Candidate Inputs

Optional Part Assignment scores source components and source shapes using:

- expected optional part type
- face family and value
- source geometry bounds and center
- source order
- grouping/cohesion evidence
- component size relative to source viewBox
- rough region expectations
- SVG text metadata
- expected-label OCR evidence
- existing manual or accepted bindings

## Candidate Filtering

Candidates that are tile/background, invisible, non-alignable, or already
reserved by a stronger incompatible binding are excluded. Negative-space
components are not ordinary label/glyph candidates.

## Score Meaning

Scores are ranking aids. A high score means the candidate looks like a good
source-side optional part under the configured query; it does not mean the
candidate is accepted.

Review acceptance converts the proposal into canonical bindings and accepted
part state.

## OCR Contribution

Expected-label OCR can raise a label candidate when the component shape matches
the expected label template. Missing OCR evidence should cap confidence for
labels that should be readable, but it should not prevent review correction.

## Alignment Scoring

Alignment scoring is geometric fit cost and matching quality, not a human
confidence value. The aligner may use score to choose among candidates, but the
review contract consumes the selected compact match and final placement fields,
not every diagnostic score.

## Ownership

Scoring rules belong to the stage that uses them. If scoring changes produce a
different accepted result, the accepted result must be written back through
`PipelineModel`.
