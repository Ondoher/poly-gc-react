# 3D Asset Pipeline Current Contracts

This is the compact factual anchor for the active 3D asset pipeline docs.
Deeper details live in the linked domain docs.

## Canonical Facts

- Mutable tileset state lives in
  `scripts/output/asset-pipeline/<tilesetId>/pipeline.json`.
- Current pipeline state schema version is `3`.
- The active/known tileset registry lives in
  `scripts/output/asset-pipeline/tilesets.json`.
- Source SVG manifests live in
  `scripts/data/asset-pipeline/manifests/<tilesetId>.json`.
- Intaken source SVG copies live in
  `scripts/output/asset-pipeline/source-svgs/<tilesetId>/<faceKey>.svg`.
- Prepared source SVGs, when produced, live in
  `scripts/output/asset-pipeline/prepared-svgs/<tilesetId>/<faceKey>.svg`.
- Stage outputs live under `scripts/output/asset-pipeline/<tilesetId>/`.

## State Ownership

`PipelineModel` is the canonical state interface for stage runners and server
routes.

- Source review state lives under `svgPipeline.faces[faceKey].state`.
- Component bindings live under `state.bindings`.
- Part state lives under `state.parts`.
- Compact alignment handoff matches live under `state.alignment.matches`.
- Final rendering options live under `rendering`.
- Generated 3D asset state lives under `assetPipeline`.

Binding records use the compact tuple:

```json
{
  "componentId": "src.b-1.0001",
  "partId": "label",
  "strength": "tentative"
}
```

Valid strengths are `none`, `tentative`, `strong`, and `accepted`.

## Implemented Flow

The pipeline app build includes Reference Approval, Optional Part Assignment,
Source Assignment, Final Rendering Options, Asset Base Tile Selection, and
Asset Review. The focused Experiments page is currently disabled in the app.

The server route surface includes state loading, tileset selection, metadata
recreation, source preprocessing, reference-structure load/save, optional
parts, source assignment, final rendering, base tile selection, asset
generation, asset review, and focused cutter-simplification experiment
endpoints retained for manual investigation.

## Generated Asset Facts

Generated asset stages are:

```text
preview-svg -> cutter-2d -> svg-cutter -> stamped-body -> colored-inlay -> preview-png
```

Generation requires a selected base tile variant at
`assetPipeline.baseTileSelection.variantId`. Generated asset readiness is
derived from the current face input hash, selected base tile, rendered SVG,
required artifacts, and per-stage hashes.

The generated stages start from the final-rendering color SVG. The queue runs
a Paper.js SVG-side `unite-all` cutter-2D stage at flatness `0.05`, records the
result as `assetPipeline.faces[faceKey].artifacts.cutterSvg` under
`images/cutter-2d-svg/`, and feeds that SVG to `svg-cutter`. `colored-inlay`
uses the final-rendering color SVG so material/color regions survive the
cutter-2D union pass. `svg-cutter` runs with `--skip-union`. The
final-rendering SVG is still expected to preserve filled `fill-rule="evenodd"`
semantics for visual holes while pruning degenerate evenodd subpaths that can
break Three triangulation.

The active selectable production base tile is variant `mark-iii`, shown in the
app as "Ivory and Bamboo". Mark II and the raw Mark III artist delivery remain
on disk for history/debugging, but they are no longer listed in
`base-tile-manifest.json` and therefore are not Base Tile Selection options.

## Current Checkpoint

As of 2026-06-12:

- A new 2-D face artwork contractor delivery is present at
  `Designs/3d-assets/2d-contractor/`. It currently contains seven zip files:
  `bamboo.zip`, `crack.zip`, `dot 1.zip`, `dragon-grw.zip`,
  `flowers tile.zip`, `nsew tiles.zip`, and `seasons tile.zip`.
- The 2-D artwork delivery has not yet been extracted, inspected, normalized,
  or routed into a source SVG manifest. Intake should follow the Stage 1
  contract: preserve raw authored SVGs as source evidence, associate files
  with canonical face keys, and leave geometry repair or semantic assignment
  to later stages.
