# Mahjongg Difficulty Tuning Knobs

This note summarizes the generation-time difficulty levers for Mahjongg and
how they tend to move the analyzer metrics.

The current goal is not to make boards merely fail more often. The useful target
is a solvable board where early choices and same-face pair choices matter more:

- easy should be easier than random
- medium should be near random
- nightmare should be significantly more decision-dense than random while still
  preserving a known solution

## Human-Relevant Metrics

These are the most useful metrics for tuning toward human-perceived difficulty:

- `Search consequential pair-choice states`: counts searched states where one
  legal same-face pair choice has different downstream consequences than another.
  Higher usually means more meaningful player decisions.
- `Initial downstream dead-end spread`: measures how much the opening pair
  changes downstream dead-end rate. Higher means early choices matter more.
- `Initial downstream remaining spread`: measures how much the opening pair
  changes how many tiles remain at downstream termination. Higher means some
  early choices fail much earlier than others.
- `Known solution longest low-branch run`: measures long constrained stretches
  along the generated solution. Higher can feel tighter, especially on hard
  levels.
- `P75 dead-end remaining`: the 75th percentile of remaining tiles at playout
  dead end. Higher means the harsher playout failures are happening earlier.

Use `Playout dead-end rate` as a guardrail, not the primary target. Random boards
can score high here because they are not guaranteed to be solvable, while engine
boards are expected to keep a valid known solution.

## Difficulty Value

Code:

- `Engine.setupDifficulty(difficulty)`
- CLI: `--generation-difficulty easy|medium|hard`
- CLI: `--generation-difficulty-value <0..1>`

Effect:

- `0` biases the picker toward the easy end of each tile score list.
- `0.5` keeps the selection window broad.
- `1` biases the picker toward the hard end of each tile score list.

This affects all tile-picker scoring components through the sliding window and
default hard-side pressure multipliers.

## Sliding Window

Code:

- `getDifficultyWindowDetails(scoredTiles, options)`
- Option: `minWindowRatio`

Effect:

- Medium difficulty uses a broad window.
- Hard difficulty shrinks the window toward high scored tiles.
- Easy difficulty shrinks the window toward low scored tiles.
- Smaller `minWindowRatio` makes easy/hard more deterministic and more extreme.
- Larger `minWindowRatio` keeps more natural variability.

## Freed-Tile Pressure

Code:

- `countTilesFreedByRemoval(tile, openTiles)`
- `getOpenPressure(freedCount, options)`
- CLI: `--open-pressure-multiplier <n>`
- CLI: `--max-freed-pressure <n>`

Effect:

- Hard settings prefer removals that open fewer new tiles.
- Easy settings should prefer removals that open more tiles and reduce stack
  pressure faster.
- Increasing `openPressureMultiplier` strengthens the hard-side bias.
- Increasing `maxFreedPressure` broadens the freed-tile range that contributes
  pressure.

Expected metrics:

- Higher hard-side pressure tends to raise tightness and can increase early
  dead-end pressure.
- Too much pressure can reduce natural variability without improving human
  difficulty.

## Z Weight

Code:

- `scoreOpenTiles()`
- `highestZOrder`

Effect:

- Higher z tiles get lower hard-side weight because `zWeight` is calculated from
  `highestZOrder - tile.z`.
- Easy selection therefore tends to remove higher stacks sooner.
- Hard selection tends to preserve taller stacks longer.

The sliding window controls how strongly this matters. The z score is one part
of the sorted tile weight, not a hard rule.

## Reference Intersections

Code:

- `buildHorizontalReferenceMasks(referenceTiles)`
- `buildVerticalReferenceMasks(referenceTiles)`
- `countHorizontalIntersections(tile, masks)`
- `countVerticalIntersections(tile, masks)`
- Options: `horizontalMultiplier`, `verticalMultiplier`

Effect:

- When picking the second tile in a pair, the first tile becomes the reference.
- When picking a suspension triple, the third tile uses the first two as
  references.
- When releasing a suspension, the original pair plus suspended tile become
  references.
- Horizontal intersections compare same-level rows.
- Vertical intersections compare x/y quarter overlaps and are weighted more
  strongly by default.

Increasing these multipliers biases hard selections toward tiles that are more
geometrically entangled with earlier choices.

## Stack-Balance Safety And Pressure

Code:

- `getStackBalanceAfterRemoval(removedTiles)`
- `wouldCreateDominantStack(removedTiles)`
- `getBalancePressure(balance, options)`
- CLI: `--balance-pressure-multiplier <n>`
- CLI: `--max-balance-margin <n>`

Effect:

- Stack safety rejects choices that would leave one stack taller than the number
  of other remaining stack groups.
- Balance pressure can still prefer tighter margins before that unsafe shape is
  reached.
- Higher `balancePressureMultiplier` makes hard generation favor choices closer
  to the dominant-stack edge.
