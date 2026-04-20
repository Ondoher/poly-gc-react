## Generator Build Plan

This note sketches a tentative bottom-up plan for building the experimental
Mahjongg generator.

The guiding idea is:

- finish the lowest-level primitives first
- test each layer in isolation before building upward
- let the final generator orchestration emerge from trusted building blocks

This is the opposite bias from plan A. Instead of stabilizing the outer
generation shell first, this plan assumes the more urgent need is to make the
generator's internals trustworthy and composable before we lock the top-level
flow.

The broad intent is:

- finish trusted lower layers first
- keep `GeneratorState` as the shared generator-side state hub
- push authored generator behavior such as `Tiles`, `Faces`, and
  `Suspensions` later in the plan

## Design Goal

The finished generator should be built from a stack of well-tested layers:

1. occupancy and Mahjongg state primitives
2. shared rule interpretation
3. copied-state analysis helpers
4. generator-side shared state
5. generation domain records
6. generator orchestration shell
7. structural tile orchestration
8. face orchestration
9. suspension orchestration
10. telemetry and compatibility

The main promise of this plan is that each layer should become dependable
before higher layers start leaning on it heavily.

## Milestone 1: Finish Core State Primitives

Goal:

- make the lowest-level state substrate solid before any deeper generator work

Core classes:

- `Grid`
- `GameState`
- `GeneratorState`
- `TileSuspension`

Why this comes first:

- every generator decision depends on trustworthy board state
- copied-state analysis and picker logic are only as good as the state model
- `GeneratorState` needs to become a real shared state object before generator
  helpers can build on it cleanly

Target outcomes:

- `Grid` is the stable occupancy substrate
- `GameState` is the stable Mahjongg-facing state layer
- `GeneratorState` is the stable generator-facing state extension
- generation-domain records use explicit types/classes instead of loose object
  conventions

Suggested tasks:

- confirm `Grid` responsibilities and invariants
- confirm `GameState` ownership of:
  - `board`
  - `layout`
  - `solution`
  - `placedTiles`
  - tile position and face access
  - occupancy-backed adjacency checks
- decide whether `GeneratorState` should:
  - store resolved settings directly
  - copy selected settings fields into generator-specific properties
  - or collapse options from both sources
- clean up `GeneratorState.collapseOptions()` so it refers to the actual shared
  state shape rather than stale assumptions
- make `TileSuspension` the standard suspension-domain record
- decide whether a generated normal-pair record class should join this
  milestone or the later face-assignment milestone

Suggested tests:

- `Grid` add/subtract/intersection invariants
- `GameState` configure/place/remove/clone behavior
- `GeneratorState` rule-field defaults and mutators
- `GeneratorState.collapseOptions()` behavior
- `TileSuspension` clone/data-shape behavior

Definition of done:

- lower-level state classes are trustworthy enough that higher layers no longer
  need to compensate for ambiguous state behavior

## Milestone 2: Finish Shared Rule Interpretation

Goal:

- make shared Mahjongg rule logic complete and boring

Core class:

- `GameRules`

Why this comes early:

- both runtime and generation depend on the same open/playable logic
- copied-state analysis should ask normal rule questions, not re-implement them

Target outcomes:

- openness logic is stable
- pair-playability logic is stable
- win/loss logic is stable
- rule behavior is clearly separated from mutation and generation policy

Suggested tasks:

- confirm `doFacesMatch(...)`
- confirm `isTileOpen(...)`
- confirm `isPlayablePair(...)`
- confirm open-tile enumeration and playable-pair enumeration
- confirm win/loss checks for copied-state and runtime use

Suggested tests:

- tile openness edge cases
- face-matching edge cases
- selected-tile playable-pair queries
- won/lost state transitions

Definition of done:

- higher layers can treat `GameRules` as trusted shared business logic rather
  than a place still in flux

## Milestone 3: Finish Copied-State Analysis

Goal:

- make hypothetical-state reasoning fully reliable before deeper picker tuning

Core class:

- `StateGraphAnalyzer`

Why this comes before picker completion:

- tile scoring already depends on copied-state questions
- suspension and face-avoidance targeting will depend on these same kinds of
  hypothetical queries later

Target outcomes:

- copied-state creation is reliable
- hypothetical tile removal works consistently
- freed-tile counts are trustworthy
- stack-balance summaries are trustworthy
- short-horizon probes are trustworthy

