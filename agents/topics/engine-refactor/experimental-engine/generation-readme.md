# Mahjongg Generation Terms

This note explains the vocabulary used by the experimental Mahjongg generator.
It is intentionally human-facing: the goal is to make the generation model easy
to talk about before diving into class names or implementation details.

Engine-wide runtime terms can be added later. This file focuses on generation.

## Promotion Intent

When the experimental engine is promoted to replace the live engine, this note
should become the basis for the official engine `README.md`.

Until then, keep this file readable as product-facing engine documentation, not
just as refactor scratch notes. Implementation-specific planning can stay in the
topic status, build plan, and mapping documents.

## Generation Flow

The generator builds a solvable board backward.

1. Start from a layout that defines every possible tile slot.
2. Temporarily occupy every tile slot.
3. Select structural tile pairs from the currently open tiles.
4. Record structural soft links for each selected pair.
5. Commit each selected tile pair into `GeneratorState.preparedPairs`.
6. Remove each committed tile pair from the temporary working board.
7. After all tile pairs are prepared, assign face pairs to those prepared tile
   pairs. At that point the prepared pairs become assigned pairs, and their
   tiles become assigned tiles.
8. Complete any later generation stages that may be added in the future.
9. Treat the final tile and pair records as generated, then restore the board
   to full occupancy for runtime play.

The solution path is a byproduct of this process. Because generation works
backward, every committed tile pair records one step in a known valid removal
path.

## Core Generation Terms

### Layout

The blueprint for tile slots.

A layout says where tile slots may exist. It does not say which faces are on
those tiles, which tile pairs will match, or what the solution order is.

### Tile Key

The board-local numeric handle for one tile slot.

Use `tileKey` when talking about code references to tile slots. It is not a
face, and it is not a global tile identity.

### Tile Pair

Two board-local tile keys that form one structural or playable pair.

Tile pairs are about board slots and removal order. They do not imply that
faces have already been assigned.

### Prepared Pair

A committed tile pair that is ready for face assignment.

Prepared pairs are the tile-domain output of structural generation. They are
not yet the full generated game because they may still need concrete face pairs.

### Prepared Pairs

The collection of prepared tile pairs produced during generation.

`preparedPairs` replaces older "pair set" language. It means the tile-pair
structure is ready for the face domain, not that the whole game is complete.
In the experimental engine this collection belongs to `GeneratorState`, because
it is generation-only metadata rather than playable game state.

### Soft Link

Non-binding tile metadata from a source prepared pair to contextually available
tiles.

The current soft-link rule records open tiles after the source pair is
hypothetically removed from the working board, excluding the source tiles
themselves. These links are about availability timing, not geometric closeness.

Soft links are tile-specific. They are not generic connections between arbitrary
things. They are intentionally general only in the narrower sense that they are
not owned by one consumer such as face avoidance. Face avoidance can later
consume `open-tiles` links with the `after-removal` role to discourage
accidental same-face-group pairing, but the soft-link record itself is not
face-specific.

Soft links live in the `SoftLinks` tile-link registry owned by
`GeneratorState`, not on individual prepared pairs. A link `type` describes how
the linked tile list was formed, while a link `role` describes why that snapshot
was recorded:

- `open-tiles` means the list was derived by asking the graph which tiles are
  open under the supplied options.
- `grouped` means the list was assembled directly by a generator domain.
- `after-removal` is the current role for open-tile links recorded when a
  selected pair is hypothetically removed.
- `reservation` is a likely future role for grouped links created while
  reserving a face set for suspension.

### Assigned Tile

A tile after face assignment.

An assigned tile belongs to a prepared tile pair and has received its concrete
face. Assignment is currently the last mutation applied to an individual tile
before the board is restored for play, but the term does not mean generation is
complete forever. Later generator stages may still be inserted after assignment.

Assigned is intentionally different from playable. A tile can be assigned but
blocked, so it is not necessarily legal to remove yet.

### Assigned Pair

A prepared tile pair after face assignment is complete.

An assigned pair has both structural tile keys and the concrete face pair that
will be shown on those tiles during play. It is a pair-level term, not a
replacement for assigned tile.

### Generated Tile

A tile after all generation stages are complete.

Today, an assigned tile usually becomes a generated tile immediately because
there are no later per-tile generation stages. If a later stage is added, the
tile should not be called generated until that stage has also completed.

