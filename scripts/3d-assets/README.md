3D asset generation helpers for the Mahjong POC.

The live scripts are split by pipeline responsibility:

- `svg-preprocessor/`: reference setup, source SVG normalization, semantic
  preprocessing, comparison, and validation.
- `asset-pipeline/`: model/top-map export and full 3D asset job orchestration.
- `shared/`: helpers imported by both live script groups.
- `archive/`: one-off POC scripts outside the current live pipelines.

Hand-authored JSON configuration and semantic template files live under
`scripts/data/3d-assets/json/`. Generated JSON stays with the output or generated
asset it describes.

Current scripts:

- `validate-preprocessed-face.js`
  - validates one preprocessed face SVG against the preprocessing contract
  - checks that the canonical `large-faces/<face-key>.png` reference exists
  - checks the `viewBox`, path-only expectations, unsupported SVG effects, and
    recognized preprocessing color families
  - writes `scripts/output/3d-assets/preprocessed/validation/<tileset-id>/reports/<face-key>-validation-report.json`
- `compare-preprocessed-face.js`
  - renders the canonical reference PNG and preprocessed SVG onto the reference
    image canvas
  - uses the lighter local `sharp` dependency from `scripts/node_modules`
    rather than browser automation
  - writes side-by-side, source/reference/result, overlay, and diff images for
    agent/human review
  - reports visible bounds, named group bounds, bottom/left/right deltas, top
    label deltas, and rendered/component label overlaps
  - updates `scripts/output/3d-assets/preprocessed/validation/<tileset-id>/reports/<face-key>-validation-report.json`
- `inspect-source-svg-components.js`
  - parses the raw source SVG into normalized component records
  - writes `scripts/output/3d-assets/preprocessed/validation/<tileset-id>/source-components/<face-key>-source-components.json`
- `visual-component-alignment.js`
  - shared helper for converting canonical reference-image component bounds
    into prepared-SVG viewBox transforms
  - used when source SVG components need to align to the same visual component
    model exposed by validation overlays
- `reference-image-components.js`
  - extracts visible canonical reference PNG components using the canonical
    face color set, so checkerboard/background pixels do not become artwork
  - records each component's bounds and dominant canonical color
- `analog-component-matcher.js`
  - groups and pairs source SVG components with canonical reference components
    for generic face preprocessing
  - tries candidate groupings and scores them against the reference so nearby
    same-color strokes can merge without collapsing repeated suit symbols into
    one distorted group
- `export-preprocessed-generic-face-svg.js`
  - face-agnostic exporter for ordinary/non-special faces
  - uses semantic metadata from
    `scripts/data/3d-assets/json/face-preprocessing-metadata.json`
  - treats `glyphLayout.number.sourcePresent` as the preferred source-label
    contract; `sourceContainsLabel` remains a compatibility shorthand
  - source numbers/letters are removed only when metadata says they are
    present; when metadata says they are absent, the canonical generated label
    is still emitted but all source paint is treated as artwork
  - derives label placement, artwork targets, and reference color anchors from
    the canonical reference PNG instead of per-face geometry config
  - matches analogous source/reference parts primarily by geometry; source
    color can help break ties, but it must not override a positional reference
    match
  - maps source colors through perceived color families and OKLCH/OKLab
    lightness so source shading can survive while landing on the analogous
    reference color family
  - uses active reference glyph metadata, when supplied with `--metadata`, to
    keep generated labels out of artwork matching
  - aligns source/reference analog groups with uniform scaling; whole-artwork
    transforms are only a fallback when the face behaves as one inseparable
    part
- `export-preprocessed-generic-special-face-svg.js`
  - metadata-driven exporter for special-case face categories that still
    benefit from generic component parsing
  - handles flowers/seasons as generated label, optional generated or source
    Chinese character, and main-artwork roles rather than hard-coded source
    classes
  - flowers/seasons use `characterText` plus
    `glyphLayout.character.sourcePresent`; when the source character is absent,
    the exporter emits a path-backed generated character using the project
    local `cjk-label.ttf` override when present, then local CJK fallbacks such
    as `STKAITI.TTF`
  - handles dragons with a category rule: the white dragon box is the sizing
    calibration frame; red/green dragons reuse the source white-dragon family
    transform with uniform scale so source aspect ratio is preserved, instead
    of shrinking to their smaller canonical reference glyph bounds; simulated
    white-box calibration is only a fallback when no source white dragon is
    available, and non-frame-like canonical white dragons use a safe simulated
    reference box instead of tight glyph bounds
