# Scripts

## Purpose

Capture guidance about repository scripts, especially generation and conversion
tools that support feature work.

## Current Status

The top-level [scripts](/c:/dev/poly-gc-react/scripts) folder is still mostly a
working area for generation and conversion helpers that were created during
development.

Most of it should still be treated as:

- useful repository tooling
- checked-in when it supports current work
- not automatically equivalent to stable runtime infrastructure

The strongest candidates for ongoing reuse are the scripts that adapt external
assets or source data into repository-owned formats, especially:

- tile-size CSS generation
- tile-face CSS generation
- tile face/body asset generation
- layout conversion into repository JSON

One intentional exception already exists:

- [scripts/deploy/production-deploy.sh](/c:/dev/poly-gc-react/scripts/deploy/production-deploy.sh)

That file is a reusable operational helper for the live deployment flow rather
than a one-off generation script.

## Deployment Script

The current production deploy helper lives at:

- [scripts/deploy/production-deploy.sh](/c:/dev/poly-gc-react/scripts/deploy/production-deploy.sh)

Its purpose is to run the verified server-side update flow:

- load `nvm`
- `git pull`
- `npm install`
- `npm run build`
- `pm2 restart poly-gc --update-env`
- show status and recent logs

The exact live runbook and environment assumptions are documented in:

- [Production Deploy Runbook](/c:/dev/poly-gc-react/agents/topics/deployment/production-deploy-runbook.md)

## Tile CSS Pipeline

The Mahjongg tile CSS and raster generation scripts now live together under:

- [scripts/tile-css](/c:/dev/poly-gc-react/scripts/tile-css)

Current folder contents that matter for active work:

- generators:
  - [tilesize.js](/c:/dev/poly-gc-react/scripts/tile-css/tilesize.js)
  - [tileface.js](/c:/dev/poly-gc-react/scripts/tile-css/tileface.js)
  - [generate-layouts.js](/c:/dev/poly-gc-react/scripts/tile-css/generate-layouts.js)
  - [generate-tile-assets.js](/c:/dev/poly-gc-react/scripts/tile-css/generate-tile-assets.js)
- shared support:
  - [metrics.js](/c:/dev/poly-gc-react/scripts/tile-css/metrics.js)
  - [tile-sizes.json](/c:/dev/poly-gc-react/scripts/tile-css/tile-sizes.json)
  - [options.js](/c:/dev/poly-gc-react/scripts/tile-css/options.js)
  - [table-size.js](/c:/dev/poly-gc-react/scripts/tile-css/table-size.js)
  - [utils.js](/c:/dev/poly-gc-react/scripts/tile-css/utils.js)
- local notes and usage files:
  - [tileface-rewrite-prompt.md](/c:/dev/poly-gc-react/scripts/tile-css/tileface-rewrite-prompt.md)
  - [ts-instructions.txt](/c:/dev/poly-gc-react/scripts/tile-css/ts-instructions.txt)
- checked-in config entry points:
  - [assets/generate-runtime-assets.json](/c:/dev/poly-gc-react/scripts/tile-css/assets/generate-runtime-assets.json)
  - [assets/generate-tiny-assets.json](/c:/dev/poly-gc-react/scripts/tile-css/assets/generate-tiny-assets.json)
  - [test-assets/generate-test-config.json](/c:/dev/poly-gc-react/scripts/tile-css/test-assets/generate-test-config.json)

Older top-level script paths may still exist during the transition, but the
folder above is the canonical location for current Mahjongg tile-generation
work.

### Current Pipeline Shape

The current tile pipeline is split into four related pieces:

1. `tilesize.js`
   Generates board-geometry CSS such as canvas dimensions and `pos-x-y-z`
   placement rules.
2. `tileface.js`
   Generates face-to-index CSS mapping for the tile faces.
3. `generate-layouts.js`
   Generates the shared layout-metric CSS surface in `layouts.css` from the
   canonical size JSON.
4. `generate-tile-assets.js`
   Generates size-specific face and body PNG assets used by the runtime CSS.

Those pieces now share supporting config and helpers in the same folder rather
than being treated as isolated standalone scripts.

## `tilesize.js`

The tile-size generator lives at:

- [scripts/tile-css/tilesize.js](/c:/dev/poly-gc-react/scripts/tile-css/tilesize.js)

Its current purpose is to generate Mahjongg tile-layout CSS files under:

- [src/gc/features/mj/assets/css/tile-layout](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout)

Those generated files currently define:

- the rendered `.board-canvas` width and height for a tile size
- base tile and face dimensions for that size
- the absolute `pos-x-y-z` placement rules for every board coordinate

The script now derives its geometry through:

- [metrics.js](/c:/dev/poly-gc-react/scripts/tile-css/metrics.js)

That shared module owns the reusable size lookup and layout-math helpers used
by the tile CSS pipeline.

Current generated targets are:

- [normal-size.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/normal-size.css)
- [medium-size.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/medium-size.css)
- [small-size.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/small-size.css)
- [tiny-size.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/tiny-size.css)

The script is intended to be run from the repository root. Current regeneration
commands are:

```powershell
node .\scripts\tile-css\tilesize.js normal-size .\src\gc\features\mj\assets\css\tile-layout\normal-size.css -w 56 -h 77 -x 8 -y 7 -r 9 -b 9
node .\scripts\tile-css\tilesize.js medium-size .\src\gc\features\mj\assets\css\tile-layout\medium-size.css -w 48 -h 66 -x 6 -y 5 -r 8 -b 7
node .\scripts\tile-css\tilesize.js small-size .\src\gc\features\mj\assets\css\tile-layout\small-size.css -w 42 -h 58 -x 6 -y 5 -r 8 -b 7
node .\scripts\tile-css\tilesize.js tiny-size .\src\gc\features\mj\assets\css\tile-layout\tiny-size.css -w 32 -h 44 -x 5 -y 4 -r 6 -b 6
```

Current implementation notes:

- the script already loads default size data from
  [tile-sizes.json](/c:/dev/poly-gc-react/scripts/tile-css/tile-sizes.json)
- `tile-sizes.json` is therefore already part of the real current
  implementation, not just future cleanup direction
- the reusable size and geometry math now lives in
  [metrics.js](/c:/dev/poly-gc-react/scripts/tile-css/metrics.js)
- the generated canvas selector now uses `.size-name.board-canvas`
- that matches the current MJ rendering model, where size/style classes are
  applied directly to `Canvas`

Current cleanup direction:

- the explicit CLI sizing overrides are still supported
- but the long-term direction is to rely more directly on the JSON-driven size
  data in [tile-sizes.json](/c:/dev/poly-gc-react/scripts/tile-css/tile-sizes.json)

## `generate-layouts.js`

The layout-metric CSS generator lives at:

- [scripts/tile-css/generate-layouts.js](/c:/dev/poly-gc-react/scripts/tile-css/generate-layouts.js)

Its current purpose is to generate:

- [layouts.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-layout/layouts.css)

That generated file currently exports one shared `:root` block with:

- `--mj-css-ready`
- per-size metric-family vars such as:
  - `--normal-tileWidth`
  - `--normal-faceWidth`
  - `--normal-cellWidth`
  - `--normal-depthX`
  - `--normal-canvasWidth`

Those vars are shaped to match the runtime metric reader used by:

- [layout-scaling.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/layout-scaling.js)
- [css-vars.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/css-vars.js)

The script reads:

- [tile-sizes.json](/c:/dev/poly-gc-react/scripts/tile-css/tile-sizes.json)

and derives the metric families through:

- [metrics.js](/c:/dev/poly-gc-react/scripts/tile-css/metrics.js)

Current live generation command is:

```powershell
node .\scripts\tile-css\generate-layouts.js --output .\src\gc\features\mj\assets\css\tile-layout\layouts.css
```

Current intent:

- keep the filename broad enough for future layout-level CSS, not only vars
- use the shared size JSON as the single source of truth for generated layout
  metrics
- keep this generator separate from the PNG asset pipeline even though both
  share the same size data

## `tileface.js`

The face CSS generator lives at:

- [scripts/tile-css/tileface.js](/c:/dev/poly-gc-react/scripts/tile-css/tileface.js)

Its current purpose is to generate the size-specific face appearance CSS files
under:

- [src/gc/features/mj/assets/css/tile-appearance](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-appearance)

Current generated targets are:

- [normal-face.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-appearance/normal-face.css)
- [medium-face.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-appearance/medium-face.css)
- [small-face.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-appearance/small-face.css)
- [tiny-face.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-appearance/tiny-face.css)

Current behavior:

- preserves the canonical Mahjongg face ordering used by the runtime
- emits a base `.face` rule with:
  - `background-repeat: no-repeat`
  - `background-position: 0 0`
