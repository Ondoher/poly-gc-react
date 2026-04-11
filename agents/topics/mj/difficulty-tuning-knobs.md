# Mahjongg Difficulty Tuning Knobs

This note summarizes the generation-time difficulty levers for Mahjongg and
how they tend to move the analyzer metrics.

Scope note:

- use the [engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
  for the canonical current-system walkthrough and the current ladder summary
- use this note for knob-by-knob effects, tuning interpretation, and the latest
  experiments that informed the current presets

That split is intentional. The engine README explains the system. This file
explains which dials have proven worth keeping an eye on.

The current goal is not to make boards merely fail more often. The useful target
is a solvable board where early choices and same-face pair choices matter more:

- easy should be easier than random
- standard should be near random
- nightmare should be significantly more decision-dense than random while still
  preserving a known solution

## Human-Relevant Metrics

These are the most useful metrics for tuning toward human-perceived difficulty:

- `Search consequential pair-choice states`: counts searched states where one
  legal same-face pair choice has different downstream consequences than another.
  Higher usually means more meaningful player decisions.
- `Initial downstream dead-end spread`: from the starting board, measures how
  much the available same-face pair choices change downstream dead-end rate.
  Higher means the first ambiguous pair choice matters more.
- `Initial downstream remaining spread`: from the starting board, measures the
  spread of the average remaining tiles at termination across those initial
  same-face pair-choice branches. Higher means some early choices fail much
  earlier than others.
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
- CLI convenience presets: `--generation-difficulty easy|medium|hard`
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

## Face-Group Reuse Spacing

Code:

- `recordAssignedFacePair(tile1, tile2, faceGroup)`
- `getSortedFaceGroupDistanceCandidates(requiredFaces, pairRecord, options)`
- `getFaceGroupDistanceWindowDetails(requiredFaces, pairRecord, options)`
- `pickFaceGroupDistanceCandidate(requiredFaces, pairRecord, options)`
- `setupFaceAssignmentRules(rules)`
- `getFaceGroupPreferredSortValue(baseSortValue, preferred)`
- `getFaceGroupDuplicateCount(reusedIndex, reusedCount, options)`
- CLI: `--preferred-face-group-multiplier <n>`
- CLI: `--easy-reuse-duplicate-scale <n>`

Effect:

- Face assignment now keeps an ordered history of already assigned face-group
  pairs.
- Reusable face groups are sorted by placement distance, nearest first.
- Unused groups are appended after the reused candidates in stable order.
- The same sliding difficulty window used by tile picking is then applied to
  that ordered face-group list.
- Preferred face groups are not handled by a separate branch anymore. They are
  folded into the same ordering with a fractional multiplier.
- Easy can additionally duplicate nearby reused face groups in the candidate
  list, making clustered reuse more likely.

Current rule shape:

- `preferredMultiplier: 0.5` is the default soft continuity bias.
- `easyReuseDuplicateScale` only acts on the easy side of the difficulty range.
- Once difficulty reaches the harder side, duplication becomes inert and reuse
  is delayed naturally by the ordered list.

Expected metrics:

- Easy should become more forgiving: higher solve rate, lower dead-end rate,
  lower remaining tiles at failure, and much lower brutality.
- Standard and harder levels should remain effectively unchanged by the
  duplication knob.
- Search consequential states can stay high on easy because the board is still
  authored; the low-end target is "friendlier," not "choice-free."

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

## Recommended Five-Level Settings

The current five-level ladder should use these settings as the starting point.
These were checked on turtle boards `1..20` with analysis depth `3`, state cap
`500`, `16` playouts, and `2` pair-choice playouts.

| Level | Generation Difficulty | Suspension | Tile Picker Rules | Face Assignment | Face Avoidance |
| --- | ---: | --- | --- | --- | --- |
| Easy | `0` | off | default | `preferredMultiplier: 0.5`, `easyReuseDuplicateScale: 2` | off |
| Standard | `0.35` | off | default | `preferredMultiplier: 0.5`, `easyReuseDuplicateScale: 0` | off |
| Challenging | `0.6` | aggressive | default | `preferredMultiplier: 0.5`, `easyReuseDuplicateScale: 0` | off |
| Expert | `0.75` | aggressive | `openPressureMultiplier: 1`, `maxFreedPressure: 6`, `balancePressureMultiplier: 1`, `maxBalanceMargin: 48` | `preferredMultiplier: 0.5`, `easyReuseDuplicateScale: 0` | `weight: 1`, `suspensionWeight: 3`, `maxWeight: 8` |
| Nightmare | `1` | aggressive with `forceReleaseAtEffectiveOpen: 3`, `suspendAtEffectiveOpen: 5` | Expert rules plus `shortHorizonProbeMoves: 8`, `shortHorizonPressureMultiplier: 1` | `preferredMultiplier: 0.5`, `easyReuseDuplicateScale: 0` | `weight: 1`, `suspensionWeight: 3`, `maxWeight: 8` |

The sampled metric shape was:

| Metric | Random | Easy | Standard | Challenging | Expert | Nightmare |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Playout solve rate | `3.8%` | `46.3%` | `35.6%` | `19.1%` | `16.3%` | `5.6%` |
| Playout dead-end rate | `96.3%` | `53.8%` | `64.4%` | `80.9%` | `83.8%` | `94.4%` |
| Playout average remaining tiles | `59.07` | `11.45` | `21.52` | `39.91` | `47.34` | `57.74` |
| P75 dead-end remaining tiles | `73.40` | `26.50` | `42.90` | `65.30` | `70.60` | `69.90` |
| Initial downstream dead-end spread | `6.9%` | `57.8%` | `48.0%` | `32.3%` | `23.6%` | `14.5%` |
| Initial downstream remaining spread | `21.99` | `20.94` | `24.91` | `31.65` | `34.16` | `29.38` |
| Search consequential pair-choice states | `129.20` | `480.90` | `407.15` | `467.05` | `419.25` | `180.55` |
| Score avg | `37.00` | `44.15` | `39.00` | `42.10` | `41.65` | `36.55` |
| Brutality avg | `51.75` | `29.15` | `38.54` | `51.46` | `54.54` | `58.57` |

The score column does not fully express the desired human-facing progression.
The better signal is the combination of solvability, solve rate, remaining
tiles, P75 dead-end remaining, and consequential pair-choice states:

- Easy and Standard are much more solvable than random and fail later.
- Easy now gets its extra softness partly from clustered face-group reuse, and
  that knob is effectively isolated to Easy.
- Challenging raises dead-end rate and remaining-tile severity while keeping a rich
  choice tree.
- Expert adds the face/pressure knobs and crosses random on P75 dead-end
  remaining while staying solvable.
- Nightmare is the most punitive on playout dead-end rate and remaining-tile
  severity, but the tight selection window reduces the number of consequential
  search states. That is acceptable for now because the intended feel is less
  "many rich options" and more "tight, punishing, and still constructed."

## Recent Face-Assignment Findings

The first ladder-wide sweep after enabling the face-group spacing chooser made
all constructed levels harsher. Adding the easy-only reuse duplication rule
pulled the low end back into a better place without moving the harder levels.

The useful result was:

- `preferredMultiplier: 0.5` everywhere
- `easyReuseDuplicateScale: 2` for Easy
- `easyReuseDuplicateScale: 0` for Standard and above

A light 10-board sweep across duplication scales `0..3` showed:

- Easy moved strongly as duplication increased.
- Standard, Challenging, Expert, and Nightmare were unchanged across the same
  duplication values.

That makes `easyReuseDuplicateScale` a clean low-end tuning lever rather than a
ladder-wide destabilizer.