- `run-preprocessed-face-pipeline.js`
  - metadata-driven batch runner for all currently supported face
    preprocessors, or for the face keys passed on the command line
  - reads `scripts/data/3d-assets/json/face-preprocessing-metadata.json`
  - accepts `--metadata <metadata-json>`; active metadata is merged with the
    base face metadata and should be treated as the authority
  - routes `exporter: "generic"` faces through
    `export-preprocessed-generic-face-svg.js`
  - routes `exporter: "generic-special"` faces through
    `export-preprocessed-generic-special-face-svg.js`
  - runs export, source component inspection, and comparison/validation
  - this is the preferred entry point for preprocessing; current metadata
    should use only `generic` or `generic-special`
- `run-asset-pipeline.js`
  - JSON-driven runner for downstream 3D POC asset generation
  - reads `scripts/data/3d-assets/json/asset-pipeline.json` by default
  - can run preprocessing, cutter export, stamped-pair export, and inlay export
    with the correct tileset scope/env
  - writes `scripts/output/3d-assets/models/poc-models.json`, which the
    `3d-poc` viewer loads to decide which generated tiles to display
  - can sync generated model files to `dist/3d-poc/models` for the currently
    running dev server when `poc.syncDist` is true
  - current jobs include `wiki-season-2` and `wiki-b-8`; both produce scoped
    model names such as `mj-tile-stamp-pair-wiki-b-8-baseline-inlay.glb`
- `infer-reference-face-metadata.js`
  - creates an active reference-glyph metadata file from canonical
    `large-faces` PNGs
  - writes `scripts/output/3d-assets/metadata-inference/reference-glyphs.json`
  - writes active metadata that can be edited before use as preprocessing authority
- `infer-tileset-face-metadata.js`
  - creates an active source/tileset glyph metadata file from source SVGs
  - records whether source labels and flower/season characters are present,
    absent, or likely candidates
  - preserves explicit `number.present: false` and `character.present: false`
    so the normalizers generate canonical glyphs instead of misidentifying
    source artwork as top glyphs
  - writes under `scripts/output/3d-assets/metadata-inference`
- Polylith `pipeline` app
  - active metadata review UI served through the normal repo Polylith server
    at `/pipeline/`
  - has separate `Tileset` and `Reference` modes; `Tileset` is the normal
    source-SVG review workflow, while `Reference` is mostly one-time canonical
    reference calibration
  - can recreate metadata, save metadata, run "Save + Preprocess", and show
    existing generated validation comparisons
  - uses server routes in `server/pipeline/index.js` for JSON writes, process
    execution, and image/JSON resources that should not be copied into `dist`
- `split-tileset-sprite-sheet.js`
  - splits a semantically grouped SVG sprite sheet into one source SVG per
    canonical face key
  - currently targets sheets with group ids such as `CHARACTER_1`,
    `BAMBOO_9`, `ROD_7`, `FLOWER_2`, `SEASON_4`, `WIND_3`, and `DRAGON_1`
  - expands `<use>` clones so each extracted face SVG is self-contained
  - defaults to `scripts/data/3d-assets/sprite-sheets/default.svg`
  - writes per-face source SVGs and `manifest.json` under
    `scripts/data/3d-assets/sprite-source-svgs/<sheet-id>`
  - these extracted SVGs are source candidates only; run metadata review and
    normal prepared-SVG preprocessing before using them for cutter/inlay work
- `archive/review-reference-glyph-metadata-server.js`
  - archived standalone fallback for reference-glyph review
  - starts a local review helper at `http://localhost:4328/` by default
  - displays editable metadata cards with reference/source previews and color
    swatches
  - saves metadata to
    `scripts/output/3d-assets/metadata-inference/reference-glyphs.json`
  - can run "Save + Preprocess" to regenerate the validation comparison images
  - note: prefer the Polylith `pipeline` app for current work; do not leave
    this server running in an internal terminal without stopping it or
    giving the user control of the process
