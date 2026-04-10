# Engine Split Notes

## Purpose

Capture the current thinking about how the Mahjongg engine could be split into a board generator, a runtime game engine, and a shared rules layer without disturbing the active implementation yet.

## Current Engine Responsibilities

The current `engine` is doing several jobs:

- board generation
- runtime game-state mutation
- occupancy tracking
- playability checks
- undo and redo history
- event emission back to the controller

That makes it harder to reason about the boundary between:

- generating a solvable board
- mutating the state of an already generated game

## Historical Context

The Mahjongg engine originated in an earlier Pascal implementation and has
since been rewritten multiple times for different environments.

One important carryover from that history is the use of `NumberSet`.

In semantic terms, `NumberSet` is the JavaScript descendant of a Pascal
`set of ...` type:

- a compact finite set over a bounded integer domain
- fast membership checks
- direct set-style operations such as union, intersection, and difference

This matters because several engine structures still make the most sense when
read through that model, especially:

- board-surface occupancy tracking
- tile-membership tracking such as `placedTiles`
- open/selectable tile sets

So while some naming and implementation details have evolved, the underlying
state model still reflects the original Pascal set-based approach.

## Proposed Split

The current exploration is trending toward three pieces:

- `BoardGenerator`
  - create a solvable board from a layout and game number
- `GameEngine`
  - own runtime mutation of an already generated board
- `BoardRules`
  - hold the logic shared by both generator and engine

The shared rules layer is important because both generator and engine need the same core tests:

- occupancy
- whether a tile is open
- whether a tile pair is playable
- which tiles are selectable

The current idea is that generator and engine should both depend on shared board logic rather than one depending directly on the other.

## Central State Class

Another important part of the current direction is a central state class that owns primitive mutation and query methods without directly encoding Mahjongg gameplay decisions.

That state class would sit underneath both the generator and the runtime engine.

Its job would be to provide low-level state operations such as:

- storing and replacing the active board
- storing and replacing the active layout
- recording occupied and released tile positions
- tracking which tiles are present on the board
- tracking undo and redo history
- answering simple structural queries about current state

The important point is that these methods would not decide higher-level game rules such as:

- whether a player move is legal
- whether two tiles form a playable pair
- whether the board is won or lost

Those higher-level questions would belong in the shared rules layer or in the runtime engine.

So the intended layering is closer to:

- central state class
  - primitive mutation and structural query methods
- shared rules layer
  - occupancy and playability logic shared by generator and engine
- generator
  - solvable board construction
- runtime engine
  - game-state mutation and move orchestration

This matters because both generator and engine currently share low-level board and occupancy mechanics, and the central state class is one way to keep those mechanics in one place without forcing generator logic and runtime gameplay logic into the same object.

The current discussion suggests the primitive board-surface access pattern is smaller than exposing a whole board object. The main access needs appear to be:

- iterating through tiles
- accessing a specific piece
- querying board-surface occupancy
- querying whether a specific tile remains in play
- testing occupancy through `isUsed(x, y, z)`
- reading the remaining tile count

That points toward a focused primitive interface centered on iteration, piece lookup, occupancy queries, remaining-tile membership, and remaining-count access.

The current discussion also identified a small set of primitive mutation candidates:

- `configureBoard`
  - really an initial-state setup operation
- `setFace`
  - currently implicit in direct piece mutation, but likely worth making explicit
- `addPos`
  - record occupancy and tile presence on the board surface
- `subtractPos`
  - release occupancy and tile presence from the board surface

One important follow-up observation is that `tileCount` is currently tracked separately from the occupancy operations that logically change it.

That suggests a cleaner primitive design where operations like `addPos` and `subtractPos` also update the remaining tile count, so occupancy and tile-count mutation happen together rather than being coordinated manually by higher-level code.

## Generated Board Handoff

The generator would return a payload to the engine rather than mutating the engine directly.

Current experimental handoff shape:

- `boardNbr`
- `layout`
- `board`
- `solution`

That shape is represented by `GeneratedBoardPayload` in `engine.d.ts`.

