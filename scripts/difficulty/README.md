# Mahjongg Difficulty Scripts

This folder hosts command-line tooling for Mahjongg solver and difficulty
analysis work.

The scripts in this folder are development tools. They can import the active
Mahjongg engine directly and should stay separate from the player-facing UI.

## CLI

Run a first-pass board analysis from the repository root:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345
```

Useful options:

- `--layout <id>` selects a layout id from `layouts.json`
- `--board <number>` selects the deterministic board number / seed
- `--boards <range>` selects multiple board numbers for batch analysis, for
  example `1..100` or `1,5,9`
- `--batch` runs batch analysis
- `--generator <name>` chooses `engine`, `standalone`, or `random`
- `--generation-difficulty <preset>` sets the weighted engine picker
  difficulty; currently `easy`, `medium`, or `hard`
- `--generation-difficulty-value <n>` sets the weighted engine picker
  difficulty directly as a number from `0` to `1`
- `--open-pressure-multiplier <n>` overrides how strongly hard-side tile
  picking favors candidates that open fewer new tiles
- `--max-freed-pressure <n>` overrides the freed-tile range used to calculate
  low-open pressure
- `--balance-pressure-multiplier <n>` overrides how strongly hard-side tile
  picking favors low safe stack-balance margins
- `--max-balance-margin <n>` overrides the margin range used to calculate
  stack-balance pressure
- `--short-horizon-probe` enables the short-horizon structural collapse probe
  with default experimental settings
- `--short-horizon-probe-moves <n>` overrides the short-horizon probe depth
- `--short-horizon-pressure-multiplier <n>` overrides the pressure applied when
  a probe collapses inside that depth
- `--face-avoidance` enables weighted face-set avoidance during face assignment
- `--face-avoidance-weight <n>` controls the normal-pair avoidance mark weight
- `--suspension-face-avoidance-weight <n>` controls the stronger suspension
  avoidance mark weight
- `--face-avoidance-max-weight <n>` caps accumulated avoidance per tile/face set
- `--suspension <preset>` applies an engine suspension preset; currently
  `conservative`, `moderate`, or `aggressive`
- `--force-release-at-effective-open <n>` overrides the suspension force-release
  safety threshold
- `--suspend-at-effective-open <n>` overrides the suspension creation safety
  threshold
- `--json` prints the summary as JSON
- `--detail` includes full diagnostic arrays when combined with `--json`
- `--max-depth <n>` limits the bounded search depth
- `--max-states <n>` limits the bounded search state count
- `--playouts <n>` controls deterministic random playout sampling
- `--pair-choice-playouts <n>` controls downstream playout sampling for each
  initial pair-choice candidate
- `--list-layouts` prints available layout ids

The current CLI runs a first-pass difficulty analysis. By default it uses the
active engine to generate a deterministic board, validates the known solution
path, and performs a bounded search over playable pair choices to produce
branching, dead-end, and pair-choice-sensitivity metrics.

It also runs deterministic random playouts. Each playout repeatedly chooses a
playable pair until the board is solved, dead-ended, or reaches the configured
move cap. The playout dead-end rate and average remaining tile count are used to
separate random-face deals from solved-by-construction boards.

The engine still uses browser-build import aliases in a couple of places, so the
CLI restarts itself with a local Node ESM loader that maps only the needed
`utils/` imports. This keeps the difficulty tooling out of the engine code until
we are ready for a deeper engine refactor.

## Standalone Generator

The standalone generator lives at:

- `scripts/difficulty/random-board-generator.js`

It uses the existing `Random` utility directly, but does not import or modify
the game engine. The generator takes a layout definition and a seed, then builds
a solved-by-construction board by removing playable pairs from a fully occupied
layout and assigning matching faces to each removed pair.

## Tile Picker Prototype

The tile picker prototype lives at:

- `scripts/difficulty/tile-picker.js`

Run the ad hoc script with:

```powershell
node .\scripts\difficulty\tile-picker-ad-hoc.js
```

Run the face-avoidance ad hoc checks with:

```powershell
node .\scripts\difficulty\face-avoidance-ad-hoc.js
```

The prototype includes:

- horizontal reference masks built from whole rows for each vertical half of
  each reference tile
- vertical reference masks built from each reference tile's 2x2 quadrant
  footprint, with quarter overlap counted once per reference tile
- open-tile scoring from freed tile count, z level, horizontal intersections,
  and vertical intersections
- sliding-window selection from a sorted score list
- composed pair and suspension-triple picker helpers

In the current scoring direction, lower scores are easier. The easy end biases
toward tiles that open more tiles and tiles higher up the stack, which should
reduce stack size quickly. The hard end biases toward fewer immediate opens,
lower z levels, and stronger reference intersections.

This is intentionally separate from the active engine. It is a small sandbox for
checking picker geometry and difficulty-window behavior before wiring the rules
into generation.

Analyze a board from the standalone generator with:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --generator standalone
```