- Higher `maxBalanceMargin` expands the margin range that contributes pressure.

Expected metrics:

- Should increase constrained play and early-decision sensitivity.
- The hard rejection is a safety valve to avoid bad terminal stack layouts.

## Short-Horizon Probe

Code:

- `runShortHorizonProbe(removedTiles, options)`
- `getShortHorizonPressure(moves, collapsed, options)`
- CLI: `--short-horizon-probe`
- CLI: `--short-horizon-probe-moves <n>`
- CLI: `--short-horizon-pressure-multiplier <n>`

Effect:

- Simulates a few naive future removals after a candidate choice.
- If the probe collapses quickly, hard settings can score that choice higher.
- This is a structural probe, not a solver. It is intentionally simple and local.

Expected metrics:

- Can increase early dead-end pressure.
- Watch `Picker short-horizon collapse rate`, `average short-horizon pressure`,
  and downstream spread metrics to see if it is doing real work.

## Suspension

Code:

- `setupSuspensionRules(rules)`
- `canSuspend()`
- `placeWeightedSuspensionPair()`
- `placeWeightedReleasedSuspensionPair(index)`
- CLI: `--suspension conservative|moderate|aggressive`
- CLI: `--force-release-at-effective-open <n>`
- CLI: `--suspend-at-effective-open <n>`

Key rules:

- `frequency`: chance to try a suspension.
- `maxSuspended`: total suspension cap.
- `maxNested`: active simultaneous suspension cap.
- `placementCount`: how long to delay release.
- `maxOpenCount`: release threshold by open-tile count.
- `matchType`: whether placement and open-count thresholds use `either` or
  `both`.
- `forceReleaseAtEffectiveOpen`: release safety threshold.
- `suspendAtEffectiveOpen`: creation safety threshold.

Effect:

- Suspensions hide a matching tile deeper in the generated solution order.
- This adds delayed-order pressure rather than only changing immediate pair
  count.
- Suspensions require a full face set because two faces are placed immediately
  and two are reserved for the suspended tile and later partner.

Expected metrics:

- More suspension tends to increase path pressure and can increase remaining
  tiles at dead end.
- Watch skip and force-release stats; many force releases mean the safety valves
  are dominating the intended delay.

## Face Avoidance And Preferred Face Groups

Code:

- `setupFaceAvoidanceRules(rules)`
- `addFaceAvoidance(tile, faceSet, weight)`
- `getWeightedFaceGroup(requiredFaces, tiles, recordDraw)`
- `getPreferredFaceGroup(requiredFaces, tiles)`
- `drawPreferredFacePairForRecord(pairRecord)`
- CLI: `--face-avoidance`
- CLI: `--face-avoidance-weight <n>`
- CLI: `--suspension-face-avoidance-weight <n>`
- CLI: `--face-avoidance-max-weight <n>`

Effect:

- Adds soft penalties to nearby or newly opened future tiles so they are less
  likely to receive the same face group as a recently generated pair.
- Normal pair records can store a soft preferred face group. Final assignment
  tries that stable face-group id first, then falls back if it was consumed.
- This is not a hard reservation system.

Expected metrics:

- Can increase same-face choice consequences and downstream spread.
- Watch `Face avoidance preferred groups`, `preferred draws`, and `preferred
  fallbacks`.
- A high fallback rate is a signal that a formal two-pass reservation model may
  become useful.

## Full Sets Versus Partial Sets

Current rule:

- Suspensions need full face sets (`requiredFaces = 4`).
- Normal pairs only need partial face sets (`requiredFaces = 2`).

The two-pass model is available if future rules need it:

1. assign or reserve all full-face-set obligations
2. fill normal pair records from the remaining partial sets

At the moment, suspension is the only full-set obligation, and it already draws
its full set immediately.

## Current Nightmare Experiment

A representative hard experiment is:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --boards 1..20 --batch --generation-difficulty hard --suspension aggressive --force-release-at-effective-open 3 --suspend-at-effective-open 5 --open-pressure-multiplier 1 --max-freed-pressure 6 --balance-pressure-multiplier 1 --max-balance-margin 48 --short-horizon-probe --short-horizon-probe-moves 8 --short-horizon-pressure-multiplier 1 --face-avoidance --face-avoidance-weight 1 --suspension-face-avoidance-weight 3 --face-avoidance-max-weight 8 --max-depth 3 --max-states 500 --playouts 16 --pair-choice-playouts 2
```

Recent comparison against random showed the nightmare configuration was much
more decision-dense:

- `Search consequential pair-choice states`: about `307` versus random `129`
- `Initial downstream dead-end spread`: about `52.5%` versus random `10.0%`
- `Initial downstream remaining spread`: about `49.75` versus random `26.50`

Random still had a higher raw playout dead-end rate, but those boards did not
preserve a known solution. Treat that as a different kind of failure than a
solvable constructed board with punishing choices.
