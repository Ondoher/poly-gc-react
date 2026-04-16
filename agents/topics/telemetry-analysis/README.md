# Telemetry Analysis Topics

Use this topic for notes about reading, summarizing, and interpreting live
feedback and telemetry from deployed Mahjongg games.

Use this folder when the task involves:

- inspecting stored telemetry or feedback records
- defining first-pass analysis questions
- turning raw game records into useful summaries
- identifying outlier boards, layouts, or difficulty levels for replay

## Current Scope

Current production telemetry assumptions are:

- each completed game is stored as one standalone record
- do not create a `sessionId`
- do not link multiple played games together
- consent controls whether telemetry is sent at game completion
- a completed game record ends on win, loss, or starting a new game after any
  recorded moves
- feedback may optionally include a compact game-context snapshot

## Main Documents

- [Telemetry Analysis Guide](/c:/dev/poly-gc-react/agents/topics/telemetry-analysis/telemetry-analysis-guide.md)

## Suggested Reading Order

1. Start with [Telemetry Analysis Guide](/c:/dev/poly-gc-react/agents/topics/telemetry-analysis/telemetry-analysis-guide.md)
   for the current production data model and first-pass analysis workflow.