- Initial inspection extracted the zips into scratch output at
  `scripts/output/asset-pipeline/delivery-inspection/2d-contractor-20260612/`
  and rendered `contact-sheet.png`. The delivery contains exactly 42 SVGs:
  bamboo 1-9, cracks/characters 1-9, dots 1-9, dragons green/red/white, winds
  north/south/east/west, flowers 1-4, and seasons 1-4.
- All inspected SVGs use `viewBox="0 0 94 136"`, contain no live text, no
  embedded raster images, no `use`, no masks, no clips, no filters, and no
  gradients. They use class-based fills in per-file `<style>` blocks, with
  sparse semantic grouping. The source component extractor read all 42 files
  with zero diagnostics and zero warnings, so they are suitable for a new
  source-manifest intake pass after canonical face-key renaming/mapping.
- The delivery has been promoted as tileset `contractor`. Canonical face-keyed
  source copies live in `scripts/data/asset-pipeline/source-svgs/contractor/`,
  with manifest `scripts/data/asset-pipeline/manifests/contractor.json`.
  Intake wrote `scripts/output/asset-pipeline/contractor/pipeline.json`,
  copied the raw source SVGs into
  `scripts/output/asset-pipeline/source-svgs/contractor/`, and registered the
  tileset in `scripts/output/asset-pipeline/tilesets.json`.
- Source normalization has run for `contractor`: 42 faces, 1402 components,
  1270 alignment components, 1292 source shapes, 1175 alignment shapes, and 0
  warnings. The pipeline app-facing active tileset is now `contractor`.

As of 2026-06-11:

- The contractor delivered `Designs/3d-assets/mark_iii.zip` and
  `Designs/3d-assets/Textures.zip` as follow-up base-tile/material files.
  They have been inspected in scratch output at
  `scripts/output/asset-pipeline/delivery-inspection/mark-iii-20260611/`.
- `mark_iii.zip` contains `Base Tile/BaseTileBody NEW.glb`, a Blender file,
  `BaseTileBody.json.txt`, an included validation script, and material asset
  folders. The GLB keeps the same useful two-mesh split as Mark II:
  `BaseTileBody_Ivory` for the carving target and `baseTileBody_wood` for the
  preserved bamboo insert after GLTFLoader name sanitization.
- Mark III has been promoted as base tile variant `mark-iii`, labeled "Ivory
  and Bamboo", with normalized GLB
  `scripts/data/3d-assets/models/base-tiles/mark-iii.glb`, metadata
  `mark-iii.json`, and manifest entry in `base-tile-manifest.json`.
- The delivered Mark III GLB was in artist axes, with measured scene bounds
  approximately X `0.79`, Y `1.08`, Z `0.50`. The promoted pipeline copy is
  normalized to generated-asset coordinates, with X width, Y carving
  thickness, and Z face depth. Validation reports assembly bounds X `0.79`,
  Y `0.50`, Z `1.08`, centered at origin.
- `Textures.zip` contains full texture-map folders for `Bamboo wood`,
  `Bone textures`, `Ivory front`, and `Wood 124`, plus a nested
  `Textures.zip`. Several files have artist-friendly `.jpg`/`.tif`
  extensions while image inspection reports PNG-encoded contents, so texture
  ingestion should inspect actual image metadata rather than trust extensions.
- The promoted Mark III texture folder is
  `scripts/data/3d-assets/models/base-tiles/mark-iii-textures/`. It currently
  contains 1024px PNG diffuse/base-color maps derived from
  `Designs/3d-assets/Textures.zip`: the bamboo role uses
  `Textures/Bamboo wood/wood08_diffuse.jpg`, and the ivory/front role uses
  `Textures/Ivory front/lvory_diffuse.jpg`. `mark-iii.json` points these
  material roles at the promoted PNGs used by base-tile selection and
  generated stamped/final GLB export.