- emits one `background-image` rule for each face index
- supports plain `url(...)` output
- supports retina-aware `image-set(...)` output via `--image-set`
- still appends the existing `.highlight:after` rule

Current regeneration commands are:

```powershell
node .\scripts\tile-css\tileface.js normal-face .\src\gc\features\mj\assets\css\tile-appearance\normal-face.css --image-set
node .\scripts\tile-css\tileface.js medium-face .\src\gc\features\mj\assets\css\tile-appearance\medium-face.css --image-set
node .\scripts\tile-css\tileface.js small-face .\src\gc\features\mj\assets\css\tile-appearance\small-face.css --image-set
node .\scripts\tile-css\tileface.js tiny-face .\src\gc\features\mj\assets\css\tile-appearance\tiny-face.css --image-set
```

Important current assumption:

- the generated face image files are now face-only PNGs sized to the face area
- they are no longer full-tile images in the runtime asset folders
- because of that, the generated CSS must keep the non-repeating top-left face
  placement rule

### Local Note Accuracy

This folder also contains:

- [tileface-rewrite-prompt.md](/c:/dev/poly-gc-react/scripts/tile-css/tileface-rewrite-prompt.md)

That file is currently best treated as:

- a working note for `tileface.js` and the tile image pipeline
- broadly accurate against the current code
- not a formal spec for the entire `scripts/tile-css` folder

Current accuracy summary:

- it correctly describes the current `tileface.js` behavior
- it correctly describes the current face/body asset model
- it correctly describes the current `generate-tile-assets.js` role
- its regeneration flow is still broadly correct for the current face/body
  pipeline
- it is narrower than the full folder state, especially around `tilesize.js`

One local rough edge is:

- [ts-instructions.txt](/c:/dev/poly-gc-react/scripts/tile-css/ts-instructions.txt)
  is currently shared by both `tileface.js` and `tilesize.js`
- but its content now primarily documents `tileface.js`

## `generate-tile-assets.js`

The raster asset generator lives at:

- [scripts/tile-css/generate-tile-assets.js](/c:/dev/poly-gc-react/scripts/tile-css/generate-tile-assets.js)

Its current purpose is to generate the face and body PNG assets that the MJ
runtime CSS references.

Current model:

- source face art comes from full-tile PNGs positioned correctly in the upper
  left of the tile body
- the generator crops the face region from those full-tile sources
- the generator writes size-specific face PNGs for:
  - `normal-face`
  - `medium-face`
  - `small-face`
  - `tiny-face`
- the generator writes size-specific body PNGs for:
  - `normal`
  - `medium`
  - `small`
  - `tiny`
- each generated asset set includes:
  - `1x`
  - `@2x`

The asset generator still has a narrower concern than the layout generators:

- it consumes the shared size data for raster output sizing
- but it does not own the generated layout-metric CSS surface
- that separation now lives in `generate-layouts.js`

The generator now ignores existing `@2x` files when scanning a source
directory, so reruns do not accidentally treat derived assets as source
material.

Current checked-in config entry points are:

- [generate-runtime-assets.json](/c:/dev/poly-gc-react/scripts/tile-css/assets/generate-runtime-assets.json)
  - generate all runtime sizes
- [generate-tiny-assets.json](/c:/dev/poly-gc-react/scripts/tile-css/assets/generate-tiny-assets.json)
  - generate only the tiny runtime size
- [test-assets/generate-test-config.json](/c:/dev/poly-gc-react/scripts/tile-css/test-assets/generate-test-config.json)
  - generate a smaller local output tree for script-side testing

The script can also generate optional composite test images when a config
includes a `composite` section, but that is no longer part of the normal asset
generation flow.

Current full regeneration command is:

```powershell
node .\scripts\tile-css\generate-tile-assets.js --config .\scripts\tile-css\assets\generate-runtime-assets.json
```

## Tile Image CSS

Current MJ tile imagery now uses retina-aware CSS for all four runtime sizes:

- face CSS files use `image-set(...)`
- [tile-bodies.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/tile-appearance/tile-bodies.css)
  uses `image-set(...)` for:
  - `normal`
  - `medium`
  - `small`
  - `tiny`

Within the current face/body pipeline, the tile layout CSS under `tile-layout/`
remains unchanged because that pipeline still works in `1x` CSS pixel geometry.

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
