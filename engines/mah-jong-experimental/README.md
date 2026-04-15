## Mah Jong Experimental Engine

Use this folder for UI-less Mahjongg engine work that should be testable
without going through the feature UI or browser-oriented runtime path.

Current shape:

- `Grid`
  - generic 3D occupancy grid
- `GameState`
  - Mahjongg-specific board and tile state on top of the grid
- `GameRules`
  - stateless questions about Mahjongg game state
- `StateGraphAnalyzer`
  - hypothetical questions over copied game state
- `GameEngine`
  - runtime state machine over game state
- `GameGenerator`
  - construction of a fresh generated game state

This folder is intentionally separate from the current UI feature tree so we
can establish a lighter-weight testing workflow first.

Related notes:

- [Engine Split Notes](/c:/dev/poly-gc-react/agents/topics/engine-refactor/engine-split-notes.md)
- [Common Terms](/c:/dev/poly-gc-react/agents/topics/engine-refactor/common-terms.md)
- [Current Status](/c:/dev/poly-gc-react/engines/mah-jong-experimental/status.md)

## Glossary

### `layout`

The blueprint for where tile slots may exist.

`layout` defines:

- how many tile slots the board has
- where each tile slot can be placed

It does not define assigned faces or current play progress.

### `board`

The generated board definition for one game.

In this experiment, `board` is internal to `GameState`, just like `grid`.
It represents the generated tile definitions, including positions and assigned
faces.

After generation, the board should be treated as immutable.

### `play state`

The mutable runtime progress on a generated board.

Examples:

- which tiles are currently placed
- which tiles have been removed
- current occupied grid space
- undo/redo history
- current selection

### `Grid`

The generic sparse 3D occupancy structure.

`Grid` knows about:

- occupied points
- occupied boxes
- intersections

`Grid` does not know about Mahjongg rules, tiles, faces, or difficulty.

### `GameState`

The Mahjongg-specific state layer on top of `Grid`.

`GameState` is the only layer that should talk directly to:

- `grid`
- `board`

`GameState` exposes Mahjongg-facing operations like:

- tile enumeration
- tile position lookup
- tile face lookup
- placement/removal
- tile adjacency

### `GameRules`

The stateless Mahjongg business-logic layer.

`GameRules` answers questions such as:

- do these faces match?
- is this tile open?
- is this pair playable?
- is the board won or lost?

### `tile`

The conceptual Mahjongg tile or board piece.

Use this term when talking about the game concept rather than the numeric
handle used in code.

### `tileKey`

The board-local numeric handle used to refer to a tile in code.

Today this is backed by array indexing internally, but callers should treat it
as an opaque board-local key managed by `GameState`.

### `face`

The specific Mahjongg face assigned to a tile.

This is what gets matched during play.

### `face group`

The stable matching-group identity behind concrete faces.

Face-group identity is immutable. Inventory state may change during generation,
but a concrete face always belongs to the same face group.

### `solution`

One known valid removal path produced by generation.

This is generation output metadata. It is useful for callers, testing, and
analysis, but it is not part of `GameRules`.

### `difficulty`

The public generation level, such as:

- `easy`
- `standard`
- `challenging`
- `expert`
- `nightmare`

### `difficulty settings`

The full resolved generator rule bundle derived from a difficulty plus optional
overrides.
