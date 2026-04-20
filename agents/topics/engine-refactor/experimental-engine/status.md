## Experimental Engine Status

Last updated: 2026-04-11

This note tracks the current status of the UI-less Mahjongg engine experiment in
[engines/mah-jong-experimental](/c:/dev/poly-gc-react/engines/mah-jong-experimental).

This note is a progress snapshot, not the final architecture spec. For the
current structure, prefer the experimental-engine README and the generator
build plan.

Related roadmap:

- [Generator Build Plan](/c:/dev/poly-gc-react/agents/topics/engine-refactor/experimental-engine/generator-build-plan.md)
- [Archived Generator Build Plan A](/c:/dev/poly-gc-react/agents/topics/engine-refactor/experimental-engine/generator-build-plan-a-archived.md)

## Current State

The experiment now has a working, test-backed baseline for the core layers:

- `Grid`
  - sparse 3D occupancy with point/box operations
- `GameState`
  - the only layer that owns direct access to `grid` and `board`
- `GameRules`
  - stateless Mahjongg rule interpretation over `GameState`
- `StateGraphAnalyzer`
  - hypothetical copied-state analysis with chainable removals
- `TilePicker`
  - weighted scoring seam for open-tile selection
- `FaceInventory`
  - simple face-pair inventory for generation
- `GameGenerator`
  - simplified solved-by-construction generator with deterministic baseline flow
- `GameEngine`
  - initial runtime state-machine shell

The non-UI Jasmine lane is also in place:

- `npm run test:engines`

As of this update, the experimental lane passes:

- `111 specs, 0 failures`

## Completed So Far

- moved the experimental engine work out of the feature UI tree and into the
  repo-root `engines` workspace
- set up a lightweight Jasmine test lane for UI-less engine work
- established glossary terms for:
  - `layout`
  - `board`
  - `play state`
  - `tileKey`
  - `face`
  - `difficulty settings`
- shaped and implemented first-pass class interfaces for:
  - `Grid`
  - `GameState`
  - `GameRules`
  - `GameEngine`
  - `GameGenerator`
- extracted generation support classes:
  - `FaceInventory`
  - `TilePicker`
  - `StateGraphAnalyzer`
- hid raw `grid` access behind `GameState`
- shifted runtime code toward `tileKey` terminology for board-local tile
  handles
- implemented a first-pass deterministic generator with:
  - simple tile-pair removal
  - simple face assignment
  - final-state restoration for play

## Tile Picker Progress

`TilePicker.scoreOpenTiles()` now has the main score buckets from the live
picker, although not full live parity yet.

Implemented buckets:

- z-index / elevation factor
- spatial relationship factor
  - horizontal intersections
  - depth intersections
- open-pressure factor
- stack-balance factor
- short-horizon factor

Implemented support for these buckets:

- settings collapse from defaults, difficulty-derived settings, and per-call
  overrides
- hypothetical-state analysis through `StateGraphAnalyzer`
- deterministic short-horizon probe behavior

Still not at live parity:

- stack-safety rejection / hard filtering
- full score metadata parity such as `freedRank`
- full live naming parity for all pressure fields
- full live spatial mask behavior
- picker telemetry/stats recording

## Generator Progress

The current generator is intentionally simplified.

Implemented:

- `generate(layout, boardNbr, { difficulty, settingsOverrides? })`
- resolved difficulty settings
- full-board occupancy setup
- pair removal loop using `TilePicker`
- simple deferred face assignment
- deterministic output for the same seed/layout/difficulty

Not yet implemented:

- suspension flows
- face avoidance
- preferred face-group reuse tuning
- weighted normal/suspension/release branching
- compatibility wrapper back into the live engine event model

## State Analyzer Progress

`StateGraphAnalyzer` currently answers copied-state questions such as:

- open tile keys after hypothetical removals
- playable pairs after hypothetical removals
- lost-state detection after hypothetical removals
- tiles freed by hypothetical removals
- stack-balance summaries after hypothetical removals
- short-horizon collapse probing

This is the current home for graph-style and hypothetical questions that should
not live in `GameRules` or `TilePicker`.

## Open Questions

- when `GeneratorState` should become the active shared state object for the
  generator-side collaborators
- how closely the experimental `TilePicker` should track live score record
  naming versus using clearer experimental names
- whether stack-safety rejection should be implemented before deeper picker
  tuning
- when the experimental generator is mature enough to start informing the live
  refactor directly

## Near-Term Next Steps

- finish tightening the shared generator-side state story around
  `GeneratorState`
- continue tightening `TilePicker` parity where it adds real value without
  re-monolithizing the experiment
- keep clarifying the face-assignment orchestration boundary
- decide how much of the old difficulty telemetry should move into the
  experimental lane later, after the generator-side structure settles