- Base Tile Selection now loads declared per-variant `textureMap` assets for
  its GLB preview materials before falling back to procedural preview
  textures. This lets Mark III visually differ from Mark II in the selector
  even though their two-piece mesh structure is very similar.
- The raw artist-delivered Mark III GLB remains available at
  `scripts/data/3d-assets/models/base-tiles/mark-iii-artist-delivery.glb` for
  visual comparison/debugging, but it is no longer shown in Base Tile
  Selection.
- Inspection showed the artist GLB looks better primarily because its bamboo
  material uses authored UV channel 1 with embedded diffuse, normal,
  roughness/metalness, and specular maps. The earlier normalized Mark III GLB
  kept the geometry/UV attributes but replaced materials with flat colors, and
  Base Tile Selection then overrode preview UVs/materials. The promoted
  `mark-iii.glb` has been regenerated from the artist delivery with pipeline
  axes while preserving the embedded material stack, and Mark III metadata now
  declares `previewMaterialSource: "embedded"` so the selector does not
  replace those materials.
- The normalized Mark III ivory/front material now also embeds the
  `Textures/Ivory front/lvory_diffuse.jpg` diffuse map and
  `Textures/Ivory front/Ivory_normal_opengl.jpg` normal map on UV channel 1,
  so the top/front no longer renders as flat white while retaining the
  artist/pipeline coordinate contract.
- `validate-base-tile-asset.js` now validates whole-assembly bounds when a
  base tile declares support/preserve meshes while still requiring the named
  carving mesh. This matches Mark II and Mark III two-piece base tile
  contracts.
- Mark III queue investigation showed the generated asset stages could finish
  and write the preview PNG while the CLI/server queue appeared stuck. The
  cause was the preview renderer's shared Puppeteer browser lifecycle:
  `browser.connected` was not a reliable connection check for the installed
  Puppeteer API, so `getBrowser()` launched a second browser and only closed
  that later instance. The renderer now uses `browser.isConnected()` when
  available, falls back to boolean `browser.connected`, and treats unknown
  browser objects as connected. The preview CLI also closes the shared preview
  renderer in a `finally` block, so one-off queue stage runs release Chromium
  after writing `preview-png`.
- Mark III also exposed two assumptions that Mark II did not: its mesh nodes
  carry non-identity transforms even though their world-space bounds match
  Mark II, and its artist materials use secondary UV channels. Stamped-body
  export now bakes source mesh world transforms into cloned geometry instead
  of applying the transform to the clone object and then resetting it, so
  Mark III carving stays aligned to the `+Y` face. Stamped-body placement now
  derives `topSurfaceY` from the selected base tile body rather than allowing
  cutter metadata from an older variant to override it. Variants that declare
  embedded preview materials keep those embedded materials in generated export
  instead of receiving channel-0 replacement texture maps; this preserves
  Mark III bamboo/support texture wiring. The CSG evaluator is configured with
  material-required UV attributes, and cutter geometry receives placeholder
  UV attributes where needed, so the carved Mark III ivory mesh now retains
  `uv1` for its channel-1 artist material after boolean subtraction.

As of 2026-06-09:

- [SVG Stage Summary](svg-processing/svg-stage-summary.md) is the focused SVG
  handoff document. It records normalization meta-goals, current normalizer
  behavior for complex SVGs, final-rendering shaping rules, and cutter
  limitations.
- Source normalization is understood as a provenance-rich geometry inventory
  stage. It should make source artwork legible, preserve origin evidence,
  separate visual structure from semantic meaning, avoid face-specific rules,
  and hand off data the next stage can reliably consume.
- The current normalizer is intentionally not a full browser SVG engine. It
  handles supported geometry/text tags, group inheritance, simple class paint,
  limited transforms, compound-path island/band splitting, source-use grouping,
  tile/background filtering, literal-white and near-white neutral
  negative-space filtering, and bounded opaque paint-layer flattening.
