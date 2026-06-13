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

Another useful way to read that split is as a deeper layered model:

- occupancy layer
  - generic present/absent and used-space tracking
- Mahjongg state layer
  - Mahjongg-specific tile and board state built on top of occupancy
- `BoardRules`
  - Mahjongg business logic interpreted over Mahjongg state
- `BoardGenerator`
  - solvable board construction
- `GameEngine`
  - runtime mutation and controller-facing orchestration

That layering makes room for a more reusable lowest layer without forcing Mahjongg-specific tile knowledge into generic occupancy tracking.

The shared rules layer is important because both generator and engine need the same core tests:

- occupancy
- whether a tile is open
- whether a tile pair is playable
- which tiles are selectable

The current idea is that generator and engine should both depend on shared board logic rather than one depending directly on the other.

## Occupancy Layer And Mahjongg State

Another important part of the current direction is a lowest-level occupancy layer that owns primitive presence and used-space mutation without directly encoding Mahjongg gameplay decisions.

That occupancy layer would sit underneath a Mahjongg-specific state layer rather than being used directly by rules, generator, or runtime engine.

The occupancy layer would provide low-level operations such as:

- recording occupied and released tile positions
- tracking which tiles are present on the board
- answering simple structural queries about current state

The important point is that these methods would not decide higher-level Mahjongg rules such as:

- whether a player move is legal
- whether two tiles form a playable pair
- whether the board is won or lost

Those higher-level questions would belong in the Mahjongg-specific state layer, the shared rules layer, or the runtime engine.

The Mahjongg state layer would then sit directly on top of occupancy and would be the only layer allowed to talk to occupancy directly.

That Mahjongg state layer would own Mahjongg-specific board data such as:

- active board seed / board number
- generated board definition
- tile position lookup for the active board
- tile face access and mutation
- board-wide tile iteration
- piece lookup by tile index
- remaining tile count as exposed to Mahjongg-facing callers

In this model, sole access matters because it prevents generator logic, runtime engine logic, and rule logic from each reaching down into raw occupancy state in slightly different ways. Instead:

- occupancy stays generic
- Mahjongg state becomes the single adapter from generic occupancy into Mahjongg tile concepts
- rules interpret Mahjongg state
- generator and engine orchestrate actions using Mahjongg state and rules

This is also a useful boundary for future reuse. If the lowest layer is generic occupancy and does not know Mahjongg-specific layout or move semantics, then the same occupancy model could hypothetically support another tile-based game while Mahjongg-specific structure remains above it.

So the intended layering is closer to:

- occupancy layer
  - primitive presence and structural query methods
- Mahjongg state layer
  - Mahjongg tile and board access built on top of occupancy
- shared rules layer
  - Mahjongg business logic shared by generator and engine
- generator
  - solvable board construction
- runtime engine
  - game-state mutation and move orchestration

This matters because both generator and engine currently share low-level board and occupancy mechanics, and the occupancy-plus-Mahjongg-state split is one way to keep those mechanics in one place without forcing generator logic and runtime gameplay logic into the same object.

The current discussion suggests the primitive occupancy access pattern is smaller than exposing a whole board object. The main access needs appear to be:

- querying board-surface occupancy
- querying whether a specific tile remains in play
- testing occupancy through `isUsed(x, y, z)`

Those occupancy primitives are then wrapped by Mahjongg state methods that provide Mahjongg-facing access needs such as:

- iterating through tiles
- accessing a specific piece
- reading or writing a tile face
- retrieving a tile position
- reading the remaining tile count

That points toward a two-step interface:

- occupancy primitives for generic used-space and present-tile mutation
- Mahjongg state accessors for tile/piece/face/position access

The current discussion also identified a small set of primitive mutation candidates:

- `addPos`
  - record occupancy and tile presence on the board surface
- `subtractPos`
  - release occupancy and tile presence from the board surface

If the split becomes occupancy plus Mahjongg state, then methods such as:

- `configureBoard`
- `setFace`

still matter, but they belong more naturally to Mahjongg state than to raw occupancy.

