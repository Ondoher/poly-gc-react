# Mahjongg Generation Difficulty

## Scope Note

This note started as the main design writeup for generation-time difficulty.
The live engine has moved on since then.

Use this file for:

- the core generation-difficulty framing
- the original suspension design intent
- safety invariants and future generator ideas that are still useful context

Use these for the canonical current implementation:

- [engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
- [difficulty-tuning-knobs.md](/c:/dev/poly-gc-react/agents/topics/mj/difficulty-tuning-knobs.md)

So this document is now a companion note, not the single source of truth for
the current runtime ladder or the final picker/face-assignment behavior.

## Goal

Capture a generation-time difficulty mechanism that works within a four-of-a-kind
Mahjongg tile model rather than treating the puzzle as if it were made of simple
 independent pairs.

## Core Problem

The builder removes tiles two at a time, but tile faces come in groups of four.
That means difficulty cannot be shaped only by selecting a single removable pair.

Difficulty must also account for the other two matching tiles in the same face
set. In practice, this means some matching relationships need to be delayed or
temporarily disqualified so that the player is not always presented with the
most obvious or most forgiving pairing.

## Suspension Algorithm

The current difficulty pass uses a tile suspension mechanism to build
difficulty directly into generation.

### Basic Flow

1. While choosing a removable pair during generation, occasionally identify a
   third tile that is also currently playable.
2. Do not remove that third tile immediately.
3. Instead, place that tile into suspension.
4. Associate the suspended tile with the pair that was just removed.
5. Keep that suspended tile unavailable to the generator until a release
   condition is met.
6. When the suspension is released, that tile becomes one tile of the next pair
   removed from the board.
7. The original removed pair and the later released pair are treated as linked.
8. When assigning faces, linked pairs receive the same face set.

This causes two removable pairs to be intentionally connected across generation
time instead of being assigned independently.

## Effect On Difficulty

This mechanism lets the builder shape when the second half of a four-of-a-kind
relationship appears in the generation timeline.

Instead of two matching pairs being placed independently:

- one pair is generated now
- a related playable tile is held back
- a later pair is forced to include that suspended tile

This allows the generator to create delayed matching relationships and more
interdependent board states.

## Intended Gameplay Effect

The main gameplay effect is to make pair choice matter more.

Without suspension, many matching decisions are locally interchangeable. With
linked delayed pairs, choosing which two matching tiles to remove can affect
which related matches become useful or harmful later.

This should increase difficulty by increasing order sensitivity rather than only
reducing the number of legal moves.

## Release Conditions

A suspended tile is released when one of the following kinds of conditions is
met:

- a minimum number of additional tiles have been removed since suspension
- the number of remaining playable tiles falls to a threshold

These release conditions determine how long the delayed relationship stays out
of circulation.

The implemented v1 rules expose two additional effective-open safety thresholds:

- `forceReleaseAtEffectiveOpen`: release a suspension when ordinary open tile
  availability gets too low
- `suspendAtEffectiveOpen`: do not start a new suspension when ordinary open
  tile availability is already too low

Here, "effective open" means open tiles minus active suspended tiles. Suspended
tiles are expected to remain open, but they are reserved, so they are subtracted
from the ordinary pool when deciding whether the generator has enough room to
start or keep pressure.

## Degrees Of Freedom

The suspension mechanism creates several tuning parameters for difficulty.

- suspension frequency: how often suspension is attempted while selecting
  removable pairs
- total suspension cap: how many tiles may be placed into suspension over the
  course of one board, currently `maxSuspended`
- maximum nested suspensions: how many active suspensions may be layered at
  once, currently `maxNested`
- placement-count release range: the range of subsequent pair placements to
  wait before releasing a suspended tile, currently `placementCount`
- open-count release range: the playable/open tile count range that can trigger
  release, currently `maxOpenCount`
- force-release effective-open threshold: the safety point where an active
  suspension must be consumed
- suspension-start effective-open threshold: the safety point below which new
  suspension creation is skipped
- whether release happens as soon as either condition is met or only after both
  are met
- how a suspended tile chooses its eventual partner when released
- whether all linked pairs share one face set or whether the mechanism is used
  only for selected face groups

### Suspension Frequency

The current `frequency` rule should be specified as a probability between `0`
and `1`.

It is checked against the deterministic random generator when a generation step
is eligible to start a new suspension:

```js
Random.random() < frequency
```

Examples:

- `0.0`: never attempt suspension
- `0.1`: attempt suspension on about 10% of eligible pair placements
- `0.5`: attempt suspension on about half of eligible pair placements
- `1.0`: attempt suspension on every eligible pair placement

This should be treated as an attempt frequency, not a guaranteed suspension
frequency.

A suspension attempt can still be skipped if:

- suspension is disabled
- the total suspension limit has already been reached
- the simultaneous suspension limit has already been reached
- there are not enough playable tiles to choose the current pair plus a third
  tile to suspend
- no full four-face set is available for a new linked pair group if faces are
  reserved immediately

When applying configuration, clamp the frequency into the valid range:

```js
frequency = Math.max(0, Math.min(1, frequency));
```

Frequency should be read together with the total and nested caps. A high
frequency only means the engine asks to suspend more often. It does not guarantee
more suspensions if the run is already hitting `maxSuspended`, `maxNested`, or
the effective-open safety threshold.

### Release Ranges

The release rules should support ranges instead of single fixed values.

Rather than every suspension waiting the same number of placements or releasing
at the same open-tile count, each suspension should roll its own actual release
targets when it is created.

The current engine names these ranges `placementCount` and `maxOpenCount`. The
older example names below describe the same concept more verbosely.

Example configuration shape:

```js
{
    releaseAfterPlacements: {
        min: 3,
        max: 8,
    },
    releaseAtOpenTiles: {
        min: 6,
        max: 12,
    },
}
```

When a tile enters suspension, the generator records concrete values on that
suspension record:

```js
{
    tile,
    reservedFaces,
    startedAtPlacement,
    releaseAfterPlacements,
    releaseAtOpenTiles,
}
```

The values should come from a normal-ish distribution over the configured
inclusive range. That gives the board a predictable center of gravity while
still allowing some suspensions to release earlier or later.

Implementation options:

- use `Random.randomNormalRange(min, max)` when a mathematically stronger normal
  distribution is preferred
- specify dice directly and use `Random.randomCurve(dice, faces, zeroBased)`
  when the configuration should expose dice-like tuning
- add a helper such as `Random.randomCurveRange(min, max, dice)` when the config
  should stay range-based but use the faster dice-curve approximation

A range helper could delegate to `randomCurve`:

```js
randomCurveRange(start, end, dice = 3) {
    const span = end - start;

    if (span === 0) {
        return start;
    }

    const curve = this.randomCurve(dice, span + 1, true);
    const averaged = Math.round(curve / dice);

    return start + averaged;
}
```

This keeps the external suspension configuration easy to read while still using
the faster normal-ish curve.

## Design Intent

The main intent is to make difficulty emerge from controlled temporary
disqualification among otherwise playable matching tiles.

This is important because Mahjongg face groups contain four matching tiles.
Harder boards are not created only by reducing the number of legal moves. They
are also created by controlling when related matching tiles become relevant to
each other.

The suspension model gives the builder a direct way to delay and shape those
relationships.

## Current Status

Suspension is now implemented in the live engine and is one of the core
generation-side difficulty mechanisms.

For the current rule shape, current aggressive profile, and current measured
ladder behavior, use:

- [engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
- [difficulty-tuning-knobs.md](/c:/dev/poly-gc-react/agents/topics/mj/difficulty-tuning-knobs.md)

This file keeps the design framing and the historical reasoning that led to the
current system.

## Implementation Note

This idea should be treated as a generation-time difficulty layer added on top
of the existing solvable-board construction model, not as a replacement for the
base generation algorithm.

The existing builder still determines legal removable pairs. Suspension then
adds a second-order rule that links some of those pairs across time.

## Baseline Before Implementation

Before implementing suspension, the script-side analyzer established a useful
baseline on the restored Turtle layout.

Engine-generated boards, which are solved-by-construction, generally landed in
the easy/medium range. Fully random face-dealt boards generally landed in the
medium-hard/hard range because random playouts often dead-ended with many tiles
left.

This suggests a useful target for suspension:

- make generated boards more order-sensitive than the baseline engine builder
- avoid drifting all the way toward random-face behavior, where naive play often
  collapses early
- preserve solved-by-construction generation while increasing pair-choice
  consequences

The first suspension experiments should be compared against both baselines:

- current engine generator as the forgiving baseline
- random face-dealt generator as the high-friction upper comparison

## Safety Invariant

Suspension must never be allowed to create a new generation failure mode.

The role of suspension is to change pairing order and delay when certain
playable tiles are forced into the next draw. It is not allowed to strand the
generator or make an otherwise generatable board fail.

That means:

- a suspended tile is still fundamentally part of the playable board state
- a suspended tile should always remain open
- when suspension ends, that tile returns to the playable draw set
- once released, the suspended tile is guaranteed to be part of the next drawn
  pair
- if ordinary playable selection would otherwise be empty, one or more
  suspended tiles must be released immediately
- release in that case is a safety rule, not a tuning parameter

So suspension changes selection order, not generation legality.

The analyzer now records safety context when suspension is force released or
skipped because effective open tiles are too low. It records open tiles, active
suspended tiles, open suspended tiles, and effective open tiles. Since suspended
tiles should always remain open, open suspended count should match active
suspended count.

The effective-open thresholds are tuning parameters. Early tests suggest the
initial `4/6` thresholds are conservative; loosening them to `3/5` increased
created suspensions and difficulty in a small sample.

Under this model, the only layouts that should still fail generation are the
same structural edge cases that already exist in the base algorithm, where
generation does not consider tile faces while removing positions. In practice,
that means cases such as:

- a stack of tiles left alone
- a stack of more than two tiles with only one other tile outside the stack

Those failures belong to the underlying layout and pair-removal model, not to
the suspension layer.

## Future Generator Improvement

A future improvement to the base generator could reduce or eliminate those
structural failure cases by forcing a safer tile choice when a dangerous board
condition is about to arise.

In other words, if generation reaches a state where the next random pair choice
could leave behind one of the known bad structural patterns, the generator could
override randomness and deliberately choose a pair that preserves continued
playable removal.

That would be an improvement to the underlying pair-removal generator, not to
the suspension mechanism itself.

## Nightmare Difficulty Goal

The long-term target is a `nightmare` difficulty mode that can score harder than
random face-dealt boards while still being solved-by-construction.

That distinction matters:

- random face-dealt boards are difficult because they are chaotic and may not
  expose a forgiving solution space
- nightmare boards should be difficult because the generator intentionally
  constrains and links the solution space while preserving at least one known
  valid solution

A successful nightmare board should have a signature like:

- known solution path remains valid
- random playout dead-end rate is high
- random playouts dead-end with many tiles remaining
- same-face pair-choice sensitivity is high
- solution multiplicity is low or estimated to be low
- forced-good-choice states are frequent

In other words, nightmare should be authored cruelty rather than accidental
chaos.

## Follow-Up: Tile-Selection Pressure

The old "selection bias" material from this note has largely become the live
weighted tile-picker system. The core idea survived:

- score current open candidates by structural pressure
- order them
- use a difficulty-shaped window instead of a hard deterministic pick

That implementation is now documented in the canonical current-system doc:

- [engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)

Future work in this area should build on the current picker rather than trying
to resurrect the earlier pseudo-code version that originally lived here.
