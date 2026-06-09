# 3D POC Status

Bootstrap note: read the "Current Bootstrap Checklist" in
[README.md](/c:/dev/poly-gc-react/agents/topics/real-3d-rendering/README.md)
before using this file as history. This document is intentionally a running
ledger; older sections preserve decisions and failed experiments, while the
current resume point and immediate next step are the active handoff.

Boundary note: this ledger still mentions preprocessing and generated asset
scripts because they affected POC viewer findings over time. Canonical stage
contracts for prepared SVGs, cutter/stamped/inlay GLB generation, asset
invalidation, queues, and Asset Review now live in
[3D Asset Pipeline](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/summary.md).

## Current Goal

The original active goal was a narrow geometry question:

- can we start from one clean base tile body
- apply one SVG-derived cutter to it offline
- export the stamped result as a separate GLB
- and compare the before/after pair directly in the POC

That placement and framing question is now largely answered.

The current live question is:

- can the offline generated carved/inlaid tile assets scale from one face to
  the full Mahjongg face set
- can glass/resin body materials make the same generated geometry read better
  than opaque ceramic

We are no longer trying to prove:

- final production materials
- final artist-facing body contract
- runtime carving on arbitrary meshes
- runtime composition of one body asset with arbitrary face geometry

We are currently trying to prove:

- whether real geometry subtraction is viable on a controlled body
- whether each face can be preprocessed into a stable canonical SVG
- whether cutter and color/inlay outputs generated from that same SVG stay
  aligned across multiple face types
- whether opaque or translucent/glass body materials are the stronger final
  material direction

## Active Visual Baseline

The active real-world bitmap references still live under
[references](/c:/dev/poly-gc-react/agents/topics/real-3d-rendering/references).

Current baseline images:

- [plastic.jpg](/c:/dev/poly-gc-react/agents/topics/real-3d-rendering/references/plastic.jpg)
- [traditional.PNG](/c:/dev/poly-gc-react/agents/topics/real-3d-rendering/references/traditional.PNG)
- [with-bamboo.jpg](/c:/dev/poly-gc-react/agents/topics/real-3d-rendering/references/with-bamboo.jpg)

These still matter as aesthetic targets, but the branch is still in a
controlled technical experiment phase.

## Current Architecture Direction

The current branch should be read as:

- offline-generated geometry experiments
- driven by reusable face inputs
- compared in the viewer after export
- runtime-simple asset loading, not runtime geometry generation

The current preferred sequence is:

1. create one controlled base body
2. preprocess the face SVG into a path-only face SVG that matches the PNG/PSD
   composition
3. create one cutter from the preprocessed SVG
4. normalize that cutter from the preprocessed SVG viewBox into an
   aspect-matched full tile face rectangle
5. union the SVG glyph solids into one cutter volume
6. apply subtraction offline
7. export before/after/inlay GLBs
8. inspect the carved result and artwork integration in the POC

The practical production direction is now pre-generation:

- every face needs a preprocessed canonical SVG
- every face needs generated cutter/stamped/inlay outputs, or a future
  generated top insert with equivalent carved/inlaid geometry
- runtime should load finished assets and vary scene/material treatment only

Runtime face/body composition was reconsidered and rejected for this mechanism.
The carved body depends on the face shape; SVG parsing, extrusion, CSG, inlay
generation, and alignment are too expensive and brittle to do per board in the
browser.

The controlled body has been softened toward the traditional tile reference:
larger rounded corners, more curve segments, and a body-level outer bevel are
now generated before subtraction. This is separate from the cutout bevel
question; the cutter itself remains non-beveled.

That means the active work is no longer:

- runtime deformation tuning
- runtime projection tuning
- broad stamp-placement guesswork

It is now:

- geometry generation
- boolean subtraction
- shallow carve tuning
- artwork-in-recess rendering experiments
- wall/side-finish interpretation for carved pigment

## Current Assets

Important current generated model assets under
[scripts/output/3d-assets/models](/c:/dev/poly-gc-react/scripts/output/3d-assets/models):

- `mj-tile-boolean-experiment-basic.glb`
  - clean controlled target body
- `mj-tile-cutter-flower-1.glb`
  - preprocessed-SVG-derived cutter geometry normalized from the face SVG
    `viewBox` into an aspect-matched full face rectangle; glyph solids are
    unioned before export
