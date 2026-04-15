# Common Terms

Use this note to keep the experimental engine vocabulary consistent.

Several of these words are close enough to be confused in conversation, code
reviews, and refactor notes. This is the preferred meaning for each term in the
current experiment.

## Layer Terms

### `Grid`

The generic sparse 3D occupancy structure.

`Grid` knows:

- occupied points
- occupied boxes
- add/subtract operations on occupied space
- intersection checks

`Grid` does not know:

- Mahjongg tiles
- faces
- layouts
- legal moves
- difficulty

## `GameState`

Mahjongg-specific board state built on top of `Grid`.

`GameState` knows:

- board number
- layout
- board definition
- tile positions
- tile faces
- which tiles are currently placed
- tile adjacency relationships

`GameState` is the only layer that should talk directly to `Grid`.

## `GameRules`

Stateless Mahjongg business logic interpreted over `GameState`.

`GameRules` answers questions like:

- do these faces match?
- is this tile open?
- is this pair playable?
- is the board won?
- is the board lost?

`GameRules` should not own mutable state.

## `GameEngine`

The runtime state machine for a generated board.

`GameEngine` owns:

- undo stack
- redo stack
- selection state
- runtime move application

`GameEngine` should not generate boards.

## `GameGenerator`

The construction flow that creates a fresh generated `GameState`.

`GameGenerator` owns:

- generation orchestration
- temporary generation state
- difficulty-driven generation behavior
- final handoff of generated game state

## Board Terms

### `layout`

The blueprint for where tiles may exist.

Layout answers:

- how many tile slots exist?
- where can each tile slot be placed?

Layout is not the generated board.

## `board`

The generated board definition for one game.

Board answers:

- which tile slots exist for this game?
- what is each tile position?
- what face was assigned to each tile?

During generation, board faces are still being assigned.
After generation, the board is intended to be treated as immutable.

## `tile`

A tile id, usually an index into the board's `pieces` array.

Use `tile` when referring to:

- a specific Mahjongg piece slot on the board
- a tile id passed between state, rules, and engine methods

## `face`

The concrete Mahjongg face assigned to a tile.

This is the thing that gets matched during play.

## `face group`

The stable matching-group identity behind several concrete faces.

A face group is immutable.
Concrete faces belong to the same group when they should match.

In the current model:

- `Math.floor(face / 4)` gives the face group

So face group identity is stable even though inventory state changes during
generation.

## `face inventory`

The generation-time pool of available face pairs or face sets.

Face inventory is mutable generation state.
It is not runtime board state.

## Generation Terms

### `difficulty`

The caller-facing generation level such as:

- `easy`
- `standard`
- `challenging`
- `expert`
- `nightmare`

This is the public input to generation.

## `difficulty settings`

The full resolved rule bundle derived from a difficulty level, optionally with
overrides applied.

This includes things like:

- generation difficulty scalar
- suspension rules
- tile picker rules
- face assignment rules
- face avoidance rules

## `solution`

Generation output describing one known valid removal path for the generated
board.

`solution` is:

- produced by generation
- optional metadata for the caller
- not a rule
- not essential runtime state for ordinary play

## `open`

A rule term, not a raw state term.

A tile is open only after Mahjongg rules interpret state and adjacency.
Prefer not to use `open` for low-level state helpers.

## `adjacent`

A state/spatial term.

Adjacency helpers belong on `GameState`, for example:

- left adjacent
- right adjacent
- above adjacent
- below adjacent

`GameRules` can then interpret those relationships into Mahjongg concepts like
`open`.

## Practical Naming Rule

When in doubt:

- use `Grid` terms for points, boxes, and intersections
- use `GameState` terms for tiles, faces, positions, and adjacency
- use `GameRules` terms for open, playable, won, and lost
- use `GameGenerator` terms for difficulty, settings, solution, and generation flow
