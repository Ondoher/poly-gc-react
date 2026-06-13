## Generator Build Plan

This note tracks the bottom-up plan for building the experimental Mahjongg
generator.

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
- treat `GeneratorState` as the source of truth for resolved generation behavior
- keep `Tiles` and `Faces` as primary domains that do not reach laterally into
  each other
- treat `Suspensions` as a higher-order generation-policy layer that composes
  public `Tiles` and `Faces` operations
- continue finishing `Tiles` and `Faces` before introducing the full
  `Suspensions` policy layer

Structural-helper guidance:

- when one generator interface is complex enough to split into helper classes,
  treat that collection as one structural unit of the generator
- the parts should remain separately testable
- options-object dependency injection is acceptable inside that tight unit for
  testability and boundary clarity
- method parameters should stay honest to production behavior; do not add
  parameters whose only job is to help tests steer internals
- except for constructor-level mocks, prefer stubbing `GeneratorState` or the
  relevant collaborator over adding method parameters solely for tests
- if a test needs different internal conditions, create those conditions through
  the same state or collaborator the runtime code uses
- if a test needs different generation behavior, configure `GeneratorState`
  rather than passing one-call behavior overrides through a domain method
- do not treat this as a general app-wide service/plugin pattern

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

## Current Progress Snapshot

Broadly complete or active:

- current engine test lane: `218 specs, 0 failures`
- milestones 1 through 6 are mostly in place for the current experimental lane
- milestone 7 is active: `Tiles` and `TilePicker` exist, with most ranking
  buckets implemented but not full live parity
- milestone 8 is active: `Faces`, `FaceInventory`, `FaceRanking`, and
  `FaceAvoidance` exist, with ranked face assignment and preferred face-group
  generation wired

Still mostly future work:

- milestone 9 now has the `Suspensions` orchestration seam, but no active
  suspension eligibility, creation, or release policy yet
- milestone 10 is mostly future work, though smaller parity checks should be
  added whenever a close live equivalent exists

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

- completed: confirm `Grid` responsibilities and invariants
- completed: confirm `GameState` ownership of:
  - `board`
  - `layout`
  - `solution`
  - `placedTiles`
  - tile position and face access
  - occupancy-backed adjacency checks
- completed: decide `GeneratorState` should store resolved settings and copy
  selected settings fields into generator-specific properties:
  - store resolved settings directly
  - copy selected settings fields into generator-specific properties
- completed: replace `GeneratorState.collapseOptions()` with explicit
  ranking-setting accessors on `GeneratorState`
- completed: remove one-call difficulty/behavior overrides from core generator
  domain methods; difficulty-derived behavior now comes from `GeneratorState`
- completed: make `TileSuspension` the standard suspension-domain record
- completed: add `GeneratedPair` as the normal tile-pair generation record

Suggested tests:

- `Grid` add/subtract/intersection invariants
- `GameState` configure/place/remove/clone behavior
- `GeneratorState` rule-field defaults and mutators
- `GeneratorState` ranking-setting accessor behavior
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

- tile ranking already depends on copied-state questions
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

- completed: decide final constructor/API shape for `TilePicker`
- completed: wire `TilePicker` to explicit `GeneratorState` ranking-setting
  accessors
- completed: update `FaceRanking` to use `GeneratorState` consistently
- completed: decide `GameGenerator` should own:
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
  policy decision systems are built on top

Current records:

- `TileSuspension`
- `GeneratedPair`

Why this comes before `Tiles`, `Faces`, and suspension policy:

- the later generator-behavior classes should target stable record shapes
- orchestration should not keep depending on plain ad hoc objects
- suspension and deferred face assignment both need a durable metadata model

Target outcomes:

- structural generation records are explicit
- deferred face assignment has a typed home
- suspension and normal tile-pair handling both operate on stable record shapes

Suggested tasks:

- completed: keep `TileSuspension` as the suspension record
- completed: keep `GeneratedPair` as the normal tile-pair record carrying:
  - tile keys
  - preferred face group
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
  layers, while still keeping the policy decision systems late in the plan

Why it comes here:

- we still want one clear orchestration layer
- but we want `Tiles`, `Faces`, and later suspension policy to remain plug-in
  behaviors rather than early moving targets

Target outcomes:

- `GameGenerator` creates and initializes generator-side state
- it owns the top-level generation stages
- it records generated structure through typed records
- it can host temporary simplified behavior without locking the final
  `Tiles` / `Faces` / `Suspensions` systems too early

Suggested tasks:

- completed: finalize `generate(...)` payload shape
- completed: keep the top-level flow explicit and readable
- completed: keep `initializeTiles()` as the structural tile-orchestration seam that
  creates `Tiles`
- completed: keep `initializeFaces()` as the face-orchestration seam that creates
  `Faces`, with `GameGenerator.shuffleTiles()` only as a temporary compatibility
  alias
- completed: keep `preparePairs()` as the current prepared tile-pairs generation
  stage seam, with `generatePairSet()` only as a temporary compatibility alias
