# Document Migration Phases

## Purpose

This plan turns `agents/topics.bak` into the new `agents/topics` structure
without copying old clutter forward wholesale. Each phase should leave the new
tree more useful for bootstrap, routing, and active development.

## Principles

- Migrate meaning, not folders.
- Keep `agents/topics.bak` intact until migrated docs are verified.
- Prefer concise index, status, contract, and runbook docs over giant mixed
  ledgers.
- Move large assets to `references` or a repo data/design location instead of
  keeping them in active topic memory.
- Update active-topic reload sources as documents move.
- After migrating a doc, remove stale duplicate guidance or mark the old source
  as superseded during final cleanup.

## Phase 0: Stabilize The New Shell

Goal: make the new tree safe for bootstrap before migrating content.

Status: complete.

Tasks:

- Confirm [Agent Topics](../README.md), [Bootstrap](../context/bootstrap.md),
  and [Routing](../context/routing.md) describe the new structure correctly.
- Keep [Active Topic](../active-topic.md) pointed at
  `documentation-restructure` while migration work is active.
- Add missing README anchors for directories that should survive in git.
- Avoid moving old content until the new routing names feel settled.

Exit criteria:

- A new session can bootstrap from `agents/topics` without opening
  `agents/topics.bak` unless it needs migration source material.

Status note:

- Phase 0 can be structurally complete before Phase 1, once the shell,
  routing, active-topic file, and README anchors exist.
- Phase 0 should be fully closed after Phase 1, because the bootstrap path
  depends on real standards content, especially the architecture overview.

## Phase 1: Standards First

Goal: migrate low-ambiguity, repo-wide guidance.

Status: complete for the first migration pass.

Targets:

- `topics.bak/architecture` -> `standards/architecture`
- `topics.bak/testing` -> `standards/testing`
- `topics.bak/deployment` -> `standards/deployment`
- `topics.bak/react-code` -> `standards/react-code`
- `topics.bak/components` -> `standards/components`
- `topics.bak/scripts` -> `standards/scripts`

Tasks:

- Move the full architecture overview into
  `standards/architecture/overview.md`.
- Split architecture docs into overview, REMVC, feature mechanics, build and
  assets, and randomness.
- Keep scripts docs focused on conventions only; move tile-generation and
  asset-generation meaning to product docs later.
- Rewrite standards READMEs as routing pages rather than content dumps.

Exit criteria:

- Bootstrap architecture context no longer depends on `topics.bak`.
- Standards docs contain only cross-product conventions.

Deferred:

- The scripts standard intentionally keeps only general script guidance. Old
  Mahjongg tile CSS and difficulty script details will move during the Game
  Collection phase. Asset Pipeline 3D, SAT, and Flat script details will move
  with their owning phases.

## Phase 2: Asset Pipeline 3D

Goal: migrate the largest active concentrated domain into focused docs.

Status: complete for the first migration pass.

Decision notes:

- Split `svg-stage-contracts.md` aggressively: create one doc per stage plus a
  summary/overview doc.
- Start contract migration mostly as-is, with light path and naming edits.
  Rebalance and polish content in a later pass.
- Leave contractor package assets where they are in `topics.bak` until Phase 5.
- Mine `real-3d-rendering` for current-state diagnostic viewer or material
  facts only. Archive sparingly; do not preserve long running histories of
  past decisions or failed branches unless they still explain current state.

Targets:

- `topics.bak/3d-asset-pipeline`
- `topics.bak/pipeline-app`
- selected useful material from `topics.bak/real-3d-rendering`

Tasks:

- Move current status into `products/asset-pipeline-3d/status.md`.
- Move compact cross-topic facts into
  `products/asset-pipeline-3d/summary.md`.
- Split contracts into `contracts/` by state, artifacts, stage order,
  source/review, rendering, and generated assets.
- Split SVG-stage material into `svg-processing/` by overview,
  one doc per stage, plus a summary/overview doc.
- Move generated-model notes into `generated-models/` for base tiles,
  SVG cutter, stamped body, colored inlay, and preview PNGs.
- Move queue, route, progress, and Chromium preview docs into
  `pipeline-runtime/`.
- Move pipeline app shell/review-page docs into `pipeline-app/`.
- Move contractor briefs and palette notes into `contractor-handoff/`.
- Leave contractor package assets in `topics.bak` for now; move binary
  packages, images, and zips during Phase 5.

Exit criteria:

- Active 3D asset-pipeline work can use the new product docs without reading
  old 3D topic folders.
- `real-3d-rendering` has no remaining unique active top-level ownership.

Completed notes:

- Status, summary, contracts, SVG processing docs, runtime docs, pipeline-app
  docs, contractor handoff docs, generated-model docs, and experiment docs now
  exist under `products/asset-pipeline-3d`.
- The old SVG stage contract is split into one summary plus stage 00 through
  stage 14 docs.
- Contractor package assets remain in `topics.bak` for Phase 5.

## Phase 3: Game Collection

Goal: merge scattered Mahjongg and game-collection notes into one product
area while leaving room for restored games.

Status: complete for the first migration pass.

Decision notes:

- `mvp` has been evaluated against current code and confirmed as historical.
  Keep only a brief archive summary of delivered first-release scope.
- Progressive Web App notes belong under the Game Collection `gc-app` area.
  PWA is currently implemented only for Mahjongg/GC, not as a repo-wide
  standard.
- `engine-refactor` and `experimental-engine` are live engine work and should
  stay active under Mahjongg Solitaire engine docs.
- Difficulty history remains active because difficulty modeling is ongoing
  research.

Targets:

- `topics.bak/mj`
- `topics.bak/difficulty`
- `topics.bak/scaling`
- `topics.bak/css-animations`
- `topics.bak/engine-refactor`
- `topics.bak/telemetry-analysis`
- historical summary from `topics.bak/mvp`
- app-shell material from `topics.bak/progressive-web-app`