Suggested tasks:

- confirm state-copy semantics
- confirm "remove these tile keys hypothetically" behavior
- confirm open-tile queries after removals
- confirm playable-pair queries after removals
- confirm stack-balance calculations
- confirm short-horizon pressure behavior

Suggested tests:

- copied-state independence
- open-tile deltas after removals
- freed-tile counts
- dominant-stack detection inputs
- short-horizon collapse behavior

Definition of done:

- analyzer-backed picker factors no longer rest on partially trusted helper
  behavior

## Milestone 4: Finish Generator-Side Shared State Wiring

Goal:

- make `GeneratorState` the shared state object used by generation helpers

Why this is separate from milestone 1:

- milestone 1 stabilizes the class itself
- this milestone wires active collaborators around it

Core classes:

- `GeneratorState`
- `TilePicker`
- `FaceRanking`
- `GameGenerator`

Target outcomes:

- generator-side helpers consume `GeneratorState`
- stale assumptions such as `this.state` versus `settings + gameState` are
  resolved
- generator-specific rules live in shared generator state rather than being
  duplicated across helpers

Suggested tasks:

- decide final constructor/API shape for `TilePicker`
- wire `TilePicker` to `GeneratorState.collapseOptions()`
- update `FaceRanking` to use `GeneratorState` consistently
- decide whether `GameGenerator` should own:
  - one `GeneratorState`
  - plus helper collaborators
  - instead of a plain `GameState + settings` split

Suggested tests:

- `TilePicker` option resolution through `GeneratorState`
- generator-side rule propagation from `GeneratorState` into helpers

Definition of done:

- generator helpers share one agreed state model

## Milestone 5: Introduce Typed Generation Records

Goal:

- ensure generator orchestration works with explicit domain records before the
  authored decision systems are built on top

Current record:

- `TileSuspension`

Needed next:

- generated normal-pair record

Why this comes before `Tiles`, `Faces`, and `Suspensions`:

- the later generator-behavior classes should target stable record shapes
- orchestration should not keep depending on plain ad hoc objects
- suspension and deferred face assignment both need a durable metadata model

Target outcomes:

- structural generation records are explicit
- deferred face assignment has a typed home
- suspension and normal-pair handling both operate on stable record shapes

Suggested tasks:

- keep `TileSuspension` as the suspension record
- add a generated-pair record carrying:
  - tile ids
  - preferred face group
  - avoidance targets
  - avoidance weight
  - resolved faces or face group when applicable

Suggested tests:

- record construction
- record cloning or serialization if needed
- generator helper compatibility with the record shapes

Definition of done:

- later generator-behavior classes can target explicit domain records instead
  of inventing their own loose object conventions

## Milestone 6: Build Generator Orchestration Shell

Goal:

- build the top-level `GameGenerator` shell as a coordinator over trusted lower
  layers, while still keeping the authored decision systems late in the plan

Why it comes here:

- we still want one clear orchestration layer
- but we want `Tiles`, `Faces`, and `Suspensions` to remain late plug-in
  behaviors rather than early moving targets

Target outcomes:

- `GameGenerator` creates and initializes generator-side state
- it owns the top-level generation stages
- it records generated structure through typed records
- it can host temporary simplified behavior without locking the final
  `Tiles` / `Faces` / `Suspensions` systems too early

Suggested tasks:

- finalize `generate(...)` payload shape
- keep the top-level flow explicit and readable
- make sure orchestration owns:
  - initialize state
  - prepare the full board
  - place the next generated step
  - assign deferred faces
  - restore board for play
- keep concrete authored decision logic behind replaceable seams so the shell
  can stay stable while `Tiles`, `Faces`, and `Suspensions` evolve

Suggested tests:

- payload shape
- restored play-state output
- deterministic full-board generation
- generated board has assigned faces and a solution path

Definition of done:

- `GameGenerator` reads as a stable orchestration shell even if the deeper
  authored decision systems are still being upgraded later

## Milestone 7: Finish Structural Tile Orchestration

Goal:

- make structural tile-choice behavior reliable before deeper face and
  suspension work

Top-level class:

- `Tiles`

Core helper:

- `TilePicker`

Target outcomes:

- `Tiles` becomes the generator-side orchestration layer for structural choice
- score factors are stable
- difficulty windowing is stable
- stack-safety filtering is stable
- candidate selection behavior is explicit and test-backed