- `export-mj-tile-bodies.js`
  - generates simple reusable `.glb` tile body variants
  - also contains the structural-relief POC path for `flower-1`; that
    path requires regenerated top-map PNGs and is not part of the current
    preprocessed-SVG cutter/inlay pipeline
  - also generates a simple watertight boolean-test body with a flat top
  - writes them to `scripts/output/3d-assets/models`
- `export-svg-cutter.js`
  - generates an SVG-derived cutter GLB for a preprocessed face
  - defaults to `flower-1`; pass a face key such as `d-7` to generate that
    face
  - uses the path-only preprocessed face SVG at
    `scripts/data/3d-assets/prepared-svgs/<tileset-id>/<face-key>.svg`
  - normalizes the preprocessed SVG `viewBox` into an aspect-matched full face
    rectangle so the preprocessed internal label/art alignment is preserved
  - skips white SVG paths for cutter geometry; white paths are visual negative
    space, not recesses
  - unions normalized SVG path solids before export so subtraction sees one
    cleaned cutter volume
  - writes cutter outputs to `scripts/output/3d-assets/models`
- `archive/boolean-carve-tile.js`
  - archived offline boolean subtraction experiment
  - subtracts the SVG-derived `flower-1` cutter from the simple experimental tile body
  - writes the carved result to `scripts/output/3d-assets/models`
- `export-stamped-tile-pair.js`
  - recreates one controlled softened base body per experiment
  - subtracts the selected face cutter from each paired body
  - defaults to `flower-1`; pass a face key such as `d-7` to generate prefixed
    outputs for that face
  - writes `mj-tile-stamp-pair-<face-prefix><variant>-basic.glb` and
    `mj-tile-stamp-pair-<face-prefix><variant>-stamped.glb`
  - writes `mj-tile-stamp-pair-<face-prefix>experiments.json`
  - writes all outputs to `scripts/output/3d-assets/models`
- `export-stamped-tile-inlay.js`
  - loads the baseline stamped tile
  - generates ordered per-path colored inlay meshes from
    `scripts/data/3d-assets/prepared-svgs/<tileset-id>/<face-key>.svg`
  - defaults to `flower-1`; pass a face key such as `d-7` to generate prefixed
    outputs for that face
  - emits material colors directly from the prepared SVG, including standard
    anchor colors and generated shade colors
  - accepts generated PNG/top-map red/green input colors for
    preprocessed SVGs produced by the top-map branch
  - can map white paths to tile-body-colored material when
    regenerating older SVGs, but current preprocessed dot SVGs bake negative
    space into transparent compound-path holes instead of emitting white paint
    paths
  - writes `mj-tile-stamp-pair-<face-prefix>baseline-inlay.glb`
  - writes all outputs to `scripts/output/3d-assets/models`
- `archive/download-wiki-full-set-svgs.js`
  - archived one-time acquisition helper that downloaded SVG originals linked
    from the Wikipedia Mahjong tiles "Full set" section
  - wrote files and `manifest.json` to
    `scripts/data/3d-assets/wiki-source-svgs`
  - the active wiki path now starts from the checked-in source SVGs and
    intakes them with `svg-preprocessor/intake-source-svg-manifest.js`
- `archive/extract-mjt7-face.js`
  - archived one-off experiment that extracts face art from
    `scripts/data/3d-assets/wiki-source-svgs/d-7.svg`
  - flips/recolors it to match local `d-7.png` orientation and palette
  - adds a path-backed upper-left red number marker generated from the local
    Gluten font asset
  - writes one-off overlays under `scripts/output/3d-assets/overlays`
    and `scripts/data/3d-assets/prepared-svgs/d-7.svg`
  - use `run-preprocessed-face-pipeline.js` for current prepared SVG generation
Standard preprocessed face color families:

- black: `#000000`
- white/near-white paint: `#F4F4F4`
- yellow: `#F6F610`
- orange: `#FF9900`
- blue: `#0505D1`
- green: `#2FC906`
- red: `#FC1D05`
- pink/purple: `#BC197A`

The listed values are family anchors, not the only valid prepared-SVG colors.
Current preprocessing can emit darker/lighter shades around those anchors.
Pure `#FFFFFF` remains a cutout/negative-space signal, not paint. Near-white
source paint can be treated as the white family when it is not pure white.