Conceptually:

- `layout` describes where tiles may be placed
- `board` describes which actual tile faces occupy those places for one generated game
- `solution` describes one guaranteed solution path for that generated board

## Internal And External State

The current experiment distinguishes between:

- internal engine state
- external engine state

Internal state is for rule processing and mutation. It includes things like:

- `boardNbr`
- `layout`
- `board`
- `solution`
- `usedTiles`
- `usedSpaces`
- `selectableTiles`
- `playableTiles`
- `tileCount`
- `undoStack`
- `redoStack`

External state is the consumable state that other layers care about. It includes things like:

- `canUndo`
- `canRedo`
- `remaining`
- `won`
- `lost`
- `open`
- `played`

This is intentionally close to the existing `updateState` event payload.

## Event Compatibility

One possible bridge from a purer engine to the current architecture is to have a mutation return:

- `state`
- `derived`
- `events`

In that model:

- `state` is the new internal engine state
- `derived` is the external game state
- `events` is a list of externally visible mutation consequences that the controller can replay through the existing event system

That would preserve the current event-driven controller and React flow while making the core engine less dependent on event emission.

Another practical option is to build a compatibility layer over the new engine while the current architecture is still in place.

In that model:

- the new generator and engine can be designed around cleaner boundaries
- a compatibility wrapper can translate between the new engine API and the current controller expectations
- the wrapper can continue to expose the current event-oriented behavior until the rest of the feature is ready for a fuller refactor

That would make it easier to plug in a new engine incrementally rather than requiring a full cutover in one step.

## Shared Logic Candidate

The strongest candidate for extraction into a shared rules module is the logic around:

- occupancy checks
- open tile checks
- selectable tile calculation
- playable pair calculation

In the current engine this is spread across methods such as:

- `isUsed`
- `calcPlayableTiles`
- `calcSelectableTiles`
- `calcPlayablePairs`
- `isPlayablePair`

These are important because they are needed both:

- while generating a solvable board
- while mutating and validating the state of a live game

## Current Understanding Of Data Shapes

- `PositionSet`
  - the list of logical tile positions that define the shape of a layout
- `Layout`
  - the named blueprint for a board shape, including `positions`
- `Board`
  - the generated board for one game
- `Board.pieces`
  - the placed tile list, where each piece combines a `pos` and a `face`

This means:

- layout = where tiles may go
- board = which tile faces occupy those places in one generated game

## Historical Constraint

This work is exploratory. The active code still uses the original combined engine and event model. The goal of this experiment is to clarify the boundaries before attempting any production refactor.

## Open Questions

The following are currently the biggest open questions for formalizing the state-mutation interface:

- full board and layout accessors
- face mutation for generated pieces
- board creation from layout
- occupancy reset helpers

## Checklist

- [done] Create an experiment workspace under `src/gc/features/mj/src/engine/experiment`
- [done] Define the initial generator handoff object
- [done] Define internal and external experimental state shapes
- [done] Capture notes about a compatibility layer for incremental engine replacement
- [done] Capture the idea of a central state class with primitive mutation and query methods
- [done] Sketch `BoardSurfaceStateExperiment`
- [done] Identify the primitive surface access needs
- [done] Identify the primitive mutation candidates
- [todo] Decide the final primitive state properties for `BoardSurfaceStateExperiment`
- [todo] Decide whether `remainingTiles` is the better long-term name for `usedTiles`
- [todo] Decide whether `tileCount` should always mutate inside occupancy primitives
- [todo] Decide the exact board-definition access surface without exposing the whole board unnecessarily
- [todo] Decide the final API for `configureBoard`, `setFace`, `addPos`, and `subtractPos`
- [todo] Define the shared rules layer for occupancy and playability logic
- [todo] Extract an experimental board generator around the shared rules layer
- [todo] Extract an experimental runtime engine around the shared rules layer
- [todo] Define the compatibility wrapper that can translate the experimental engine back into the current event flow
- [todo] Decide when the experiment is mature enough to start a real refactor