Tasks:

- Create a concise Game Collection status doc.
- Move Mahjongg-specific engine notes under
  `mahjongg-solitaire/engine`.
- Move difficulty docs under `mahjongg-solitaire/difficulty`.
- Move layout and control notes under `mahjongg-solitaire/layout`.
- Move tile metrics and responsive board behavior under
  `mahjongg-solitaire/scaling`.
- Move play/win animation notes under `mahjongg-solitaire/animation`.
- Move solver/tooling notes under `mahjongg-solitaire/solver-analysis`.
- Move telemetry notes under `mahjongg-solitaire/telemetry`.
- Put cross-game shell, routing, PWA, and deployment-facing game app notes
  under `game-collection/gc-app`.
- Put future restored-game notes under `restored-games`, not under Mahjongg.

Exit criteria:

- The top-level product is Game Collection, not Mahjongg.
- Mahjongg remains well documented but no longer blocks future game docs.

Completed notes:

- Mahjongg layout, scaling, animation, solver-analysis, telemetry, difficulty,
  and engine-refactor docs now live under `products/game-collection`.
- Progressive Web App notes now live under `gc-app`.
- MVP is historical and represented only by [MVP Summary](../../archive/mvp-summary.md).
- The difficulty solver PDF remains in `topics.bak` until the references phase.

## Phase 4: Deployable Apps

Goal: move unrelated deployable app docs into app-specific homes.

Status: complete for the first migration pass.

Targets:

- `topics.bak/sat-app`
- `topics.bak/flat`
- app-surface notes for `gc` and `pipeline`

Tasks:

- Split Flat's large README into `README.md`, `status.md`, plans, and
  decisions.
- Move Flat projection and false-simulation details into focused docs.
- Move SAT status, city-index generation, geospatial model, and deployment
  notes into `apps/sat`.
- Keep `apps/gc` and `apps/pipeline` as app-surface docs that link back to
  their owning product docs.

Exit criteria:

- SAT and Flat can be worked on without loading game or asset-pipeline docs.
- App docs describe deployable surfaces; product docs own domain meaning.

Completed notes:

- SAT app status, reference notes, and prototype script now live under
  `apps/sat`.
- Flat app docs now live under `apps/flat`; the old mixed README is preserved
  intact as `status.md`.
- Flat prompt, ProjectionModel API draft, and POC Phase 1 plan were copied
  into focused docs.
- Flat has a migration decision note that records why the first pass preserved
  the large old README instead of splitting every section immediately.
- `apps/gc` and `apps/pipeline` remain app-surface docs that point back to
  their owning product documentation.

## Phase 5: References And Assets

Goal: remove large supporting assets from active topic memory.

Status: complete for the first migration pass.

Targets:

- images under `topics.bak/real-3d-rendering`
- PDFs under `topics.bak/difficulty`
- contractor zips and extracted packages under `topics.bak/3d-asset-pipeline`
- palettes and visual references mixed into topic docs

Tasks:

- Move reference-only images to `references/images` or
  `references/3d-materials`.
- Move PDFs to `references/pdfs` or `references/research`.
- Move contractor packages to `references/contractor-packages` or a better
  repo data/design location.
- Leave short topic links pointing to the new reference locations.

Exit criteria:

- Recursive topic scans mostly see text docs, not large binary payloads.
- Active docs link to references instead of embedding storage responsibility.

Completed notes:

- Created a repo-level `references/` folder with domain folders for
  Asset Pipeline 3D, Game Collection, and real-3d-rendering visual references.
- Moved the Asset Pipeline 3D contractor package ZIP and extracted contractor
  package folder to `references/asset-pipeline-3d/contractor-packages`.
- Moved the standalone palette builder SVG to
  `references/asset-pipeline-3d/palettes`.
- Moved the Mahjongg Solitaire solver paper PDF to
  `references/game-collection/mahjongg-solitaire/difficulty/research`.
- Moved real-3d-rendering material images and tile variation image sets to
  `references/real-3d-rendering`.
- Updated active docs to link to the new reference locations.
- Verified the key PDF, contractor ZIP, and palette SVG hashes after moving.
- Verified the old selected source folders no longer contain PDF, ZIP, image,
  SVG, CSV, or JSON reference assets.

## Phase 6: Archive And Compatibility Cleanup

Goal: make the old tree clearly historical.

Status: started.

Tasks:

- Package the remaining `agents/topics.bak` tree before external archive
  removal.
- Move stale exploratory docs into `archive`.
- Add superseded notes only where old links are likely to be used during the
  transition.
- Update `AGENTS.md` bootstrap paths to the new tree.
- Update active-topic reload sources to new paths.
- Search for references to `agents/topics.bak` and replace them where active.
- Decide whether `topics.bak` remains as a long-term archive, moves under
  `agents/topics/archive`, or is deleted after verification.

Exit criteria:

- No active bootstrap or routing doc depends on `topics.bak`.
- New docs are authoritative.
- Old docs are either migrated, archived, or explicitly marked historical.

Completed notes:

- Created `archives/docs/topics.bak.zip` from the remaining
  `agents/topics.bak` tree on 2026-06-12.
- Verified the zip exists and contains 103 entries.
- Left `agents/topics.bak` in place; the user plans to move `archives/docs`
  out of the repo next.

## Suggested Batch Size

Migrate one coherent topic group per work session:

- one standard folder
- one asset-pipeline contract cluster
- one SVG-processing cluster
- one Mahjongg subarea
- one app

After each batch, update the relevant status or restructure docs with:

- what moved
- what was intentionally left behind
- what old doc is now superseded
- what links still need repair