- `mj-tile-cutter-d-7.glb`
  - the same cutter process applied to the preprocessed dot-7 SVG
- `mj-tile-cutter-d-1.glb`
  - the same cutter process applied to the preprocessed dot-1 SVG
- `mj-tile-stamp-pair-<variant>-basic.glb`
  - recreated softened base body for each sweep variant
- `mj-tile-stamp-pair-<variant>-stamped.glb`
  - same softened body after subtraction
- `mj-tile-stamp-pair-baseline-inlay.glb`
  - baseline carved body plus exported colored SVG-derived inlay meshes
- `mj-tile-stamp-pair-d-7-baseline-inlay.glb`
  - dot-7 carved body plus exported colored SVG-derived inlay meshes
- `mj-tile-stamp-pair-d-1-baseline-inlay.glb`
  - dot-1 carved body plus exported colored SVG-derived inlay meshes
- `mj-tile-stamp-pair-wiki-season-2-baseline-inlay.glb`
  - wiki season-2 carved body plus exported colored SVG-derived inlay meshes
- `mj-tile-stamp-pair-wiki-b-8-baseline-inlay.glb`
  - wiki b-8 carved body plus exported colored SVG-derived inlay meshes
- `poc-models.json`
  - generated POC viewer manifest written by the JSON-driven asset pipeline
- `mj-tile-stamp-pair-experiments.json`
  - manifest of current sweep settings and canonical placement data
- `mj-tile-stamp-pair-d-7-experiments.json`
  - dot-7 manifest using the same generator path

Important current board-POC model assets:

- `scripts/output/asset-pipeline/traditional/models/colored-inlay/*.glb`
  contains the generated traditional colored-inlay tiles currently available
  for the board POC. As of 2026-05-19 this covers the full canonical
  traditional face set: bamboos, characters, dots, dragons, winds, flowers,
  and seasons: 42 GLBs.
- `src/3d-poc/assets/models/colored-inlay/*.glb` mirrors those traditional
  colored-inlay GLBs into the POC app's build-facing asset tree.
- `dist/3d-poc/models/colored-inlay/*.glb` is populated by
  `npx polylith build 3d-poc`.

Important current POC face images under
[scripts/data/3d-assets/generated-images/faces/flower-1](/c:/dev/poly-gc-react/scripts/data/3d-assets/generated-images/faces/flower-1):

- `face-color-full.png`
  - full exported face image
- `face-color-symbol.png`
  - symbol-only color image copied into the POC for recess-art testing
- `face-metadata.json`
  - authored face bounds used by cutter normalization

Removed/generated-image notes:

- `face-normal.png`, `face-roughness.png`, and `face-height.png` were removed
  from the checked-in generated face-image set because the current
  preprocessed-SVG cutter/inlay pipeline does not consume them.
- legacy `generated-images/top-maps` and the old standalone
  `generated-images/flower-plum` folder are not part of the current pipeline.
  Regenerate top maps only when intentionally revisiting the older
  heightmap/relief branch.

Important current scripts:

- [validate-preprocessed-face.js](/c:/dev/poly-gc-react/scripts/3d-assets/svg-preprocessor/validate-preprocessed-face.js)
- [compare-preprocessed-face.js](/c:/dev/poly-gc-react/scripts/3d-assets/svg-preprocessor/compare-preprocessed-face.js)
- [run-preprocessed-face-pipeline.js](/c:/dev/poly-gc-react/scripts/3d-assets/svg-preprocessor/run-preprocessed-face-pipeline.js)
- [export-preprocessed-generic-face-svg.js](/c:/dev/poly-gc-react/scripts/3d-assets/svg-preprocessor/export-preprocessed-generic-face-svg.js)
- [export-preprocessed-generic-special-face-svg.js](/c:/dev/poly-gc-react/scripts/3d-assets/svg-preprocessor/export-preprocessed-generic-special-face-svg.js)
- [infer-reference-face-metadata.js](/c:/dev/poly-gc-react/scripts/3d-assets/svg-preprocessor/infer-reference-face-metadata.js)
- [infer-tileset-face-metadata.js](/c:/dev/poly-gc-react/scripts/3d-assets/svg-preprocessor/infer-tileset-face-metadata.js)
- [pipeline app](/c:/dev/poly-gc-react/src/pipeline/main/App.jsx)
- [pipeline router](/c:/dev/poly-gc-react/server/pipeline/index.js)
- [review-reference-glyph-metadata-server.js](/c:/dev/poly-gc-react/scripts/3d-assets/archive/review-reference-glyph-metadata-server.js)
  - legacy standalone fallback; the Polylith `pipeline` app is the active UI