### Generated Pair

A tile pair after all generation stages are complete.

Generated pair is the pair-level final state. Keep it conceptually separate
from generated tile: the pair describes the relationship between two tile keys,
while each tile describes one board slot with its own assigned face.

### Face

One concrete Mahjongg face id.

A face is what the player sees on a tile. Matching is based on face-group rules,
not tile-key identity.

### Face Group

The stable matching identity behind concrete faces.

For normal suits, a face group corresponds to four matching concrete faces.
Ranking usually talks about face groups because the generator chooses the kind
of face before selecting the concrete faces.

### Face Set

The inventory entry for one face group.

A full face set contains four matching concrete faces. Selecting one face pair
removes two faces from that set. Suspension generation may need a full face set
because it can split one set across an immediate tile pair and a delayed tile
pair.

The face domain exposes full-set selection neutrally as `selectFullFaceSet`.
Suspension policy decides how to split or reserve the selected faces.

### Face Pair

Two concrete faces selected from the same face set.

A face pair is assigned to one prepared tile pair. Face pairs are about imagery
and matching, not about where tiles are placed on the board.

### Candidate

An option before a choice has been made.

Examples:

- an open tile that might be selected
- a ranked face group that might provide a face pair
- a future suspension target

### Rank

To build an ordered list of candidates according to generation policy.

Use `rank` for the sorting/ordering step for both tiles and faces. Ranking does
not choose the final item by itself.

### Ranked Window

A difficulty-shaped slice of a ranked list.

Easy and hard difficulties bias toward different ends of the ranked list.
Middle difficulties keep a broader window.

### Select

To choose one item from a ranked window.

Selection is the random choice step after ranking and difficulty windowing have
already shaped the available candidates.

### Commit

To accept a selected tile pair into generator state.

For backward generation, committing a selected tile pair records it in
`GeneratorState.preparedPairs`, appends it to the solution path, and removes
its tiles from the temporary working board.

### Suspension

A delayed tile-pair commitment.

Suspension generation can place part of a future match now and release the
delayed partner later. This is not fully implemented yet, but the vocabulary is
important because suspensions interact with both tile pairs and face sets.

## Tile Ranking Factors

Tile ranking orders currently open tile candidates before selection.

The current tile rank record is `RankedTileCandidate`. It keeps the component
factors so we can inspect and tune the generator later.

### Z-Index Factor

What it measures:

The candidate tile's stack height.

Why it is used:

During backward generation, stack height influences how quickly lower layers
are exposed. The z-index factor lets difficulty settings bias selection toward
or away from certain stack heights.

Current behavior:

Higher `z` tiles produce less pressure because they are already near the top of
their stack. Lower tiles can receive more pressure.

### Spatial Relationship Factor

What it measures:

How much the candidate overlaps the already selected reference tile or tiles.

Why it is used:

When selecting the second tile in a prepared tile pair, the first selected tile
becomes the reference. Spatial relationship pressure lets the generator tune how
strongly it prefers nearby, aligned, overlapping, or separated tile-pair
structure.

Current inputs:

- horizontal intersections
- depth intersections
- horizontal multiplier
- depth multiplier

### Open-Pressure Factor

What it measures:

How many additional tiles would become open after removing the candidate.

Why it is used:

A candidate that frees many tiles can make the future board easier. A candidate
that frees few tiles can keep the generated path tighter and more constrained.
Difficulty settings can use this to influence how generous the generated board
feels.

Current metadata:

- `freedCount`
- `openPressureFactor`

### Stack-Balance Factor

What it measures:

Whether removing the candidate would leave one stack group dominating the
remaining board.

Why it is used:

Dominant stacks can create fragile or awkward generated states. The balance
factor gives the generator pressure metadata now, and later can support hard
rejection of unsafe choices.

Current metadata:

- `balanceMargin`
- `balanceFactor`
- `createsDominantStack`

### Short-Horizon Factor

What it measures:

Whether a small hypothetical lookahead can continue making legal tile-pair
removals after the candidate is removed.

Why it is used:

Some choices look safe immediately but collapse the board a few moves later.
Short-horizon pressure helps detect and avoid those fragile local choices,
especially on harder settings.

Current metadata:

