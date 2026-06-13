# Documentation Restructure Plan

## Goal

Replace the old flat topic folder with a purpose-first documentation tree:

- `context` for bootstrap and routing
- `standards` for repo-wide engineering conventions
- `products` for durable product and domain knowledge
- `apps` for deployable app surfaces
- `references` for large supporting material
- `archive` for historical notes

## Design Decisions

- The Game Collection is a product. Mahjongg Solitaire is the current
  concentration, not the whole product.
- Asset Pipeline 3D is a product/domain of its own. It currently serves
  Mahjongg assets, but it should not be nested under Mahjongg.
- `real-3d-rendering` is retired as a top-level topic. Its useful content will
  be absorbed into Asset Pipeline 3D, app docs, references, or archive.
- `scripts` is a standards topic, not a domain. Domain-specific script meaning
  belongs with the owning product or app.
- `sat` and `flat` live under `apps` because the repo is becoming a deployable
  monorepo for unrelated apps.
- Binary assets, PDFs, zips, and image sets should move out of active topic
  docs and into `references` or a repo data/design folder.
- Asset Pipeline 3D SVG stage migration should split the old
  `svg-stage-contracts.md` into one doc per stage plus a summary.
- Asset Pipeline 3D contracts should be migrated mostly as-is first, with a
  later balancing/correction pass.
- Contractor package assets should stay in `topics.bak` until the references
  phase.
- Old `real-3d-rendering` material should become current-state documentation
  only; archive sparingly and avoid keeping long historical failure logs unless
  they still explain current behavior.
- For Game Collection migration, Progressive Web App material belongs under
  `gc-app`; engine-refactor is live work; difficulty history remains active
  research; `mvp` is historical and should be represented only by a brief
  archive summary.

## Migration Map

- `architecture` -> `standards/architecture`
- `testing` -> `standards/testing`
- `deployment` -> `standards/deployment`
- `react-code` -> `standards/react-code`
- `components` -> `standards/components`
- `scripts` -> `standards/scripts`, plus owner-specific product/app docs
- `mj` -> `products/game-collection/mahjongg-solitaire`
- `difficulty` -> `products/game-collection/mahjongg-solitaire/difficulty`
- `scaling` -> `products/game-collection/mahjongg-solitaire/scaling`
- `css-animations` -> `products/game-collection/mahjongg-solitaire/animation`
- `engine-refactor` -> `products/game-collection/mahjongg-solitaire/engine`
- `telemetry-analysis` -> `products/game-collection/mahjongg-solitaire/telemetry`
- `mvp` -> `products/game-collection` or `archive`, depending freshness
- `progressive-web-app` -> `products/game-collection/gc-app` or
  `standards/architecture`
- `3d-asset-pipeline` -> `products/asset-pipeline-3d`
- `pipeline-app` -> `products/asset-pipeline-3d/pipeline-app`
- `real-3d-rendering` -> absorb into `products/asset-pipeline-3d`,
  `apps`, `references`, or `archive`
- `sat-app` -> `apps/sat`
- `flat` -> `apps/flat`

## Migration Order

For the detailed phase-by-phase checklist, use
[Document Migration Phases](migration-phases.md).

1. Keep `topics.bak` intact as the source archive.
2. Create routing stubs in the new tree.
3. Move small standards docs first because they have low domain ambiguity.
4. Split the Asset Pipeline 3D docs by contract, SVG processing, generated
   models, runtime, pipeline app, contractor handoff, and experiments.
5. Merge Mahjongg-related topics under Game Collection / Mahjongg Solitaire.
6. Move app-specific SAT and Flat docs into `apps`.
7. Move large assets and external references out of topic memory.
8. Archive stale exploratory notes.
9. Update `AGENTS.md` bootstrap paths once the new tree is stable.

Current status:

- Phase 0 is complete.
- Phase 1 is complete for the first migration pass.
- Phase 2 is complete for the first migration pass.
- Phase 3 is complete for the first migration pass.
- Phase 4 is complete for the first migration pass.
- Phase 5 is complete for the first migration pass.
- `AGENTS.md` now points bootstrap architecture and naming-convention links at
  the new standards paths.

## Bootstrap Target

Future bootstrap should load:

1. `agents/topics/active-topic.md`
2. `agents/topics/context/bootstrap.md`
3. `agents/topics/context/routing.md`
4. `agents/topics/standards/architecture/overview.md`
5. The active topic README
6. Focused reload sources named by the active topic

## Next Work

- Start Phase 6 archive and compatibility cleanup.
- Decide how long `agents/topics.bak` remains as the transition archive after
  active references are replaced or intentionally documented as historical.
- Add redirect notes or compatibility paths for common old links while the
  migration is in progress.

Phase 5 completed source groups:

- `agents/topics.bak/real-3d-rendering`
- `agents/topics.bak/difficulty`
- `agents/topics.bak/3d-asset-pipeline`

Phase 5 target groups:

- `references/asset-pipeline-3d/contractor-packages`
- `references/asset-pipeline-3d/palettes`
- `references/game-collection/mahjongg-solitaire/difficulty/research`
- `references/real-3d-rendering/material-references`
- `references/real-3d-rendering/tile-variations`