- [export-svg-cutter.js](/c:/dev/poly-gc-react/scripts/3d-assets/asset-pipeline/export-svg-cutter.js)
- [boolean-carve-tile.js](/c:/dev/poly-gc-react/scripts/3d-assets/archive/boolean-carve-tile.js)
- [export-stamped-tile-pair.js](/c:/dev/poly-gc-react/scripts/3d-assets/asset-pipeline/export-stamped-tile-pair.js)
- [export-stamped-tile-inlay.js](/c:/dev/poly-gc-react/scripts/3d-assets/asset-pipeline/export-stamped-tile-inlay.js)
- [run-asset-pipeline.js](/c:/dev/poly-gc-react/scripts/3d-assets/asset-pipeline/run-asset-pipeline.js)
- [asset-pipeline.json](/c:/dev/poly-gc-react/scripts/data/3d-assets/json/asset-pipeline.json)

Important current checked-in 3D input assets:

- [reference-faces](/c:/dev/poly-gc-react/scripts/data/3d-assets/reference-faces)
- [wiki-source-svgs](/c:/dev/poly-gc-react/scripts/data/3d-assets/wiki-source-svgs)
- [other-source-svgs](/c:/dev/poly-gc-react/scripts/data/3d-assets/other-source-svgs)
- [prepared-svgs](/c:/dev/poly-gc-react/scripts/output/3d-assets/prepared-svgs)
- [generated-images](/c:/dev/poly-gc-react/scripts/data/3d-assets/generated-images)
- [fonts](/c:/dev/poly-gc-react/scripts/data/3d-assets/fonts)

`wiki-source-svgs` should preserve existing local `flower-*.svg` and
`season-*.svg` files during full-set downloads. Those files may come from
different source sections than the numbered suit SVGs, and the downloader now
reports them as protected local files instead of overwriting them.

## What We Learned From Earlier Branches

The earlier branches still gave useful constraints.

What remains true:

- `top-mask` and `top-relief` remain useful legacy structural descriptions of
  the face when revisiting the older heightmap branch
- `top-color` still behaves more like an authored finish layer in that branch
- full-top overlays and floating caps repeatedly caused confusion
- plain-box experiments were the clearest diagnostic environment
- runtime deformation proved that image-driven face inputs are viable

What changed:

- runtime deformation is no longer the active branch
- the bottleneck is no longer "can we describe the face"
- the bottleneck first became "can we physically cut the geometry cleanly"
- the bottleneck is now "can authored color be attached to the carved result in
  a stable way"

## Current Boolean Branch

The active boolean branch is built around a simple rule:

- compare the exact same body before and after stamping

This is why the current exporter creates paired outputs:

- `*-basic.glb`
- `*-stamped.glb`

The active POC scene in
[App.jsx](/c:/dev/poly-gc-react/src/3d-poc/main/App.jsx)
shows:

- a seeded `turtle` Mahjongg board generated with the existing MJ engine
- generated traditional colored-inlay GLBs for every engine-assigned
  canonical face key
- a dark diagonal-lined floor to keep the material and depth read diagnostic
- a small HUD showing the game number, layout, generated-asset count, and
  placeholder count

The current viewer is deliberately a board-shaped renderer diagnostic, not a
final playable 3D game surface.

The full sweep assets still exist for reference:

- `baseline`
- `smaller`
- `larger`
- `shift-left`
- `shift-up`

But the viewer is no longer presenting the full sweep as the main working view.

What changed recently:

- the POC now generates a board from the existing Mahjongg engine instead of
  loading the old `poc-models.json` lineup; current seed is `314159` and the
  layout is `turtle`
- `src/3d-poc/main/App.jsx` maps engine face ids to generated face keys using
  the same face ordering as the existing 2D tile CSS
- the board layer step now matches the generated colored-inlay GLB height
  (`0.576`) so turtle-layout stacks sit on top of each other instead of
  intersecting vertically
- `builds/3d-poc.json` now copies POC model resources from
  `src/3d-poc/assets/models`, including the mirrored traditional
  `colored-inlay` GLBs
