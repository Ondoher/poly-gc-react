# Notes On "Solving Mahjong Solitaire Boards With Peeking"

## Source

- [Solving_Mahjong_Solitaire_boards_with_peeking.pdf](/c:/dev/poly-gc-react/agents/topics/mj/Solving_Mahjong_Solitaire_boards_with_peeking.pdf)

## Why This Paper Matters Here

This paper is relevant because it is not only about proving hardness. It also
discusses practical solving ideas:

- pruning
- critical-group style reasoning
- structural conditions that guarantee solvability in restricted cases

That makes it useful for three different tracks in this repository:

- building a Mahjongg solver and analysis tool
- defining measurable difficulty signals
- tuning future generation-time difficulty features such as suspension

One nuance matters for this repository:

- generated boards are expected to be solvable
- the main value of solver work is difficulty rating and search-space analysis

So the paper is useful here less as a way to ask "is this board solvable?" and
more as a way to think about:

- which states are structurally dangerous
- which local choices are critical
- how to prune and analyze difficult but still solvable boards

## High-Level Takeaways

### Peeking Changes The Problem, But Does Not Make It Easy

The paper proves that Mahjong Solitaire with peeking is NP-complete.

That matters because even a solver with full hidden-information access still has
a genuinely hard search problem in the general case. So a future analysis tool
should be designed as:

- a practical solver with heuristics and pruning
- not as a naive exhaustive search that expects to scale cleanly

### Restricted Cases Can Still Have Clean Structural Tests

The paper shows that for layouts made only of isolated stacks of heights 1 and
2, solvability with peeking can be characterized by the absence of a blocked
cycle.

This does not directly solve the general case for this project, but it is
important for two reasons:

- it shows that some Mahjongg substructures admit strong structural analysis
- it suggests that solver performance can improve by recognizing special cases
  instead of treating every board state uniformly

### Critical Groups Are Likely More Useful Than Raw Branch Count Alone

The paper describes a practical solver that uses pruning and a heuristic that
prioritizes critical groups.

For this repository, that is probably the most directly reusable idea.

Plain branching-factor metrics are useful, but critical-group reasoning points
to something richer:

- some currently available choices matter much more than others
- the important task is often to identify the local structure that controls
  future solvability

That fits well with the current interest in:

- pair-choice sensitivity
- order sensitivity
- generation features that make matching decisions strategically important

## Ideas That Seem Most Transferable

## Structural Obstruction Detection

The blocked-cycle result is specific to restricted layout classes, but the
general lesson is broader:

- some unsolved states may contain recognizable structural obstructions
- detecting those early can improve pruning

Possible application here:

- identify restricted local patterns or reduced subproblems inside the full
  board
- apply cheap structural checks before deeper search

Even if a full blocked-cycle theorem does not transfer to general layouts, the
same style of reasoning may still provide practical pruning rules.

## Critical-Group Prioritization

The paper's use of critical groups suggests a future solver should not explore
playable pairs in arbitrary order.

Instead, move ordering should probably prefer pairs that touch:

- low-branch regions
- ambiguous same-face groups
- structurally constrained stacks or side-blocking relationships

This is especially promising for the planned difficulty work, because a good
solver heuristic often exposes what actually makes a board hard.

If the solver consistently treats certain local configurations as critical, that
may indicate good candidate metrics for difficulty analysis.

## Pruning As Measurement Support

Pruning is useful not only for making a solver fast enough to run. It also helps
make large-sample analysis practical.

That matters because the difficulty notes already assume:

- board batches
- repeated evaluation across layouts and seeds
- comparisons between baseline generation and suspension-enabled generation

Without effective pruning, those comparisons may be too expensive to run often.

## What Seems Especially Relevant To Suspension

The suspension idea is intended to increase order sensitivity by making same-face
pairing decisions more consequential.

This paper does not describe suspension, but its emphasis on critical decisions
supports the same overall direction.

The connection is:

- the paper suggests some groups of choices are disproportionately important
- suspension is explicitly trying to create more of those important choices

So the paper strengthens the case for measuring:

- pair-choice sensitivity
- dead-end sensitivity after ambiguous pair choices
- solver backtracking caused by same-face ambiguity

If suspension works, a future solver should detect more states where one local
pairing choice materially changes downstream solvability.

## What Does Not Transfer Directly

Some caution is important.

The paper's strongest structural results apply to restricted layout classes.
This project supports broad, irregular 3D layouts, so the paper should not be
treated as if it gives a complete general solver recipe for this engine.

So the right use of the paper is:

- as a source of solver ideas
- as support for structural pruning
- as evidence that critical local configurations matter

and not as:

- a drop-in solving method for all layouts in this repository

## Practical Implications For This Repo

### For A Solver Prototype

The first solver/analysis prototype should probably include:

- search with backtracking
- move ordering heuristics
- hooks for pruning rules
- instrumentation around ambiguous same-face choices

And it should be built with the expectation that more structural heuristics will
be added later.

### For Difficulty Measurement

This paper reinforces that difficulty should not be measured only by the number
of currently playable pairs.

More meaningful signals likely include:

- how often the solver encounters critical-choice states
- how sharply outcomes diverge after local pairing decisions
- how much search pruning is needed to keep analysis tractable

### For Future Documentation

If the solver-analysis tool grows, it may be useful to add a dedicated section
for:

- known structural obstructions
- known restricted-case guarantees
- solver heuristics inspired by academic work

This paper would be the first entry in that thread.

## Recommended Next Step

When solver work begins, treat this paper as guidance for:

- early pruning design
- move ordering heuristics
- and the idea that some local tile groups should be analyzed as critical
  structures rather than just another branch in the search tree