Current preprocessing status:

- The active default sprite-sheet source is
  `scripts/data/3d-assets/sprite-sheets/default.svg`; extracted per-face source
  SVGs live under `scripts/data/3d-assets/sprite-source-svgs/default`.
- The traditional sprite-sheet source has also been split and reviewed through
  the same source-scoped pipeline; traditional prepared SVGs and validation
  artifacts live under the `traditional` tileset id.
- Current default tileset override metadata is
  `scripts/output/3d-assets/metadata-inference/default-sprite-glyphs.json`.
  It is the active override used during the current default tileset
  experiments.
- Output artifacts for prepared SVGs and validation are tileset-scoped:
  prepared SVGs live under `scripts/data/3d-assets/prepared-svgs/<tileset-id>`;
  validation artifacts live under
  `scripts/output/3d-assets/preprocessed/validation/<tileset-id>`.
- The color pipeline now classifies perceived families in OKLCH-like space
  before choosing shade output. When a source color family has no matching
  reference family, the exporter uses the mean of that source family as its
  anchor instead of forcing it into the nearest existing reference color.
- For ordinary/generic faces, the analogous reference component is chosen
  primarily by position/shape; its reference color is the output anchor. This
  prevents cases such as traditional `b-9` where a black source bamboo column
  should still inherit the green of the matching reference bamboo.
- For source/reference overlaps that contain multiple shades, the shade table
  is built from the maximum shade contrast observed for that target reference
  color. The lowest z-order/source-index shade is treated as the base reference
  anchor, with darker and lighter detail distributed around it.
- The default wind source SVGs now keep the dark/black wind character color;
  generated corner wind labels are still red canonical labels.
- Default flowers now mark their source Chinese characters as absent in both
  base metadata and the active default override. Their `梅`, `蘭`, `菊`,
  and `竹` characters are generated from Unicode via the CJK font fallback
  path, currently resolving to `STKAITI.TTF` on Windows.
- After the latest default flower rerun, `flower-1`, `flower-2`, and
  `flower-3` validate as `needs-review`; `flower-4` still reports
  `blocked-overlap` from a tiny generated `竹`/main-art overlap and needs a
  follow-up placement or validation-tolerance review.
- Seasons still use source characters by default and keep
  `character.sourcePresent: true`. Their Unicode meanings are
  `春`, `夏`, `秋`, and `冬`.
- White-dragon handling uses the source white-dragon rectangle when available;
  if the source white dragon lacks a rectangle shape, the dragon family scaling
  box is simulated from the canonical reference padding proportions. Dragon
  artwork is scaled and centered inside that box.
- Merge/join attempts are intended only for component-count mismatches after
  excluding identified number/character glyphs. Generic matching should avoid
  color-run merges when the source and reference already have compatible
  component counts.

Generated output convention:

- `scripts/output/3d-assets/models`
  - generated GLB/JSON model assets consumed by the 3D POC build
  - `poc-models.json` is the generated viewer manifest consumed by
    `src/3d-poc/main/App.jsx`
- `scripts/output/3d-assets/preprocessed/validation`
  - generated validation artifacts, grouped first by tileset id and then by
    artifact type:
    - `reports`
    - `side-by-side`
    - `source-reference-result`
    - `overlays`
    - `diffs`
    - `source-components`
- `scripts/output/3d-assets/overlays`
  - older one-off comparison overlay SVGs

Everything under `scripts/output` is disposable and should be regenerable if
the folder is deleted.

Exception to treat carefully during handoff: active glyph metadata currently
lives under `scripts/output/3d-assets/metadata-inference`. The common
day-to-day files are `tileset-glyphs.json`, `default-sprite-glyphs.json`,
`traditional-sprite-glyphs.json`, and `reference-glyphs.json`. Preserve or
promote these files before deleting `scripts/output` if those decisions should
survive.

Checked-in input asset convention:

- `scripts/data/3d-assets/reference-faces/large-faces`
  - canonical PNG face references used for visual authority and validation
- `scripts/data/3d-assets/reference-faces/faces`
  - smaller PNG references for placement spot checks