- the full 42-GLB traditional colored-inlay set has been mirrored from
  `scripts/output/asset-pipeline/traditional/models/colored-inlay` into the
  POC asset tree, and `GENERATED_TRADITIONAL_FACE_KEYS` now includes winds,
  flowers, and seasons
- `dragon-w` exposed a 3D export gap: final rendering preserved its black
  stroke-only frame path, but colored-inlay export only generated meshes from
  filled paths. `export-stamped-tile-inlay.js` now emits visible SVG strokes
  as colored inlay meshes too; regenerated traditional `dragon-w` now contains
  four red fill meshes plus one black stroke mesh. The same fixed exporter was
  also rerun for the other traditional final SVGs with visible stroke-only
  geometry, `b-1` and `d-1`.
- The first stroke fix only added black inlay meshes; it did not cut matching
  recesses into the stamped body. `export-svg-cutter.js` now converts visible
  SVG strokes into solid cutter volumes as well, so stroke-only line grids are
  carved before colored inlay placement. Traditional `dragon-w`, `b-1`, and
  `d-1` were regenerated through cutter, stamped-body, and colored-inlay stages
  and mirrored back into the POC assets.
- Reset-regenerated `dragon-w` showed that exporter-level stroke handling was
  still too late: final rendering continued to emit its white-dragon frame as
  `fill="none"` stroke artwork. `makePaintPathWithKnockouts` now canonicalizes
  stroke-only source components into filled path geometry tagged
  `data-geometry-normalized="stroke-to-fill"`, so regenerated final SVGs are
  directly consumable by cutter/inlay generation. `dragon-w` was rerun through
  final rendering, cutter, stamped-body, and colored-inlay generation, then the
  refreshed GLB was mirrored into the POC asset tree.
- The first stroke-to-fill pass emitted one filled triangle subpath per stroke
  triangle, which made `dragon-w` visibly reveal carved seam walls anywhere
  the small pieces met. Stroke canonicalization now emits continuous outline
  loops with `fill-rule="evenodd"`, and the cutter exporter unions bounded
  touching/overlapping path solids even when their bounds-overlap ratio is
  high. The overlap ratio remains diagnostic only; geometry count and triangle
  count are the hard fallback limits.
- The next `dragon-w` review showed the inner white-dragon rectangle distorted
  because multiple expanded stroke subpaths were packed into one evenodd SVG
  path. Stroke canonicalization now emits one filled path per original stroke
  subpath so evenodd fill is local to each stroked mark and separate grid/frame
  lines do not cancel each other in 2D review.
- Traditional source acceptance then exposed `b-1` component
  `src.b-1.0011`, a stroke-only source path with explicit
  `stroke-width="0"`. Final rendering now treats non-positive-width
  stroke-only components as invisible and omits them instead of trying to
  generate filled stroke geometry. Full traditional final rendering now
  completes all 42 faces.
- cutter framing was corrected upstream in the cutter exporter
- full-SVG `viewBox` centering was replaced by glyph-bounds normalization into
  the authored face rectangle
- SVG cutter path solids are now unioned before export so subtraction sees one
  cleaned cutter volume rather than a pile of overlapping raw paths
- cutter depth is currently `0.026`; the stamped baseline applies that cutter
  at full depth with a small negative lift to keep the inlay close to the
  carved floor while avoiding obvious z-fighting
- the viewer now loads both the exported `flower-1` baseline inlay GLB and the
  exported `d-7` baseline inlay GLB
- the viewer now loads `models/poc-models.json` when present; the checked-in
  React list is only a fallback for missing generated manifests
- `run-asset-pipeline.js` reads
  `scripts/data/3d-assets/json/asset-pipeline.json` and can run preprocessing, cutter,
  stamped-pair, and inlay stages with the right tileset scope. Current jobs:
  `wiki-season-2` and `wiki-b-8`.
- colored inlay meshes now preserve SVG painter order with tiny layer offsets
  and use the prepared SVG path colors directly. The standard colors are
  preprocessing family anchors, not the only possible emitted colors.
- white SVG paths in raw face artwork, such as Wikimedia dot interiors, are not
  cutter geometry. The current preprocessed dot SVGs convert those source
  shapes into transparent compound-path holes so the tile body shows through
  as printed negative space rather than extra recesses.
- SVG face extraction cannot assume the source SVG composition is final: the
  local PNG/PSD faces can move labels independently of the artwork. For
  `flower-1`, the PNG raises the blue character and red number relative to the
  flower/stem art, and the number is styled like the rest of the tile set
  rather than treated as an authoritative source-SVG label.