Use `--json --detail` to include the full analysis details.

Run the active engine with the conservative suspension preset:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --suspension conservative
```

Run the active engine with the moderate suspension preset:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --suspension moderate
```

Run the active engine with the aggressive suspension preset:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --suspension aggressive
```

Run the active engine with the hard weighted picker:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --generation-difficulty hard
```

Run the hard picker with explicit stack-balance pressure:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --generation-difficulty hard --balance-pressure-multiplier 1 --max-balance-margin 48
```

Run the hard picker with explicit low-open pressure:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --generation-difficulty hard --open-pressure-multiplier 1 --max-freed-pressure 6
```

Run the hard picker with the short-horizon probe enabled:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --generation-difficulty hard --short-horizon-probe
```

Run the hard picker with weighted face-set avoidance:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --generation-difficulty hard --face-avoidance --face-avoidance-weight 1 --suspension-face-avoidance-weight 3
```

Run the aggressive preset with looser safety thresholds:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --suspension aggressive --force-release-at-effective-open 3 --suspend-at-effective-open 5
```

Run a batch comparison over many boards:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --boards 1..100 --batch --suspension aggressive
```

Batch output includes suspension instrumentation for engine-generated boards:

- `Brutality score` separates random-play punishment from authored
  pair-choice pressure. It combines playout dead-end rate, high-percentile
  remaining tiles at dead end, shallow dead-end timing, and dominant-stack risk
  at dead ends.
- `Playout average dead-end moves` shows how far random play usually gets
  before failing. Lower values mean the board punishes bad lines earlier.
- `Playout p75 dead-end moves` shows a high-percentile dead-end depth so one or
  two very early failures do not dominate the reading.
- `Playout p75 dead-end remaining tiles` shows how much of the board is usually
  still locked when a bad sampled line dies. This is useful for comparing random
  face deals against solved-by-construction boards.
- `Known solution early/middle/late branching` splits the guaranteed solution
  path into thirds. This helps identify boards that are open early but tighten
  late, or boards that are constrained from the start.
- `Known solution longest low-branch run` counts the longest run of known
  solution moves with two or fewer legal pairs.
- `Known solution dominant-stack risk moves` records how often the known
  solution passes through a stack-balance state close to the bad layout shape.
- `Search dominant-stack risk rate` and `Search dominant-stack rate` record the
  same stack-balance pressure across bounded search states.
- `Picker picks` counts weighted picker calls during generation
- `Picker average weight` shows the average final weighted score selected by
  the picker
- `Picker average freed tiles` shows how many blocked tiles the selected tile
  would open if removed
- `Picker average freed rank` shows the inverted freed-tile rank used in the
  current score, where lower values are easier
- `Picker average open pressure` shows the raw freed-tile multiplier applied to
  hard-side selections; higher values mean the picker is favoring candidates
  that open fewer new tiles
- `Picker average z` and `Picker average z weight` show how the picker is
  interacting with stack height
- `Picker average balance margin` shows how much slack remains between the
  tallest remaining stack and the other remaining tile groups after selected
  removals; lower safe values mean the picker is riding closer to the
  dominant-stack boundary
