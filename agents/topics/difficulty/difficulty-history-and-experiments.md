# Mahjongg Difficulty History And Experiments

Use this document for historical baselines, earlier suspension experiments,
instrumentation notes, and follow-up ideas that are still useful context but
are not the main source of truth for the current ladder.

For the current runtime model and current recommended settings, use:

- [Engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
- [Difficulty Tuning Knobs](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-tuning-knobs.md)

## Current Experimental Findings

The first aggressive suspension runs show a real difficulty increase compared
with the ordinary solved-by-construction engine generator.

On boards `1..10`, aggressive suspension moved the batch average from about
`54.30` to `70.80`. Random playout dead-end rate rose from about `58.3%` to
`86.3%`, and average remaining tiles at dead-end rose from about `19.30` to
`42.52`.

On boards `1..25`, aggressive suspension compared with pure random face dealing
looked like this:

- aggressive engine: known valid `25/25`, score average `69.12`, solve rate
  `15.5%`, dead-end rate `84.5%`, average remaining `42.41`
- random faces: known valid `0/25`, score average `81.32`, solve rate `3.7%`,
  dead-end rate `96.3%`, average remaining `57.23`

The current interpretation is that random faces are still more brutally
punishing, but aggressive suspension is producing authored difficulty while
preserving a known valid solution path.

A cheap rule sensitivity pass over boards `1..10` showed:

- high frequency alone had little effect
- raising the total cap had no visible effect in that sample
- raising `maxNested` gave a mild lift
- longer placement waits and lower open thresholds increased pressure somewhat
- `matchType: both` was the largest single change
- the full aggressive combination produced the strongest result

A `maxNested` sweep with the aggressive base over boards `1..20` suggested a
useful range around `5` or `6`. Higher values kept increasing pressure, but also
started leaning harder on force release and open-tile safety.

Loosening the safety thresholds from `4/6` to `3/5` in a small aggressive
sample increased created suspensions and raised difficulty slightly. That
suggests there is room to tune the safety valves, but the sample is too small
to treat as a final target.

## Suspension Instrumentation

The engine now exposes suspension stats to the analyzer so rule changes can be
read as generator behavior instead of only final board difficulty.

The useful counters are:

- attempts
- created
- released
- force released
- skipped by frequency
- skipped by total cap
- skipped by nested cap
- skipped by open-tile safety
- skipped by no full face set
- max nested seen

The analyzer also records safety context averages for force releases and
open-tile safety skips:

- average open tiles
- average suspended tiles
- average open suspended tiles
- average effective open tiles

Suspended tiles should always remain open. The `open suspended` average should
therefore match the active suspended count. If those diverge, that points to an
engine invariant violation rather than a tuning result.

`skipped by no full face set` is expected to be low in the current design,
because ordinary single-pair face assignment is deferred until after the primary
placement pass. The first pass should mostly be consuming full four-face sets
for linked suspension groups.

## Tuning Dimensions To Compare

The suspension algorithm exposes several parameters that can be tuned against
measured difficulty:

- suspension frequency
- maximum total suspended tiles
- maximum simultaneous suspended tiles
- maximum nested suspensions
- suspension duration range
- open-tile release range
- force-release effective-open threshold
- suspension-start effective-open threshold
- match type
  - either condition met
  - both conditions met
- how a suspended tile selects its eventual partner

Each parameter should be changed independently during early tuning so its effect
on the measurement profile is visible.

Current analyzer presets are:

- `conservative`
- `moderate`
- `aggressive`

The aggressive preset currently uses frequent suspension attempts, a high total
cap, `maxNested: 4`, a placement release range of `8..16`, an open-count
release range of `4..8`, `matchType: both`, `forceReleaseAtEffectiveOpen: 4`,
and `suspendAtEffectiveOpen: 6`.

The current face-assignment defaults use:

- `preferredMultiplier: 0.5`
- `easyReuseDuplicateScale: 0` by default in the engine

The current named difficulty ladder keeps `easyReuseDuplicateScale: 0` on all
levels. Earlier Easy-only duplication experiments were useful during the first
face-spacing rollout, but after the rank-face cleanup that duplication started
making Easy harsher instead of softer.

The current authored ladder instead relies on:

- `challenging.generationDifficulty: 0.55`
- `expert.faceAssignmentRules.preferredMultiplier: 0.33`
- `nightmare.faceAssignmentRules.preferredMultiplier: 0.33`

`matchType: both` has behaved more like a regime switch than a smooth knob.
Once that switch is on, the stronger numeric dials so far are `maxNested` and
the effective-open release thresholds. `frequency` and `maxSuspended` are
linked: frequency raises the attempt rate, but `maxSuspended` only matters when
the run actually reaches that cap.

## Recommended First Implementation

The first measurement harness did not need to be a perfect full-search solver.

A useful first version could:

- clone engine state
- enumerate playable pairs
- recursively explore to a bounded depth
- count dead ends and branching
- sample multiple solve attempts

That is enough to create early comparative metrics for:

- baseline generation
- suspension-enabled generation

## Practical Success Criteria

The suspension algorithm is behaving as intended if measured boards show:

- more meaningful divergence between alternate same-face pairings
- more order sensitivity without collapsing into mostly dead-end play
- a moderate increase in solver effort
- a noticeable reduction in "all choices are equivalent" states

## Historical Baseline Results Before Suspension

After restoring the normal Turtle layout, the first script-side analyzer was run
against both solved-by-construction engine boards and fully random face-dealt
boards.

The command shape was:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board <seed> --generator <engine|random> --max-depth 4 --max-states 1000 --playouts 24
```

Engine-generated boards:

- board 101: medium, 50/100, 19 initial playable pairs, 54.2% playout solve rate, 45.8% playout dead-end rate, 14.00 average remaining tiles
- board 202: easy, 44/100, 20 initial playable pairs, 62.5% playout solve rate, 37.5% playout dead-end rate, 11.75 average remaining tiles
- board 303: medium, 54/100, 25 initial playable pairs, 45.8% playout solve rate, 54.2% playout dead-end rate, 10.58 average remaining tiles
- board 404: medium, 48/100, 14 initial playable pairs, 45.8% playout solve rate, 54.2% playout dead-end rate, 15.08 average remaining tiles
- board 505: medium, 50/100, 19 initial playable pairs, 50.0% playout solve rate, 50.0% playout dead-end rate, 8.25 average remaining tiles

Random face-dealt boards:

- board 101: medium, 57/100, 8 initial playable pairs, 41.7% playout solve rate, 58.3% playout dead-end rate, 27.67 average remaining tiles
- board 202: hard, 79/100, 11 initial playable pairs, 4.2% playout solve rate, 95.8% playout dead-end rate, 62.17 average remaining tiles
- board 303: hard, 77/100, 13 initial playable pairs, 0.0% playout solve rate, 100.0% playout dead-end rate, 41.92 average remaining tiles
- board 404: medium, 74/100, 7 initial playable pairs, 4.2% playout solve rate, 95.8% playout dead-end rate, 45.75 average remaining tiles
- board 505: hard, 81/100, 11 initial playable pairs, 0.0% playout solve rate, 100.0% playout dead-end rate, 64.92 average remaining tiles

This gives a useful historical baseline for suspension work:

- engine-generated boards cluster around easy/medium
- random face-dealt boards cluster around medium-hard/hard
- random boards often have fewer initial playable pairs
- random boards often dead-end with many more tiles still on the board

Important interpretation note:

- random playout failure does not prove a board is unsolvable
- a solvable board can still have a very high random-play dead-end rate
- reported references that only a small percentage of random Turtle boards are
  unsolvable are compatible with high random playout failure, because those are
  measuring different things

For this project, the random-face baseline is best treated as a high-friction
comparison target, not as the desired generator behavior.

## Historical Nightmare Difficulty Target

The eventual `nightmare` difficulty target was not merely to approach random
face-dealt behavior.

Instead, the desired target was:

- harder than the random-face baseline by the analyzer's difficulty metrics
- still solved-by-construction
- still able to report a known valid solution path
- more punishing to naive random play
- more sensitive to pair choice and solve order

This means the analyzer should eventually distinguish:

- chaotic difficulty from random assignment
- intentional difficulty from constrained but solvable generation

The latter is the desired outcome for suspension-based nightmare boards.

## Follow-Up Ideas

Tile choice can become another family of knobs after the current suspension
rules are characterized.

One promising structural option is a blocking-score bias:

1. calculate open tiles before choosing a candidate tile
2. temporarily remove the candidate
3. calculate open tiles again
4. score the candidate by how many new tiles it opens
5. restore the candidate

Open tiles can then be sorted by score and selected with weighted rank choice.
A positive bias would prefer most-blocking tiles, a negative bias would prefer
least-blocking tiles, and zero bias would preserve random selection.

Possible future rules:

- `suspendTileSelectionBias`
- `releasedPartnerSelectionBias`
- `normalPairSelectionBias`
- `suspendTileSelection`
- `partnerSelection`

Candidate strategies include random, nearest, farthest, most-blocking,
least-blocking, and highest-z. Euclidean distance may matter more to human
players than to the current analyzer unless it also changes structural unlocks,
but it is still worth keeping as a later human-difficulty knob.

The same blocking score can also be applied to normal pair selection. That is a
separate class of difficulty knob from choosing which suspended tile or
released partner to use. Normal pair bias changes the base removal order
throughout the entire board, while suspension bias changes the delayed
relationships layered on top of that order.

For analyzer work, normal pair selection bias should be tested by itself before
mixing it with aggressive suspension. It is likely to have a larger global
effect because it can influence nearly every generated pair.
