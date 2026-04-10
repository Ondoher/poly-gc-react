# Mahjongg Solver And Analysis Tool

## Goal

Capture notes for building a standalone solver/analysis tool around the existing
Mahjongg engine.

This tool is intended to support:

- difficulty measurement
- generator validation
- tuning of future difficulty algorithms such as tile suspension
- exploratory analysis of layouts, seeds, and playable-pair structure

It is not primarily a player-facing feature. It is a development and analysis
tool.

## Core Purpose

The main purpose of the tool is to answer questions like:

- how many successful solve paths appear to exist?
- how often do legal moves lead to dead ends?
- how much backtracking is needed to solve a board?
- how sensitive is the board to choosing one matching pair over another?
- how does a generation tweak change those metrics?

For generated boards in this engine, solvability is generally assumed because
the builder is intended to produce boards with at least one solution.

So the main value of the tool is not proving that a generated board is winnable.
It is measuring how the search space behaves:

- how forgiving it is
- how constrained it is
- how punishing wrong local choices become
- how much solver effort is needed to recover from ambiguity

## Why Build It Separately

The existing engine is optimized for live gameplay.

The solver/analysis tool should stay separate because it will likely need:

- repeated state exploration
- branching and backtracking search
- metric collection
- batch analysis across many generated boards
- debug-oriented output that should not complicate gameplay code paths

Keeping it separate also makes it easier to run in scripts, tests, or future
analysis workflows.

## Suggested Scope

The first version should focus on analysis rather than full feature richness.

### Phase 1

- load or generate a board
- enumerate playable pairs
- recursively explore moves
- detect solved branches and dead-end branches
- collect basic metrics

### Phase 2

- compare multiple solve paths
- estimate solution multiplicity
- collect branching-factor profiles
- record backtracking cost

### Phase 3

- add pair-choice sensitivity analysis
- compare baseline generation against suspension-enabled generation
- support batch evaluation across seeds and layouts

## Candidate Inputs

The tool should eventually support inputs such as:

- layout id
- board number / seed
- tile size should not matter for solving
- optional future generation mode or difficulty mode
- optional suspension settings once implemented

## Candidate Outputs

Useful outputs may include:

- number of explored states
- number of dead ends
- number of backtracks
- branching profile
- estimated number of successful solve paths
- pair-choice sensitivity score
- summary difficulty profile

For generated boards, `solvable / unsolvable` is secondary. It may still be
useful as a guardrail or regression check, but it is not the primary analytic
goal.

## Likely Architecture

The cleanest design is probably:

- a solver that works from engine-compatible board state
- an analysis layer that records metrics during search
- optional script or command entry points that run batches

Possible internal pieces:

- `SolverState`
  - board occupancy
  - placed tiles
  - currently playable pairs
  - move history

- `Solver`
  - explores legal moves
  - supports backtracking
  - reports solved and failed branches

- `AnalysisRecorder`
  - collects branching and dead-end statistics
  - measures pair-choice divergence
  - aggregates results

## Implementation Notes

- Reuse engine rules where practical instead of re-implementing move legality
  from scratch.
- Prefer a representation that can be cloned cheaply, because search will
  expand many states.
- Treat the first version as an instrumentation tool, not as a perfect
  production solver.
- Assume generated boards should already be solvable and focus instrumentation
  on difficulty characteristics rather than only on yes/no solvability.
- Favor metrics that help tune generation over metrics that are expensive but
  not actionable.

## Relationship To Difficulty Measurement

The difficulty-measurement note defines what should be measured.

This note is about the tool needed to obtain those measurements.

In short:

- `difficulty-measurement.md`
  - what to measure and why

- `solver-analysis-tool.md`
  - what to build in order to measure it

## Immediate Next Step

When work begins, the first design pass should define:

- how to snapshot engine state for branching search
- whether the solver reuses `Engine` directly or uses a lighter derived state
  model
- what the smallest useful metric set is for the first runnable prototype

## Current Prototype Baseline

The current script-side prototype lives under:

- [scripts/difficulty](/c:/dev/poly-gc-react/scripts/difficulty)

It supports generator modes:

- `engine`: use the active game engine generator
- `standalone`: scripts-side solved-by-construction generator mirroring the
  current engine approach
- `random`: random face-dealt board, where each placed tile receives a random
  remaining face

The prototype currently measures:

- initial playable pair count
- same-face pair-choice sensitivity
- known solution path branching when a known solution is available
- bounded search branching and dead ends
- deterministic random playout solve/dead-end rates
- average remaining tiles after playouts

The random face-dealt mode has no known solution path by construction, so the
tool reports that path as `unknown`. This should not be interpreted as
unsolvable without a full solver pass.