- `scripts/data/3d-assets/reference-faces/bodies`
  - body/chrome reference images used by asset research
- `scripts/data/3d-assets/wiki-source-svgs`
  - downloaded/source SVG artwork named with canonical face keys
  - `flower-*.svg` and `season-*.svg` may come from different Wikimedia page
    sections or other source packs; the downloader treats existing local
    copies as protected and must not overwrite them during a full-set refresh
- `scripts/data/3d-assets/other-source-svgs`
  - non-Wikimedia source SVGs needed by current preprocessors
- `scripts/data/3d-assets/sprite-sheets`
  - structured source sprite sheets, such as KDE/libkmahjongg-style full
    tileset SVGs
- `scripts/data/3d-assets/sprite-source-svgs`
  - per-face source SVGs extracted from structured sprite sheets
  - these are source candidates, not canonical prepared SVGs
- `scripts/data/3d-assets/prepared-svgs`
  - canonical path-only prepared face SVGs consumed by cutter and inlay
    exporters
  - current prepared SVGs are stored by tileset id, for example
    `scripts/data/3d-assets/prepared-svgs/default/b-1.svg`
- `scripts/data/3d-assets/generated-images`
  - checked-in generated face reference data used by current scripts
  - currently expected face files are `face-color-full.png`,
    `face-metadata.json`, and limited helper files such as
    `face-color-symbol.png` / `face-cavity.png` where a script still needs them
  - `face-normal.png`, `face-roughness.png`, and `face-height.png` are not
    needed by the current 3D pipeline and have been removed
  - top-map PNGs are not part of the current pipeline; regenerate them
    with `scripts/psd-maps/generate-top-map-resource.js` only when revisiting
    the older heightmap/relief branch
- `scripts/data/3d-assets/fonts`
  - font files needed to convert numbers/letters to path geometry
- `scripts/data/3d-assets/json/asset-pipeline.json`
  - JSON job/config source for downstream 3D asset generation and current POC
    model layout
  - currently defines `wiki-season-2` and `wiki-b-8` jobs using
    `tileset-glyphs.json`

Current stamped branch notes:

- current cutter depth is `0.026`
- current cutter target face rect preserves the preprocessed SVG aspect ratio:
  `targetDepth: 1.08`, `targetWidth: 1.08 * 94 / 136` (`0.7464705882352941`)
- current stamped-pair body softness settings are `radius: 0.105`,
  `segments: 12`, `bevelSize: 0.032`, `bevelThickness: 0.042`, and
  `bevelSegments: 5`
- stamped-pair metadata includes `topSurfaceY` because the body bevel raises
  the actual top above `height / 2`; cutter placement and inlay floor placement
  should use that value
- scaled multi-shoulder stamp edge softening is currently disabled because it
  produced multiple steep terraces and apparent path shifts instead of a soft
  rounded bevel
- the inlay uses thin geometry placed near the cutout floor; current baseline
  values are `thickness: 0.0014` and `floorLift: 0.006`
- a first U-channel colored inlay attempt created noisy fringe geometry and
  has been rolled back to flat color fills
- a direct cutter-bevel experiment was tried and undone because it made the
  cutout too chunky; revisit beveling later with a different method
- the current production direction is offline generation for every face:
  preprocess SVG, export cutter, export stamped body, export inlay; runtime
  should load finished assets and vary materials/scene only
- glass/resin body material remains an option, but the current viewer is back
  to opaque tile bodies while the generated inlay remains opaque

Legacy generated relief POC outputs:

- `mj-tile-relief-poc-flower-1.glb`
- `mj-tile-relief-poc-flower-1.json`

These outputs may still exist under `scripts/output/3d-assets/models`, but the
top-map PNG inputs they came from are no longer checked in because that branch
is not part of the active pipeline.

Current generated boolean-test outputs:

- `mj-tile-boolean-experiment-basic.glb`
- `mj-tile-boolean-experiment-basic.json`

Current generated cutter outputs:

- `mj-tile-cutter-flower-1.glb`
- `mj-tile-cutter-flower-1.json`
- `mj-tile-cutter-d-1.glb`
- `mj-tile-cutter-d-1.json`
- `mj-tile-cutter-d-7.glb`
- `mj-tile-cutter-d-7.json`
- `mj-tile-cutter-wiki-season-2.glb`
- `mj-tile-cutter-wiki-season-2.json`
- `mj-tile-cutter-wiki-b-8.glb`
- `mj-tile-cutter-wiki-b-8.json`

