# Telemetry Analysis Guide

Use this document to interpret the deployed Mahjongg telemetry and feedback
data now being written to MongoDB.

## Purpose

The goal of this topic is not to redesign telemetry collection. It is to help
us answer practical questions from the data we already collect, such as:

- which difficulty levels are actually being played
- which layouts are producing more losses or abandonment
- which boards deserve local replay
- whether player behavior matches current difficulty assumptions
- what feedback comments are attached to specific board contexts

## Current Production Data Shape

Current production telemetry stores one standalone completed-game record per
played game.

Core identity fields:

- difficulty
- layout
- board number

Core play fields:

- elapsed time
- result
- tile sequence

The tile sequence is intentionally compact. It is enough to:

- reconstruct the played line
- infer forward versus backward movement
- estimate undo and redo behavior
- infer whether the game was won from the sequence and board reconstruction

Feedback records currently store:

- board number
- difficulty label
- layout title
- rating fields
- free-form comment
- optional compact game context

## Important Constraints

Interpret results with these limits in mind:

- no `sessionId`
- no cross-game linking for the same player
- no per-action timestamps
- no direct personal identity fields in structured telemetry
- free-form feedback comments may still contain user-supplied personal content

That means the analysis should stay centered on:

- board behavior
- level behavior
- layout behavior
- aggregate gameplay patterns

not user profiling.

## Best First Questions

The first high-value questions for this repo are:

- How many played games do we have per difficulty?
- How many completed games do we have per layout?
- What share of completed games end as won, lost, or abandoned?
- Which board numbers appear in feedback comments?
- Which boards have unusually long play times?
- Which boards have unusually short or unusually long tile sequences?
- Which layouts produce more abandonment than expected?
- Which difficulty levels show heavier inferred undo behavior?

## Recommended First Summaries

Start with simple grouped summaries:

- telemetry count by difficulty
- telemetry count by layout
- result count by difficulty
- result count by layout
- average elapsed time by difficulty
- average elapsed time by layout
- longest elapsed-time boards
- longest tile-sequence boards
- feedback count by difficulty and layout

These summaries should give us a quick feel for whether the deployed ladder and
layout mix are behaving roughly as expected.

## Reconstructing A Played Game

To replay or inspect a specific board locally, use:

- difficulty
- layout
- board number
- tile sequence

The intended workflow is:

1. recreate the board locally from the stored identity fields
2. walk the stored tile sequence against the recreated board
3. infer where the player advanced, backtracked, or abandoned
4. compare the played line to solver or analyzer expectations

This is especially useful for:

- boards mentioned in feedback comments
- boards with unusually long elapsed times
- boards with unusually high inferred backtracking
- boards that contradict the expected difficulty ladder

## Analysis Priority Order

When new data comes in, analyze it in this order:

1. aggregate counts and result mix
2. outlier boards by time or move count
3. feedback-linked boards
4. layout-specific anomalies
5. difficulty-specific anomalies

This keeps the first pass practical and makes it easier to pick concrete boards
for local replay.

## Mongo Collections

Current production Mongo collections are:

- `feedback`
- `telemetry`

Current production database name is:

- `poly_gc_prod`

## Recommended Mongo Checks

Useful first checks in Mongo are:

- document count in `telemetry`
- document count in `feedback`
- latest feedback records with board and layout context
- latest telemetry records with difficulty, layout, result, and elapsed time
- grouped counts by difficulty
- grouped counts by layout

## Practical Success Criteria

This topic is doing its job if it helps us:

- quickly confirm production data is arriving
- identify which boards deserve local replay
- compare live play against expected difficulty behavior
- connect subjective feedback to a concrete board and play history

## Related References

- [MVP README](/c:/dev/poly-gc-react/agents/topics/mvp/README.md)
- [MVP Implementation Checklist](/c:/dev/poly-gc-react/agents/topics/mvp/mvp-implementation-checklist.md)
- [Difficulty Validation Data Collection](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-validation-data-collection.md)
- [Deployment Checklist](/c:/dev/poly-gc-react/agents/topics/deployment/deployment-checklist.md)
