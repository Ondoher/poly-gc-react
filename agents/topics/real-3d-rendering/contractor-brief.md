# Mahjong Tile 3D Contractor Brief

This note captures the current 3D artist/contractor ask for real Mahjong tile
body assets. It is calibrated against the current generated asset pipeline,
base-tile manifest, and `3d-poc` / Asset Review usage.

## Goal

We need reusable Mahjong tile body assets for a realtime 3D renderer and an
offline generation pipeline.

The important constraint is still:

- do not hand-author 144 unique finished tile models
- do provide one or a few reusable base tile bodies
- let tile face identities be generated offline from accepted SVG/rendering
  inputs

The current production direction is:

```text
base tile GLB
-> SVG cutter generation
-> offline boolean subtraction against the base body
-> SVG-derived colored inlay meshes
-> final per-face inlay GLB for runtime/review
```

The artist deliverable is therefore a reusable base body contract, not a full
set of finished face tiles.

## Current Pipeline Reality

The current pipeline already generates per-face assets from accepted rendered
SVGs. It selects a reusable base tile variant from:

```text
scripts/data/3d-assets/models/base-tiles/base-tile-manifest.json
```

The selected base tile variant is recorded in `assetPipeline` and participates
in generated asset hashes. Changing the selected base tile invalidates or
requeues generated output.

Generated asset stages are:

```text
preview-svg -> svg-cutter -> stamped-body -> colored-inlay -> preview-png
```

The final reviewable GLB is the colored-inlay model. It contains:

- the stamped tile body mesh
- separate colored SVG-derived inlay meshes

Asset Review loads that final GLB in a Three.js viewer and uses a generated
PNG preview for card scanning.

## Current Placeholder Baseline

The active placeholder production shape is `classic-soft`:

```json
{
  "width": 0.79,
  "height": 0.5,
  "depth": 1.08,
  "radius": 0.105,
  "bevelSize": 0.028,
  "bevelThickness": 0.038,
  "bevelSegments": 4,
  "curveSegments": 16
}
```

The current code computes the top carving plane as:

```text
topSurfaceY = (height / 2) + bevelThickness
```

For `classic-soft`, that is `0.288`. The current cutter depth is `0.026`.
Colored inlay meshes are very shallow, currently `0.0014` thick, and are
placed near the carved recess.

These numbers are not sacred final art requirements, but they describe the
scale and assumptions the current generator is built around.

The placeholder generator's `body.width`, `body.height`, and `body.depth`
describe the nominal rounded body before bevel expansion. Exported GLB bounds
include bevels, so the current `classic-soft` mesh measures about
`0.846 x 0.576 x 1.136`.

## Coordinate And Geometry Contract

The pipeline assumes a Three.js-style coordinate system:

- `X`: tile width, left/right
- `Y`: tile thickness, vertical
- `Z`: tile depth, top/bottom of the face
- tile center near world origin
- top face points toward positive `Y`
- face artwork is normalized into a centered `X/Z` rectangle
- cutter extrusion moves downward in `-Y`

The base tile GLB must contain a mesh that the pipeline can locate by name.
Current placeholder metadata uses:

```json
{
  "meshName": "baseTileBody"
}
```

The stamped output mesh is renamed to `stampedTileBody`, and final inlay meshes
are named with the `tileFaceInlay` prefix.

## Required Deliverables

Ask for:

- one production-ready base tile body GLB
- editable source file, preferably `.blend`
- base-tile metadata JSON matching the manifest contract
- material maps or embedded PBR material settings
- notes about scale, orientation, top surface, and mesh name

The production base tile should replace a temporary manifest entry like this:

```json
{
  "id": "production-ivory",
  "label": "Production Ivory",
  "description": "Reusable ivory Mahjong tile body.",
  "kind": "base-tile-glb",
  "temporary": false,
  "glb": "scripts/data/3d-assets/models/base-tiles/production-ivory.glb",
  "metadata": "scripts/data/3d-assets/models/base-tiles/production-ivory.json",
  "body": {
    "width": 0.79,
    "height": 0.5,
    "depth": 1.08
  }
}
```

And the metadata file should include at least:

```json
{
  "schemaVersion": 1,
  "id": "production-ivory",
  "label": "Production Ivory",
  "kind": "base-tile-glb",
  "temporary": false,
  "meshName": "baseTileBody",
  "glb": "scripts/data/3d-assets/models/base-tiles/production-ivory.glb",
  "metadata": "scripts/data/3d-assets/models/base-tiles/production-ivory.json",
  "body": {
    "width": 0.79,
    "height": 0.5,
    "depth": 1.08,
    "radius": 0.105,
    "bevelThickness": 0.038
  },
  "material": {
    "color": "#f2ece2",
    "opacity": 1
  }
}
```

Additional fields are welcome, but `meshName`, `glb`, `metadata`, and
`body.width/height/depth` are the minimum useful pipeline-facing facts.
`bevelThickness` is currently important because the generator uses it to place
the cutter relative to the top surface.

## Tile Body Requirements

The body should have:

- believable Mahjong tile proportions and slab silhouette
- rounded outside corners and softened perimeter edges
- a clean, stable top region suitable for shallow boolean subtraction
- enough material below the top surface for a `0.026`-ish carve depth
- no decorative face identity baked into the base body
- no floating cap that assumes runtime face composition
- normals and topology that survive GLB export and CSG subtraction cleanly
- reasonable realtime triangle count after generated inlay is added

Avoid:

- fragile top ridges, wrinkles, or shallow relief details in the carve area
- disconnected face plates
- non-manifold geometry
- hidden internal meshes that may confuse boolean subtraction
- transforms that make the mesh appear correct visually but export with
  unexpected scale/rotation

## Material Requirements

The body material should read well under a slightly elevated game camera and
in the Asset Review viewer. PBR-friendly materials are preferred.

Ask for:

- base color / albedo
- roughness
- normal map if it improves the shared body
- optional ambient occlusion
- source texture files in common formats
- embedded GLB material that looks reasonable without custom shader work

These maps describe the reusable body only. Face colors are generated as
separate inlay geometry from the accepted rendered SVG.

## Useful Variants

If budget allows, ask for several variants that share the same coordinate and
top-surface contract:

- ivory / bone
- opaque ceramic or plastic
- translucent glass or resin
- wood, only if it remains carve-friendly

Glass/resin is still worth testing, but it should be delivered as a reusable
body material/body variant, not as a hand-composited finished face tile.

## Example Assets

The contractor example bundle is:

```text
Designs/3d-assets/contractor/mahjong-tile-contractor-examples.zip
```

The zip also includes contractor-facing standalone handoff documents:

- `CONTRACTOR-HANDOFF.txt`
- `CONTRACTOR-HANDOFF.html`

Those files are self-contained and intended to be sent directly to the
contractor. The HTML version has richer formatting and opens in a normal
browser without external assets or internet access. This brief remains the
more detailed internal/reference document.

It contains a base tile example and one fully processed generated tile example.
These files show scale, orientation, mesh naming, metadata shape, and how the
pipeline uses a base body. They are not final art direction.

Base tile example:

- `base-tile/classic-soft.glb`: current temporary reusable base body. Use this
  to inspect repo scale, orientation, rounded slab form, and the expected
  `baseTileBody` mesh behavior.
- `base-tile/classic-soft.json`: metadata for that base body. This shows the
  `meshName`, GLB path, body dimensions, bevel facts, and material note the
  pipeline expects.
- `base-tile/base-tile-manifest.json`: current manifest shape for selectable
  base tile variants. A production contractor asset should be added here as a
  non-temporary variant.
- `base-tile/classic-soft-validation-review.glb`: example output from the
  validation script. Open this in a standard 3D modeling tool to see the
  submitted body with helper geometry overlaid.

Processed tile example:

- `processed-default-d-7/default-d-7-colored-inlay.glb`: final generated tile
  asset for `default/d-7`. This is the kind of GLB Asset Review and runtime
  viewing consume after carving and inlay generation.
- `processed-default-d-7/default-d-7-colored-inlay.json`: metadata for the
  final generated tile. It records the source stamped body, source cutter
  metadata, inlay mesh prefix, inlay placement, colors, and target rectangle.
- `processed-default-d-7/default-d-7-preview.png`: generated review thumbnail
  used by Asset Review cards.
- `processed-default-d-7/default-d-7-final-rendering.svg`: accepted rendered
  face SVG input that drives both cutter and colored inlay generation.