- `Picker average balance pressure` shows the multiplier applied from that
  margin; hard picker settings raise this when candidates stay close to the
  safe side of the stack-balance boundary
- `Picker average short-horizon moves` shows how far selected candidate probes
  ran before collapsing, or the configured probe depth if they did not collapse
- `Picker average short-horizon remaining tiles` shows how many structural
  tiles remained when the selected candidate probe stopped
- `Picker average short-horizon pressure` shows the multiplier applied from the
  probe
- `Picker short-horizon collapse rate` shows how often selected candidate
  probes collapsed inside the configured horizon
- `Picker average horizontal intersections` and `Picker average vertical
  intersections` show how much the picker is selecting tiles entangled with the
  reference set
- `Picker average candidates`, `Picker average window size`, and `Picker
  average window start` show how broad the active selection window was
- `Picker normal first/second`, `Picker suspension first/second/third`, and
  `Picker released partner` counts show which generation paths used the picker

- `Face avoidance marks` counts soft avoid-face marks added to frontier tiles
- `Face avoidance preferred groups` counts pair records that preselected a
  stable face-group id while avoidance was enabled
- `Face avoidance preferred draws` counts preferred face groups that were still
  available when final face assignment ran
- `Face avoidance preferred fallbacks` counts preferred face groups that had
  already been consumed and had to fall back to weighted face assignment
- `Face avoidance draws` counts weighted face assignments made while avoidance
  is enabled
- `Face avoidance average selected penalty` shows how much avoidance penalty the
  chosen face sets carried
- `Face avoidance non-zero penalty draw rate` shows how often the generator had
  to choose a face set that was discouraged for the pair

- `Suspension attempts` counts calls that considered starting a suspension
- `Suspensions created` counts successful suspensions
- `Suspensions released` counts suspended tiles consumed into later pairs
- `Suspensions force released` counts releases caused by low effective open
  tile pressure
- `Suspension skip frequency` counts random frequency misses
- `Suspension skip total cap` counts skips caused by `maxSuspended`
- `Suspension skip nested cap` counts skips caused by `maxNested`
- `Suspension skip open tiles` counts skips caused by the open-tile safety
  threshold
- `Suspension skip no full face set` counts skips caused by no full four-face
  set remaining in the draw pile
- `Suspension max nested seen` records the highest simultaneous suspension
  count reached
- `Force release avg open tiles` records the average open tile count at actual
  force release points
- `Force release avg suspended` records the average active suspension count at
  actual force release points
- `Force release avg open suspended` records how many active suspensions were
  still open at actual force release points
- `Force release avg effective open` records open tiles minus active
  suspensions at actual force release points
- `Skip open avg open tiles` records the average open tile count when new
  suspension creation was skipped by the effective-open threshold
- `Skip open avg suspended` records active suspensions at those skips
- `Skip open avg open suspended` records how many active suspensions were still
  open at those skips
- `Skip open avg effective open` records open tiles minus active suspensions at
  those skips

Suspended tiles should always remain open. If `open suspended` diverges from the
active suspended count, treat that as an engine invariant problem before
interpreting it as a tuning result.

The analyzer also reports initial downstream pair-choice sensitivity. This is a
sampled metric for ambiguous same-face choices at the starting position: it
tries each initial candidate and runs playouts from the resulting state. This is
intended to catch delayed order pressure that does not show up in the immediate
same-face pair-spread metric.

Useful quick comparison commands:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --boards 1..25 --batch
node .\scripts\difficulty\cli.js --layout turtle --boards 1..25 --batch --suspension aggressive
node .\scripts\difficulty\cli.js --layout turtle --boards 1..25 --batch --generator random
```

Useful threshold sweep shape:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --boards 1..25 --batch --suspension aggressive --force-release-at-effective-open 3 --suspend-at-effective-open 5
```

Use the random-face generator to deal each placed tile from the remaining face
pool without building in a known solution. These boards report the known
solution as `unknown`:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --generator random
```