- `shortHorizonFactor`
- `shortHorizonMoves`
- `shortHorizonRemainingTiles`
- `shortHorizonEnabled`
- `shortHorizonCollapsed`

### Final Tile Weight

What it measures:

The combined ranking pressure for one tile candidate.

Why it is used:

The ranked tile list needs one sortable value. The current implementation
multiplies the major tile-ranking factors into `weight`.

Current formula shape:

```txt
weight = zIndexFactor
  * spatialRelationshipFactor
  * analyzerFactor
```

Where:

```txt
analyzerFactor = openPressureFactor
  * balanceFactor
  * shortHorizonFactor
```

Lower weights currently rank earlier. The difficulty window then decides which
part of that ranked list is eligible for selection.

## Face Ranking Factors

Face ranking orders face groups before selecting a concrete face pair.

The face domain does not randomly draw from one flat pile. It ranks available
face groups, applies the difficulty window, selects one face group, then asks
the inventory for a concrete face pair from that group.

### Availability

What it measures:

Whether a face set has enough remaining concrete faces for the current request.

Why it is used:

Normal prepared tile pairs need two faces. A face group with fewer than two
remaining faces cannot provide a face pair and is excluded from ranking.

### Pair-Count Factor

What it measures:

Whether the face set still contains a full four faces or only one remaining face
pair.

Why it is used:

This gives the ranker a way to treat fuller face sets differently from partially
used face sets. That matters because reusing groups and preserving future
options affects how easy or constrained the board feels.

### Assigned-History Distance

What it measures:

How recently the same face group was assigned to another prepared tile pair.

Why it is used:

Spacing repeated face groups changes perceived difficulty. Nearby repeats can
make the board easier to read and solve. More distant repeats can make matches
less obvious.

### Preferred Face Group Bias

What it measures:

Whether the current prepared tile pair has a preferred face group.

Why it is used:

Preferred face groups are a soft nudge, not a reservation. They are intended to
support face-avoidance behavior by asking the ranker to favor a group that has
lower local penalty.

### Easy Duplicate Expansion

What it measures:

Whether easy-side difficulty should duplicate recently reused face groups in the
ranked candidate list.

Why it is used:

Duplicating a ranked candidate increases its chance of appearing in the final
selection window. This is a tuning hook for easier boards, where intentional
reuse can make matches more discoverable.

### Avoidance Penalty

What it measures:

The accumulated soft penalty for assigning a face group near target tiles that
should avoid that group.

Why it is used:

Face avoidance discourages immediately recovering or locally obvious matches.
It is especially important for higher-difficulty behavior and suspension-like
flows.

Current status:

The generator now records structural soft links in `GeneratorState.softLinks`
during tile selection. The active record shape is `type: 'open-tiles'` with
`role: 'after-removal'`. After a face group is assigned,
`Faces.applyFaceAvoidance()` consumes matching links and records pressure
against that face group on the linked tiles.

Current caution:

The live-shaped behavior currently uses an inverse penalty branch for unused
face groups. Difficulty settings were tuned against that behavior, so it should
not be changed casually.

### Final Face-Group Rank

What it measures:

The combined ordering value for one face group.

Why it is used:

The face domain needs an ordered list of available face groups before applying
the difficulty window and selecting one group.

Current formula shape:

```txt
sortValue = baseFactor
  * pairCountFactor
  * distanceFactor
  * preferredFactor
```

Avoidance can override the final value for unused groups when an avoidance
penalty exists. Easy duplicate expansion can then add duplicate candidate
entries before difficulty-window selection.

## What To Be Careful About

- Do not use "pair" by itself when the distinction matters.
- Use "tile pair" for structural board slots.
- Use "face pair" for concrete faces assigned to a tile pair.
- Use "face set" for the inventory group that face pairs come from.
- Use "face group" for the stable matching identity.
- Use "prepared pair" only when talking about the generator's committed tile
  pair records before or during face assignment.
- Use "assigned tile" or "assigned pair" after concrete face assignment is
  complete, but before claiming all generation stages are complete.
- Use "generated tile" or "generated pair" only for the final state after all
  generation stages are complete.
- Do not use "playable" for generated tiles unless the runtime rules say the
  tile or pair can currently be removed.
- Use "rank" for ordering candidates.
- Use "select" for choosing from ranked candidates.
- Use "commit" for mutating generator state after tile-pair selection.