- `processed-default-d-7/default-d-7-svg-cutter.json`: cutter metadata showing
  how the SVG viewBox maps into the base tile face rectangle and the current
  cutter depth.
- `processed-default-d-7/default-d-7-stamped-body.json`: stamped body metadata
  showing the selected base tile, top surface plane, cutter placement, and
  boolean subtraction output.
- `tools/validate-base-tile-asset.js`: standalone Node validator for checking
  a submitted base tile GLB and metadata against the pipeline-facing contract.

Use the processed `d-7` files to understand the generation mechanism and
validation target. Do not copy every visual artifact: the current base body is
a temporary placeholder, and the generated inlay/carve details are pipeline
outputs that will improve as the base body contract improves.

Run the validator from a checkout with dependencies installed:

```text
node tools/validate-base-tile-asset.js classic-soft
```

For a submitted production body, run the same command with the submitted base
name, such as `production-ivory`. The validator checks the named mesh,
measured bounds, centering, material presence, and basic metadata fields. It
does not prove boolean subtraction quality; that still needs the repo
generation loop and visual review.

The optional review GLB is intended for standard 3D modeling tools such as
Blender. It contains the submitted base tile plus helper geometry:

- yellow frame: expected outer bounds derived from metadata
- translucent green plane: top carve plane
- translucent blue plane: face rectangle where generated artwork is normalized
- red bar: width/X axis
- green bar: thickness/Y axis
- blue bar: depth/Z axis
- white vertical bar: origin centerline

## Running The Validator

The validator needs Node.js and the `three` package. Contractors can run it
from the standalone example zip or from the full project checkout.

### Windows / PC

1. Install Node.js LTS from `https://nodejs.org/`.
2. Open PowerShell.
3. Go to the unzipped example folder:

```powershell
cd C:\path\to\mahjong-tile-contractor-examples
```

4. Install the script dependency:

```powershell
npm install
```

5. Validate the included base tile and write a modeling-tool review GLB:

```powershell
npm run validate:base-tile -- classic-soft
```

6. Validate a submitted production tile by placing `production-ivory.json` and
   `production-ivory.glb` in either `production\` or the current folder, then
   run:

```powershell
npm run validate:base-tile -- production-ivory
```

### macOS

1. Install Node.js LTS from `https://nodejs.org/`. Homebrew is also fine:

```bash
brew install node
```

2. Open Terminal.
3. Go to the unzipped example folder:

```bash
cd /path/to/mahjong-tile-contractor-examples
```

4. Install the script dependency:

```bash
npm install
```

5. Validate the included base tile and write a modeling-tool review GLB:

```bash
npm run validate:base-tile -- classic-soft
```

6. Validate a submitted production tile by placing `production-ivory.json` and
   `production-ivory.glb` in either `production/` or the current folder, then
   run:

```bash
npm run validate:base-tile -- production-ivory
```

### Full Project Checkout

From this repo root, dependencies are installed with:

```bash
npm install
```

Then run:

```bash
npm run validate:base-tile -- classic-soft
```

By default, the script searches `base-tile/`, `production/`, the current
folder, and the repo's `scripts/data/3d-assets/models/base-tiles/` folder. It
expects matching `<base-name>.json` and `<base-name>.glb` files, and writes
`<base-name>-validation-review.glb` next to the found metadata/GLB.

## Validation In Repo

A contractor asset is useful when it can pass this loop:

1. Add the GLB and metadata under `scripts/data/3d-assets/models/base-tiles/`.
2. Add a variant to `base-tile-manifest.json`.
3. Open the pipeline app's Base Tile Selection page and confirm the GLB loads.
4. Select the base tile variant.
5. Run Asset Review generation.
6. Inspect ready tiles in Asset Review and/or the `3d-poc` viewer.

What we are validating:

- the body loads in Three.js
- the named body mesh can be found
- the cutter aligns to the intended top face
- boolean subtraction produces clean recesses
- colored inlay meshes sit correctly in/near the recess
- the body material still reads well with generated face inlay

## What To Tell The Contractor

Use this as the practical ask:

```text
Please create a reusable Mahjong tile base body for a realtime Three.js game
and an offline face-generation pipeline. The tile face identity will not be
modeled by hand. Our pipeline will generate cutters and colored inlay meshes
from accepted SVG face art, then generate per-face GLBs offline.

The base body should be centered, correctly oriented, exported as GLB, and
contain a named mesh called baseTileBody unless we agree on another name. The
top face must be stable and carve-friendly for shallow boolean subtraction.
Please also provide the editable source file, PBR material maps/settings, and
a small JSON note with dimensions, mesh name, and top-surface assumptions.
```

## Contractor Messages

Use these as starting drafts when contacting possible 3D artists.

### Initial Introduction

```text
Hi [Name],

I am building a realtime Mahjong game with a generated 3D tile asset pipeline.
I am looking for a 3D artist/modeler to create one or more reusable Mahjong
tile body assets, not a full set of individually modeled tile faces.

The important part of the work is the base tile body: proportions, rounded
corners, material direction, clean topology, and a top surface that can support
shallow carved/inlaid face details. The face artwork itself will be generated
later by our pipeline from SVG inputs, so I do not need 144 bespoke finished
tile models.

The deliverable would likely be a GLB export, editable source file such as a
Blender file, PBR material maps/settings, and a small metadata JSON file with
dimensions and mesh naming. I can provide example files showing our current
placeholder base tile, a fully generated processed tile, and a simple
validation script that checks scale/orientation/mesh naming.

Would this kind of asset/technical modeling work be a fit for you? If so, I
can send the package and a more specific brief.
```

### Package Handoff

```text
Hi [Name],

Thanks for taking a look. Attached is the contractor package for the Mahjong
tile base body work.

The key files to start with are:

- CONTRACTOR-HANDOFF.html: browser-friendly brief with the requirements,
  commands, and file explanations.
- CONTRACTOR-HANDOFF.txt: plain-text version of the same brief.
- base-tile/classic-soft.glb and classic-soft.json: our temporary placeholder
  base tile and metadata.
- processed-default-d-7/default-d-7-colored-inlay.glb: an example of a fully
  generated tile after carving/inlay.
- tools/validate-base-tile-asset.js: optional validator that can produce a GLB
  with helper overlays for checking orientation, bounds, and the top carve
  plane.

The main thing I need from you is a reusable base tile body, not hand-modeled
unique faces. Please pay special attention to the coordinate contract, named
mesh requirement, clean carve-friendly top surface, and material direction.

If you make a candidate body, you can place your files as:

production/production-ivory.glb
production/production-ivory.json

Then run:

npm install
npm run validate:base-tile -- production-ivory

That creates production/production-ivory-validation-review.glb, which you can
open in Blender or another GLB-capable modeling tool to inspect the helper
overlays. Passing the validator is not the final quality bar, but it confirms
that the asset matches the basic pipeline contract before I run it through the
full generation workflow.

Please let me know if any part of the contract is unclear or if you would
recommend a different modeling/material approach for the reusable body.
```

## Hypothetical SVG Face Artwork Contractor

This is a separate contractor track from the 3D base body work. Use it if we
hire an illustrator/vector artist to create a new custom Mahjong tile face
art set that the pipeline can process.

### Goal

The goal is a complete custom SVG face-art set for Mahjong tiles that can feed
the existing source review and 3D generation pipeline.

The SVG contractor should create reusable, clean vector face artwork. They are
not responsible for modeling 3D tile bodies, carving GLBs, or manually
authoring finished 3D models.

### Face Coverage

A full set should cover the standard unique Mahjong face identities:

- dots/circles: `d-1` through `d-9`
- bamboos: `b-1` through `b-9`
- characters: `c-1` through `c-9`
- winds: `wind-e`, `wind-s`, `wind-w`, `wind-n`
- dragons: `dragon-r`, `dragon-g`, `dragon-w`
- flowers: `flower-1` through `flower-4`
- seasons: `season-1` through `season-4`

This is 42 unique face SVGs. The game can duplicate generated assets later
for repeated physical tiles.

### Deliverables

Ask for:

- one SVG file per face key
- a simple preview sheet PNG or PDF for human review
- a palette/style guide listing intended colors
- source/editable vector files if authored outside plain SVG
- notes for any intentionally absent labels, generated-label assumptions, or
  special cases

Preferred file naming:

```text
d-1.svg
d-2.svg
...
dragon-r.svg
wind-e.svg
flower-1.svg
season-1.svg
```

### SVG Technical Requirements

The pipeline can normalize imperfect SVGs, but cleaner input makes review and
generation much more reliable. Ask for:

- real vector paths/shapes, not embedded raster images
- visible face artwork only, not full tile body/chrome/background
- a consistent portrait viewBox across all faces
- stable artwork placement across related face families
- paths or groups organized by visual element where practical
- solid fills for final intended colors
- no CSS that depends on external files
- no external image links, fonts, scripts, or remote resources
- no clipping/masking tricks unless visually necessary and tested in browser
- transparent background

Avoid:

- flattened bitmap screenshots inside SVG
- invisible helper layers left on by mistake
- random per-file scaling or rotated coordinate systems
- text that depends on a font not supplied with the package
- gradients as the only source of important color meaning
- face artwork that requires manual per-face 3D modeling to interpret

### Color And Physical Inlay Considerations

Generated 3D assets convert SVG paint into discrete colored inlay geometry.
That means the artist should think in solid color regions rather than only
screen-rendered illustration effects.

Useful guidance:

- prefer a small, intentional palette
- use separate colored shapes for meaningful colored regions
- keep near-white negative-space details intentional and documented
- avoid tiny color slivers that would be unreadable as physical inlay
- keep important details thick enough to survive small 3D geometry generation
- avoid relying on blur, shadows, or gradients for core symbol readability

Gradients can be included as visual reference, but the pipeline will flatten
or interpret colors for generated geometry. If a gradient is essential to the
style, ask the contractor to also provide a flat-color version or clear notes.

### Semantic Structure Guidance

The pipeline does not require perfect semantic ids, but meaningful organization
helps review:

- group repeated dots/bamboos/characters where practical
- keep corner labels separate from main artwork when possible
- keep flower/season glyphs separate from illustration artwork when possible
- avoid merging unrelated visual elements into one giant compound path unless
  it is necessary for the artwork

Good source organization reduces manual review work later. It does not need to
match the internal pipeline part ids exactly.

### Review And Acceptance

The current pipeline treats source SVG artwork as donor style and maps it onto
reference-owned Mahjong structure. The contractor's SVGs should therefore be
reviewed for:

- complete face coverage
- consistent style across suits/honors/bonus tiles
- clean source geometry
- readable symbols at game camera scale
- compatibility with physical-looking inlay regions
- consistent placement within the viewBox
- no hidden dependencies on external fonts/images/resources

After intake, the pipeline will still run source normalization, optional part
assignment, source alignment, source assignment review, final rendering, and
generated asset stages.

### Secondary Reference Use

If the contractor-provided artwork is complete and internally consistent, we
may also use it as a secondary visual reference during future review. In that
role, it can guide style, proportions, motif choices, and color direction.

It should not be treated as the canonical Mahjong structure by default. The
pipeline's reference set continues to own face identity, required parts,
semantic coverage, and placement expectations unless we explicitly promote the
contractor set into a new reviewed reference set.

### SVG Artist Message Draft

```text
Hi [Name],

I am building a realtime Mahjong game with a pipeline that generates 3D tile
assets from SVG face artwork. I am looking for a vector artist/illustrator to
create a custom Mahjong face-art set as clean SVG files.

This is not a request for 3D modeling. The 3D tile body and generated inlay
pipeline are separate. What I need from this role is a consistent set of
vector face designs: dots, bamboos, characters, winds, dragons, flowers, and
seasons.

The SVGs should be real vector artwork with transparent backgrounds, consistent
portrait viewBoxes, solid color regions, and no external image/font/script
dependencies. The artwork will later be processed into physical-looking
colored inlay geometry, so clean shapes and readable solid-color regions matter
more than raster-like effects.

The full unique face set is 42 SVGs. I can provide face-key naming, examples,
and references for the expected Mahjong identities. Would this kind of SVG
illustration work be a fit for you?
```

## Short Version

```text
We need reusable Mahjong tile base bodies:
- GLB plus editable source file
- centered Three.js orientation: width X, thickness Y, depth Z
- top face points +Y and supports shallow -Y cutter subtraction
- named body mesh, ideally baseTileBody
- dimensions close to 0.79 x 0.50 x 1.08 in repo units
- clean rounded slab silhouette with carve-friendly top region
- PBR-friendly body material/maps
- optional ivory, opaque plastic/ceramic, and glass/resin variants
- no hand-authored unique finished faces
```
