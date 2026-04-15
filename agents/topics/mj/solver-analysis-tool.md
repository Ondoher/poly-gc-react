# Mahjongg Solver And Analysis Tool

## Scope Note

This note is about the tooling shape, not the current runtime difficulty story.

Use it for:

- solver and analyzer architecture ideas
- prototype scope
- script-side tool responsibilities

Use these for adjacent concerns:

- [engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
  for the current engine-side difficulty model
- [difficulty-measurement.md](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-measurement.md)
  for what the analyzer metrics mean

## Goal

Capture notes for building a standalone solver/analysis tool around the existing
Mahjongg engine.

This tool is intended to support:

- difficulty measurement
- generator validation
- tuning of future difficulty algorithms such as tile suspension
- exploratory analysis of layouts, seeds, and playable-pair structure

It is not primarily a player-facing feature. It is a development and analysis
tool.

## Core Purpose

The main purpose of the tool is to answer questions like:

- how many successful solve paths appear to exist?
- how often do legal moves lead to dead ends?
- how much backtracking is needed to solve a board?
- how sensitive is the board to choosing one matching pair over another?
- how does a generation tweak change those metrics?

For generated boards in this engine, solvability is generally assumed because
the builder is intended to produce boards with at least one solution.

So the main value of the tool is not proving that a generated board is winnable.
It is measuring how the search space behaves:

- how forgiving it is
- how constrained it is
- how punishing wrong local choices become
- how much solver effort is needed to recover from ambiguity

## Why Build It Separately

The existing engine is optimized for live gameplay.

The solver/analysis tool should stay separate because it will likely need:

- repeated state exploration
- branching and backtracking search
- metric collection
- batch analysis across many generated boards
- debug-oriented output that should not complicate gameplay code paths

Keeping it separate also makes it easier to run in scripts, tests, or future
analysis workflows.

## Suggested Scope

The first version should focus on analysis rather than full feature richness.

### Phase 1

- load or generate a board
- enumerate playable pairs
- recursively explore moves
- detect solved branches and dead-end branches
- collect basic metrics

### Phase 2

- compare multiple solve paths
- estimate solution multiplicity
- collect branching-factor profiles
- record backtracking cost

### Phase 3

- add pair-choice sensitivity analysis
- compare baseline generation against suspension-enabled generation
- support batch evaluation across seeds and layouts

## Candidate Inputs

The tool should eventually support inputs such as:

- layout id
- board number / seed
- tile size should not matter for solving
- optional future generation mode or difficulty mode
- optional suspension settings once implemented

## Candidate Outputs

Useful outputs may include:

- number of explored states
- number of dead ends
- number of backtracks
- branching profile
- estimated number of successful solve paths
- pair-choice sensitivity score
- summary difficulty profile

For generated boards, `solvable / unsolvable` is secondary. It may still be
useful as a guardrail or regression check, but it is not the primary analytic
goal.

## Likely Architecture

The cleanest design is probably:

- a solver that works from engine-compatible board state
- an analysis layer that records metrics during search
- optional script or command entry points that run batches

Possible internal pieces:

- `SolverState`
  - board occupancy
  - placed tiles
  - currently playable pairs
  - move history

- `Solver`
  - explores legal moves
  - supports backtracking
  - reports solved and failed branches

- `AnalysisRecorder`
  - collects branching and dead-end statistics
  - measures pair-choice divergence
  - aggregates results

## Implementation Notes

- Reuse engine rules where practical instead of re-implementing move legality
  from scratch.
- Prefer a representation that can be cloned cheaply, because search will
  expand many states.
- Treat the first version as an instrumentation tool, not as a perfect
  production solver.
- Assume generated boards should already be solvable and focus instrumentation
  on difficulty characteristics rather than only on yes/no solvability.
- Favor metrics that help tune generation over metrics that are expensive but
  not actionable.

## Relationship To Difficulty Measurement

The difficulty-measurement note defines what should be measured.

This note is about the tool needed to obtain those measurements.

In short:

- `difficulty-measurement.md`
  - what to measure and why

- `solver-analysis-tool.md`
  - what to build in order to measure it

## Immediate Next Step

When work begins, the first design pass should define:

- how to snapshot engine state for branching search
- whether the solver reuses `Engine` directly or uses a lighter derived state
  model
- what the smallest useful metric set is for the first runnable prototype

## Current Prototype Baseline

The current script-side prototype lives under:

- [scripts/difficulty](/c:/dev/poly-gc-react/scripts/difficulty)

It supports generator modes:

- `engine`: use the active game engine generator
- `standalone`: scripts-side solved-by-construction generator mirroring the
  current engine approach
- `random`: random face-dealt board, where each placed tile receives a random
  remaining face

The prototype currently measures:

- initial playable pair count
- same-face pair-choice sensitivity
- known solution path branching when a known solution is available
- bounded search branching and dead ends
- deterministic random playout solve/dead-end rates
- average remaining tiles after playouts

The random face-dealt mode has no known solution path by construction, so the
tool reports that path as `unknown`. This should not be interpreted as
unsolvable without a full solver pass.

## Future Human-Grounded Validation

This project is still engineering-centric, so future validation does not need
to start with a formal playtest program or recruited volunteer pool.

One practical next step is to treat lightweight player interaction data as an
adjacent input to the analyzer rather than as a separate research project.

### Why This Fits This Repo Well

Generated boards are deterministic by seed and generation settings.

That means a small feedback record can be joined back to a fully reconstructed
board later, then enriched offline with analyzer metrics. In practice, the key
for later analysis should be closer to:

- engine or build version
- layout id
- generator mode
- difficulty preset or explicit generation rules
- board number

Board number alone is useful, but it is not enough once generation rules or
 implementation details change over time.

### Low-Friction Feedback Direction

If lightweight feedback collection is added later, the project should prefer:

- one-click end-of-board ratings
- behavior-derived friction signals
- full move and tool event logs for deterministic replay

This avoids needing a dedicated participant study just to start validating
whether analyzer metrics line up with player-facing difficulty.

### Minimum Useful Session Record

The smallest useful board-session record would likely include:

- session id
- engine or build version
- layout id
- generator mode
- difficulty preset or explicit generation overrides
- board number
- session outcome
  - solved
  - dead-ended
  - abandoned
  - restarted
- start time and end time

This is enough to regenerate the exact board later and join it with analyzer
output.

### Minimum Useful Event Log

The most valuable additional data is ordered play history.

For each event, record:

- session id
- sequence number
- elapsed time or timestamp
- action type
  - play pair
  - undo
  - redo
  - hint
  - shuffle
  - restart
  - abandon
- for pair plays:
  - tile1
  - tile2
- optional local state context:
  - remaining tile count
  - playable pair count

Because the board is deterministic, this event log can later be replayed
against the exact board state and compared against the known solution path and
analyzer predictions.

### Useful Derived Human-Centric Metrics

Once session events exist, a future analysis pass can derive signals that are
more human-grounded than search metrics alone.

Especially promising first metrics:

- `First divergence depth`
  - the move index where the player first leaves the engine's recorded solution
    path
- `Branch regret rate`
  - how often a player undoes back across a prior pair choice, especially at
    ambiguous same-face states
- `Hint pressure`
  - hint usage frequency and the board stage where hints are requested
- `Thrash index`
  - repeated undo/redo or long time spent with little net progress
- `Collapse distance`
  - how far a player gets after a major divergence before dead-ending,
    abandoning, or entering heavy recovery behavior

These are attractive because they connect naturally to the current analyzer's
search-space story:

- pair-choice sensitivity
- delayed consequence
- local opacity
- fairness versus frustration

### How This Would Be Used

The intended use is not to replace the current analyzer.

The intended use is:

1. keep using solver and playout metrics as engineering-facing proxies
2. collect deterministic session records during normal product usage
3. regenerate those same boards offline
4. join analyzer metrics with session outcomes and interaction traces
5. test which analyzer signals actually correlate with human friction or
   perceived difficulty

That would help answer questions such as:

- do boards with higher downstream pair-choice spread really produce more human
  regret or later collapse?
- do dominant-stack-risk states align with "felt unfair" behavior?
- do hint-heavy sessions cluster around specific board structures?
- which presets are difficult in an engaging way versus merely confusing?

### Repeated Plays On The Same Board

Another especially useful validation path is to collect multiple sessions on
the same deterministic board.

This matters because one playthrough can mix together several things:

- the board's actual structure
- the player's current mood or patience
- whether the player was exploring or trying to solve cleanly
- luck in sampled hint or branch discovery

Repeated sessions on the same board make it easier to separate board-intrinsic
signals from session noise.

Useful questions for repeated-board analysis:

- does the same board reliably produce high undo or hint pressure across
  sessions?
- do players repeatedly fail after the same early branch choice?
- does familiarity collapse the board's apparent difficulty quickly, or do the
  hard decisions remain consequential across replays?
- are there boards whose analyzer scores look ordinary but repeatedly trigger
  abandonment or thrash?

This also creates a good bridge between solver-style metrics and human
experience:

- if repeated plays converge toward the known solution quickly, the board may be
  hard mostly because it is unfamiliar
- if repeated plays still show heavy regret or delayed collapse, the board may
  have genuinely consequential structure
- if repeated plays diverge strongly between sessions, the board may contain
  meaningful branch sensitivity rather than just one obvious trap

At the data level, repeated-board tracking only needs one more stable concept:

- a board identity key that groups sessions by the exact generated board

In practice that key should still include:

- engine or build version
- layout id
- generator mode
- difficulty preset or explicit generation rules
- board number

Once grouped that way, the analysis layer can compute per-board aggregates such
as:

- session count
- solve rate per board
- average first divergence depth
- average branch regret rate
- average hint pressure
- average thrash index
- common failure move indexes
- common failure states or pair choices

This kind of repeated-board analysis is likely one of the cheapest ways to
improve confidence that measured analyzer signals correspond to human-facing
difficulty rather than to one-off session variance.

### Opt-In Tuning Boards

Another lightweight direction is an explicit in-product prompt such as:

- `Help us make this better`

That prompt could offer an opt-in path where, instead of serving an arbitrary
board for the selected difficulty, the game serves a deterministic board from a
small tuning pool chosen for that difficulty tier.

This has several advantages:

- it keeps the player experience simple
- it avoids needing a dedicated volunteer program
- it concentrates feedback onto boards that are especially informative
- it makes repeated-board analysis much easier

One practical flow would be:

1. the player chooses a difficulty
2. the UI offers:
   - play normally
   - help improve this difficulty
3. if the player opts in, the game selects a deterministic board from a
   curated tuning set for that difficulty
4. normal session and event telemetry is recorded
5. optional end-of-board feedback can be attached to that exact board identity

This would allow the project to maintain small curated buckets such as:

- calibration boards
  - stable reference boards used over long periods for comparison
- candidate boards
  - boards selected because analyzer metrics suggest they are good tests for a
    preset
- outlier boards
  - boards whose analyzer profile or prior player sessions suggest they are
    unusually confusing, punishing, or interesting

The deterministic nature of generation makes this especially attractive.
Sessions can be grouped by the same exact board identity and analyzed later
without storing a full board snapshot.

This is also a good fit for an engineering-first project because it turns
ordinary gameplay into a gradual source of validation data instead of requiring
a separate research workflow up front.

### Low Play Volume As The Main Constraint

For a side project maintained by one engineer, the biggest likely bottleneck is
not instrumentation or analysis design. It is attracting enough real play
sessions to make broad conclusions trustworthy.

That constraint should shape the validation plan from the beginning.

The project should optimize for low-volume, high-value data rather than
assuming large-scale player traffic.

In practice that means:

- prefer repeated plays on a small curated board pool over sparse data on many
  unrelated boards
- prefer passive telemetry over long surveys
- prefer one-click feedback over multi-question forms
- prefer metrics that stay interpretable with small sample sizes
- prefer board-level aggregates and outlier review over large-population claims

This also changes the success target.

For a project at this scale, the realistic goal is not to fully prove that the
entire analyzer stack matches human difficulty in a general sense.

The more realistic goal is to gather enough data to:

- falsify bad assumptions
- find analyzer metrics that clearly fail to match player behavior
- identify especially useful metrics that do appear to align with friction or
  perceived difficulty
- detect outlier boards that behave very differently from their analyzer
  profile

The deterministic board model is what makes that realistic. Even modest traffic
can still be useful if sessions are concentrated on stable board identities that
can be replayed, re-analyzed, and compared over time.

So the practical posture for future feedback work should be:

- small asks
- concentrated board selection
- detailed offline analysis
- caution about over-interpreting thin data

### Small-Network Distribution And Small-Screen Play

At this project's likely scale, early useful traffic may come less from broad
discovery and more from small-network distribution:

- friends
- acquaintances
- social posts
- direct links to specific builds or board pools

That is a valid path for this kind of validation work. If the feedback loop is
low-friction and the board identities are deterministic, even a small recruited
network can still generate meaningful repeated-board data.

Small-screen deployment also matters here. If the game can be played
comfortably on limited-resolution screens, that increases the number of moments
where someone can casually start or resume a board:

- short play sessions
- repeat sessions across the same day
- opportunistic mobile or small-window play
- more chances to collect lightweight interaction data

That makes the existing UI direction especially relevant. A UI already designed
around constrained resolution is not only a presentation win; it is also a data
collection enabler because it increases practical play opportunities.

For future validation work, this suggests a simple strategy:

- make deployment easy to open from a shared link
- keep the session start flow extremely short
- route opt-in players toward curated deterministic boards
- rely on normal casual play rather than on formal test-session commitment

If small-screen access is genuinely smooth, the project may need fewer total
people than expected because the same small audience can generate more sessions
over time.

### Deployment Readiness And HTTPS

Practical deployment readiness is another real gating factor for validation.

If the game already has access to:

- an existing domain name
- a reachable server
- a UI that works at small resolutions

then the main remaining blockers may be operational rather than architectural.

In particular, HTTPS matters because it reduces friction at exactly the moment
the project needs casual access to work well:

- shared links are more trustworthy
- mobile browsers are less likely to warn or degrade the experience
- players are more willing to open and revisit the game
- telemetry and repeat sessions become more realistic

For this project, that means deployment work should be treated as part of the
validation pipeline, not as an unrelated release chore.

Once a stable HTTPS URL exists, the project can make much better use of:

- small-network sharing
- repeat-session collection
- opt-in tuning boards
- lightweight end-of-board prompts

### Framing

This is still an engineering-first direction.

The goal is not to run a formal human-subject study immediately. The goal is to
make future player-facing validation cheap enough that normal usage can
gradually test whether the analyzer's current proxy metrics match human
experience.
