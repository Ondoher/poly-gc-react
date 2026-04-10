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

Run the aggressive preset with looser safety thresholds:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345 --suspension aggressive --force-release-at-effective-open 3 --suspend-at-effective-open 5
```

Run a batch comparison over many boards:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --boards 1..100 --batch --suspension aggressive
```

Batch output includes suspension instrumentation for engine-generated boards:

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