Suggested tasks:

- settle the `Tiles` boundary above `TilePicker`
- finish z-order factor behavior
- finish spatial relationship factor behavior
- finish open-pressure factor behavior
- finish balance factor behavior
- finish short-horizon factor behavior
- decide final score-record shape
- add hard filtering or rejection for dominant-stack danger
- decide whether to preserve live naming or clearer experimental naming

Suggested tests:

- `Tiles` integration over `TilePicker`
- each factor in isolation
- combined scoring behavior
- difficulty-window behavior
- stack-safety rejection
- deterministic selection under fixed seed

Definition of done:

- normal pair selection and future suspension triple selection can both build on
  the same trusted structural tile system

## Milestone 8: Finish Face Orchestration

Goal:

- make face assignment a real subsystem before suspension orchestration becomes
  more complex

Top-level class:

- `Faces`

Core helpers:

- `FaceInventory`
- `FaceRanking`
- `FaceAvoidance`

Why this comes here:

- the generator should compose a face subsystem, not invent it inline
- suspension depends on face-group reservation and later release

Target outcomes:

- `Faces` is the face-orchestration layer above the lower-level helpers
- `FaceInventory` is the trusted owner of face sets and assigned-face history
- `FaceRanking` can rank face groups for reuse and preferred bias
- `FaceAvoidance` can hold and query soft penalties

Suggested tasks:

- settle the `Faces` boundary above the lower-level helpers
- remove stale live-engine references from `FaceInventory`
- finish face-set draw/query helpers
- finish assigned-face history ownership
- finish ranking inputs and outputs in `FaceRanking`
- finish penalty bookkeeping in `FaceAvoidance`
- decide whether preferred-group and easy-side duplication belong fully inside
  `FaceRanking`

Suggested tests:

- `Faces` integration over its helper classes
- inventory population and draw behavior
- face-group history behavior
- ranking order behavior
- face-avoidance penalty accumulation and lookup

Definition of done:

- face assignment becomes a composable subsystem instead of a future TODO glued
  into `GameGenerator`, and `GameGenerator` no longer needs to know the
  low-level `FaceInventory` details directly

## Milestone 9: Add Suspension Orchestration

Goal:

- layer in delayed-match generation after normal structural and face-assignment
  paths are stable

Why it stays late:

- suspension depends on stable structural tile behavior
- suspension depends on stable face-group reservation and release behavior
- suspension is one of the most authored generator-specific systems, so it
  should sit near the end of a bottom-up plan

Top-level class:

- `Suspensions`

Core pieces:

- `TileSuspension`
- `GameGenerator`
- `Tiles`
- `Faces`

Target outcomes:

- `Suspensions` becomes the orchestration layer for delayed-match policy
- suspension creation works
- suspension release works
- suspension face-group reservation works
- release policy works

Suggested tasks:

- settle the `Suspensions` boundary above `TileSuspension`
- implement suspension eligibility rules
- implement suspension creation
- implement release checks
- implement force-release safety
- integrate face-group reservation and release

Suggested tests:

- suspension creation behavior
- release timing behavior
- face reservation behavior
- force-release safety behavior

Definition of done:

- delayed-match generation is a working authored mechanism rather than just a
  placeholder collection on the generator

## Milestone 10: Add Telemetry And Compatibility

Goal:

- add observability and integration only after the behavior stack is stable

Target areas:

- picker telemetry
- suspension telemetry
- face-assignment telemetry
- runtime/controller compatibility

Suggested tasks:

- decide which live telemetry to preserve experimentally
- add metrics where they naturally belong
- define the eventual compatibility surface toward the current runtime model

Definition of done:

- the experimental generator can be measured, compared, and eventually bridged
  back toward the live system

## Recommended Build Order

1. finish core state primitives
2. finish shared rule interpretation
3. finish copied-state analysis
4. finish generator-side shared state wiring
5. introduce typed generation records
6. build generator orchestration shell
7. finish structural tile orchestration
8. finish face orchestration
9. add suspension orchestration
10. add telemetry and compatibility

## Current Working Interpretation

If we follow the plan above, the current next best step is:

- finish `GeneratorState` wiring as the bridge between the trusted lower layers
  and the later generator-behavior systems

That step keeps the plan bottom-up while explicitly postponing `Tiles`,
`Faces`, and `Suspensions` until the layers underneath them are steadier.