- the cutter and inlay exporters now consume path-only prepared SVGs under
  `scripts/output/3d-assets/prepared-svgs`; generated Gluten numbers are converted to
  SVG paths before export so geometry generation does not depend on browser
  text support
- the preprocessing loop now uses two active exporters:
  - `generic` for ordinary faces, including bamboos, characters, dots, and
    winds
  - `generic-special` for high-variation faces such as `b-1`, `d-1`,
    dragons, flowers, and seasons
  - ordinary face grouping is adaptive: candidate source/reference groups are
    scored against the canonical reference so grouping does not cause major
    reshaping
  - black `#000000` is now part of the standard face family set, and near-white
    paint has its own family while pure `#FFFFFF` remains a cutout signal
  - ordinary/generic faces now choose analogous reference objects primarily by
    geometry. Source color can influence shade/detail mapping, but it should
    not override the color of the selected positional reference object.
  - current color matching classifies source colors by perceived family in
    OKLCH-like space, then maps shades around the chosen reference anchor in
    OKLab lightness. If a source family has no matching reference family, the
    source-family mean is used as the anchor.
- the current `flower-1` cutter target preserves the preprocessed SVG aspect
  ratio by using `targetDepth: 1.08` and
  `targetWidth: 1.08 * 94 / 136` (`0.7464705882352941`)
- the stamped-pair body now uses `radius: 0.105`, `segments: 12`,
  `bevelSize: 0.032`, `bevelThickness: 0.042`, and `bevelSegments: 5` to move
  the tile silhouette closer to the softer traditional reference
- the body bevel makes the actual top surface `0.292`, so cutter and inlay
  placement now use exported `topSurfaceY` instead of assuming `height / 2`
- the multi-shoulder subtraction experiment has been disabled; scaled cutters
  shifted and produced multiple steep terraces instead of a rounded outer
  bevel

## Current Findings

The current branch has already clarified several things.

What appears true:

- the base body itself exports and renders cleanly
- the base body casts a correct shadow
- the cutter can be generated from SVG cleanly enough for testing
- the softened body silhouette is now generated directly, not simulated in the
  viewer
- the corrected cutter framing now matches the authored face rectangle closely
- downstream placement compensation is no longer the main blocker
- inlay geometry is visible and can carry authored color as actual meshes
- the same cutter/stamp/inlay mechanism has been exercised on representative
  prepared faces such as `flower-1`, `d-1`, and `d-7`
- glass/resin body materials remain promising, but the active viewer has been
  switched back to opaque tile bodies to make carve depth and inlay placement
  easier to judge
- the top-right petal/flower overlap is present in the SVG source, but path
  ordering/layer offsets reduce the 3D artifact

What appears likely:

- normalizing from glyph bounds into the authored face rectangle was the real
  placement fix
- the shallower carve reads better for the controlled body than the earlier
  deeper cut
- the remaining production problem is not stamp placement math but reliable
  preprocessing for all face identities
- white source negative-space paths should become transparent holes/cutouts in
  the preprocessed face SVG, not cutter geometry or white paint

What is still unresolved:

- whether the current generated tile GLB per face is the final asset unit, or
  whether a future generated top insert can share more body geometry
- whether glass/resin or opaque ceramic/plastic is the stronger material target
- how automated and data-driven the all-face preprocessing pass can become
- how to handle special layouts such as `b-8`, winds, dragons, seasons, and
  flowers without one-off manual drift
- how far character-suit preprocessing can be generalized from the successful
  `c-1` and `c-3` object-splitting pattern

## What The Current POC Is Actually Testing

The current POC should be interpreted literally.

It is testing:

- before/after geometry comparison
- corrected cutter framing against the carved baseline
- shallow carved readability
- whether exported inlay geometry can read like pigment fill
- whether the visible beige carved side walls are acceptable or need treatment
- whether opaque bodies make cut depth and inlay placement clear enough before
  returning to glass/resin material tuning
- whether multiple generated faces remain coherent when adjacent or stacked

It is not currently testing:

- final production coloration
- final realistic material response
- arbitrary artist-supplied GLBs
- proven artwork-on-carve rendering
- final bevel/chamfer behavior

That means the current screenshots should be judged for:

- carve readability
- how the recess catches light
- whether opaque inlay stays readable against the carved floor and walls
- whether artwork visibility is stable as the camera moves
- whether the same generated geometry remains promising for a later
  glass/resin material pass

not for:

- final beauty
- final production realism

## Current Resume Point

If work resumes from here, the best immediate resume point is:

- keep the corrected upstream preprocessing and viewBox-based cutter
  normalization
- keep the non-beveled unioned cutter baseline at `0.026`
- keep the softened body generation unless screenshots show the body bevel is
  interfering with the carved face
- preserve the `topSurfaceY` placement correction when changing body bevel
  settings; otherwise the face can disappear under the raised beveled top
- keep the current runtime split: generated geometry assets are prebuilt;
  material experiments happen in the viewer
- keep the JSON-driven downstream path as the default for POC additions:
  update `scripts/data/3d-assets/json/asset-pipeline.json`, then run
  `node .\scripts\3d-assets\asset-pipeline\run-asset-pipeline.js <job-id>`
- continue reviewing the full preprocessed face set and regenerating prepared
  SVGs through the metadata-driven pipeline as metadata is corrected

Important recent result to remember:

- the baseline stamped metadata now lands essentially at identity relative to
  the target rect, which means placement compensation should not be the focus
  anymore
- `export-stamped-tile-inlay.js` now creates baseline inlay GLBs by loading
  the existing carved baseline tile and adding colored SVG-derived meshes
  generated from the same preprocessed face SVG as the cutter
- the POC viewer loads generated inlay GLBs directly instead of creating a
  runtime decal or running geometry generation in the browser
- the inlay exporter emits per-path meshes in SVG painter order with
  `inlayLayerStep: 0.00008`
- the current inlay exporter emits prepared SVG colors directly, including
  generated shade colors around the standard family anchors; legacy generated
  PNG/top-map input colors are still accepted for older preprocessed SVGs
- current dot preprocessed SVGs bake source white details into transparent
  compound-path holes, not cutter volumes or white paint paths, so dot
  interiors read as printed negative space
- the cutter exporter unions normalized SVG path solids before exporting the
  cutter; this was added to reduce internal walls from overlapping paths
- `export-svg-cutter.js`, `export-stamped-tile-pair.js`, and
  `export-stamped-tile-inlay.js` accept a face key argument such as `d-7`
- raw Plum source for the current flower preprocessor lives under
  `scripts/data/3d-assets/other-source-svgs`, and the identical protected
  `flower-1.svg` source also exists under
  `scripts/data/3d-assets/wiki-source-svgs`; cutter/color scripts should consume
  only the generated path-only files under `scripts/output/3d-assets/prepared-svgs`
- current additional preprocessed/validated examples include ordinary
  bamboos, characters, dots, winds, dragons, flowers/seasons, `d-1`, and
  `b-1`; most remain `needs-review` validation artifacts rather than
  downstream generated GLBs
- current default sprite-sheet preprocessing uses
  `scripts/output/3d-assets/metadata-inference/default-sprite-glyphs.draft.json`
  as the active working override; it is still draft review state, but it can
  override the checked-in base metadata during reruns
- source glyph metadata is now explicit: prefer
  `glyphLayout.number.sourcePresent` and
  `glyphLayout.character.sourcePresent` over older shorthand. When a number or
  flower/season character is marked absent, the exporter generates the
  canonical glyph instead of trying to remove or align source artwork.
- default flowers currently mark source Chinese characters absent and generate
  `梅`, `蘭`, `菊`, and `竹` from Unicode using the CJK font fallback path
  (`cjk-label.ttf` if supplied, currently `STKAITI.TTF` on this Windows setup).
  Latest default flower validation: `flower-1`, `flower-2`, and `flower-3`
  are `needs-review`; `flower-4` remains `blocked-overlap` from a tiny
  generated `竹`/main-art overlap.
- default seasons still use source characters for `春`, `夏`, `秋`, and `冬`.
- default winds now keep their dark/black direction glyphs; generated wind
  corner letters remain red canonical labels.
- white-dragon family scaling uses the source white-dragon rectangle when one
  exists. If the source white dragon has artwork but no rectangle shape, the
  scaling box is simulated from the canonical reference white-dragon padding
  proportions, and dragon artwork is scaled/centered within that box.