One important follow-up observation is that `tileCount` is currently tracked separately from the occupancy operations that logically change it.

That suggests a cleaner primitive design where operations like `addPos` and `subtractPos` also update the remaining tile count, so occupancy and tile-count mutation happen together rather than being coordinated manually by higher-level code.

Under the occupancy-plus-Mahjongg-state model, that means:

- occupancy mutators should keep raw presence/count invariants correct
- Mahjongg state should expose those counts in Mahjongg terms
- higher-level code should not coordinate raw occupancy and raw counts manually

## Proposed Occupancy State Shape

With the Mahjongg-specific state layer sitting above occupancy, the lowest-level occupancy state can be smaller and more explicit.

The proposed occupancy data shape is:

- `usedSpaces`
  - occupied logical board-surface coordinates grouped by depth and row
- `usedTiles`
  - the set of tile ids currently present on the occupied surface
- `tileCount`
  - the number of tiles currently present

That means occupancy should not directly store:

- layout blueprints
- generated board definitions
- tile faces
- tile-position lookup tables
- undo or redo history

Those belong either to Mahjongg state or to higher orchestration layers.

## Proposed Occupancy Interface

The proposed occupancy interface is intentionally narrow:

- `reset()`
  - clear all occupancy state and restore the empty-surface invariants
- `occupyTile(tile, position)`
  - mark a tile present and occupy its logical position in one step
- `releaseTile(tile, position)`
  - mark a tile absent and release its logical position in one step
- `occupyPosition(position)`
  - lower-level used-space mutation primitive
- `releasePosition(position)`
  - lower-level used-space release primitive
- `isUsed(x, y, z)`
  - structural used-space query
- `hasTile(tile)`
  - test tile presence
- `forEachTile(callback)`
  - iterate through currently present tile ids
- `getTileCount()`
  - return the current count of present tiles

The design intent is that Mahjongg-facing callers should usually work through:

- `occupyTile()`
- `releaseTile()`
- `hasTile()`
- `getTileCount()`

and only the Mahjongg state layer itself should ever need to reason about raw position occupancy.

## Occupancy Invariants

The occupancy layer should keep the following invariants true after every mutation:

- every tile in `usedTiles` contributes exactly one unit to `tileCount`
- every occupied tile position is reflected in `usedSpaces`
- released tiles are absent from `usedTiles`
- released tile positions are absent from `usedSpaces`
- callers never need to manually synchronize `usedSpaces`, `usedTiles`, and `tileCount`

If those invariants hold, then Mahjongg state can safely treat occupancy as a reliable primitive substrate instead of coordinating raw structural state by hand.

## Generated Board Handoff

The generator would return a payload to the engine rather than mutating the engine directly.

Current experimental handoff shape:

- `boardNbr`
- `layout`
- `board`
- `solution`

That shape is currently represented by `GeneratorPayload` in the experimental
engine `types.d.ts` file.

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

- [done] Create an experiment workspace for UI-less engine work
- [done] Move the experimental engine workspace to `engines/mah-jong-experimental`
- [done] Define the initial generator handoff object
- [done] Define internal and external experimental state shapes
- [done] Capture notes about a compatibility layer for incremental engine replacement
- [done] Capture the idea of a central state class with primitive mutation and query methods
- [done] Sketch `Grid`
- [done] Identify the primitive surface access needs
- [done] Identify the primitive mutation candidates
- [todo] Decide the final primitive state properties for `Grid`
- [todo] Decide whether `remainingTiles` is the better long-term name for `usedTiles`
- [todo] Decide whether `tileCount` should always mutate inside occupancy primitives
- [todo] Decide the exact board-definition access surface without exposing the whole board unnecessarily
- [todo] Decide the final API for `configureBoard`, `setFace`, `addPos`, and `subtractPos`
- [done] Define the shared rules layer for occupancy and playability logic
- [in progress] Extract an experimental board generator around the shared rules layer
- [in progress] Extract an experimental runtime engine around the shared rules layer
- [todo] Define the compatibility wrapper that can translate the experimental engine back into the current event flow
- [todo] Decide when the experiment is mature enough to start a real refactor
