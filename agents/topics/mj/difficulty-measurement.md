# Mahjongg Difficulty Measurement

## Scope Note

This document is the analyzer-semantics companion to the engine README.

Use it for:

- what each measurement is trying to capture
- how the analyzer samples those measurements
- why certain metrics matter for this generator

Do not use it as the primary source for the current runtime ladder or the
current user-facing difficulty summary. Those now live in:

- [engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
- [difficulty-tuning-knobs.md](/c:/dev/poly-gc-react/agents/topics/mj/difficulty-tuning-knobs.md)

Some later sections in this file preserve historical baselines and early
experiments. They are still useful context, but they are not the source of
truth for the latest ladder settings.

## Goal

Define a repeatable way to measure Mahjongg board difficulty so generation
changes can be validated and tuned against something more objective than feel.

This is especially important for the suspension-based difficulty algorithm,
because that algorithm is intended to make pair choice and solve order more
important rather than only reducing the raw number of legal moves.

## Core Approach

Use a solver or solver-like search harness to evaluate generated boards and
extract difficulty metrics from the search process.

For this engine, generated boards are expected to have at least one solution.
So the main purpose of the harness is difficulty rating, not basic solvability
testing.

The basic loop is:

1. generate a board
2. solve or partially solve it with a search-based algorithm
3. record search metrics
4. aggregate those metrics into a difficulty profile
5. compare profiles across generator configurations

## Why Solver-Based Measurement Fits This Engine

The current engine already models:

- currently open tiles
- currently placed tiles
- playable pairs
- undoable game state transitions

That makes it a good base for a search-driven difficulty evaluator because the
same state rules used by gameplay can be reused by a solver harness.

## Primary Metrics

### Branching Factor

Measure how many playable pairs are available at each solve step.

Useful derived values:

- average branching factor
- median branching factor
- minimum branching factor
- number of turns with very low branching

Lower branching often correlates with higher difficulty, but not always.

## Backtracking Cost

Measure how much search is required before a solution is found.

Useful values:

- total backtracks
- maximum backtrack depth
- average backtracks per solve

Higher backtracking usually indicates more order sensitivity and more trap
choices.

## Dead-End Rate

Measure how often a legal sequence reaches a state with no solution.

Useful values:

- proportion of explored branches that dead-end
- dead ends encountered before the first solution
- dead-end depth distribution

This is important because a board can be solvable while still containing many
plausible losing paths.

That distinction is central here:

- generated board solvability is assumed
- branch solvability is not

So dead-end rate is useful because it measures how punishing player choices are,
not because we expect the builder to emit unsolvable boards.

## Solution Multiplicity

Estimate how many distinct successful solve paths exist.

Useful values:

- exact count when the search space is small enough
- sampled estimate when the space is too large
- number of materially different successful lines

Boards with many successful continuations usually feel easier and more
forgiving. Boards with very few successful lines tend to feel harder.

## Forced-Move Density

Measure how often the player effectively has only one good continuation.

Useful values:

- turns where only one playable pair exists
- turns where many pairs exist but only one preserves solvability

This helps distinguish:

- simple low-branch boards
- genuinely order-sensitive boards

## Pair-Choice Sensitivity

This is the most important metric for validating the suspension algorithm.

Measure how much the success rate changes when the player chooses among
different matching options from the same face set.

Useful values:

- number of states where one face set exposes multiple pairing choices
- difference in downstream solve success between those pairings
- average penalty for choosing a lower-quality pairing

If suspension is working as intended, this metric should increase.

### Immediate Versus Downstream Pair Choice

The first pair-choice metric only measures the immediate spread between legal
same-face pairings in the current state. Suspension may not always move that
number, because the suspended partner is often buried deeper in the generation
timeline. In that case, the immediate reward for one pairing over another can
look similar while the consequences appear several removals later.

The analyzer now also includes a downstream initial pair-choice sample. For
ambiguous same-face choices available at the starting position, it tries each
candidate pair and runs deterministic playouts from the resulting board state.
That gives a longer-horizon signal for whether one initially plausible pairing
leads to better or worse continuation space.

Useful downstream values:

- initial downstream consequential groups
- average solve-rate spread between choices in those groups
- average remaining-tile spread after sampled playouts

This is still a sampled metric, not a proof of optimal play, but it is closer to
the kind of delayed order pressure the suspension algorithm is trying to create.

Important detail: these downstream initial-choice metrics are anchored to the
starting board state, not to arbitrary later search states. For each immediately
available same-face pair choice:

- the analyzer applies that initial choice
- runs sampled continuations from that branch until termination
- summarizes the branch outcomes
- then compares those branch summaries across the alternative initial choices

So:

- dead-end spread is about how often those branches fail
- remaining spread is about how deep those branches get before they end

### Random-Play Brutality

The analyzer now reports a separate brutality score so random face-dealt boards
and solved-by-construction boards can be compared without pretending they are
difficult in the same way.

Useful values:

- playout dead-end rate
- average moves before dead end
- p75 moves before dead end
- p75 remaining tiles at dead end
- dominant-stack risk at dead end

This should help separate:

- chaotic random boards, which often punish random play brutally but have no
  authored solution pressure
- generated boards, which can have a known valid solution and still build
  increasing punishment into bad choices

The eventual nightmare target should score high on both brutality and authored
choice pressure.

### Known-Solution Timeline

The analyzer also splits the known solution path into early, middle, and late
thirds.

Useful values:

- average branching in each third
- low-branch move count in each third
- longest low-branch run
- dominant-stack risk moves along the known solution

This helps identify whether a generator is producing boards that tighten
gradually, collapse late, or constrain the player from the start.

### Dominant-Stack Risk

The bad layout shape discussed during suspension tuning happens when one stack
is taller than the other remaining placed tile groups, counting a stack as one
placed group.

The analyzer now records a stack-balance profile for states:

- stack group count
- maximum stack height
- other stack group count
- balance margin
- at-risk state
- dominant state

The same signal is summarized for the initial board, the known solution path,
bounded search, and sampled playout dead ends.

The weighted tile picker now also uses this balance margin as a hard-side
pressure signal. Candidate removals that would create a dominant stack are still
rejected by the safety rule. Candidate removals that remain safe but closer to
the boundary can receive extra weight in harder generation settings.

The current experimental CLI knobs are:

- `--open-pressure-multiplier`
- `--max-freed-pressure`
- `--balance-pressure-multiplier`
- `--max-balance-margin`
- `--short-horizon-probe`
- `--short-horizon-probe-moves`
- `--short-horizon-pressure-multiplier`

Open pressure is the raw freed-tile companion to the older freed-rank score. In
harder settings it gives more weight to candidate removals that open fewer new
tiles, which should reduce recovery paths and push bad playouts toward earlier
dead ends.

The short-horizon probe is off by default. When enabled, it structurally removes
a candidate pair, walks forward for a small number of greedy low-continuation
moves, and adds hard-side pressure if the probe collapses inside that horizon.
This is intended to target early dead ends more directly than static picker
signals.

Face-set avoidance is another opt-in experiment. When enabled, assigned solution
pairs mark nearby frontier tiles with soft penalties against the assigned face
set. Later face assignment chooses among remaining face sets by the lowest
avoidance penalty, not by hard exclusion. This should reduce accidental local
matches while preserving fallbacks if the draw pile has no clean option.

Face assignment now also has a spacing-aware chooser. The analyzer-facing model
to keep in mind is:

- assigned face-group pairs are recorded in placement order
- reusable face groups can be sorted by distance from their previous use
- unused groups remain the neutral remainder of the candidate list
- the same sliding difficulty window used by tile picking can then shape face
  assignment

That means face assignment is no longer only a "which clean face set is left"
question. It can now contribute to difficulty by clustering or delaying same-
face reuse through the authored solve order.

The current experimental CLI knobs are:

- `--face-avoidance`
- `--face-avoidance-weight`
- `--suspension-face-avoidance-weight`
- `--face-avoidance-max-weight`
- `--preferred-face-group-multiplier`
- `--easy-reuse-duplicate-scale`

## Suggested Derived Score

Instead of one final score immediately, start with a multi-metric profile.

For example:

- branching profile
- backtracking profile
- dead-end profile
- pair-choice sensitivity profile

After that, a composite score can be introduced, for example:

`difficulty =`

- weighted low-branching score
- plus weighted backtracking score
- plus weighted dead-end score
- plus weighted pair-choice sensitivity score
- minus weighted solution-multiplicity score

The exact weights should be tuned empirically.

## Validation Strategy For Suspension

To validate the suspension algorithm:

1. generate a baseline sample with the current builder
2. record all difficulty metrics
3. enable suspension with conservative settings
4. regenerate a sample with the same layouts and similar board counts
5. compare distributions, not just averages

The most important expected change is:

- pair-choice sensitivity should rise

Other likely changes:

- backtracking should rise moderately
- dead-end rate may rise
- solution multiplicity may fall

If branching drops too sharply or dead-end rates rise too far, the builder may
be producing frustrating boards rather than interestingly difficult boards.

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

Loosening the safety thresholds from `4/6` to `3/5` in a small aggressive sample
increased created suspensions and raised difficulty slightly. That suggests
there is room to tune the safety valves, but the sample is too small to treat as
a final target.

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
cap, `maxNested: 4`, a placement release range of `8..16`, an open-count release
range of `4..8`, `matchType: both`, `forceReleaseAtEffectiveOpen: 4`, and
`suspendAtEffectiveOpen: 6`.

The current face-assignment defaults use:

- `preferredMultiplier: 0.5`
- `easyReuseDuplicateScale: 0` by default in the engine

The named difficulty ladder overrides that for Easy only, setting
`easyReuseDuplicateScale: 2`.

`matchType: both` has behaved more like a regime switch than a smooth knob. Once
that switch is on, the stronger numeric dials so far are `maxNested` and the
effective-open release thresholds. `frequency` and `maxSuspended` are linked:
frequency raises the attempt rate, but `maxSuspended` only matters when the run
actually reaches that cap.

## Recommended First Implementation

The first measurement harness does not need to be a perfect full-search solver.

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

## Documentation Note

Difficulty should be treated as a measurable property of the generated search
space, not only as a subjective player impression.

For this project, that means rating the shape of the solution space around a
known-solvable generated board, not treating solvability itself as the main
question.

Subjective playtesting is still important, but it should be used alongside the
solver metrics rather than in place of them.

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

The eventual `nightmare` difficulty target is not merely to approach random
face-dealt behavior.

Instead, the desired target is:

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
separate class of difficulty knob from choosing which suspended tile or released
partner to use. Normal pair bias changes the base removal order throughout the
entire board, while suspension bias changes the delayed relationships layered on
top of that order.

For analyzer work, normal pair selection bias should be tested by itself before
mixing it with aggressive suspension. It is likely to have a larger global
effect because it can influence nearly every generated pair.