- the metadata review UI has moved from the standalone helper into the
  Polylith `pipeline` app. It has separate `Tileset` and `Reference` modes;
  `Tileset` is the common workflow and `Reference` is mostly one-time
  calibration. It can regenerate draft metadata, reload existing review state,
  save reviewed metadata, run "Save + Preprocess", show existing generated
  validation comparisons after reload, and write an explicit accepted artifact
  through `Accept`.
- downstream wiki `season-2` and wiki `b-8` have been sent through the
  JSON-driven 3D asset pipeline and added to the POC as scoped model assets.
  Their preprocessed comparisons are coherent but still `needs-review`.
- traditional `b-9` exposed an important generic matching rule: a source object
  that is black can still be the geometric analog of a green reference object.
  Generic matching now uses geometry first and anchors output color to the
  selected reference object, so the right-hand traditional bamboos inherit
  reference green instead of staying black.
- the board POC now consumes the full generated traditional colored-inlay set
  by canonical face key. Neutral placeholder loading remains only as a
  diagnostic fallback for missing or unmapped future assets.
- colored-inlay export now treats visible SVG strokes as renderable inlay
  geometry, not just filled paths. This fixed the traditional `dragon-w`
  white-dragon tile losing its black frame lines in the board POC.
- traditional `b-8`/`b-9` did build their model artifacts, but preview PNG
  export exposed a Puppeteer timeout/hang problem. The preview renderer has
  longer ready/close guards, but a direct `b-8` preview probe still hung on
  2026-05-19; preview export remains unresolved.
- ornamental traditional faces exposed a separate upstream source issue:
  layered opaque SVG paint paths can create overlapping final-rendering solids
  that make downstream cutter CSG pathological. Source normalization now
  flattens partially overlapping opaque fill layers into visible, non-overlap
  component geometry without using face-key-specific rules.

Important failed or partial experiments to remember:

- a hidden plane under the carve only made color appear through cut openings
  and only from some angles
- switching to symbol-only transparent artwork improved the signal slightly but
  still behaved like a peeking-underlay solution
- the current decal attempt renders no visible color and is still unresolved
- the first visible inlay pass loaded successfully in the POC, but material
  tuning continued; the current exporter uses physical/lit materials for
  body/inlay experiments rather than the earlier underlay/decal branch
- raising the inlay reduced apparent recess depth but did not remove beige
  internal walls, proving those walls were baked into the carved geometry rather
  than only an inlay-depth issue
- the unioned cutter reduced the raw-overlap problem enough to keep pursuing the
  boolean path, but beige side-wall finish is still visible
- a cutter-bevel attempt using `bevelSize: 1.4`, `bevelThickness: 0.22`, and
  `bevelSegments: 3` made the cutout too chunky and was undone for now
- a multi-shoulder scaled-cutter attempt produced multiple steep edges and
  apparent path shifts; it is disabled via `STAMP_EDGE_SOFTENING.enabled:
  false`
- a first U-channel colored inlay attempt made noisy fringe geometry around
  the artwork; it has been rolled back to flat color fills and straight carved
  walls

## Immediate Next Step

The immediate next step is:

- inspect the generated board in-browser for tile spacing, z stacking, camera
  framing, shadow acne, and whether 144 GLB instances are acceptable for this
  POC
- review and correct metadata for any remaining faces, then regenerate the
  prepared SVGs and validation images through the metadata-driven pipeline
- resolve or explicitly accept the remaining default `flower-4` generated
  character/main-art overlap after inspecting the source-reference-result image
- use the `pipeline` app's `Tileset` mode for day-to-day review; only switch to
  `Reference` when recalibrating the canonical reference glyph metadata
- use `run-asset-pipeline.js` and `asset-pipeline.json` for downstream POC
  additions instead of manually threading `FACE_OUTPUT_SCOPE`, model names, and
  POC manifest edits
- keep white/negative-space source shapes out of cutter geometry; convert them
  to transparent preprocessed SVG holes/cutouts unless a face proves it uses
  real white paint
- keep glass/resin material tuning as a separate follow-up after opaque-body
  cut depth and inlay placement are stable
- keep U-shaped pigment/side-wall treatment paused until the flat inlay and
  opaque-body baseline are better understood

Success for the current branch means:

- the carve still reads as real subtraction
- the color sits in the recess instead of peeking from under it
- artwork remains visible across normal viewing angles
- the body silhouette remains trustworthy
- the offline face-generation path can cover the full tile set without runtime
  CSG or hand-authored finished faces