- completed: keep `assignFacesToPreparedPairs()` as the current face-assignment
  stage seam, with `assignFacesToPairSet()`, `assignDeferredFaces()`, and
  `fillInRemainingFaces()` only as temporary compatibility aliases
- completed: make sure orchestration owns:
  - initialize state
  - prepare the full board
  - place the next generated step
  - assign face pairs to prepared tile pairs
  - restore board for play
- keep concrete policy decision logic behind replaceable seams so the shell
  can stay stable while `Tiles`, `Faces`, and later suspension policy evolve

Suggested tests:

- payload shape
- restored play-state output
- deterministic full-board generation
- generated board has assigned faces and a solution path

Definition of done:

- `GameGenerator` reads as a stable orchestration shell even if the deeper
  policy decision systems are still being upgraded later

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
- ranking factors are stable
- difficulty windowing is stable
- stack-safety filtering is stable
- candidate ranking and selected-tile behavior are explicit and test-backed

Suggested tasks:

- completed: keep `GameGenerator` dependent on `Tiles`, not directly on
  `TilePicker`
- implemented: z-order factor behavior
- implemented: spatial relationship factor behavior
- implemented: open-pressure factor behavior
- implemented: balance factor metadata
- implemented: short-horizon factor behavior
- decide final ranked-record shape
- add hard filtering or rejection for dominant-stack danger
- decide whether to preserve live naming or clearer experimental naming

Suggested tests:

- `Tiles` integration over `TilePicker`
- each factor in isolation
- combined ranking behavior
- difficulty-window behavior
- stack-safety rejection
- deterministic selection under fixed seed

Definition of done:

- normal tile-pair selection and future suspension triple selection can both build on
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
- `FaceInventory` is the active owner of face sets, selected-group face-pair
  selection, and assigned-face history
- `FaceRanking` can rank and select face groups for reuse, preferred bias,
  easy duplicate expansion, and avoidance-aware ordering
- `FaceAvoidance` holds and queries shared generation-run soft penalties
- `Faces` wires ranking, difficulty-window selection, concrete face-pair selection,
  board mutation, assignment-history recording, and stored avoidance marks

Soft-link concept:

- soft links are tile-specific generation metadata, not inherently
  face-specific
- the current soft-link rule is intentionally simple:
  - when a pair is selected, record the non-source tiles that are open after
    that pair is hypothetically played/removed
- those recorded tiles are available by timing/context, not by geometric
  closeness
- the current face-domain use of those links is face avoidance:
  - after the source pair receives a face group, `FaceAvoidance` adds soft
    ranking pressure against assigning that same face group to the linked
    available tiles
- this separates reusable structural/context metadata from the face-specific
  pressure that consumes it

Implementation requirement:

- soft-linked open tiles are now the explicit source of truth for this
  structural context
- `FaceAvoidance` pressure is layered on top of that source data through
  `Faces.applyFaceAvoidance(pair)`
- avoid extending `avoidanceTargets`, `avoidanceTiles`, or similarly vague
  names as the primary API
- this is new experimental code, so do not carry transitional aliases unless a
  caller outside the experimental engine actually requires one

Suggested tasks:

- keep `GameGenerator` dependent on `Faces`, not directly on low-level face
  drawing
- completed: preferred face-group generation for `GeneratedPair` records
- completed: Stage 1 soft-link recording through `Tiles`
- completed: Stage 2 face-avoidance pressure consumption through
  `Faces.applyFaceAvoidance(pair)`
- completed: neutral full-face-set selection through
  `Faces.selectFullFaceSet(pair)`
- keep `SoftLinks` on `GeneratorState` as the explicit source of truth for
  soft-link records; `GeneratedPair` should not own link payloads
- decide whether selected-group history should stay in `FaceInventory` or move
  to a dedicated assignment-history helper during the folder restructure
- compose full-face-set selection from future suspension policy without making
  `Faces` aware of suspensions
- decide which face-assignment and face-avoidance telemetry should be preserved
- keep `ranked-window.js` as the shared tile/face windowing helper and consider
  moving it to a future `tools` folder

Soft-link implementation plan:

Before implementing additional face-avoidance pressure behavior, complete these
steps first:

1. Completed: add `SoftLinks`.
   - `SoftLinks` is a small tile-link registry owned by `GeneratorState`.
   - It stores links as records with an id, type, role, and linked tile list.
   - The link `type` is a constrained construction method such as `open-tiles`
     or `grouped`.
   - The link `role` is freeform context such as `after-removal` or a future
     `reservation`.
   - Consumers decide how to interpret zero, one, or many matching links.
2. Completed: add `Tiles.getOpenSoftLinkTiles(options)`.
   - Current option shape:
     - optional `removeTiles`
     - optional `ignoreTiles`
   - `removeTiles` and `ignoreTiles` are actions to perform while deriving
     links, not descriptions of work already done.