- Generated asset stages currently use final-rendering color SVGs, not prepared
  SVGs. Prepared SVG export remains future work behind visual approval.
- Mark II base tile assets remain promoted in
  `scripts/data/3d-assets/models/base-tiles/mark-ii.glb` and `mark-ii.json`,
  with the manifest entry preserved.
- Mark II stamped-body and colored-inlay generation now carry configured
  support/preserve meshes, including the bamboo/back insert, through the final
  output while carving only the ivory/front mesh.
- Mark II material preview textures are promoted under
  `scripts/data/3d-assets/models/base-tiles/mark-ii-textures/` and embedded
  into generated stamped/final GLBs. The artist GLB itself preserves material
  names but does not include texture maps.
- Base Tile Selection enriches manifest variants with their per-variant
  metadata for review display. Its GLB selector preview applies generated
  ivory/bamboo material textures by mesh name and deliberately does not apply
  the promoted preview-sphere PNGs as UV texture maps. Each selector card also
  exposes a larger 3D preview dialog using the same selector-only material
  preview path.
- The Mark II generated-asset code experiments for cutter clustering,
  multi-mesh stamped output, inlay depth/overlap handling, and hole-fill
  synthesis were reverted back to the last committed pipeline code after
  visual review showed they had become too aggressive. The key unresolved
  design issue is that the bird body should not be carved as a filled region;
  only the visible blue linework/details should become recess geometry.
- Traditional generated 3D outputs were cleared after the failed Mark II
  queue runs: `models/svg-cutter`, `models/stamped-body`,
  `models/colored-inlay`, `json/svg-cutter`, `json/stamped-body`,
  `json/colored-inlay`, and `images/generated-asset-preview-png` are empty.
- The `traditional` `assetPipeline` state was reset to an empty generated-asset
  section with `baseTileSelection.variantId` still set to `mark-ii`, and the
  persisted generation queue is empty.
- Base tile selection stages missing/stale generated assets into the persisted
  queue when the tileset is idle.
- Asset Review now has Cancel and Reset controls. Cancel stops queued
  generated-asset work by clearing the persisted queue, live queue snapshot,
  and `assetPipeline` runtime queue/build fields. Reset performs the same
  cancel work, clears only generated 3D asset folders, and resets only
  `assetPipeline` generated face state to ungenerated while preserving the
  selected base tile variant and all SVG preprocessing state.
- `svg-cutter` now emits structured stdout progress for parse, extrude,
  normalize, union, and export phases. The queue runner streams those records
  into Asset Review as live `stageProgress` so long cutter runs show active
  phase/count/percent without changing generated geometry or persisted
  readiness contracts. Blocking 3D union work now runs in a worker thread
  owned by `export-svg-cutter.js`, keeping the cutter main thread available
  to emit heartbeat pings and drive the secondary Asset Review activity bar.
- A focused Paper.js SVG-side union experiment is available for generated
  asset validation. The `default/season-1` face has been pointed at
  `paper-united-all` experiment artifacts generated with `svg-cutter
  --skip-union`, with stamped body, colored inlay, and preview outputs written
  under `scripts/output/asset-pipeline/default/experiments/paper-flatten/`.
- Known residual risk: generated asset preview PNG rendering still depends on
  Puppeteer/Chromium availability, but the Mark III queue hang caused by a
  leaked extra browser process has been fixed and verified with a Mark III
  `b-1` generated preview run.

## Doc Map

- [State](contracts/state.md) owns mutable state shape.
- [Stage Order](contracts/stage-order.md) owns stage order and gates.
- [SVG Stage Summary](svg-processing/svg-stage-summary.md) owns SVG input/output
  boundaries.
- [Artifacts](contracts/artifacts.md) owns artifact roles and paths.
- [Routes And Queue](pipeline-runtime/routes-and-queue.md) owns routes, CLIs,
  and queue behavior.
- [Future Work](archive/future-work.md) owns unimplemented desired work.
