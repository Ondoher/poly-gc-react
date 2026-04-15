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
- [difficulty-tuning-knobs.md](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-tuning-knobs.md)

Some later sections in this file preserve historical baselines and early
experiments. They are still useful context, but they are not the source of
truth for the latest ladder settings.

Historical baselines, older experiment notes, and earlier suspension-tuning
writeups now live in:

- [difficulty-history-and-experiments.md](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-history-and-experiments.md)

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

## Documentation Note

Difficulty should be treated as a measurable property of the generated search
space, not only as a subjective player impression.

For this project, that means rating the shape of the solution space around a
known-solvable generated board, not treating solvability itself as the main
question.

Subjective playtesting is still important, but it should be used alongside the
solver metrics rather than in place of them.

## Historical And Experimental Notes

For historical baselines, older suspension experiment summaries, instrumentation
notes, and early follow-up ideas, use:

- [difficulty-history-and-experiments.md](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-history-and-experiments.md)
