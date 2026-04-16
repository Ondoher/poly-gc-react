# Scripts

## Purpose

Capture guidance about the repository's script usage, especially generation and conversion tools that support feature work.

## Script Note

The current top-level `scripts` folder is mostly a personal working area for one-off conversion and generation tasks that were used during development, especially for Mahjongg layout conversion and CSS generation.

Most of that folder is not intended to be checked in as core repository infrastructure.

The scripts that appear to have the best chance of ongoing reuse are the ones that adapt external assets or data into repository formats, for example:

- tile-size CSS generation
- tile-face CSS generation
- layout conversion from outside sources into repo layout JSON

If the repo later formalizes a shared scripts area, those are the strongest candidates to promote into that more permanent repository-level tooling layer.

One exception now exists:

- [scripts/deploy/production-deploy.sh](/c:/dev/poly-gc-react/scripts/deploy/production-deploy.sh)

That script is an intentionally reusable operational helper for the current
server deploy flow. It is not a one-off content-generation tool.

## Deployment Script

The current production deploy helper lives at:

- [scripts/deploy/production-deploy.sh](/c:/dev/poly-gc-react/scripts/deploy/production-deploy.sh)

Its purpose is to run the verified server-side update flow:

- load `nvm`
- `git pull`
- `npm install`
- `pm2 restart poly-gc --update-env`
- show status and recent logs

The exact live runbook and environment assumptions are documented in:

- [Production Deploy Runbook](/c:/dev/poly-gc-react/agents/topics/deployment/production-deploy-runbook.md)

## Tile CSS Generators

The Mahjongg tile CSS generators now live together under:

- [scripts/tile-css](/c:/dev/poly-gc-react/scripts/tile-css)

That folder currently contains:

- [tilesize.js](/c:/dev/poly-gc-react/scripts/tile-css/tilesize.js)
- [tileface.js](/c:/dev/poly-gc-react/scripts/tile-css/tileface.js)
- [tile-sizes.json](/c:/dev/poly-gc-react/scripts/tile-css/tile-sizes.json)
- shared helper modules used by those generators

Older top-level script paths still exist during the transition, but the
tile CSS generator folder above is the canonical location for current work.

## `tilesize.js`

The tile-size generator lives at:

- [scripts/tile-css/tilesize.js](/c:/dev/poly-gc-react/scripts/tile-css/tilesize.js)

Its current purpose is to generate Mahjongg tile-layout CSS files under:

- [src/gc/features/mj/assets/css/tile-layout](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout)

Those generated files define:

- the rendered `.board-canvas` width and height for a tile size
- base tile and face dimensions for that size
- the absolute `pos-x-y-z` placement rules for every board coordinate

Current generated targets are:

- [normal-size.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/normal-size.css)
- [medium-size.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/medium-size.css)
- [small-size.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/small-size.css)
- [tiny-size.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/tiny-size.css)

The script is intended to be run from the repository root. Current regeneration commands are:

```powershell
node .\scripts\tile-css\tilesize.js normal-size .\src\gc\features\mj\assets\css\tile-layout\normal-size.css -w 56 -h 77 -x 8 -y 7 -r 9 -b 9
node .\scripts\tile-css\tilesize.js medium-size .\src\gc\features\mj\assets\css\tile-layout\medium-size.css -w 48 -h 66 -x 6 -y 5 -r 8 -b 7
node .\scripts\tile-css\tilesize.js small-size .\src\gc\features\mj\assets\css\tile-layout\small-size.css -w 42 -h 58 -x 6 -y 5 -r 8 -b 7
node .\scripts\tile-css\tilesize.js tiny-size .\src\gc\features\mj\assets\css\tile-layout\tiny-size.css -w 32 -h 44 -x 5 -y 4 -r 6 -b 6
```

The script now loads its default size definitions from:

- [tile-sizes.json](/c:/dev/poly-gc-react/scripts/tile-css/tile-sizes.json)

You can point it at an alternate config file with `--config` or `-c`.

One recent behavior change is important:

- the generated canvas-size selector now uses `.size-name.board-canvas`
- that matches the current MJ rendering model, where tile size/style classes are applied directly to `Canvas`
- earlier generated output used a descendant selector like `.size-name .board-canvas`, which no longer matches the current component structure

Future cleanup note:

- the current script still relies on explicit command-line sizing arguments for each generated size
- later, this should be replaced or supplemented with a JSON configuration file that contains the tile sizing parameters
- that file should become the single source of truth for size-related generation inputs such as width, height, depth offsets, and padding values

## Mahjongg Difficulty Scripts

The Mahjongg difficulty script area lives at:

- [scripts/difficulty](/c:/dev/poly-gc-react/scripts/difficulty)

This folder is intended to host command-line solver and difficulty-analysis
work for the Mahjongg engine.

The initial entry point is:

- [scripts/difficulty/cli.js](/c:/dev/poly-gc-react/scripts/difficulty/cli.js)

It can be run from the repository root:

```powershell
node .\scripts\difficulty\cli.js --layout turtle --board 12345
```

Current behavior:

- imports the active Mahjongg engine directly
- restarts through a local Node ESM loader that maps the engine's `utils/`
  aliases without changing engine source
- supports `--generator engine`, `--generator standalone`, and
  `--generator random`
- loads layout data from the feature's `layouts.json`
- generates a deterministic board for a layout and board number
- validates the engine's known solution path
- performs a bounded playable-pair search and reports difficulty-oriented
  metrics such as branching, dead-end rate, and pair-choice sensitivity
- runs deterministic random playouts and uses playout dead-end rate plus average
  remaining tile count to better rate random-face boards

The CLI keeps JSON compact by default for batch work. Use `--json --detail` when
the full diagnostic pair lists and branch arrays are needed.

The standalone generator lives at:

- [scripts/difficulty/random-board-generator.js](/c:/dev/poly-gc-react/scripts/difficulty/random-board-generator.js)

It uses the existing `Random` utility directly and does not import the game
engine. This gives the difficulty work a greenfield place to experiment with
generation behavior before we decide which ideas belong in the real engine.