Current generated boolean-carve outputs:

- `mj-tile-boolean-carved-flower-1.glb`
- `mj-tile-boolean-carved-flower-1.json`

Current generated stamped-pair outputs:

- `mj-tile-stamp-pair-<variant>-basic.glb`
- `mj-tile-stamp-pair-<variant>-stamped.glb`
- `mj-tile-stamp-pair-baseline-inlay.glb`
- `mj-tile-stamp-pair-experiments.json`
- `mj-tile-stamp-pair-d-7-<variant>-basic.glb`
- `mj-tile-stamp-pair-d-7-<variant>-stamped.glb`
- `mj-tile-stamp-pair-d-7-baseline-inlay.glb`
- `mj-tile-stamp-pair-d-7-experiments.json`
- `mj-tile-stamp-pair-d-1-<variant>-basic.glb`
- `mj-tile-stamp-pair-d-1-<variant>-stamped.glb`
- `mj-tile-stamp-pair-d-1-baseline-inlay.glb`
- `mj-tile-stamp-pair-d-1-experiments.json`
- `mj-tile-stamp-pair-wiki-season-2-<variant>-basic.glb`
- `mj-tile-stamp-pair-wiki-season-2-<variant>-stamped.glb`
- `mj-tile-stamp-pair-wiki-season-2-baseline-inlay.glb`
- `mj-tile-stamp-pair-wiki-season-2-experiments.json`
- `mj-tile-stamp-pair-wiki-b-8-<variant>-basic.glb`
- `mj-tile-stamp-pair-wiki-b-8-<variant>-stamped.glb`
- `mj-tile-stamp-pair-wiki-b-8-baseline-inlay.glb`
- `mj-tile-stamp-pair-wiki-b-8-experiments.json`

Run from the repo root:

```powershell
node .\scripts\3d-assets\asset-pipeline\export-mj-tile-bodies.js
node .\scripts\3d-assets\asset-pipeline\export-svg-cutter.js
node .\scripts\3d-assets\archive\boolean-carve-tile.js
node .\scripts\3d-assets\asset-pipeline\export-stamped-tile-pair.js
node .\scripts\3d-assets\asset-pipeline\export-stamped-tile-inlay.js
node .\scripts\3d-assets\asset-pipeline\export-svg-cutter.js d-7
node .\scripts\3d-assets\asset-pipeline\export-stamped-tile-pair.js d-7
node .\scripts\3d-assets\asset-pipeline\export-stamped-tile-inlay.js d-7
node .\scripts\3d-assets\svg-preprocessor\split-tileset-sprite-sheet.js scripts\data\3d-assets\sprite-sheets\default.svg
node .\scripts\3d-assets\svg-preprocessor\infer-reference-face-metadata.js
node .\scripts\3d-assets\svg-preprocessor\infer-tileset-face-metadata.js
node .\scripts\3d-assets\svg-preprocessor\run-preprocessed-face-pipeline.js --metadata scripts\output\3d-assets\metadata-inference\tileset-glyphs.json
node .\scripts\3d-assets\asset-pipeline\run-asset-pipeline.js wiki-season-2
node .\scripts\3d-assets\asset-pipeline\run-asset-pipeline.js wiki-b-8
node .\scripts\3d-assets\svg-preprocessor\validate-preprocessed-face.js d-7
node .\scripts\3d-assets\svg-preprocessor\compare-preprocessed-face.js d-7
node .\scripts\3d-assets\svg-preprocessor\inspect-source-svg-components.js d-7
```

Note: `b-8` is a special-case face layout in the local PNG set and should not
be used as a generic bamboo placement/template reference.

Current viewer note: `src/3d-poc/main/App.jsx` is a geometry/material
diagnostic at the moment. It loads `models/poc-models.json` when present,
falling back to a hardcoded list. The current manifest places five opaque-body
generated inlay tiles side by side on the bottom layer with a `0.84` center
step: `d-7`, `flower-1`, `wiki-season-2`, `d-1`, and `wiki-b-8`.