3. Completed: add `Tiles.recordSoftLinks(pair)`.
   - Responsibility: evaluate the current open-tile soft-link rule and store
     an `open-tiles` / `after-removal` record in `GeneratorState.softLinks`.
   - Timing: called automatically by `Tiles.selectGeneratedPair()` before the
     selected pair is committed/removed from the working board.
4. Completed: add the face-domain consumption step separately.
   - Method name: `applyFaceAvoidance(pair)`
   - Responsibility: after face assignment, query `GeneratorState.softLinks`
     for `open-tiles` / `after-removal` records matching the pair's source
     tiles and apply `FaceAvoidance` pressure for `pair.faceGroup`
   - This keeps `FaceAvoidance` as the face-specific pressure store rather than
     the owner of soft-link discovery.
5. Stage 1 tests are in place.
   - Soft-link tests should assert open-tile recording after hypothetical pair
     removal.
6. Stage 2 tests are in place.
   - Face-avoidance tests should assert that assigned face groups create
     penalties against the recorded soft-linked open tiles.
7. Update the glossary/readme after each migration stage.
   - Define `soft link` as non-binding generation metadata from a source pair to
     contextually available tiles.
   - Define the current soft-link rule as recording open tiles after pair
     removal.
   - Define `FaceAvoidance` as the face-domain consumer that discourages
     accidental same-face-group pairing on those soft-linked open tiles.

Suggested tests:

- `Faces` integration over its helper classes
- inventory population and draw behavior
- face-group history behavior
- ranking order behavior
- face-avoidance penalty accumulation and lookup
- preferred-group generation behavior
- soft-linked-open-tile recording behavior
- face-avoidance consumption of recorded soft links
- focused live-parity checks that run the same prepared-pair, face-inventory,
  avoidance, difficulty, and random-seed inputs through the closest equivalent
  live generator methods and the experimental `Faces` path
- full-face-set selection behavior through `Faces.selectFullFaceSet()`

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
- suspension is one of the most policy-heavy generator-specific systems, so it
  should sit near the end of a bottom-up plan

Top-level class:

- `Suspensions`

Core pieces:

- `TileSuspension`
- `GameGenerator`
- `Tiles`
- `Faces`

Target outcomes:

- `Suspensions` becomes the cross-domain orchestration layer for delayed-match
  policy
- suspension creation works
- suspension release works
- suspension face-group reservation works
- release policy works

Suggested tasks:

- completed: settle the `Suspensions` boundary above `TileSuspension`
  - constructor uses one options object: `{ state, tiles, faces }`
  - active methods are policy shells only
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

- delayed-match generation is a working policy mechanism rather than just a
  placeholder collection on the generator

## Milestone 10: Add Telemetry And Compatibility

Goal:

- add observability and integration only after the behavior stack is stable
- compare old and new engine behavior before retiring the live generator

Target areas:

- picker telemetry
- suspension telemetry
- face-assignment telemetry
- runtime/controller compatibility
- old-vs-new generation parity

Suggested tasks:

- decide which live telemetry to preserve experimentally
- add metrics where they naturally belong
- define the eventual compatibility surface toward the current runtime model
- build a parity harness that runs the live generator and experimental generator
  with the same layouts, board numbers, difficulties, and settings
- add smaller parity tests at each milestone when there is a close live
  equivalent, instead of waiting for the whole-generator harness
- compare generated boards, assigned faces, solution paths, and relevant
  telemetry where exact parity is expected
- document intentional differences where the experimental generator is meant to
  diverge
- if parity is not complete, decide whether the old engine must remain
  available for analysis of existing generated-game data

Definition of done:

- the experimental generator can be measured, compared, and eventually bridged
  back toward the live system
- the team has an explicit decision on whether the old generator can be retired
  or must be preserved as an analysis/reference path

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

- implement the first small suspension eligibility question inside
  `Suspensions` now that the `GameGenerator.preparePair()` / `Suspensions.step()`
  seam exists

Architectural guardrail for that work:

- shared information should come from `GeneratorState`
- data needed for playing the generated game belongs in `GameState`
- generation-only data belongs in `GeneratorState`
- `Tiles` and `Faces` are primary domains and should not reach laterally into
  each other
- `Suspensions` may coordinate `Tiles` and `Faces` through their public APIs
  because delayed-match policy spans both domains
- `Faces` may read prepared-pair metadata and shared state, but should not call
  `Tiles` to ask how a pair was selected
- if preferred face groups or face-avoidance pressure needs structural context,
  expose that context through `GeneratorState`, prepared-pair metadata, or a
  pure analyzer/helper rather than creating a lateral domain dependency
- prepared pairs are generation-only, so `preparedPairs` belongs to
  `GeneratorState`; structural soft-link metadata belongs to
  `GeneratorState.softLinks`

Preferred face-group generation, Stage 1 soft-link recording, Stage 2
face-avoidance pressure consumption, full-face-set selection, and the
`GameGenerator.preparePair()` / `Suspensions.step()` policy seam are now in
place. The most useful next work is adding the first small suspension
eligibility question without implementing the whole suspension algorithm at
once.

