## Archived Generator Build Plan A

This note sketches a tentative plan for building the experimental Mahjongg
generator from the outside in.

The guiding idea is:

- stabilize the public generation flow early
- keep the outer orchestration readable and close to the intended end state
- fill in deeper picker, face-assignment, and suspension behavior behind stable
  seams

## Design Goal

The finished generator should read as one deliberate authored pipeline:

1. create generator-side state
2. resolve difficulty settings and shared generation rules
3. populate face inventory
4. occupy the full board
5. repeatedly place the next generated step
6. assign deferred faces
7. restore the board for play
8. return a stable generated payload

That outer flow should settle before the inner algorithms reach full live
parity.

## Milestone 1: Stabilize The Outer Contract

Goal:

- make `GameGenerator.generate(layout, boardNbr, parameters)` the stable public
  entry point
- keep the return payload stable even while internals evolve

Target outcomes:

- `generate(...)` remains the only required public generation entry point
- returned payload shape is explicit and documented
- top-level generation stages are visible from one method without deep implicit
  coupling

Contract decisions to settle:

- what the public input shape is
- what the public output shape is
- which objects in the result are stable contract versus internal detail
- which generation details are returned now versus only kept as internal
  metadata

Recommended public input contract:

- `layout`
  - required board blueprint
- `boardNbr`
  - required deterministic seed / game number
- `parameters`
  - optional generation controls
  - should remain limited to public concepts such as:
    - `difficulty`
    - `settingsOverrides`

Recommended public output contract:

- `gameState`
  - the generated board restored to runtime-play occupancy
- `solution`
  - one known valid authored removal path

Optional future output fields to avoid exposing too early:

- generator telemetry
- suspension telemetry
- debug-only picker details
- internal pending-pair or suspension records

The default outer-contract rule should be:

- return only what runtime callers, tests, and analysis tools actually need
- keep internal generation scaffolding internal until there is a clear external
  consumer

Public invariants to lock down:

- the same `layout`, `boardNbr`, and `parameters` should produce deterministic
  output
- the returned `gameState` should already be restored for runtime play
- every tile slot should have an assigned face in the returned board
- the returned `solution` should be recorded in authored removal order
- the method should not require callers to perform extra “finalize” or
  “restore” steps after generation

Non-goals for milestone 1:

- do not chase full live difficulty parity yet
- do not expose temporary generator internals just to make debugging easier
- do not let telemetry needs distort the public generator API early
- do not require callers to know whether the generator currently uses
  `GameState`, `GeneratorState`, or other internal helpers

Implementation seams to preserve:

- `generate(...)` should remain the one public orchestration method
- helper methods such as `initializeState()`, `shuffleTiles()`,
  `occupyAllTiles()`, and `fillInRemainingFaces()` should stay internal
- lower-level collaborators such as `TilePicker`, `FaceInventory`, and
  `StateGraphAnalyzer` should not become required public dependencies of the
  caller

Suggested tasks:

- define the exact generated payload shape in code comments and this note
- confirm whether `gameState` alone is the runtime handoff object or whether a
  richer payload object is the long-term contract
- decide whether `solution` should remain duplicated both:
  - in the returned payload
  - and inside `gameState`
- confirm which parameter names are public and should be treated as stable
- keep top-level generation stages explicit in `GameGenerator.generate(...)`
- keep lower-level setup methods internal even if they remain test-visible
- avoid exposing active helper classes through the public contract
- keep the return shape independent of current internal staging classes such as
  `GeneratorState`
- document any intentionally unstable debug fields as internal-only if they
  must exist temporarily

Suggested test coverage for this milestone:

- generation returns the agreed payload shape
- generation restores the board for play before returning
- generation assigns faces to every tile before returning
- generation records one solution path in the returned payload
- repeated generation with the same seed and inputs is deterministic
- different seeds can change the authored result without breaking payload shape
- callers do not need to call any post-generation helper to make the result
  usable

Concrete milestone-1 checklist:

1. decide and document the stable `generate(...)` signature
2. decide and document the stable payload shape
3. remove or hide any outer-contract leakage from temporary internals
4. make `generate(...)` visibly own the full top-level orchestration
5. ensure current specs test the public contract rather than helper order alone
6. add one or two contract-focused tests for payload shape and restored runtime
   state

Review questions before calling milestone 1 done:

- if we later replace `GameState` with `GeneratorState` internally, would a
  caller need to change anything?
- if we later add suspension, would a caller need a new post-processing step?
- if we later add telemetry, can it be added without changing the basic
  generated payload?
- if we later refactor face assignment, can we keep `generate(...)` unchanged?

Definition of done:

- the method signature and returned payload feel stable enough that internal
  refactors do not need to keep changing them
- tests are asserting the public contract directly
- the top-level generation flow is easy to read without opening several helper
  classes first

## Milestone 2: Center Generator Work On `GeneratorState`

Goal:

- make `GeneratorState` the shared generator-side state object across
  generation classes

Why this comes early:

- it creates one place for generator-specific rules and shared helper state
- it gives `TilePicker`, `FaceRanking`, and future suspension helpers a common
  state model

Target outcomes:

- `GeneratorState` extends `GameState`
- generator-specific rules live there instead of being split awkwardly between
  plain `GameState`, loose settings objects, and helper classes
- option collapse belongs to generator-side state rather than to ad hoc helper
  assumptions

Suggested tasks:

- update `GameGenerator.createGameState(...)` or add a parallel
  `createGeneratorState(...)`
- make the active generator own a `GeneratorState`
- wire `TilePicker` to consume `GeneratorState`
- decide whether resolved difficulty settings should be copied into
  `GeneratorState`, referenced from it, or collapsed fully into it

Definition of done:

- active generator and picker code use `GeneratorState` as the shared
  generation-state model

## Milestone 3: Lock The Generation Pipeline Stages

Goal:

- make the internal generator flow look like the intended final architecture

Target stages:

- `initializeState()`
- `initializeGeneration()`
- `shuffleTiles()`
- `occupyAllTiles()`
- `placeGeneratedStep()`
- `fillInRemainingFaces()`
- `restoreBoardForPlay()`

Suggested tasks:

- rename or reshape methods where needed so each stage has one clear purpose
- keep branching policy in the generator layer rather than leaking it into
  state classes
- make the top-level control flow easy to read in one pass

Definition of done:

- `generate()` reads like the final design skeleton even if some inner logic is
  still simplified

## Milestone 4: Make Step Placement A Stable Policy Seam

Goal:

- shape one method around the three intended generated-step paths:
  - release a suspension
  - create a suspension
  - place a normal pair

Why this matters:

- it lets us keep the outer generation flow stable while filling in each branch
  later

Suggested tasks:

- keep a central `placeGeneratedPair()` or `placeGeneratedStep()` policy method
- structure it around the final branch order
- allow normal pair placement to remain the only active path until the other
  branches are ready

Definition of done:

- there is one explicit policy seam for “what kind of authored step happens
  next?”

## Milestone 5: Finish The Structural Tile-Selection Subsystem

Goal:

- get structural pair/triple selection stable before deep face-assignment work

Target outcomes:

- `TilePicker` owns tile scoring and candidate selection
- `StateGraphAnalyzer` owns copied-state and short-horizon questions
- dominant-stack safety becomes a first-class picker concern

Suggested tasks:

- finish `GeneratorState.collapseOptions()` wiring into `TilePicker`
- remove stale assumptions such as `this.state` if the final picker API differs
- add stack-safety filtering or rejection
- decide whether to match live naming exactly or keep clearer experimental names

Definition of done:

- picker behavior is structurally solid enough to author normal pairs and later
  suspension triples without changing the public seams again

## Milestone 6: Introduce Typed Generation Records

Goal:

- replace loose generation records with explicit domain classes

Current starting point:

- `TileSuspension` now exists as the suspension-domain record

Next likely record:

- a normal generated-pair record carrying deferred face-assignment metadata

Suggested tasks:

- use `TileSuspension` consistently for suspended records
- create a generated-pair record type or class for:
  - tile ids
  - preferred face group
  - avoidance targets
  - avoidance weight
  - resolved face assignment if already chosen

Definition of done:

- generator-side records are explicit enough that deeper face-assignment and
  suspension work stop depending on plain object conventions

## Milestone 7: Build Deferred Normal-Pair Face Assignment

Goal:

- make normal pair structure and face assignment two distinct phases

Target outcomes:

- structural pair placement happens first
- face assignment resolves later from richer pending records

Suggested tasks:

- move from plain `pairs` to richer deferred pair records
- add a preferred-face-group concept to the pending record
- keep face assignment in a dedicated later pass

Definition of done:

- normal pair generation no longer assigns faces in the simplest immediate way,
  and deferred face assignment becomes a real subsystem

## Milestone 8: Finish The Face-Assignment Subsystem

Goal:

- give face assignment its own stable supporting classes and rules

Target classes:

- `FaceInventory`
- `FaceRanking`
- `FaceAvoidance`

Suggested tasks:

- clean up `FaceInventory` and remove stale live-engine references
- make `FaceInventory` the real owner of remaining face sets and assigned-face
  history
- make `FaceRanking` own reuse spacing, preferred-group bias, and easy-side
  duplication behavior
- make `FaceAvoidance` own soft local face penalties

Definition of done:

- normal face assignment can express live concepts such as preferred reuse,
  spacing, and avoidance without those concerns leaking back into the outer
  generator shell

## Milestone 9: Add Suspension Flows

Goal:

- implement suspension after the normal structural and face-assignment paths are
  stable

Target outcomes:

- `TileSuspension` becomes active rather than only preparatory
- generator can choose among:
  - normal pair
  - suspension creation
  - suspension release

Suggested tasks:

- implement suspension-eligibility checks
- implement suspension creation
- implement release checks and force-release rules
- reserve and later consume face groups through the face-assignment subsystem
- track active suspended records through `TileSuspension`

Definition of done:

- the generator can author delayed matches intentionally rather than only
  simple normal-pair sequences

## Milestone 10: Add Telemetry And Compatibility

Goal:

- add the instrumentation and bridging layers only after behavior is stable

Target areas:

- picker stats
- suspension stats
- face-assignment stats
- compatibility wrapper back toward the live runtime/event model

Suggested tasks:

- decide which live telemetry matters in the experimental lane
- add stats at the supporting-class level instead of re-monolithizing the
  generator
- define the future compatibility surface to the current controller/runtime
  model

Definition of done:

- the experimental generator is observable, comparable to the live generator,
  and ready to inform a real integration path

## Recommended Build Order

1. stabilize the outer `generate(...)` contract
2. center generation on `GeneratorState`
3. lock the visible generation pipeline stages
4. make generated-step branching a stable policy seam
5. finish `TilePicker` and `StateGraphAnalyzer` wiring
6. introduce typed generation records
7. build deferred normal-pair face assignment
8. finish `FaceInventory`, `FaceRanking`, and `FaceAvoidance`
9. add suspension flows
10. add telemetry and compatibility

## Current Working Interpretation

If we follow the plan above, the current next best step is:

- wire the active `GameGenerator` and `TilePicker` around `GeneratorState`

That step removes one of the biggest remaining structural mismatches in the
experiment and gives later picker, face-assignment, and suspension work a
shared generator-state model.
